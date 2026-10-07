// Pure content-driven clinical extraction - no hard-coded patient names
export interface ExtractedData {
  patient: { name?: string; patientId?: string; age?: number; sex?: string; dob?: string; recordStart?: string; recordEnd?: string };
  events: Array<{ date: string; type: string; title: string; description: string; page: number; sourceText: string }>;
  medications: Array<{ name: string; dose?: string; frequency?: string; route?: string; status: string; startDate?: string; sourceText: string; page: number }>;
  investigations: Array<{ name: string; orderedDate?: string; performedDate?: string; status: string; result?: string; finding?: string; sourceText: string; page: number }>;
  labs: Array<{ test: string; value: string; unit?: string; referenceRange?: string; date?: string; sourceText: string; page: number }>;
  vitals: Array<{ type: string; value: string; unit?: string; date?: string; sourceText: string; page: number }>;
  referrals: Array<{ specialty: string; date?: string; reason?: string; outcome?: string; sourceText: string; page: number }>;
  followups: Array<{ description: string; recommendedDate?: string; actualDate?: string; outcome?: string; sourceText: string; page: number }>;
  findings: Array<{ finding: string; date?: string; sourceText: string; page: number }>;
}

const MONTHS: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };

function parseDateStr(s: string): string | undefined {
  // Try DD MMM YYYY
  let m = s.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (m) { const mm = MONTHS[m[2].toLowerCase().slice(0,3)]; return `${m[3]}-${mm}-${m[1].padStart(2,'0')}`; }
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  return undefined;
}

function allDates(text: string): string[] {
  const dates: string[] = [];
  const re = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) { const d = parseDateStr(m[1]); if (d) dates.push(d); }
  return dates;
}

export function extractClinicalData(fullText: string, pages: Array<{ page: number; text: string }>): ExtractedData {
  const data: ExtractedData = { patient: {}, events: [], medications: [], investigations: [], labs: [], vitals: [], referrals: [], followups: [], findings: [] };

  // Patient demographics - generic patterns
  const nameMatch = fullText.match(/Patient(?:\s+Name)?\s*[:\-]\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
  if (nameMatch) data.patient.name = nameMatch[1].trim();
  const idMatch = fullText.match(/(?:Patient\s*ID|MRN|NHS\s*Number)\s*[:\-]\s*([A-Z0-9\-]+)/i);
  if (idMatch) data.patient.patientId = idMatch[1].trim();
  const ageMatch = fullText.match(/Age\s*[:\-]\s*(\d{1,3})/i);
  if (ageMatch) data.patient.age = parseInt(ageMatch[1]);
  const dobMatch = fullText.match(/(?:DOB|Date of Birth)\s*[:\-]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}\s+\w+\s+\d{4})/i);
  if (dobMatch) data.patient.dob = dobMatch[1];
  const sexMatch = fullText.match(/Sex\s*[:\-]\s*(Male|Female|M|F)\b/i);
  if (sexMatch) data.patient.sex = sexMatch[1];

  const dates = allDates(fullText).sort();
  if (dates.length) { data.patient.recordStart = dates[0]; data.patient.recordEnd = dates[dates.length - 1]; }

  for (const pg of pages) {
    const t = pg.text;

    // Medications - generic: look for drug-like patterns with dose
    const medRe = /([A-Z][a-z]+(?:cillin|pril|olol|sartan|statin|pine|mide|formin|gliflozin|gliptin|zole|prazole)?)\s+(\d+(?:\.\d+)?\s*mg)\s*(?:(\w+\s*\w*?)\s*)?(?:\(.*?\)\s*)?/gi;
    let mm: RegExpExecArray | null;
    const seenMeds = new Set<string>();
    // Also catch explicit medication lines
    const medLines = t.split('\n');
    for (const line of medLines) {
      // Lines containing dose
      const doseMatch = line.match(/([A-Z][a-z]{2,})\s+(\d+(?:\.\d+)?\s*mg)\b/i);
      if (doseMatch && line.length < 300) {
        const name = doseMatch[1];
        if (['Patient','Record','Report','Result','Review','January','February','March','April','May','June','July','August','September','October','November','December'].includes(name)) continue;
        const dose = doseMatch[2];
        const freqMatch = line.match(/(once daily|twice daily|nightly|daily|bd|od|nocte|mane)/i);
        const key = name.toLowerCase() + dose.toLowerCase();
        if (seenMeds.has(key)) continue;
        seenMeds.add(key);
        let date: string | undefined;
        const d = line.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
        if (d) date = parseDateStr(d[1]);
        data.medications.push({ name, dose, frequency: freqMatch?.[1], status: 'ACTIVE', startDate: date, sourceText: line.trim().slice(0, 300), page: pg.page });
      }
    }

    // Investigations
    const invKeywords = ['echocardiogram','ECG','X-ray','Xray','CT scan','MRI','ultrasound','blood test','pulmonary function test','PFT','spirometry','colonoscopy','endoscopy','biopsy','bloods','CXR','chest x-ray','laboratory','HbA1c','lipid','renal function','liver function','FBC','U&E','CRP','ESR','troponin','BNP','D-dimer'];
    for (const kw of invKeywords) {
      const re = new RegExp(`(${kw})[^\\n]{0,120}?(ordered|requested|performed|completed|result|pending|awaiting|follow.?up|normal|abnormal|reviewed)?`, 'gi');
      let im: RegExpExecArray | null;
      while ((im = re.exec(t)) !== null) {
        const snippet = t.slice(Math.max(0, im.index - 60), im.index + 200).replace(/\s+/g, ' ').trim().slice(0, 350);
        // Avoid duplicates per page
        if (data.investigations.some(x => x.name.toLowerCase() === kw.toLowerCase() && x.page === pg.page && x.sourceText === snippet)) continue;
        let status = 'ORDERED';
        const lower = snippet.toLowerCase();
        if (lower.includes('completed') || lower.includes('performed') || lower.includes('result') || lower.includes('normal') || lower.includes('abnormal')) status = 'COMPLETED';
        if (lower.includes('ordered') || lower.includes('requested') || lower.includes('pending') || lower.includes('awaiting')) status = 'ORDERED';
        if (lower.includes('result') && (lower.includes('normal') || lower.includes('%') || lower.includes('55%') || lower.includes('LVEF'))) status = 'RESULT_AVAILABLE';
        const d = snippet.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
        const od = d ? parseDateStr(d[1]) : undefined;
        // Extract result if present
        let result: string | undefined;
        const resMatch = snippet.match(/(LVEF\s*\d+%|normal|abnormal|elevated|low)[^.]{0,40}/i);
        if (resMatch) result = resMatch[0].trim();
        data.investigations.push({ name: kw, orderedDate: status === 'ORDERED' ? od : undefined, performedDate: status !== 'ORDERED' ? od : undefined, status, result, sourceText: snippet, page: pg.page });
        break; // one per keyword per page
      }
    }

    // Labs
    const labRe = /(HbA1c|CRP|ESR|WBC|Haemoglobin|Hemoglobin|Creatinine|eGFR|Troponin|BNP|Platelets|Sodium|Potassium|Cholesterol|LDL|HDL|Triglycerides)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*([a-z\/\%]+)?\s*(?:\(.*?(reference|normal).*?(\d[^)]*)\))?/gi;
    let lm: RegExpExecArray | null;
    while ((lm = labRe.exec(t)) !== null) {
      data.labs.push({ test: lm[1], value: lm[2], unit: lm[3], referenceRange: lm[5], sourceText: lm[0].slice(0,300), page: pg.page });
    }

    // Vitals
    const bpMatch = t.match(/BP\s*[:\-]?\s*(\d+\/\d+)\s*(mmHg)?/i);
    if (bpMatch) data.vitals.push({ type: 'Blood Pressure', value: bpMatch[1], unit: 'mmHg', sourceText: bpMatch[0], page: pg.page });
    const hrMatch = t.match(/(?:Pulse|HR|Heart rate)\s*[:\-]?\s*(\d+)\s*bpm/i);
    if (hrMatch) data.vitals.push({ type: 'Pulse', value: hrMatch[1], unit: 'bpm', sourceText: hrMatch[0], page: pg.page });
    const spo2Match = t.match(/(?:SpO2|O2 sat|Oxygen saturation)\s*[:\-]?\s*(\d+)%/i);
    if (spo2Match) data.vitals.push({ type: 'Oxygen Saturation', value: spo2Match[1], unit: '%', sourceText: spo2Match[0], page: pg.page });

    // Referrals
    const refRe = /referr\w*\s+(?:to\s+)?(Cardiology|Respiratory|Neurology|Gastroenterology|Rheumatology|Dermatology|General Medicine|Endocrinology|Nephrology|Oncology|Orthopaedics|ENT|Ophthalmology|Urology)[^\n]{0,120}/gi;
    let rm: RegExpExecArray | null;
    while ((rm = refRe.exec(t)) !== null) {
      const snippet = t.slice(rm.index, rm.index + 250).replace(/\s+/g,' ').trim().slice(0,350);
      const d = snippet.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
      data.referrals.push({ specialty: rm[1], date: d ? parseDateStr(d[1]) : undefined, reason: snippet, sourceText: snippet, page: pg.page });
    }

    // Follow-ups
    const fuRe = /(follow.?up|review in|see again in|return in)\s+(\d+\s*(?:weeks?|months?|days?))?[^.]{0,80}/gi;
    let fm: RegExpExecArray | null;
    while ((fm = fuRe.exec(t)) !== null) {
      const snippet = t.slice(Math.max(0, fm.index - 20), fm.index + 180).replace(/\s+/g,' ').trim().slice(0,350);
      data.followups.push({ description: snippet, sourceText: snippet, page: pg.page });
    }

    // Events - admission/discharge/procedure/symptom
    const eventPatterns: Array<{ type: string; re: RegExp }> = [
      { type: 'Admission', re: /admi(?:tted|ssion)[^\n]{0,100}/gi },
      { type: 'Discharge', re: /discharg\w*[^\n]{0,100}/gi },
      { type: 'Procedure', re: /(?:procedure|operation|surgery|performed)[^\n]{0,100}/gi },
      { type: 'Diagnosis', re: /(?:diagnosis|diagnosed with|history of)\s+([A-Za-z ]{3,40})/gi },
      { type: 'Symptom', re: /(?:presenting with|complains of|reports|c\/o)\s+([A-Za-z ,]{5,60})/gi },
    ];
    for (const ep of eventPatterns) {
      let em: RegExpExecArray | null;
      while ((em = ep.re.exec(t)) !== null) {
        const snippet = em[0].slice(0,250).trim();
        if (snippet.length < 10) continue;
        const d = t.slice(Math.max(0, em.index - 100), em.index + 100).match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
        data.events.push({ date: d ? parseDateStr(d[1])! : (dates[0] || new Date().toISOString().slice(0,10)), type: ep.type, title: snippet.slice(0,80), description: snippet, page: pg.page, sourceText: snippet });
        break;
      }
    }

    // Findings
    const findRe = /(?:finding|impression|conclusion|noted|observed)[:\-]\s*([^\n]{10,150})/gi;
    let fnm: RegExpExecArray | null;
    while ((fnm = findRe.exec(t)) !== null) {
      data.findings.push({ finding: fnm[1].trim().slice(0,250), sourceText: fnm[0].slice(0,300), page: pg.page });
    }
  }

  // Deduplicate investigations per name+page
  // Already handled loosely

  // If no patient name found, try first line
  if (!data.patient.name) {
    const firstLine = fullText.split('\n').find(l => l.trim().length > 3);
    const maybeName = firstLine?.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    if (maybeName && maybeName[1].split(' ').length === 2) {
      // Only use if not a common header
      if (!['Medical Record','Discharge Summary','Patient Record'].includes(maybeName[1])) {
        // leave as undefined if uncertain; don't guess
      }
    }
  }

  return data;
}
