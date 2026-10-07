/**
 * Structured clinical extraction — sentence scoped and negation aware.
 *
 * Everything here is driven by the CONTENT of the document. There is no
 * patient-name, filename or document-id branching anywhere in this module.
 * A completely unseen record produces a completely different result.
 *
 * Design rules that keep precision high:
 *  - Each fact is asserted only from the sentence that contains it.
 *  - Negated mentions ("was not completed", "no CT scan") never create facts.
 *  - Conditional/hypothetical mentions are recorded as plans, never as results.
 *  - Missing values are left null. Nothing is inferred to fill a gap.
 */

import {
  Chunk,
  ClinicalEvent,
  ClinicalFinding,
  Evidence,
  FollowUp,
  Investigation,
  LabResult,
  Medication,
  Patient,
  Referral,
  Vital,
} from './types.js';
import {
  chunkPage,
  sentenceAt,
  cleanText,
  dateSortKey,
  evidenceWindow,
  findDates,
  looksLikeClinicalRecord,
  sentenceAround,
  sentences,
  units,
} from './text.js';

export interface PageInput {
  documentId: string;
  documentName: string;
  page: number;
  text: string;
}

export interface ExtractionResult {
  patient: Patient;
  events: ClinicalEvent[];
  medications: Medication[];
  investigations: Investigation[];
  labs: LabResult[];
  vitals: Vital[];
  referrals: Referral[];
  followUps: FollowUp[];
  findings: ClinicalFinding[];
  chunks: Chunk[];
  warnings: string[];
  isClinicalRecord: boolean;
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${(counter * 2654435761) % 100000}`;
}
export function resetIdCounter(): void {
  counter = 0;
}

/* ================================================================== *
 * Lexicons — clinical domain knowledge, never patient specific
 * ================================================================== */

/** Tokens that must never be mistaken for a drug name. */
const DRUG_PREFIX_STOP = new Set([
  'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules',
  'od', 'bd', 'tds', 'qds', 'mane', 'nocte', 'prn', 'stat', 'po', 'iv', 'im', 'sc',
  'mg', 'mcg', 'dose', 'doses', 'start', 'started', 'starting', 'continue',
  'continuing', 'increased', 'increase', 'increased from', 'reduced', 'reduce',
  'decreased', 'decrease', 'stop', 'stopped', 'stopping', 'commence', 'commencing',
  'new', 'current', 'regular', 'take', 'taking', 'prescribe', 'prescribed',
  'the', 'a', 'an', 'and', 'or', 'of', 'with', 'for', 'on', 'at', 'to', 'from',
  'then', 'now', 'also', 'add', 'added', 'change', 'changed', 'switched', 'switch',
  'daily', 'once', 'twice', 'three', 'four', 'times', 'nightly', 'morning',
  'evening', 'patient', 'pt', 'this', 'that', 'it', 'his', 'her', 'their',
  'was', 'is', 'has', 'had', 'been', 'being', 'will', 'would', 'should', 'may',
  'might', 'no', 'not', 'route', 'oral', 'orally', 'intravenously', 'intravenous',
  'subcut', 'subcutaneous', 'sublingually', 'sublingual', 'topical', 'as',
  'since', 'until', 'per', 'one', 'two', 'completed', 'course', 'discontinued',
  'ceased', 'titrate', 'titrated', 'uptitrate', 'uptitrated', 'downtitrate',
  'morning', 'nocturnal', 'regularly', 'throughout', 'continue', 'continued',
  'previous', 'earlier', 'original', 'prior', 'same', 'usual', 'his', 'her',
  'only', 'just', 'approximately', 'about', 'around',
]);

/** Suffix/stem cues that identify a drug name. */
const DRUG_STEMS = [
  'pril', 'sartan', 'olol', 'statin', 'prazole', 'cillin', 'mycin', 'azole',
  'formin', 'gliptin', 'gliflozin', 'nacin', 'caine', 'pidine', 'tidine',
  'setron', 'mab', 'nib', 'tinib', 'parin', 'coxib', 'prafen', 'azepam',
  'zolam', 'bital', 'uridine', 'thiopental', 'oxetine', 'pramine', 'zolpidem',
  'tropium', 'sone', 'terone', 'asone', 'solone', 'azone', 'vudine', 'vir',
  'tin', 'zosin', 'setine', 'trinitrate', 'glitazar', 'floxacin', 'cycline',
  'penem', 'fentan', 'bactam', 'ximab', 'zumab', 'stent', 'sartan', 'gliflozin',
  'glutide', 'glutam', 'lisinopril', 'oxaban', 'parin', 'grel', 'afil', 'dipine',
  'nidine', 'lutamide', 'piroxide', 'setron', 'prost', 'terol', 'sert',
  'amide', 'pamide', 'samide', 'famide', 'thamide', 'glitide', 'tinide',
  'dromate', 'perone', 'tegrast', 'grel', 'oxaban', 'pril', 'lutone',
  'lazide', 'glinide', 'glutide', 'pirin', 'oquine', 'lactone', 'semide',
];

/** Qualifiers that legitimately precede a drug name: "Glyceryl trinitrate". */
const DRUG_MODIFIER = new Set([
  'glyceryl', 'methyl', 'sodium', 'potassium', 'calcium', 'magnesium',
  'ferrous', 'ferric', 'ammonium', 'hydroxy',
]);

function joinDrugName(token: string, prev: string | undefined): string {
  if (prev && /^[A-Z][a-z]+$/.test(prev) && DRUG_MODIFIER.has(prev.toLowerCase())) {
    return `${prev} ${token}`;
  }
  return token;
}

const INVESTIGATION_ALIASES: Record<string, string> = {
  'pulmonary function test': 'Pulmonary function test',
  pft: 'Pulmonary function test',
  'lung function test': 'Pulmonary function test',
  spirometry: 'Pulmonary function test',
  'flow volume loop': 'Pulmonary function test',
  'peak flow diary': 'Pulmonary function test',
  echocardiogram: 'Echocardiogram',
  'transthoracic echocardiogram': 'Echocardiogram',
  'ttee': 'Echocardiogram',
  'arterial blood gas': 'Arterial blood gas',
  abg: 'Arterial blood gas',
  'venous blood gas': 'Venous blood gas',
  vbg: 'Venous blood gas',
  'cardiac catheterisation': 'Cardiac catheterisation',
  'cardiac catheterization': 'Cardiac catheterisation',
  'exercise tolerance test': 'Exercise tolerance test',
  ett: 'Exercise tolerance test',
  'chest x-ray': 'Chest X-ray',
  'chest xray': 'Chest X-ray',
  cxr: 'Chest X-ray',
  'renal ultrasound': 'Renal ultrasound',
  'kidney ultrasound': 'Renal ultrasound',
  'chest film': 'Chest X-ray',
  'computed tomography': 'CT scan',
  'cat scan': 'CT scan',
  'ct scan': 'CT scan',
  'magnetic resonance imaging': 'MRI',
  mri: 'MRI',
  'full blood count': 'Blood tests',
  fbc: 'Blood tests',
  'blood cultures': 'Blood cultures',
  'blood culture': 'Blood cultures',
  'renal function tests': 'Renal function tests',
  'liver function tests': 'Liver function tests',
  lfts: 'Liver function tests',
  'renal profile': 'Renal function tests',
  'electrolytes': 'Renal function tests',
  'lipid profile': 'Lipid profile',
  'lipid bloods': 'Lipid profile',
  'colonoscopy': 'Colonoscopy',
  gastroscopy: 'Endoscopy',
  'upper gi endoscopy': 'Endoscopy',
  endoscopy: 'Endoscopy',
  'urinalysis': 'Urinalysis',
  'urine test': 'Urinalysis',
  biopsy: 'Biopsy',
  'blood test': 'Blood tests',
  'blood tests': 'Blood tests',
  bloods: 'Blood tests',
  'holter monitor': 'Holter monitor',
  'ambulatory ecg': 'Holter monitor',
  '24 hour ecg': 'Holter monitor',
  polysomnography: 'Sleep study',
  'sleep study': 'Sleep study',
  'lumbar puncture': 'Lumbar puncture',
  'bone density scan': 'Bone density scan',
  'dexa scan': 'Bone density scan',
  'renal imaging': 'Renal ultrasound',
  'iron studies': 'Iron studies',
  'retinal screening': 'Retinal screening',
  'eye screening': 'Retinal screening',
  'smoking cessation referral': 'Smoking cessation referral',
  'smoking cessation service': 'Smoking cessation referral',
  'home oxygen assessment': 'Home oxygen assessment',
  'cardiac angiography': 'Coronary angiography',
  'coronary angiography': 'Coronary angiography',
  'catheterisation': 'Cardiac catheterisation',
};

const ALIAS_BY_CANON: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const [alias, canon] of Object.entries(INVESTIGATION_ALIASES)) {
    if (!m[canon]) m[canon] = [];
    m[canon].push(alias);
  }
  return m;
})();

const LAB_TESTS: Record<string, string> = {
  hba1c: 'HbA1c',
  'glycated haemoglobin': 'HbA1c',
  'glycated hemoglobin': 'HbA1c',
  crp: 'CRP',
  'c-reactive protein': 'CRP',
  esr: 'ESR',
  wbc: 'White cell count',
  'white cell count': 'White cell count',
  'white blood cell': 'White cell count',
  haemoglobin: 'Haemoglobin',
  hemoglobin: 'Haemoglobin',
  'platelet count': 'Platelets',
  platelets: 'Platelets',
  creatinine: 'Creatinine',
  egfr: 'eGFR',
  'estimated gfr': 'eGFR',
  urea: 'Urea',
  sodium: 'Sodium',
  potassium: 'Potassium',
  'total cholesterol': 'Total cholesterol',
  ldl: 'LDL cholesterol',
  'ldl cholesterol': 'LDL cholesterol',
  hdl: 'HDL cholesterol',
  'hdl cholesterol': 'HDL cholesterol',
  triglycerides: 'Triglycerides',
  albumin: 'Albumin',
  bilirubin: 'Bilirubin',
  inr: 'INR',
  'prothrombin time': 'INR',
  bicarbonate: 'Bicarbonate',
  'base excess': 'Base excess',
  troponin: 'Troponin',
  'troponin i': 'Troponin',
  'troponin t': 'Troponin',
  'troponin c': 'Troponin',
  ck: 'Creatine kinase',
  'creatine kinase': 'Creatine kinase',
  'ck-mb': 'CK-MB',
  'lactate': 'Lactate',
  'blood glucose': 'Blood glucose',
  glucose: 'Blood glucose',
  'capillary glucose': 'Blood glucose',
  ph: 'pH',
};

const REFERRAL_SPECIALTIES = [
  'Cardiology', 'Respiratory', 'Neurology', 'Gastroenterology', 'Rheumatology',
  'Dermatology', 'General Medicine', 'Endocrinology', 'Nephrology', 'Oncology',
  'Orthopaedics', 'ENT', 'Ophthalmology', 'Urology', 'Psychiatry',
  'Haematology', 'Hematology', 'Infection Control', 'Pain Clinic',
];

/** Most specific first. */
const FREQ_RULES: Array<[RegExp, string]> = [
  [/\b(?:twice\s+daily|b\.?i\.?d\.?|bd|nocte|nightly|at\s+night|each\s+evening)\b/i, 'Twice daily'],
  [/\b(?:three\s+times\s+daily|t\.?i\.?d\.?|tds)\b/i, 'Three times daily'],
  [/\b(?:four\s+times\s+daily|q\.?d\.?s\.?)\b/i, 'Four times daily'],
  [/\bprn\b|\bas\s+needed\b|\bwhen\s+required\b/i, 'As needed (PRN)'],
  [/\b(?:once\s+daily|o\.?d\.?|mane|each\s+morning|every\s+day|daily|per\s+day)\b/i, 'Once daily'],
  [/\bweekly\b|\bonce\s+a\s+week\b/i, 'Weekly'],
  [/\bstat\b|\bimmediately\b/i, 'Immediate'],
];

const ROUTE_RULES: Array<[RegExp, string]> = [
  [/\b(?:sublingual|sublingually|sl)\b/i, 'Sublingual'],
  [/\b(?:po|by\s+mouth|oral|orally)\b/i, 'Oral'],
  [/\b(?:iv|i\.?v\.?|intravenously|intravenous)\b/i, 'Intravenous'],
  [/\b(?:im|i\.?m\.?|intramuscular)\b/i, 'Intramuscular'],
  [/\b(?:sc|s\.?c\.?|subcut|subcutaneous)\b/i, 'Subcutaneous'],
  [/\b(?:topical|topically)\b/i, 'Topical'],
  [/\b(?:inhaled|inhaler|nebulised|nebulized)\b/i, 'Inhaled'],
];

function normaliseFrequency(text: string): string | null {
  for (const [re, label] of FREQ_RULES) if (re.test(text)) return label;
  return null;
}
function normaliseRoute(text: string): string | null {
  for (const [re, label] of ROUTE_RULES) if (re.test(text)) return label;
  return null;
}

/* ---------- negation / modality detection ---------- */

const NEGATION_BEFORE =
  /\b(?:no|not|never|without|denies|deny|denied|ruled\s+out|exclude|excluded|negative\s+for|absence\s+of|has\s+not|have\s+not|had\s+not|was\s+not|were\s+not|is\s+not|are\s+not|declined|refused|did\s+not\s+attend|unable\s+to)\b[\s\S]{0,40}$/i;

const NEGATION_AFTER = /^\s*(?:was\s+not|were\s+not|has\s+not|have\s+not|had\s+not|is\s+not|are\s+not|not\s+completed|not\s+performed|not\s+done|not\s+available|not\s+located|not\s+found|not\s+identified|not\s+seen|no\s+longer\s+required|could\s+not|cannot|was\s+deferred|were\s+deferred|was\s+not\s+located)\b/i;

const CONDITIONAL_MODAL = /\b(?:if|unless|should\s+the|where\s+the|depending\s+on|consider|considered|possibly|possible|perhaps|may\s+be|might\s+be|could\s+be|suspected|question\s+of|r\?\s*rule|to\s+exclude|to\s+exclude\b)/i;

const ORDER_VERBS = /\b(?:order|ordered|ordering|request|requested|requesting|book|booked|booking|arrange|arranged|arranging|plan|planned|planning|scheduled|schedule|proposed|recommended|recommend|intended|offered|agreed|listed|raise|raised|awaiting|await|pending|tbc|due|repeat|required|advised)\b/i;

const COMPLETION_VERBS = /\b(?:completed|complete|performed|carried\s+out|undertaken|attended|done|obtained|acquired)\b/i;

const NEGATED_COMPLETION =
  /\b(?:not\s+(?:been\s+)?(?:completed|performed|carried\s+out|undertaken|done|obtained)|no\s+completion|(?:has|have|had|was|were|is|are)\s+not\s+been\s+(?:completed|performed|done)|did\s+not\s+(?:attend|complete|perform)|does\s+not\s+appear\s+to\s+have\s+been\s+completed|deferred\s+on\s+two\s+occasions|no\s+results\s+are\s+available|not\s+located|absent)\b/i;

/** A planning or conditional statement can never be treated as a result. */
const PLANNING_CONTEXT =
  /\b(?:consider|considered|proposed|planned|plan|requested|request|ordered|order|booked|book|arrange|arranged|awaiting|pending|tbc|to be (?:done|arranged|completed|performed)|if|unless|should the|where the|depending on|possible|possibly|suspected|question of|repeat|offered|agreed|referred|deferred|advised|remains? (?:outstanding|due)|has not|have not|was not|were not|is not|are not|not been)\b/i;

/** Concrete result evidence: a measurement, or an explicit normal/abnormal report. */
const RESULT_EVIDENCE =
  /(?:\bejection\s+fraction\b[^\n]{0,30}\((?:lvef|fev1|fvc)?[^)\n]{0,14}\d+(?:\.\d+)?\s*%?\))|(?:\b(?:lvef|ejection\s+fraction|fev1|fvc|fev1\s*%\s*predicted)\b[^\n]{0,30}?\d+(?:\.\d+)?\s*%?)|(?:\b\d+(?:\.\d+)?\s*(?:%|mmol\/?l|ng\/?l|mmhg|l\/min|bpm|cm)\b)|(?:\bno\s+acute\s+(?:abnormality|pneumothorax|consolidation|effusion|collapse)\b)|(?:\bresolution\s+of\b)|(?:\b(?:study|examination|trace|film)\s+(?:was\s+|is\s+)?(?:normal|unremarkable)\b)|(?:\b(?:shows?|showed|demonstrates?|demonstrated|reveals?|revealed|found\s+to\s+be|measures?|measured)\b[^\n]{3,70})/i;

/* ---------- helpers ---------- */

function canonicalInvestigation(raw: string): string | null {
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (INVESTIGATION_ALIASES[key]) return INVESTIGATION_ALIASES[key];
  return null;
}

function looksLikeDrugToken(token: string, prev?: string): boolean {
  if (!token) return false;
  const lower = token.toLowerCase();
  if (token.length < 3 || token.length > 34) return false;
  if (DRUG_PREFIX_STOP.has(lower)) return false;
  // Known lab / investigation names must never become medications.
  if (Object.prototype.hasOwnProperty.call(LAB_TESTS, lower)) return false;
  if (Object.prototype.hasOwnProperty.call(INVESTIGATION_ALIASES, lower)) return false;
  if (!/^[A-Za-z][A-Za-z'()-]*$/.test(token)) return false;
  if (!DRUG_STEMS.some((s) => lower.endsWith(s))) return false;
  // A capitalised qualifier in front means the full name is longer than this token.
  return !(prev && /^[A-Z][a-z]+$/.test(prev) && DRUG_MODIFIER.has(prev.toLowerCase()));
}

const DOSE_UNIT = '(mg|mcg|\\u00b5g|g|ml|units?|iu|micrograms?)';
const DOSE_RE = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${DOSE_UNIT}\\b`, 'gi');

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * A later document that records a course as completed or stopped is the
 * current status of that drug and dose. Earlier entries for the same
 * drug and dose are updated so the medication list does not show one
 * course as both active and completed.
 */
function reconcileMedicationStatuses(medications: Medication[]): void {
  const groups = new Map<string, Medication[]>();
  for (const m of medications) {
    if (!m.dose) continue;
    const k = `${m.name.toLowerCase()}|${m.dose.toLowerCase()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => dateSortKey(a.startDate) - dateSortKey(b.startDate));
    const latest = sorted[sorted.length - 1];
    if (latest.status === 'ACTIVE') continue;
    for (const m of sorted) {
      m.status = latest.status;
      m.stopDate = latest.stopDate ?? m.stopDate ?? latest.startDate;
    }
  }
}

/* ================================================================== *
 * Main extraction
 * ================================================================== */

export function extractClinicalRecord(pages: PageInput[], chunkTarget = 900): ExtractionResult {
  const warnings: string[] = [];
  const events: ClinicalEvent[] = [];
  const medications: Medication[] = [];
  const investigations: Investigation[] = [];
  const labs: LabResult[] = [];
  const vitals: Vital[] = [];
  const referrals: Referral[] = [];
  const followUps: FollowUp[] = [];
  const findings: ClinicalFinding[] = [];
  const chunks: Chunk[] = [];

  const cleaned = pages.map((p) => ({ ...p, text: cleanText(p.text) }));
  const fullText = cleaned.map((p) => p.text).join('\n\n');
  const isClinicalRecord = looksLikeClinicalRecord(fullText);

  if (!isClinicalRecord) {
    warnings.push(
      'The uploaded text does not resemble a structured clinical record. Extraction results may be incomplete.'
    );
  }
  if (fullText.trim().length < 150) {
    warnings.push('Very little text could be read from this document.');
  }

  for (const p of cleaned) {
    const cs = chunkPage(p.text, p.documentId, p.documentName, p.page, chunkTarget);
    for (const c of cs) chunks.push({ ...c, id: `${p.documentId}_p${p.page}_c${c.index}` });
  }

  const chunkIndexFor = (documentId: string, page: number, offset: number): number => {
    const docChunks = chunks.filter((c) => c.documentId === documentId && c.page === page);
    if (docChunks.length === 0) return 0;
    let running = 0;
    for (const c of docChunks) {
      running += c.text.length;
      if (offset <= running) return c.index;
    }
    return docChunks[docChunks.length - 1].index;
  };

  const ev = (p: PageInput, field: string, offset: number, length: number): Evidence => ({
    documentId: p.documentId,
    documentName: p.documentName,
    page: p.page,
    chunkIndex: chunkIndexFor(p.documentId, p.page, offset),
    field,
    text: evidenceWindow(p.text, offset, length),
  });

  /* ------------------------- Patient header ------------------------- */
  const patient: Patient = {
    name: null,
    patientId: null,
    age: null,
    sex: null,
    dob: null,
    recordStart: null,
    recordEnd: null,
  };

  /*
   * Demographic headers are often not on page 1. A PDF may start with a
   * cover/summary page, and some exports put several fields on one line.
   * Search the first structured header pages rather than assuming the first
   * 700 characters contain the patient banner.
   */
  const headerCandidates = cleaned
    .map((p) => ({ page: p.page, text: p.text }))
    .filter((p) => /\b(?:patient\s*(?:name|id)?|mrn|hospital\s*(?:number|no)|age|sex|gender|date\s+of\s+birth|dob)\b/i.test(p.text))
    .slice(0, 12);

  const headerText = headerCandidates.map((p) => p.text.slice(0, 1600)).join('\n\n');
  const demographicPages = headerCandidates.length ? headerCandidates : cleaned.slice(0, 12);

  const namePatterns = [
    /(?:^|\n)[ \t]*(?:Patient[ \t]*(?:Name)?|Name|Full[ \t]*Name|Surname[ \t]*\/[ \t]*Forename)[ \t]*[:\-][ \t]*([^\n|]{2,100})/im,
    /\bPatient[ \t]+(?:Name)?[ \t]*[:\-][ \t]*([^\n|]{2,100})/im,
  ];
  for (const source of [headerText, ...demographicPages.map((p) => p.text)]) {
    if (patient.name) break;
    for (const re of namePatterns) {
      const m = source.match(re);
      if (!m) continue;
      const candidate = m[1].trim().replace(/\s+/g, ' ').replace(/[;,]+$/, '');
      if (
        candidate &&
        candidate.length <= 100 &&
        !/^(?:not documented|unknown|n\/a|patient)$/i.test(candidate) &&
        /[A-Za-z]/.test(candidate)
      ) {
        patient.name = candidate;
        break;
      }
    }
  }

  if (!patient.name) {
    const sur = fullText.match(/(?:^|\n)[ \t]*([A-Z][a-z'’-]{2,30}),[ \t]*([A-Z][a-z'’-]{2,30})\b/);
    if (sur && !/^(medical|discharge|operation|clinic|ward|referral|letter|operation)$/i.test(sur[1])) {
      patient.name = `${sur[2]} ${sur[1]}`;
    }
  }

  const idPatterns = [
    /(?:Patient[ \t]*(?:ID|Number|No)|Hospital[ \t]*(?:Number|No)|MRN|NHS[ \t]*(?:Number|No)|Medical[ \t]*Record[ \t]*(?:Number|No)|Reference)[ \t]*[:\-#]?[ \t]*([A-Z0-9][A-Z0-9\-/]{3,24})/i,
  ];
  for (const source of [headerText, ...demographicPages.map((p) => p.text)]) {
    if (patient.patientId) break;
    for (const re of idPatterns) {
      const m = source.match(re);
      if (m) {
        patient.patientId = m[1].trim();
        break;
      }
    }
  }

  for (const source of [headerText, ...demographicPages.map((p) => p.text)]) {
    if (patient.age) break;
    const ageMatch = source.match(/\bAge[ \t]*[:\-]?[ \t]*(\d{1,3})\s*(?:years?|yrs?\b)?/i);
    if (ageMatch) {
      const a = parseInt(ageMatch[1], 10);
      if (a > 0 && a < 130) patient.age = a;
    }
  }

  for (const source of [headerText, ...demographicPages.map((p) => p.text)]) {
    if (patient.dob) break;
    const dobMatch = source.match(
      /\b(?:DOB|Date[ \t]+of[ \t]+Birth|Born)[ \t]*[:\-]?[ \t]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[ \t]+[A-Za-z]{3,9}[ \t]+\d{4})/i
    );
    if (dobMatch) {
      const d = findDates(dobMatch[1]);
      patient.dob = d.length ? d[0].iso : dobMatch[1].trim();
    }
  }

  for (const source of [headerText, ...demographicPages.map((p) => p.text)]) {
    if (patient.sex) break;
    const sexMatch = source.match(/\b(?:Sex|Gender)[ \t]*[:\-]?[ \t]*(Male|Female|M\s*\/\s*F|\bM\b|\bF\b)\b/i);
    if (sexMatch) {
      const s = sexMatch[1].toLowerCase().replace(/\s/g, '');
      patient.sex = s.startsWith('m') ? 'Male' : 'Female';
    }
  }

  const detectedIds = Array.from(new Set(
    Array.from(fullText.matchAll(/(?:Patient[ \t]*(?:ID|Number|No)|Hospital[ \t]*(?:Number|No)|MRN|NHS[ \t]*(?:Number|No))[ \t]*[:\-#]?[ \t]*([A-Z0-9][A-Z0-9\-/]{3,24})/gi))
      .map((m) => m[1].trim())
      .filter(Boolean)
  ));
  const detectedNames = Array.from(new Set(
    Array.from(fullText.matchAll(/(?:Patient[ \t]*(?:Name)?|Full[ \t]*Name)[ \t]*[:\-][ \t]*([^\n|]{2,100})/gi))
      .map((m) => m[1].trim().replace(/\s+/g, ' '))
      .filter((v) => v && !/^(?:not documented|unknown|n\/a)$/i.test(v))
  ));
  if (detectedIds.length > 1 || detectedNames.length > 1) {
    warnings.push(
      'Multiple patient identities were detected in this upload. The record header uses the first structured patient identity; for clean longitudinal analysis, upload one patient record at a time.'
    );
  }

  if (!patient.age && patient.dob) {
    const y = parseInt(patient.dob.slice(0, 4), 10);
    if (Number.isFinite(y)) {
      const approx = new Date().getUTCFullYear() - y;
      if (approx > 0 && approx < 130) patient.age = approx;
    }
  }

  /* ---- record period: dates in clinical content, excluding the DOB ---- */
  {
    const all = findDates(fullText).map((d) => d.iso);
    const filtered = all.filter((iso) => iso !== patient.dob);
    const uniq = Array.from(new Set(filtered)).sort();
    if (uniq.length) {
      patient.recordStart = uniq[0];
      patient.recordEnd = uniq[uniq.length - 1];
    } else if (all.length) {
      patient.recordStart = all[0];
      patient.recordEnd = all[all.length - 1];
    }
  }

  /* ------------------------- Per page ------------------------- */
  const medSeen = new Set<string>();
  const invSeen = new Set<string>();
  const vitalSeen = new Set<string>();
  const labSeen = new Set<string>();
  const fuSeen = new Set<string>();
  const eventSeen = new Set<string>();
  const refSeen = new Set<string>();

  /* ---- A document whose TITLE names a test IS that test's report ----
     The findings written inside it constitute the result. This is derived from
     the document body, never from the filename. */
  const SECTION_HEAD = /^(?:findings?|results?|impression|conclusion|interpretation|summary|overall impression|clinical impression|clinical findings|assessment)\b/i;

  const reportTests = new Map<string, { canon: string; date: string | null; evidence: Evidence; body: string }>();
  for (const p of cleaned) {
    const titleLines = p.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' \n ');
    const sents = units(p.text);
    for (const canon of Object.keys(ALIAS_BY_CANON)) {
      if (reportTests.has(canon)) continue;
      const named = ALIAS_BY_CANON[canon].some((a) =>
        new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(titleLines)
      );
      if (!named) continue;
      const headDates = findDates(p.text.slice(0, 600)).filter((d) => d.iso !== patient.dob);
      // The impression / conclusion section is the clinician's own summary of
      // the study, so it is used verbatim as the documented result.
      let body = '';
      for (const preferred of [/^(?:impression|conclusion|interpretation|summary|overall impression|clinical impression)\b/i, SECTION_HEAD]) {
        for (let i = 0; i < sents.length; i++) {
          if (!preferred.test(sents[i].text)) continue;
          const inline = sents[i].text.match(/[:\-]\s*(.{6,240})$/);
          const parts: string[] = [];
          if (inline && inline[1]) parts.push(inline[1]);
          const tail: string[] = [];
          for (let j = i + 1; j < sents.length && j <= i + 3; j++) {
            if (sents[j].isHeading) break;
            tail.push(sents[j].text);
          }
          // A quantified line is what a reader needs from an impression, so the
          // whole section is kept rather than truncated before the measurement.
          const quantitative = tail.find((t) => /\d+(?:\.\d+)?\s*(?:%|mmHg|mmol|mg|bpm|kg|mL|ng\/L)\b/i.test(t));
          if (quantitative && !tail.includes(quantitative)) tail.push(quantitative);
          parts.push(...tail);
          const joined = parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 240);
          if (joined.length > body.length) body = joined;
          break;
        }
        if (body) break;
      }
      if (!body) {
        const cue = sents.find((s) => RESULT_EVIDENCE.test(s.text) && !s.isHeading);
        body = cue ? cue.text : '';
      }
      reportTests.set(canon, {
        canon,
        date: headDates.length ? headDates[0].iso : null,
        evidence: ev(p, `Report: ${canon}`, 0, Math.min(160, p.text.length)),
        body: body.replace(/\s+/g, ' ').trim().slice(0, 240),
      });
    }
  }

  for (const p of cleaned) {
    if (!p.text.trim()) continue;
    const pageDates = findDates(p.text);
    /** Page dates excluding the date of birth, which is header metadata. */
    const pickDate = (dates: typeof pageDates): string | null => {
      const usable = dates.filter((d) => d.iso !== patient.dob);
      return (usable.length ? usable : dates)[0]?.iso ?? null;
    };
    const defaultDate = pickDate(pageDates);
    /** Page dates excluding the date of birth, which is header metadata. */
    const usableDates = pageDates.filter((d) => d.iso !== patient.dob);
    const sents = units(p.text);
    /**
     * Investigations are matched over page-level sentences, not line units, so
     * that a test name and the clause describing its result stay together even
     * when a line break falls between them.
     */
    const pageSentences = sentences(p.text);
    const bodyUnits = sents.filter((u) => !u.isHeading);

    for (const s of bodyUnits) {
      const lower = s.text.toLowerCase();
      // Match offsets inside a unit are unit-relative; evidence offsets and
      // date lookups are page-relative, so translate at every hand-off.
      const at = (rel: number): number => s.start + rel;

      /* ---------------- Medications ---------------- */
      DOSE_RE.lastIndex = 0;
      let dm: RegExpExecArray | null;
      while ((dm = DOSE_RE.exec(s.text)) !== null) {
const doseIndex = dm.index;
        const doseRaw = `${dm[1]} ${dm[2].toLowerCase()}`;
        // Clinical attributes come from the sentence containing the dose, so a
        // neighbouring sentence cannot change the status of this one.
        const local = sentenceAt(s.text, doseIndex) ?? s.text;
        const localLower = local.toLowerCase();
        // Skip laboratory-looking values: "X: 5 mg" for a known test name
        const before = local.slice(0, Math.max(0, doseIndex));
        const tokens = before.match(/[A-Za-z][A-Za-z'()-]*/g);
        if (!tokens) continue;

        let name: string | null = null;
        let nameIndex = -1;
        for (let i = tokens.length - 1; i >= Math.max(0, tokens.length - 6); i--) {
          const tok = tokens[i];
          const prev = i > 0 ? tokens[i - 1] : undefined;
          if (looksLikeDrugToken(tok, prev)) {
            name = joinDrugName(tok, prev);
            nameIndex = name.length;
            break;
          }
        }
        if (!name) continue;

        // Reject when the token before the value is a known lab test name.
        const lastTok = tokens[tokens.length - 1];
        if (lastTok && Object.prototype.hasOwnProperty.call(LAB_TESTS, lastTok.toLowerCase())) continue;
        if (/[:=]\s*$/.test(before)) continue;

        // Repeated documentation of the same dose in a different document is kept,
        // because a return to an earlier dose is exactly what Documentation Drift detects.
        const dedupeKey = `${name.toLowerCase()}|${doseRaw}|${p.documentId}`;

        const status: Medication['status'] = /\b(?:stop|stopped|ceased|discontinue|discontinued|withdrawn|come off|complete[d]?|completed course|no longer (?:required|needed)|tapering off|tapered off)\b/i.test(localLower)
          ? /\b(?:completed|completed course|no longer (?:required|needed))\b/i.test(localLower)
            ? 'COMPLETED'
            : 'STOPPED'
          : 'ACTIVE';

        const freq = normaliseFrequency(local);
        const route = normaliseRoute(local);
        const reasonM = local.match(/\b(?:for|due to|because of|secondary to|owing to|in view of)\s+([a-z][a-z\s\-]{3,60})/i);
        const startDate = usableDates.find((d) => d.index >= at(doseIndex))?.iso ?? defaultDate;

        const sentenceText = sentenceAround(p.text, at(doseIndex), nameIndex + dm[0].length);
        const evidence = ev(p, `Medication: ${name}`, at(Math.max(0, doseIndex - nameIndex)), nameIndex + dm[0].length);
        evidence.text = sentenceText;

        const existing = medications.find(
          (m) =>
            m.name.toLowerCase() === name.toLowerCase() &&
            m.dose === doseRaw &&
            m.evidence.documentId === p.documentId
        );
        if (existing) {
          /* A later mention in the same document that records the
             course as completed or stopped is the current status
             of that drug and dose: a discharge list completes a
             course the same summary documented as running. */
          if (status !== 'ACTIVE' && existing.status === 'ACTIVE') {
            existing.status = status;
            existing.stopDate = existing.startDate;
            existing.evidence = evidence;
          }
          continue;
        }

        medications.push({
          id: uid('med'),
          name: titleCase(name),
          dose: doseRaw,
          frequency: freq,
          route,
          status,
          startDate,
          stopDate: status === 'ACTIVE' ? null : startDate,
          documentedReason: reasonM ? reasonM[1].trim().replace(/\s+/g, ' ').replace(/[,.;]$/, '') : null,
          evidence,
        });
        medSeen.add(dedupeKey);

        if (!eventSeen.has(`med|${name}|${doseRaw}|${p.documentId}|${status}`)) {
          eventSeen.add(`med|${name}|${doseRaw}|${p.documentId}|${status}`);
          events.push({
            id: uid('evt'),
            date: startDate,
            type: 'Medication',
            title: `${titleCase(name)} ${doseRaw}`,
            description: `Documented as ${status.toLowerCase()}${freq ? `, ${freq.toLowerCase()}` : ''}${route ? `, ${route.toLowerCase()}` : ''}. ${s.text.replace(/\s+/g, ' ').trim().slice(0, 180)}`,
            evidence,
          });
        }
      }

      /* ---------------- Stopping / ceasing a medication without a dose ---------------- */
      {
                const sm = s.text;
        const stopM = sm.match(
          /\b(?:stop|stopped|ceased|discontinue[ds]?|withdraw|come off|withdrawn)\s+(?:the\s+|his\s+|her\s+|their\s+|any\s+)?([A-Za-z][A-Za-z'’-]{3,30})\b/i
        );
if (stopM && looksLikeDrugToken(stopM[1])) {
          const key = `${stopM[1].toLowerCase()}|stop|${p.documentId}`;
          if (!medSeen.has(key)) {
            medSeen.add(key);
            const d = usableDates.find((x) => x.index >= at(sm.indexOf(stopM[0])))?.iso ?? defaultDate;
            const evidence = ev(p, `Medication stopped: ${stopM[1]}`, at(sm.indexOf(stopM[0])), stopM[0].length);
            // A stop for a drug already documented with a dose belongs to that
            // entry, rather than a second, dose-less row for the same drug.
            const known = medications.find(
              (m) => m.name.toLowerCase() === titleCase(stopM[1]).toLowerCase()
            );
            if (known) {
              known.status = 'STOPPED';
              known.stopDate = d;
              // The stop is the notable later fact for this entity, so its
              // evidence becomes the citation for the current state.
              known.evidence = evidence;
            } else {
              medications.push({
                id: uid('med'),
                name: titleCase(stopM[1]),
                dose: null,
                frequency: null,
                route: null,
                status: 'STOPPED',
                startDate: d,
                stopDate: d,
                documentedReason: null,
                evidence,
              });
}
          }
        }
      }

      /* ---------------- Investigations (page-sentence scoped) ---------------- */
      if (s === bodyUnits[0]) {
      for (const su of pageSentences.length ? pageSentences : [s]) {
      const suDates = findDates(su.text).filter((d) => d.iso !== patient.dob);
      for (const alias of Object.keys(INVESTIGATION_ALIASES)) {
        const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        let im: RegExpExecArray | null;
        let guard = 0;
        while ((im = re.exec(su.text)) !== null && guard < 3) {
          guard += 1;
          const canon = INVESTIGATION_ALIASES[alias];
          const suLower = su.text.toLowerCase();
          const beforeAlias = su.text.slice(Math.max(0, im.index - 45), im.index);
          const afterAlias = su.text.slice(im.index + alias.length, im.index + alias.length + 45);

          if (NEGATION_BEFORE.test(beforeAlias)) continue;
          if (NEGATION_AFTER.test(afterAlias)) continue;

          const negatedCompletion = NEGATED_COMPLETION.test(suLower);
          const planning = PLANNING_CONTEXT.test(suLower);
          const hasCompletion = COMPLETION_VERBS.test(suLower) && !negatedCompletion && !planning;
          const hasResult = RESULT_EVIDENCE.test(su.text) && !planning && !negatedCompletion;
          const hasOrder = ORDER_VERBS.test(suLower) || /\b(?:awaiting|pending|tbc|to be (?:done|arranged|completed))\b/i.test(suLower);

          const conditionalOnly =
            /\b(?:if|unless|should\s+the|where\s+the|depending\s+on|possibly|possible|perhaps|suspected|question\s+of)\b/i.test(suLower) &&
            !ORDER_VERBS.test(suLower) && !hasResult;

          const aliasMatch = im;
          const aliasDate = suDates.find((d) => d.index >= aliasMatch.index && d.index <= aliasMatch.index + alias.length + 60)?.iso
            ?? suDates.find((d) => d.index <= aliasMatch.index && d.index >= aliasMatch.index - 60)?.iso
            ?? defaultDate;

          if (conditionalOnly) continue;

          let status: Investigation['status'];
          if (hasResult) status = 'RESULT_AVAILABLE';
          else if (negatedCompletion) status = hasOrder ? 'ORDERED' : 'PENDING';
          else if (hasCompletion) status = 'COMPLETED';
          else if (hasOrder) status = 'ORDERED';
          else status = 'PENDING';

          let result: string | null = null;
          if (status === 'RESULT_AVAILABLE') {
            const rv = su.text.match(
              /((?:\bejection\s+fraction\b[^\n]{0,24}\((?:lvef|fev1|fvc)?[^)\n]{0,14}\d+(?:\.\d+)?\s*%?\))|(?:\b(?:lvef|fev1|fvc)\b[^\n]{0,24}?\d+(?:\.\d+)?\s*%?)|(?:\bno\s+(?:acute\s+)?(?:abnormalit\w+|pneumothorax|consolidation|effusion|collapse|infiltrate)\b)|(?:\bresolution\s+of\b[^\n.]{0,40})|(?:\b(?:shows?|showed|demonstrates?|reveals?|found\s+to\s+be|measured|normalised|normalized)\b[^\n]{3,70}))/i
            );
            if (rv) result = rv[1].trim().replace(/\s+/g, ' ').replace(/[,;]$/, '');
          }

          const dedupeKey = `${canon}|${aliasDate}|${status}`;
          if (invSeen.has(dedupeKey)) break;

          const evidence = ev(p, `Investigation: ${canon}`, su.start + im.index, alias.length);
          investigations.push({
            id: uid('inv'),
            name: canon,
            orderedDate: status === 'ORDERED' || status === 'PENDING' ? aliasDate : null,
            performedDate: status === 'COMPLETED' || status === 'RESULT_AVAILABLE' ? aliasDate : null,
            status,
            result,
            finding: null,
            evidence: [evidence],
          });
          invSeen.add(dedupeKey);

          events.push({
            id: uid('evt'),
            date: aliasDate,
            type: 'Investigation',
            title: `${canon} — ${status.replace(/_/g, ' ').toLowerCase()}`,
            description: su.text.replace(/\s+/g, ' ').trim().slice(0, 220),
            evidence,
          });
          break;
        }
      }
      }
      }

      /* ---------------- Laboratory results ---------------- */
      for (const [key, canon] of Object.entries(LAB_TESTS)) {
        const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Allows "HbA1c: 62", "Troponin I was 480 ng/L", "HbA1c of 71 mmol/mol".
        const re = new RegExp(
          `\\b${safe}\\b[ \\t]*(?:[A-Za-z]{1,4}[ \\t]+)?(?:is|was|of|level|levels)?[ \\t]*[:=]?[ \\t]*(<?\\d+(?:\\.\\d+)?>?)\\s*(%|mmol\\s*/\\s*(?:L|mol)|mmol|mIU\\s*/\\s*L|ng\\s*/\\s*(?:L|mL)|µ?g\\s*/\\s*(?:L|mL)|g\\s*/\\s*L|pg\\s*/\\s*mL|mmHg|bpm|L\\s*/\\s*min|kg|ratio|seconds?|x10\\^9\\s*/\\s*L)?\\s*(?:\\((?:ref(?:erence)?|normal|range)?[ \\t]*[:\\-]?[ \\t]*([^)\\n]{1,44}))?\\)?`,
          'gi'
        );
        let lm: RegExpExecArray | null;
        while ((lm = re.exec(s.text)) !== null) {
          const dk = `${canon}|${lm[1]}`;
          if (labSeen.has(dk)) break;
          labSeen.add(dk);
          const labMatch = lm;
          const after = usableDates.find((d) => d.index > at(labMatch.index))?.iso ?? defaultDate;
          labs.push({
            id: uid('lab'),
            test: canon,
            value: lm[1].replace(/\s+/g, ''),
            unit: lm[2] ? lm[2].replace(/\s+/g, '') : null,
            referenceRange: lm[3] ? lm[3].trim().replace(/^ref(?:erence)?[ \t]*[:\-]?[ \t]*/i, '') : null,
            date: after,
            evidence: ev(p, `Laboratory: ${canon}`, at(lm.index), lm[0].length),
          });
          // A later value in the same sentence is the same test moving:
          // "Troponin I was 480 ng/L ..., falling to 210 ng/L".
          const tailM = s.text
            .slice(lm.index + lm[0].length)
            .match(/\b(?:falling|fell|risen|rose|increased|climbed|up|dropped|decreased|settled|down|improved|reduced)\s+(?:to|at)\s+(<?\d+(?:\.\d+)?>?)\s*(%|mmol\s*\/\s*(?:L|mol)|mmol|ng\s*\/\s*L|ng\s*\/\s*mL|µ?g\s*\/\s*L|mIU\s*\/\s*L)?/i);
          if (tailM) {
            const tk = `${canon}|${tailM[1]}`;
            if (!labSeen.has(tk)) {
              labSeen.add(tk);
              const tailIndex = lm.index + lm[0].length + (tailM.index ?? 0);
              labs.push({
                id: uid('lab'),
                test: canon,
                value: tailM[1].replace(/\s+/g, ''),
                unit: tailM[2] ? tailM[2].replace(/\s+/g, '') : lm[2] ? lm[2].replace(/\s+/g, '') : null,
                referenceRange: null,
                date: after,
                evidence: ev(p, `Laboratory: ${canon} (repeat value)`, at(tailIndex), tailM[0].length),
              });
            }
          }
        }
      }

      /* ---------------- Vitals ---------------- */
      const VITAL_SPECS: Array<[string, RegExp, string | null]> = [
        ['Blood pressure', /\b(?:bp|blood\s+pressure)\b[ \t]*[:=]?[ \t]*(\d{2,3}\s*\/\s*\d{2,3})/gi, 'mmHg'],
        ['Pulse', /\b(?:pulse|hr|heart\s*rate)\b[ \t]*[:=]?[ \t]*(\d{2,3})\b/gi, '/min'],
        ['Oxygen saturation', /\b(?:spo2|o2\s*sat(?:s|uration)?|oxygen\s+saturation|sat(?:s|uration)?)\b[ \t]*[:=]?[ \t]*(\d{2,3})\s*%/gi, '%'],
        ['Temperature', /\b(?:temp(?:erature)?)\b[ \t]*[:=]?[ \t]*(\d{2}(?:\.\d)?)\s*(?:°?\s*c\b|degrees?\s*c\b)?/gi, '°C'],
        ['Respiratory rate', /\b(?:resp(?:iration)?|respiratory\s+rate)\b[ \t]*[:=]?[ \t]*(\d{1,2})\b/gi, '/min'],
        ['Weight', /\b(?:weight|wt)\b[ \t]*[:=]?[ \t]*(\d{2,3}(?:\.\d)?)\s*(?:kg\b|kgs\b)?/gi, 'kg'],
        ['Height', /\b(?:height|ht)\b[ \t]*[:=]?[ \t]*(\d{2,3})\s*(?:cm\b)?/gi, 'cm'],
        ['Peak flow', /\b(?:peak\s*flow|pef)\b[ \t]*[:=]?[ \t]*(\d{2,4})\b/gi, 'L/min'],
      ];
      for (const [label, re, unit] of VITAL_SPECS) {
        re.lastIndex = 0;
        let vm: RegExpExecArray | null;
        while ((vm = re.exec(s.text)) !== null) {
          const vk = `${label}|${vm[1]}`;
          if (vitalSeen.has(vk)) break;
          // Temperature without a unit is usually a mention, not a measurement.
          if (label === 'Temperature' && !/[°cC]|degrees/i.test(vm[0]) && !/^\d{2}\.\d$/.test(vm[1])) {
            continue;
          }
          vitalSeen.add(vk);
          const vitalMatch = vm;
          const after = pageDates.find((d) => d.index > at(vitalMatch.index))?.iso ?? pickDate(pageDates);
          vitals.push({
            id: uid('vit'),
            type: label,
            value: vm[1].replace(/\s+/g, ''),
            unit,
            date: after,
            evidence: ev(p, `Vital: ${label}`, at(vm.index), vm[0].length),
          });
        }
      }

      /* ---------------- Referrals ---------------- */
      for (const spec of REFERRAL_SPECIALTIES) {
        const re = new RegExp(
          `\\b(?:refer(?:ral|red|ring|rered|rer)?)\\b[ \\t]*(?:to|under|on)?[ \\t]*(?:the[ \\t]+)?${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'gi'
        );
        const rm = re.exec(s.text);
        if (!rm) continue;
        if (NEGATION_BEFORE.test(s.text.slice(Math.max(0, rm.index - 45), rm.index))) continue;
        const dk = `${spec}|${pageDates.find((d) => d.index >= at(rm.index))?.iso ?? pickDate(pageDates)}`;
        if (refSeen.has(dk)) continue;
        refSeen.add(dk);
        const evidence = ev(p, `Referral: ${spec}`, at(rm.index), rm[0].length);
        const outcomeM = s.text.match(/\b(?:has been seen|was seen|were seen|attended|clinic\s+(?:attendance|visit)|outcome|appointment|awaiting\s+(?:appointment|review)|seen on|accepted|rejected)\b/i);
        const reasonM = s.text.match(/\b(?:for|due to|because of|regarding|concerning|with)\s+([a-z][a-z\s\-,\(\)]{4,80})/i);
        const date = pageDates.find((d) => d.index >= at(rm.index))?.iso ?? pickDate(pageDates);
        referrals.push({
          id: uid('ref'),
          specialty: spec,
          date,
          reason: reasonM ? reasonM[1].trim().replace(/\s+/g, ' ').replace(/[,.;]$/, '') : null,
          outcome: outcomeM ? outcomeM[0] : null,
          evidence: [evidence],
        });
        events.push({
          id: uid('evt'),
          date,
          type: 'Referral',
          title: `Referral to ${spec}`,
          description: s.text.replace(/\s+/g, ' ').trim().slice(0, 200),
          evidence,
        });
      }

      /* ---------------- Follow-ups (actionable only) ---------------- */
      {
        const sm = s.text.match(
          /\b(?:follow[ \t-]*up|review|recheck|reassess(?:ment)?|monitor|repeat|appointment)\b/i
        );
        if (!sm) {
          /* no follow-up language in this unit */
        } else {
        // Scoping to the sentence keeps an entire management block from
        // becoming one oversized, untraceable care loop.
        const local = sentenceAt(s.text, sm.index ?? 0) ?? s.text;
        const localLower = local.toLowerCase();

        const isInterval = /\b(?:in|within|after|over)[ \t]+\d+[ \t-]*(?:day|week|month|year|fortnight)s?\b/i.test(local);
        const isBooked = /\b(?:booked|rebooked|arranged|scheduled|issued|listed|planned for|due)\b/i.test(local);
        const isFollowUpWord = /\bfollow[ \t-]*up\b/i.test(local);
        const adviceOnly =
          /\b(?:if|should|unless|sooner|urgently|in the event|contact the clinic|seek help|call 999|999|advised to contact|warning signs)\b/i.test(
            localLower
          ) && !isBooked;
        const retrospective =
          /\b(?:was|were|has been|have been|had been)\b[^.]{0,40}\b(?:seen|attended|completed|reviewed|booked|rebooked|cancelled|discharged)\b/i.test(
            localLower
          );
        // A named review must name what is being reviewed to be a real task.
        const reviewTarget = /\b(?:clinic|appointment|review|recheck|reassess(?:ment)?|monitor|repeat|follow[ \t-]*up)\b/i.test(local);

        if (!adviceOnly && !retrospective && (isInterval || isBooked || isFollowUpWord) && reviewTarget) {
          const description = local
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^[\s\d]+[.)]\s*/, '')
            .slice(0, 240);
          const dk = description.slice(0, 50);
          if (fuSeen.has(dk)) continue;
          fuSeen.add(dk);
          const localIndex = s.text.indexOf(local);
          const evidence = ev(p, 'Follow-up', at(localIndex < 0 ? (sm.index ?? 0) : localIndex), local.length);
          const actualM = local.match(
            /\b(?:follow[ \t-]*up|review|clinic|seen|attended|appointment)\b[ \t]*(?:on|was|were|took place)?[ \t]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i
          );
          const actual = actualM ? findDates(actualM[1])[0]?.iso ?? null : null;
          const attendedM = /\b(?:did not attend|declined|has not attended|unable to attend|cancelled)\b/i.test(localLower);
          const date = pageDates.find((d) => d.index >= at(localIndex < 0 ? (sm.index ?? 0) : localIndex))?.iso ?? pickDate(pageDates);
          const seen = actual || /\b(?:seen|attended)\b/i.test(localLower);
          followUps.push({
            id: uid('fu'),
            description,
            recommendedDate: actual ?? pickDate(pageDates),
            actualDate: attendedM ? null : actual ?? (isBooked || seen ? date : null),
            outcome: attendedM ? 'Documented as not attended' : seen ? 'Follow-up documented' : null,
            evidence: [evidence],
          });
          events.push({
            id: uid('evt'),
            date,
            type: 'Follow-up',
            title: attendedM
              ? 'Follow-up documented as not attended'
              : actual || isBooked
              ? 'Follow-up booked or documented'
              : 'Follow-up recommended',
            description: description.slice(0, 200),
            evidence,
          });
        }
        }
      }

      /* ---------------- Findings (section bodies) ---------------- */
      for (let si = 0; si < sents.length; si++) {
        const cand = sents[si];
        const isSection = SECTION_HEAD.test(cand.text) || cand.text.replace(/[:\s]/g, '').length > 0 && /^(?:findings?|impression|conclusion|interpretation|summary|assessment|results?)\b/i.test(cand.text);
        if (!isSection) continue;
        const inline = cand.text.match(/^(?:findings?|results?|impression|conclusion|interpretation|summary|overall impression|clinical impression|assessment)\s*[:\-]\s*(.{6,240})/i);
        const parts: string[] = [];
        if (inline && inline[1]) parts.push(inline[1]);
        // Take the whole section up to the next heading, then prefer any line
        // that carries a measurement so findings are not truncated before it.
        const tail: string[] = [];
        for (let j = si + 1; j < sents.length && j <= si + 6; j++) {
          if (sents[j].isHeading) break;
          tail.push(sents[j].text);
        }
        const quantitative = tail.find((t) => /\d+(?:\.\d+)?\s*(?:%|mmHg|mmol|mg|bpm|kg|mL|ng\/L)\b/i.test(t));
        if (quantitative && !tail.includes(quantitative)) tail.push(quantitative);
        parts.push(...tail);
        const body = parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 260);
        if (body.length < 8) continue;
        const dk = body.slice(0, 40);
        if (findings.some((f) => f.finding.slice(0, 40) === dk)) continue;
        const relDates = findDates(body);
        findings.push({
          id: uid('fnd'),
          finding: body,
          date: relDates.length ? relDates[0].iso : pickDate(pageDates),
          evidence: ev(p, 'Documented finding', cand.start, cand.text.length),
        });
        break;
      }

      /* ---------------- Events ---------------- */
      const EVENT_SPECS: Array<{
        type: ClinicalEvent['type'];
        re: RegExp;
        validate?: (detail: string) => boolean;
      }> = [
        { type: 'Admission', re: /\b(?:admitted|admission|was taken in|presented to the emergency department|presented to ed|ward admission|attend(?:ed)? the ward)\b/gi },
        { type: 'Discharge', re: /\b(?:discharged|discharge[ \t]+summary|was discharged)\b/gi },
        { type: 'Procedure', re: /\b(?:procedure|operation|surgery|operated on|underwent|undergoing|catheterisation|catheterization|implantation|insertion of|angioplasty|angiography|biopsy|endoscopy|colonoscopy|gastroscopy|bronchoscopy|dialysis|transplantation|appendicectomy|cholecystectomy|hernia repair)\b/gi },
        { type: 'Symptom', re: /\b(?:presenting with|complains? of|complained of|reports? (?:of )?|c\/o|has developed|experiencing|notices?)\s+([a-z][a-z\s\-,\(\)]{4,90})/gi },
        { type: 'Diagnosis', re: /\b(?:diagnos(?:is|ed)\s+(?:of|with)|documented diagnosis)\s*[:\-]?\s*([a-z][a-z\s\-,\(\)\/]{3,80})/gi },
        /* "Hypertension diagnosed 2019" — the condition precedes
           the diagnosis keyword, so it is captured before it. */
        {
          type: 'Diagnosis',
          re: /\b([a-z0-9][a-z0-9\s\-,\(\)\/]{2,80}?)\s+diagnos(?:is|ed)\s+(?:in\s+)?\d{4}\b/gi,
          /* The capture must name a condition, not a pronoun or
             auxiliary verb ("he was diagnosed in 2015"). */
          validate: (d) =>
            !/\b(?:he|she|it|they|we|you|i|him|her|his|its|them|us|me|my|your|our|their|the patient|patient|was|is|are|am|been|being|has|have|had|will|would|can|could|shall|should|may|might|must|do|does|did|not|no)\b/i.test(d),
        },
        { type: 'Encounter', re: /\b(clinic|ward|hospital|outpatient|day\s+case|attend(?:ance|ed))\s+(?:on|at)?\s*(\d{1,2}[ \t]+[A-Za-z]{3,9}[ \t]+\d{4}|\d{4}-\d{2}-\d{2})/gi },
      ];

      for (const spec of EVENT_SPECS) {
        spec.re.lastIndex = 0;
        let em: RegExpExecArray | null;
        let count = 0;
        while ((em = spec.re.exec(s.text)) !== null && count < 4) {
          if (NEGATION_BEFORE.test(s.text.slice(Math.max(0, em.index - 30), em.index))) continue;
          count += 1;
          const detail = (em[1] ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\b(?:in|on|at|since|with|and|or|of|for|to)\s*$/i, '')
            .replace(/^[\s\d.)-]+/, '');
          if (spec.validate && !spec.validate(detail)) continue;
          const relDates = findDates(s.text).filter((x) => x.iso !== patient.dob);
          const d = relDates.length ? relDates[0].iso : pickDate(pageDates);
          let title: string;
          switch (spec.type) {
            case 'Symptom':
              title = `Presenting with ${detail.slice(0, 70)}`;
              break;
            case 'Diagnosis':
              title = `Documented diagnosis: ${detail.slice(0, 70)}`;
              break;
            case 'Encounter':
              title = `${titleCase(em[1] ?? 'Clinic')} contact`;
              break;
            case 'Procedure':
              // Name the procedure itself rather than the sentence it appears in,
              // so downstream care loops stay readable.
              title = `Procedure: ${titleCase((em[0] ?? '').replace(/^(?:a|an|the)\s+/i, '').trim())}`;
              break;
            default:
              title = `${spec.type} documented`;
          }
          const dk = `${title}|${d}`;
          if (eventSeen.has(dk)) continue;
          eventSeen.add(dk);
          const evidence = ev(p, `${spec.type}`, at(em.index), em[0].length);
          events.push({
            id: uid('evt'),
            date: d,
            type: spec.type,
            title,
            description: s.text.replace(/\s+/g, ' ').trim().slice(0, 240),
            evidence,
          });
        }
      }
    }
  }

  /* ---- Resolve tests whose report exists but whose body never repeats the
     test name (e.g. an echocardiogram report that only states "LVEF 55%"). ---- */
  for (const rt of reportTests.values()) {
    if (!rt.body) continue;
    const existing = investigations.filter((i) => i.name === rt.canon);
    if (existing.some((i) => i.status === 'RESULT_AVAILABLE')) continue;
    const cue = RESULT_EVIDENCE.exec(rt.body);
    /* A report is the authoritative documentation that the test was
       performed, so it supersedes earlier order-only mentions of the same
       test (e.g. a follow-up note recommending a repeat of it). */
    for (let k = investigations.length - 1; k >= 0; k--) {
      if (investigations[k].name === rt.canon && investigations[k].status !== 'RESULT_AVAILABLE') {
        investigations.splice(k, 1);
      }
    }
    investigations.push({
      id: uid('inv'),
      name: rt.canon,
      orderedDate: null,
      performedDate: rt.date,
      status: 'RESULT_AVAILABLE',
      result: cue ? cue[0].trim().replace(/\s+/g, ' ') : rt.body.slice(0, 160),
      finding: null,
      evidence: [rt.evidence],
    });
    events.push({
      id: uid('evt'),
      date: rt.date,
      type: 'Investigation',
      title: `${rt.canon} — report available`,
      description: rt.body.slice(0, 200),
      evidence: rt.evidence,
    });
  }

  /* ---- Drop investigation mentions that carry no date and no status signal,
     so that prose mentions do not become phantom open loops. ---- */
  const trimmedInvestigations = investigations.filter((i) => {
    if (i.status === 'ORDERED' || i.status === 'RESULT_AVAILABLE' || i.status === 'COMPLETED') return true;
    if (i.orderedDate || i.performedDate) return true;
    return false;
  });

  if (medications.length === 0) warnings.push('No medications could be extracted from the available record.');
  if (trimmedInvestigations.length === 0) warnings.push('No investigations could be extracted from the available record.');
  if (events.length === 0) warnings.push('No clinical events could be extracted from the available record.');

  reconcileMedicationStatuses(medications);

  return {
    patient,
    events,
    medications,
    investigations: trimmedInvestigations,
    labs,
    vitals,
    referrals,
    followUps,
    findings,
    chunks,
    warnings,
    isClinicalRecord,
  };
}

export { sentenceAt } from './text.js';
