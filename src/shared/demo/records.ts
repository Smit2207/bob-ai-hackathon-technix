/**
 * Demo Mode source records.
 *
 * These are SYNTHETIC documents written as text. They are NOT fixtures with
 * pre-computed answers: they are pushed through exactly the same
 * `analyseDocuments` pipeline used for a freshly uploaded PDF, so every figure
 * the demo shows is computed from this text at runtime in the browser.
 *
 * No identifiers here are special-cased anywhere in the codebase.
 */

export interface DemoDocument {
  name: string;
  kind: 'pdf' | 'txt';
  pages?: Array<{ page: number; text: string }>;
  text?: string;
}

export interface DemoPatient {
  id: string;
  displayName: string;
  summary: string;
  documents: DemoDocument[];
}

/* ================================================================== *
 * Demo patient 1 — hypertension / hyperlipidemia with an open PFT loop
 * ================================================================== */

const arjunDoc0b: DemoDocument = {
  name: 'GP_Telephone_Contact_10Feb2026.txt',
  kind: 'txt',
  text: `NORTHFIELD MEDICAL CENTRE
GP TELEPHONE CONTACT RECORD

Patient Name: Arjun Mehta
Patient ID: NF-448120
Age: 64
Sex: Male

Date of Contact: 10 Feb 2026
Clinician: Dr H. Sandhu, MRCGP

REASON FOR CONTACT
Mr Mehta telephoned to report that the cardiology clinic had changed his
Atorvastatin to 40 mg nightly. He had stopped taking the tablet for
approximately one week after reading an article about side effects and has
restarted his previous dose of Atorvastatin 20 mg nightly as advised by his
own doctor. He has now recommenced Atorvastatin 20 mg nightly from the
pharmacy.

He reports no muscle pain and no darkening of his urine. He is compliant with
the rest of his medication.

PLAN
1. Continue Amlodipine 5 mg once daily.
2. Atorvastatin 20 mg nightly restarted by the patient. Cardiology have been
   informed that the dose they documented as 40 mg nightly may not be what he
   is currently taking.
3. Cardiology to be contacted to confirm the intended dose.
4. Bloods to be repeated at the next review.
5. Urgent review not required.

Follow-up appointment in 3 weeks.`,
};

const arjunDoc1: DemoDocument = {
  name: 'GP_Consultation_12Jan2026.txt',
  kind: 'txt',
  text: `NORTHFIELD MEDICAL CENTRE
GP CONSULTATION RECORD

Patient Name: Arjun Mehta
Patient ID: NF-448120
Date of Birth: 04/06/1961
Age: 64
Sex: Male

Date of Consultation: 12 Jan 2026
Clinician: Dr H. Sandhu, MRCGP

HISTORY
Mr Mehta is a 64 year old retired engineer who presents today for review of
his hypertension. He was diagnosed with hypertension in 2019 following an
incidental finding at a pharmacy blood pressure check. He has also been
documented with hyperlipidaemia since 2021.

He reports no chest pain and no breathlessness at rest. He has noticed some
shortness of breath when climbing stairs over the last two months. He denies
palpitations, syncope, or leg swelling. He sleeps poorly and snores loudly,
which his wife reports has worsened over the past year.

EXAMINATION
BP 152/88 mmHg, HR 76 bpm regular, SpO2 97% on air, Temperature 36.8 C.
Chest clear on auscultation. No audible murmur. No pedal oedema.
Weight 84 kg.

IMPRESSION
1. Hypertension - poorly controlled on current therapy
2. Hyperlipidaemia
3. Breathlessness on exertion of recent onset - cause not established

PLAN
Continue Amlodipine 5 mg once daily.
Continue Atorvastatin 20 mg nightly.
Bloods requested today: full blood count, renal function, liver function, lipid profile.
ECG requested today.
Consider echocardiogram if symptoms persist.
Smoking status: never smoker.
Allergies: no known allergies.

Follow-up in 6 weeks with blood pressure review.`,
};

const arjunDoc2: DemoDocument = {
  name: 'Echocardiogram_Report_23Jan2026.txt',
  kind: 'txt',
  text: `CITY HOSPITAL IMAGING DEPARTMENT
ECHOCARDIOGRAM REPORT

Patient Name: Arjun Mehta
Patient ID: NF-448120
Age: 64    Sex: Male

Date of Examination: 23 Jan 2026
Study performed by: Dr L. Fitzgerald, FRCR

CLINICAL INDICATION
Breathlessness on exertion. Assessment for LV function.

FINDINGS
The study is technically adequate. The left ventricle is normal in size with
good systolic function. LVEF 55% by biplane Simpson's method. Normal left
atrial size. No regional wall motion abnormality. Aortic valve is
tri-leaflet and not stenotic. Mitral and tricuspid valves are structurally
normal with no significant regurgitation. The interventricular septum and
posterior wall are of normal thickness. Right ventricle is normal in size and
function. No pericardial effusion.

IMPRESSION
Normal left ventricular systolic function with preserved ejection fraction
(LVEF 55%). No significant structural abnormality identified.

Electocardiogram performed concurrently shows sinus rhythm with left ventricular
hypertrophy.

FOLLOW-UP
Clinical correlation is recommended. Repeat echocardiogram in 12 months or
sooner if symptoms change.`,
};

const arjunDoc3: DemoDocument = {
  name: 'Cardiology_Clinic_Letter_03Feb2026.txt',
  kind: 'txt',
  text: `ROYAL COUNTY CARDIOLOGY CENTRE
OUTPATIENT CLINIC LETTER

Patient Name: Arjun Mehta
Patient ID: NF-448120
Age: 64    Sex: Male

Clinic Date: 03 Feb 2026
Consultant: Dr A. Bianchi, MRCP

Thank you for referring this patient for assessment of breathlessness on
exertion. He was reviewed in clinic today.

He reports that the breathlessness has improved somewhat since the
echocardiogram. There is no chest pain, no orthopnoea, and no palpitations.
He has stopped taking the cholesterol tablet and restarted his previous dose
as advised by his own doctor. He is otherwise well.

EXAMINATION
BP 148/84 mmHg, HR 72 bpm, chest clear. No raised JVP. No ankle oedema.

INVESTIGATIONS PERFORMED TODAY
Lung function testing has been requested as a formal test and was not
completed on the day of clinic. He has agreed to attend the respiratory
department for spirometry with bronchodilator reversibility testing.

IMPRESSION
1. Breathlessness on exertion of uncertain cause. Echocardiogram has excluded
   significant cardiac dysfunction.
2. Obstructive sleep apnoea is a possible contributor and has not been assessed.
3. Hypertension remains above target.

PLAN
1. Atorvastatin 40 mg nightly has been increased from the previous 20 mg dose
   as the lipid profile remains above target.
2. Pulmonary function test to be arranged and completed.
3. Refer to Respiratory for spirometry.
4. Blood pressure monitoring advised.
5. Follow-up in Cardiology in 6 weeks.

Yours sincerely,
Dr A. Bianchi
Consultant Cardiologist`,
};

const arjunDoc4: DemoDocument = {
  name: 'Respiratory_Clinic_Note_18Mar2026.txt',
  kind: 'txt',
  text: `CITY HOSPITAL RESPIRATORY MEDICINE
CLINIC NOTE

Patient Name: Arjun Mehta
Patient ID: NF-448120
Age: 64    Sex: Male

Date of Clinic: 18 Mar 2026
Consultant: Dr P. Nkemelu, MRCP

REASON FOR REFERRAL
Spirometry requested by cardiology following breathlessness on exertion.

HISTORY
The patient reports that his breathing has been no different. He has purchased
an over-the-counter bronchodilator inhaler which he used twice with some
perceived benefit. He has not slept well and his wife has noticed that he
stops breathing during sleep. He is tired in the afternoons.

He confirms he has never smoked. He works part-time as a volunteer.

EXAMINATION
Chest clear. HR 70 bpm, SpO2 96%, BP 146/82 mmHg. No cyanosis.

IMPRESSION
1. Exertional breathlessness of unclear cause. Pulmonary function test ordered
   05 Mar 2026 does not appear to have been completed at this hospital.
2. Symptoms are compatible with possible obstructive sleep apnoea. This has
   not yet been formally assessed.
3. Asthma has not been excluded. Consider peak flow diary.

PLAN
1. Spirometry to be booked and completed with bronchodilator reversibility.
2. Consider sleep study if spirometry is normal and symptoms persist.
3. Continue current medication unchanged pending spirometry results.
4. Follow-up in 4 weeks with peak flow readings.

Patient advised to contact the clinic sooner if breathing deteriorates.
Patient informed that no test results are currently available for review.`,
};

/* ================================================================== *
 * Demo patient 2 — diabetes / CKD with an unassessed renal imaging loop
 * ================================================================== */

const sarahDoc1: DemoDocument = {
  name: 'Diabetes_Annual_Review_03Feb2026.txt',
  kind: 'txt',
  text: `ASHGROVE MEDICAL PRACTICE
DIABETES ANNUAL REVIEW

Patient Name: Sarah Chen
Patient ID: AG-771203
Date of Birth: 17/09/1958
Age: 67
Sex: Female

Date of Review: 03 Feb 2026
Clinician: Dr M. Okonkoro, MRCGP

HISTORY OF PRESENTING PROBLEM
Type 2 diabetes mellitus diagnosed in 2015. Chronic kidney disease stage 3
documented since 2021. Hypertension diagnosed 2018. She has never smoked and
does not drink alcohol.

She has been managed on Metformin 1000 mg twice daily since 2019. She
reports occasional diarrhoea on this dose but has not sought review. She
adheres to a low salt diet. She has not attended ophthalmology screening for
two years.

EXAMINATION
BP 148/86 mmHg, HR 72 bpm, SpO2 98%, Temperature 36.5 C, Weight 71 kg.
Feet inspected - no ulcers, monofilament sensation intact.
Fundoscopy not performed at this visit.

BLOOD RESULTS 03 Feb 2026
HbA1c: 62 mmol/mol (reference 20-42)
eGFR: 34 ml/min/1.73m2 (reference >90)
Creatinine: 132 umol/L (reference 60-110)
Potassium: 5.1 mmol/L (reference 3.5-5.0)
Sodium: 138 mmol/L (reference 135-145)
Total cholesterol: 4.8 mmol/L (reference <5.2)
LDL cholesterol: 2.9 mmol/L (reference <3.0)
Albumin: 38 g/L (reference 35-50)
Haemoglobin: 112 g/L (reference 120-140)

IMPRESSION
1. Type 2 diabetes mellitus - control above target
2. Chronic kidney disease stage 3 - progressive decline in eGFR
3. Hypertension - above target
4. Mild anaemia noted
5. No documented retinopathy screening for 2 years

PLAN
1. Renal ultrasound requested to assess kidney size and exclude obstruction.
2. Metformin continued at current dose pending renal function review.
3. Blood pressure target discussed.
4. Retinal screening referral to be raised.
5. Renal referral to be considered if eGFR continues to decline.

Allergies: no known allergies.`,
};

const sarahDoc2: DemoDocument = {
  name: 'Renal_Medicine_Clinic_Letter_22Apr2026.txt',
  kind: 'txt',
  text: `CITY HOSPITAL RENAL MEDICINE
CLINIC LETTER

Patient Name: Sarah Chen
Patient ID: AG-771203
Age: 67    Sex: Female

Clinic Date: 22 Apr 2026
Consultant: Dr M. Sivalingam, MRCP

Thank you for referring this patient with type 2 diabetes and chronic kidney
disease stage 3, with a falling estimated GFR and intercurrent anaemia.

She was reviewed in clinic today. She reports fatigue and reduced exercise
tolerance. She denies nausea, vomiting, or ankle swelling. She has noticed
she is passing urine more frequently overnight than previously.

EXAMINATION
BP 152/88 mmHg, HR 76 bpm, SpO2 97%. Abdomen soft, no masses palpable.
No peripheral oedema.

BLOOD RESULTS 22 Apr 2026
HbA1c: 64 mmol/mol (reference 20-42)
eGFR: 29 ml/min/1.73m2 (reference >90)
Creatinine: 148 umol/L (reference 60-110)
Haemoglobin: 105 g/L (reference 120-140)
Potassium: 5.4 mmol/L (reference 3.5-5.0)
Bicarbonate: 21 mmol/L (reference 22-29)

IMPRESSION
1. Chronic kidney disease stage 3b, progressing from stage 3a.
2. Normocytic anaemia, likely renal in origin.
3. Metformin is being continued although eGFR is now below 30. She has been
   counselled that this combination should be reviewed.
4. Renal function has deteriorated further since the ultrasound request in
   February.

PLAN
1. Renal ultrasound has not been located in the record. If not already
   performed, please arrange renal imaging.
2. Stop Metformin - eGFR below threshold. commenced Indapamide 2.5 mg once daily.
3. Renal anaemia to be assessed with iron studies and treated accordingly.
4. Referral to Cardiology for assessment of hypertension with renal impairment.
5. Systolic blood pressure target agreed with nephrology.
6. Diabetic retinopathy screening remains outstanding.

Dr M. Sivalingam

Allergies: Penicillin — generalised rash in childhood.
Medications on admission: Metformin 1000 mg twice daily, Ramipril 5 mg once daily,
Simvastatin 20 mg nightly, Atorvastatin 40 mg nightly.
Drug history recorded by the general practitioner lists Atorvastatin 40 mg nightly only.`,
};

/* ================================================================== *
 * Demo patient 3 — COPD exacerbation with contradictory smoking history
 * ================================================================== */

const michaelDoc1: DemoDocument = {
  name: 'Acute_Admission_20Jan2026.txt',
  kind: 'txt',
  text: `RIVERSIDE UNIVERSITY HOSPITAL
ACUTE MEDICAL ADMISSION

Patient Name: Michael Okonkwo
Patient ID: RU-330914
Date of Birth: 22/01/1954
Age: 72
Sex: Male

Admission Date: 20 Jan 2026
Ward: Acute Medical Unit, Ward 7
Admitted by: Dr T. Whitcombe, MRCP

REASON FOR ADMISSION
Presented to the emergency department with increased breathlessness and a
productive cough with green sputum of four days duration. His wife reports he
has been sleeping in an upright position for the past fortnight.

PAST MEDICAL HISTORY
Chronic obstructive pulmonary disease, diagnosed 2015. Asthma. Hypertension.
Smokes 20 cigarettes per day, 45 pack-year history. Previous admission in
November 2025 for the same problem.

MEDICATIONS ON ADMISSION
Salbutamol inhaler 100 micrograms two puffs as needed
Ipratropium bromide inhaler 20 micrograms four times daily
Prednisolone 40 mg once daily for 5 days
Amoxicillin 500 mg three times daily for 5 days
Atorvastatin 20 mg nightly
Amlodipine 5 mg once daily

EXAMINATION ON ADMISSION
BP 138/82 mmHg, HR 108 bpm, RR 26 breaths per minute, SpO2 88% on air,
Temperature 37.9 C, Weight 79 kg. Barrel chest with poor air entry
throughout. Coarse expiratory crackles. No added heart sounds. No leg oedema.

INVESTIGATIONS REQUESTED
Chest X-ray requested on admission.
Arterial blood gas requested on admission.
Full blood count, CRP, and sputum culture requested.
ECG performed - sinus tachycardia at 104 bpm, right axis deviation.

IMPRESSION
1. Acute exacerbation of chronic obstructive pulmonary disease with infective
   trigger.
2. Type 2 respiratory failure on the arterial blood gas.
3. Left lower zone consolidation on the chest X-ray may represent pneumonia.

PLAN
1. Controlled oxygen therapy target saturations 88-92%.
2. Nebulised bronchodilators to continue four times daily.
3. Prednisolone 40 mg daily for 5 days, to be stopped on completion.
4. Antibiotics to complete a 5 day course.
5. Chest X-ray to be repeated in 48 hours to ensure resolution.
6. Spirometry requested once the patient is clinically stable.
7. Discharge planning to include smoking cessation referral and an assessment
   for home oxygen therapy.`,
};

const michaelDoc2: DemoDocument = {
  name: 'Discharge_Summary_28Jan2026.txt',
  kind: 'txt',
  text: `RIVERSIDE UNIVERSITY HOSPITAL
DISCHARGE SUMMARY

Patient Name: Michael Okonkwo
Patient ID: RU-330914
Age: 72    Sex: Male

Admission Date: 20 Jan 2026
Discharge Date: 28 Jan 2026
Discharging Consultant: Dr T. Whitcombe, MRCP

REASON FOR ADMISSION
Acute exacerbation of chronic obstructive pulmonary disease.

SUMMARY OF CLINICAL COURSE
Mr Okonkwo was admitted with an infective exacerbation of his chronic
obstructive pulmonary disease. He received controlled oxygen therapy, nebulised
bronchodilators, a five day course of Prednisolone 40 mg once daily, and a five
day course of Amoxicillin 500 mg three times daily. His chest X-ray on 23 Jan
2026 showed resolution of the left lower zone consolidation. Arterial blood gas
had normalised by the time of discharge.

He has been weaned off nebulised bronchodilators to his regular inhalers. He
remains breathless on minimal exertion but is able to walk to the bathroom.

His spirometry has been deferred on two occasions because he was too unwell to
perform the test. No spirometry results are available in the record. A formal
spirometry appointment has been issued for 15 Mar 2026.

He has declined inpatient pulmonary rehabilitation and prefers a home exercise
programme.

At a previous admission the general practitioner recorded that he had stopped
smoking three years ago, although he describes a continuing 20 cigarettes per
day during this admission. This discrepancy is noted for reconciliation.

MEDICATIONS ON DISCHARGE
Salbutamol inhaler 100 micrograms two puffs as needed
Ipratropium bromide inhaler 20 micrograms four times daily
Prednisolone 40 mg once daily - COMPLETED, no longer required
Amoxicillin 500 mg three times daily - COMPLETED, no longer required
Atorvastatin 20 mg nightly
Amlodipine 5 mg once daily

BLOOD RESULTS
CRP: 94 mg/L (reference <5) on admission, 11 mg/L on 27 Jan 2026
White cell count: 13.4 on admission, 7.8 on 27 Jan 2026
Haemoglobin: 141 g/L
Oxygen saturation: 93% on discharge, on air

OUTSTANDING ON DISCHARGE
1. Spirometry appointment booked for 15 Mar 2026.
2. Home oxygen assessment requested by respiratory specialist nurse.
3. Smoking cessation referral to be completed.
4. Ambulatory oxygen service referral awaiting allocation.
5. Annual influenza vaccination offered.

Follow-up in respiratory clinic in 6 weeks.
Please re-refer if there is a further deterioration.`,
};

const michaelDoc3: DemoDocument = {
  name: 'Respiratory_FollowUp_15Mar2026.txt',
  kind: 'txt',
  text: `RIVERSIDE UNIVERSITY HOSPITAL
RESPIRATORY CLINIC FOLLOW-UP

Patient Name: Michael Okonkwo
Patient ID: RU-330914
Age: 72    Sex: Male

Clinic Date: 15 Mar 2026
Consultant: Respiratory Nurse Specialist, C. Mbeki

OUTCOME
The patient did not attend his spirometry appointment booked for
15 Mar 2026. He contacted the clinic on 20 Feb 2026 stating that he felt his
breathing had returned to his usual baseline and that he did not wish to
attend hospital at this time. He was counselled that spirometry remains
important to guide his treatment and was rebooked.

He reports continuing to smoke 10 cigarettes per day. He has not engaged with
the smoking cessation service offered at his admission.

His medication has been reviewed and remains unchanged. Atorvastatin 20 mg
nightly has been increased to 40 mg nightly in line with cardiology advice.

Breathing remains comfortable at rest. He manages a flight of stairs without
pausing. SpO2 95% on air. Chest clear.

His general practitioner has written to say that he is a former smoker,
having stopped in 2023, which conflicts with what he tells us in clinic.

PLAN
1. Spirometry rebooked for 08 Apr 2026 - attendance required to guide therapy.
2. Home oxygen assessment still outstanding from the previous admission.
3. Smoking cessation referral to be repeated.
4. Medication unchanged other than the statin dose increase.
5. Urgent review if breathlessness worsens or haemoptysis occurs.`,
};

/* ================================================================== *
 * Registry
 * ================================================================== */

export const DEMO_PATIENTS: DemoPatient[] = [
  {
    id: 'demo-patient-1',
    displayName: 'Arjun Mehta',
    summary:
      '64-year-old with hypertension and hyperlipidaemia. Atorvastatin documented at three different doses, an echocardiogram with a preserved ejection fraction, and a pulmonary function test ordered in March that has no completion documentation.',
    documents: [arjunDoc1, arjunDoc0b, arjunDoc2, arjunDoc3, arjunDoc4],
  },
  {
    id: 'demo-patient-2',
    displayName: 'Sarah Chen',
    summary:
      '67-year-old with type 2 diabetes and progressive chronic kidney disease. Metformin documented as continuing past the eGFR threshold, a renal ultrasound requested in February with no imaging report, and a cardiology referral raised but not yet seen.',
    documents: [sarahDoc1, sarahDoc2],
  },
  {
    id: 'demo-patient-3',
    displayName: 'Michael Okonkwo',
    summary:
      '72-year-old with repeated COPD exacerbations. Prednisolone and antibiotic courses documented as completed, three spirometry attempts with no results, a home oxygen assessment still outstanding, and a smoking status recorded inconsistently between primary care and the hospital.',
    documents: [michaelDoc1, michaelDoc2, michaelDoc3],
  },
];

export const DEMO_DISCLAIMER =
  'SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE. Every patient, date, medication, and result in this demo is invented for demonstration purposes. No real patient data is present.';