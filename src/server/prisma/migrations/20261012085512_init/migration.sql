-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PatientRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "patientId" TEXT,
    "age" INTEGER,
    "sex" TEXT,
    "dob" TEXT,
    "recordStart" TEXT,
    "recordEnd" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "analysisJson" TEXT,
    CONSTRAINT "PatientRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "date" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    "changeStatus" TEXT NOT NULL DEFAULT 'NEW',
    CONSTRAINT "ClinicalEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TEXT,
    "stopDate" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicationChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicationId" TEXT NOT NULL,
    "fromDose" TEXT,
    "toDose" TEXT,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceText" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    CONSTRAINT "MedicationChange_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderedDate" TEXT,
    "performedDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "result" TEXT,
    "finding" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    CONSTRAINT "Investigation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "test" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "date" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    CONSTRAINT "LabResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vital" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "date" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    CONSTRAINT "Vital_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "date" TEXT,
    "reason" TEXT,
    "outcome" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    CONSTRAINT "Referral_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendedDate" TEXT,
    "actualDate" TEXT,
    "outcome" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    CONSTRAINT "FollowUp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicalFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "date" TEXT,
    "documentId" TEXT,
    "page" INTEGER,
    "sourceText" TEXT,
    CONSTRAINT "ClinicalFinding_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareLoop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderedDate" TEXT,
    "completedDate" TEXT,
    "result" TEXT,
    "lastMention" TEXT,
    "evidence" TEXT NOT NULL,
    CONSTRAINT "CareLoop_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentationConflict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFLICTING',
    "entries" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    CONSTRAINT "DocumentationConflict_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "specialty" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedBrief_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandoverReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "linkedEntityId" TEXT NOT NULL,
    "linkedEntityType" TEXT NOT NULL,
    "accountableService" TEXT,
    "accountablePerson" TEXT,
    "plannedFollowUpDate" TEXT,
    "disposition" TEXT,
    "reviewState" TEXT NOT NULL DEFAULT 'Incomplete',
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HandoverReview_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverReview_patientId_linkedEntityId_linkedEntityType_key" ON "HandoverReview"("patientId", "linkedEntityId", "linkedEntityType");
