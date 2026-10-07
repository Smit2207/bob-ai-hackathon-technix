/**
 * MedBrief AI — shared clinical domain types.
 * These types are used by BOTH the browser (Demo Mode) and the server (Live Mode)
 * so that a synthetic demo record and a freshly uploaded record are analysed by
 * exactly the same code path.
 */

export type Confidence = 'DOCUMENTED' | 'INFERRED' | 'UNKNOWN';

export interface Evidence {
  documentId: string;
  documentName: string;
  page: number;
  chunkIndex: number;
  field: string;
  text: string;
}

export type ChangeClass =
  | 'NEW'
  | 'CHANGED'
  | 'REPEATED'
  | 'RESOLVED'
  | 'OPEN'
  | 'CONFLICTING';

export type LoopStatus = 'OPEN' | 'RESOLVED' | 'PARTIAL';

export interface Patient {
  name: string | null;
  patientId: string | null;
  age: number | null;
  sex: string | null;
  dob: string | null;
  recordStart: string | null;
  recordEnd: string | null;
}

export interface ClinicalEvent {
  id: string;
  date: string | null;
  type:
    | 'Encounter'
    | 'Admission'
    | 'Discharge'
    | 'Procedure'
    | 'Follow-up'
    | 'Symptom'
    | 'Diagnosis'
    | 'Referral'
    | 'Finding'
    | 'Medication'
    | 'Investigation';
  title: string;
  description: string;
  evidence: Evidence;
}

export type MedicationStatus = 'ACTIVE' | 'STOPPED' | 'COMPLETED';

export interface Medication {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  status: MedicationStatus;
  startDate: string | null;
  stopDate: string | null;
  documentedReason: string | null;
  evidence: Evidence;
}

export interface MedicationChange {
  id: string;
  medicationName: string;
  kind:
    | 'STARTED'
    | 'STOPPED'
    | 'DOSE_INCREASED'
    | 'DOSE_DECREASED'
    | 'DOSE_UNCHANGED'
    | 'FREQUENCY_CHANGED'
    | 'CONFLICTING';
  previousDose: string | null;
  newDose: string | null;
  previousFrequency: string | null;
  newFrequency: string | null;
  date: string | null;
  documentedReason: string | null;
  evidence: Evidence[];
}

export type InvestigationStatus =
  | 'ORDERED'
  | 'PENDING'
  | 'COMPLETED'
  | 'RESULT_AVAILABLE'
  | 'RESULT_MISSING'
  | 'FOLLOW_UP_REQUIRED';

export interface Investigation {
  id: string;
  name: string;
  orderedDate: string | null;
  performedDate: string | null;
  status: InvestigationStatus;
  result: string | null;
  finding: string | null;
  evidence: Evidence[];
}

export interface LabResult {
  id: string;
  test: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  date: string | null;
  evidence: Evidence;
}

export interface Vital {
  id: string;
  type: string;
  value: string;
  unit: string | null;
  date: string | null;
  evidence: Evidence;
}

export interface Referral {
  id: string;
  specialty: string;
  date: string | null;
  reason: string | null;
  outcome: string | null;
  evidence: Evidence[];
}

export interface FollowUp {
  id: string;
  description: string;
  recommendedDate: string | null;
  actualDate: string | null;
  outcome: string | null;
  evidence: Evidence[];
}

export interface ClinicalFinding {
  id: string;
  finding: string;
  date: string | null;
  evidence: Evidence;
}

export interface ChangeMapItem {
  id: string;
  entity: string;
  entityType: 'Medication' | 'Investigation' | 'Finding' | 'Event' | 'Referral' | 'Follow-up';
  classification: ChangeClass;
  summary: string;
  date: string | null;
  evidence: Evidence[];
}

export interface CareLoop {
  id: string;
  type:
    | 'Investigation'
    | 'Referral'
    | 'Procedure'
    | 'Medication'
    | 'Follow-up';
  name: string;
  status: LoopStatus;
  orderedDate: string | null;
  completedDate: string | null;
  result: string | null;
  lastMention: string | null;
  stages: Array<{ stage: string; documented: boolean; date: string | null; note: string }>;
  evidence: Evidence[];
}

export interface ConflictEntry {
  value: string;
  date: string | null;
  documentName: string;
  page: number;
  text: string;
}

export interface DocumentationConflict {
  id: string;
  field: string;
  entity: string;
  status: 'Requires review';
  entries: ConflictEntry[];
  interpretation: string;
}

export interface AttentionItem {
  id: string;
  kind:
    | 'Open Care Loop'
    | 'Documentation Conflict'
    | 'Medication Change'
    | 'New Result'
    | 'New Event'
    | 'Recently Resolved';
  title: string;
  whySurfaced: string;
  dates: string[];
  evidence: Evidence[];
  target:
    | { view: 'careloop'; id: string }
    | { view: 'drift'; id: string }
    | { view: 'changemap'; id: string }
    | { view: 'timeline'; id: string };
}

export interface SourceDocument {
  id: string;
  name: string;
  pageCount: number;
  charCount: number;
  kind: 'pdf' | 'txt';
}

export interface Chunk {
  id: string;
  documentId: string;
  documentName: string;
  page: number;
  index: number;
  text: string;
}

export interface PatientAnalysis {
  patient: Patient;
  documents: SourceDocument[];
  events: ClinicalEvent[];
  medications: Medication[];
  medicationChanges: MedicationChange[];
  investigations: Investigation[];
  labs: LabResult[];
  vitals: Vital[];
  referrals: Referral[];
  followUps: FollowUp[];
  findings: ClinicalFinding[];
  changeMap: ChangeMapItem[];
  careLoops: CareLoop[];
  conflicts: DocumentationConflict[];
  attention: AttentionItem[];
  currentState: string[];
  longitudinalStory: ClinicalEvent[];
  verifyNext: string[];
  warnings: string[];
}

export interface DeltaSummary {
  newEvents: number;
  medicationChanges: number;
  newResults: number;
  resolvedLoops: number;
  newlyOpenLoops: number;
  newConflicts: number;
  details: Array<{ kind: string; title: string }>;
}

export interface SearchHit {
  kind: 'chunk' | 'medication' | 'investigation' | 'event' | 'finding' | 'lab' | 'conflict' | 'careloop';
  label: string;
  text: string;
  documentName: string;
  page: number | null;
  score: number;
  field: string;
}
