import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../utils/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { processText, chunkText } from '../services/extractionPipeline.js';
import { analyseBridge, searchBridge, answerBridge, briefsBridge, byoaiBridge, compareBridge, analyticsBridge, diffBridge } from '../services/sharedEngineBridge.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15*1024*1024 }, fileFilter:(req,file,cb)=>{
  if (file.mimetype==='application/pdf' || file.mimetype==='text/plain' || file.originalname.endsWith('.txt') || file.originalname.endsWith('.pdf')) cb(null,true);
  else cb(new Error('Unsupported file type'));
}});

const r = Router();
r.use(requireAuth);

// List patients
r.get('/', async (req: AuthRequest, res) => {
  const patients = await prisma.patientRecord.findMany({ where:{userId:req.userId!}, orderBy:{updatedAt:'desc'}, include:{ documents:true, careLoops:true, conflicts:true } });
  const enriched = await Promise.all(patients.map(async p=>{
    const meds = await prisma.medication.findMany({where:{patientId:p.id}});
    const invs = await prisma.investigation.findMany({where:{patientId:p.id}});
    return { ...p, _counts:{ meds:meds.length, investigations:invs.length, docs:p.documents.length, openLoops:p.careLoops.filter((x:any)=>x.status==='OPEN').length, conflicts:p.conflicts.length } };
  }));
  res.json(enriched);
});

r.post('/', async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const p = await prisma.patientRecord.create({ data:{ userId:req.userId!, name }});
  res.json(p);
});

// Get single patient with all data
r.get('/:id', async (req: AuthRequest, res) => {
  const p = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  const [documents, events, medications, investigations, labs, vitals, referrals, followups, findings, careLoops, conflicts, briefs, chunks] = await Promise.all([
    prisma.document.findMany({ where:{patientId:p.id}, orderBy:{createdAt:'asc'}}),
    prisma.clinicalEvent.findMany({ where:{patientId:p.id}, orderBy:{date:'asc'}}),
    prisma.medication.findMany({ where:{patientId:p.id}}),
    prisma.investigation.findMany({ where:{patientId:p.id}}),
    prisma.labResult.findMany({ where:{patientId:p.id}}),
    prisma.vital.findMany({ where:{patientId:p.id}}),
    prisma.referral.findMany({ where:{patientId:p.id}}),
    prisma.followUp.findMany({ where:{patientId:p.id}}),
    prisma.clinicalFinding.findMany({ where:{patientId:p.id}}),
    prisma.careLoop.findMany({ where:{patientId:p.id}}),
    prisma.documentationConflict.findMany({ where:{patientId:p.id}}),
    prisma.generatedBrief.findMany({ where:{patientId:p.id}, orderBy:{createdAt:'desc'}}),
    prisma.documentChunk.findMany({ where:{ document:{patientId:p.id}}}),
  ]);

  // Rebuild analysis from stored documents using the shared engine
  const docs = documents.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  let analysis = null;
  if (docs.length) {
    try { analysis = analyseBridge(docs).analysis; } catch { analysis = null; }
  }

  res.json({ patient:p, documents, events, medications, investigations, labs, vitals, referrals, followups, findings, careLoops, conflicts, briefs, chunks, analysis });
});

// Upload document
r.post('/:id/documents', upload.single('file'), async (req: AuthRequest, res) => {
  const patient = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let fullText = '';
  let pages: Array<{ page:number; text:string }> = [];
  try {
    if (req.file.mimetype==='application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
      const pdfParse: any = (await import('pdf-parse')).default;
      const data = await pdfParse(new Uint8Array(req.file.buffer));
      fullText = data.text || '';
      const rawPages = fullText.split('\f');
      pages = rawPages.map((t:string,i:number)=>({ page:i+1, text:t }));
      if (pages.length===1 && fullText.length>0) {
        const approxPages = Math.ceil(fullText.length/2500);
        pages = Array.from({length: approxPages}, (_,i)=>({ page:i+1, text: fullText.slice(i*2500,(i+1)*2500)}));
      }
    } else {
      fullText = req.file.buffer.toString('utf-8');
      pages = [{ page:1, text: fullText }];
    }
  } catch (e:any) { return res.status(400).json({ error: 'Failed to extract document: '+e.message }); }

  if (!fullText.trim()) return res.status(400).json({ error: 'No text extracted from document' });

  // Save document
  const doc = await prisma.document.create({ data:{
    patientId: patient.id, filename: req.file.originalname, originalName: req.file.originalname,
    mimeType: req.file.mimetype, size: req.file.size, pageCount: pages.length, text: fullText
  }});
  for (const pg of pages) {
    const chunks = chunkText(pg.text, pg.page);
    for (const c of chunks) await prisma.documentChunk.create({ data:{ documentId:doc.id, page:c.page, index:c.index, text:c.text }});
  }

  // Re-extract from ALL documents for longitudinal view using the shared engine
  const allDocs = await prisma.document.findMany({ where:{patientId:patient.id}});
  const bridgeDocs = allDocs.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  const { analysis, chunks: allChunks } = analyseBridge(bridgeDocs);

  // Clear and re-create derived data
  await prisma.$transaction([
    prisma.clinicalEvent.deleteMany({ where:{patientId:patient.id}}),
    prisma.medication.deleteMany({ where:{patientId:patient.id}}),
    prisma.investigation.deleteMany({ where:{patientId:patient.id}}),
    prisma.labResult.deleteMany({ where:{patientId:patient.id}}),
    prisma.vital.deleteMany({ where:{patientId:patient.id}}),
    prisma.referral.deleteMany({ where:{patientId:patient.id}}),
    prisma.followUp.deleteMany({ where:{patientId:patient.id}}),
    prisma.clinicalFinding.deleteMany({ where:{patientId:patient.id}}),
    prisma.careLoop.deleteMany({ where:{patientId:patient.id}}),
    prisma.documentationConflict.deleteMany({ where:{patientId:patient.id}}),
  ]);

  for (const e of analysis.events) await prisma.clinicalEvent.create({ data:{ patientId:patient.id, date:e.date, type:e.type, title:e.title, description:e.description, documentId:e.evidence.documentId, page:e.evidence.page, sourceText:e.evidence.text }});
  for (const m of analysis.medications) await prisma.medication.create({ data:{ patientId:patient.id, name:m.name, dose:m.dose, frequency:m.frequency, route:m.route, status:m.status, startDate:m.startDate, stopDate:m.stopDate, documentId:m.evidence.documentId, page:m.evidence.page, sourceText:m.evidence.text }});
  for (const inv of analysis.investigations) await prisma.investigation.create({ data:{ patientId:patient.id, name:inv.name, orderedDate:inv.orderedDate, performedDate:inv.performedDate, status:inv.status, result:inv.result, finding:inv.finding, documentId:inv.evidence[0]?.documentId, page:inv.evidence[0]?.page, sourceText:inv.evidence[0]?.text }});
  for (const l of analysis.labs) await prisma.labResult.create({ data:{ patientId:patient.id, test:l.test, value:l.value, unit:l.unit, referenceRange:l.referenceRange, date:l.date, documentId:l.evidence.documentId, page:l.evidence.page, sourceText:l.evidence.text }});
  for (const v of analysis.vitals) await prisma.vital.create({ data:{ patientId:patient.id, type:v.type, value:v.value, unit:v.unit, date:v.date, documentId:v.evidence.documentId, page:v.evidence.page, sourceText:v.evidence.text }});
  for (const rf of analysis.referrals) await prisma.referral.create({ data:{ patientId:patient.id, specialty:rf.specialty, date:rf.date, reason:rf.reason, outcome:rf.outcome, documentId:rf.evidence[0]?.documentId, page:rf.evidence[0]?.page, sourceText:rf.evidence[0]?.text }});
  for (const fu of analysis.followUps) await prisma.followUp.create({ data:{ patientId:patient.id, description:fu.description, recommendedDate:fu.recommendedDate, actualDate:fu.actualDate, outcome:fu.outcome, documentId:fu.evidence[0]?.documentId, page:fu.evidence[0]?.page, sourceText:fu.evidence[0]?.text }});
  for (const fn of analysis.findings) await prisma.clinicalFinding.create({ data:{ patientId:patient.id, finding:fn.finding, date:fn.date, documentId:fn.evidence.documentId, page:fn.evidence.page, sourceText:fn.evidence.text }});
  for (const cl of analysis.careLoops) await prisma.careLoop.create({ data:{ patientId:patient.id, type:cl.type, name:cl.name, status:cl.status, orderedDate:cl.orderedDate, completedDate:cl.completedDate, result:cl.result, lastMention:cl.lastMention, evidence: JSON.stringify(cl.evidence)}});
  for (const cf of analysis.conflicts) await prisma.documentationConflict.create({ data:{ patientId:patient.id, field:cf.field, entity:cf.entity, status:cf.status, entries: JSON.stringify(cf.entries), evidence: JSON.stringify(cf.entries)}});

  // Update patient demographics if found
  const patch: any = {};
  if (analysis.patient.patientId) patch.patientId = analysis.patient.patientId;
  if (analysis.patient.age) patch.age = analysis.patient.age;
  if (analysis.patient.sex) patch.sex = analysis.patient.sex;
  if (analysis.patient.dob) patch.dob = analysis.patient.dob;
  if (analysis.patient.recordStart) patch.recordStart = analysis.patient.recordStart;
  if (analysis.patient.recordEnd) patch.recordEnd = analysis.patient.recordEnd;
  if (analysis.patient.name && !patient.name) patch.name = analysis.patient.name;
  if (Object.keys(patch).length) await prisma.patientRecord.update({ where:{id:patient.id}, data: patch });

  res.json({ document: doc, analysis, changeMap: analysis.changeMap, careLoops: analysis.careLoops, conflicts: analysis.conflicts, attention: analysis.attention });
});

// Delete patient
r.delete('/:id', async (req: AuthRequest, res)=>{
  const p = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!p) return res.status(404).json({ error: 'Not found' });
  await prisma.patientRecord.delete({ where:{ id:req.params.id }});
  res.json({ ok:true });
});

// Search within patient (grounded retrieval)
r.get('/:id/search', async (req: AuthRequest, res)=>{
  const patient = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!patient) return res.status(404).json({ error: 'Not found' });
  const q = (req.query.q as string || '').trim();
  if (!q) return res.json({ results:[] });
  const [documents, chunks] = await Promise.all([
    prisma.document.findMany({ where:{patientId:patient.id}}),
    prisma.documentChunk.findMany({ where:{ document:{patientId:patient.id}}}),
  ]);
  const docs = documents.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  if (!docs.length) return res.json({ results:[], message:'No documents available.' });
  const { analysis } = analyseBridge(docs);
  const result = searchBridge(analysis, chunks.map(c => ({ id:c.id, documentId:c.documentId, documentName:'', page:c.page, index:c.index, text:c.text })), q);
  res.json(result);
});

// Answer a question from the record
r.post('/:id/ask', async (req: AuthRequest, res)=>{
  const patient = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!patient) return res.status(404).json({ error: 'Not found' });
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Question required' });
  const [documents, chunks] = await Promise.all([
    prisma.document.findMany({ where:{patientId:patient.id}}),
    prisma.documentChunk.findMany({ where:{ document:{patientId:patient.id}}}),
  ]);
  const docs = documents.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  if (!docs.length) return res.json({ answer:'No documents available.', provenance:'UNKNOWN', hits:[] });
  const { analysis } = analyseBridge(docs);
  const result = answerBridge(analysis, chunks.map(c => ({ id:c.id, documentId:c.documentId, documentName:'', page:c.page, index:c.index, text:c.text })), question);
  res.json(result);
});

// Brief generation
r.post('/:id/briefs', async (req: AuthRequest, res)=>{
  const patient = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!patient) return res.status(404).json({ error: 'Not found' });
  const { type, specialty } = req.body;
  const [documents, chunks] = await Promise.all([
    prisma.document.findMany({ where:{patientId:patient.id}}),
    prisma.documentChunk.findMany({ where:{ document:{patientId:patient.id}}}),
  ]);
  const docs = documents.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  if (!docs.length) return res.status(400).json({ error: 'No documents to base a brief on' });
  const { analysis } = analyseBridge(docs);
  const brief = briefsBridge(analysis, chunks.map(c => ({ id:c.id, documentId:c.documentId, documentName:'', page:c.page, index:c.index, text:c.text })), type, specialty);
  const saved = await prisma.generatedBrief.create({ data:{ patientId:patient.id, type, specialty, content: brief.plainText }});
  res.json({ ...brief, id: saved.id });
});

// BYOAI context
r.get('/:id/byoai-context', async (req: AuthRequest, res)=>{
  const patient = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!patient) return res.status(404).json({ error: 'Not found' });
  const [documents, chunks] = await Promise.all([
    prisma.document.findMany({ where:{patientId:patient.id}}),
    prisma.documentChunk.findMany({ where:{ document:{patientId:patient.id}}}),
  ]);
  const docs = documents.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  if (!docs.length) return res.json({ context:'No documents available.' });
  const { analysis } = analyseBridge(docs);
  const pkg = byoaiBridge(analysis, chunks.map(c => ({ id:c.id, documentId:c.documentId, documentName:'', page:c.page, index:c.index, text:c.text })));
  res.json(pkg);
});

// Analytics per patient
r.get('/:id/analytics', async (req: AuthRequest, res)=>{
  const patient = await prisma.patientRecord.findFirst({ where:{ id:req.params.id, userId:req.userId! }});
  if (!patient) return res.status(404).json({ error: 'Not found' });
  const documents = await prisma.document.findMany({ where:{patientId:patient.id}});
  const docs = documents.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  if (!docs.length) return res.json({ totals:{ documents:0, events:0, medications:0, medicationChanges:0, investigations:0, labs:0, vitals:0, referrals:0, followUps:0, findings:0, evidenceReferences:0 }, eventsByType:[], investigationsByStatus:[], careLoopsByStatus:[], eventsByMonth:[], medicationTimeline:[], labTable:[], recentActivity:[], attentionBreakdown:[] });
  const { analysis } = analyseBridge(docs);
  res.json(analyticsBridge(analysis));
});

// Compare two patients
r.post('/compare', async (req: AuthRequest, res)=>{
  const { aId, bId } = req.body;
  if (!aId || !bId) return res.status(400).json({ error: 'Two patient IDs required' });
  const [a, b] = await Promise.all([
    prisma.patientRecord.findFirst({ where:{ id:aId, userId:req.userId! }}),
    prisma.patientRecord.findFirst({ where:{ id:bId, userId:req.userId! }}),
  ]);
  if (!a || !b) return res.status(404).json({ error: 'One or both patients not found or not owned' });
  const [aDocs, bDocs] = await Promise.all([
    prisma.document.findMany({ where:{patientId:a.id}}),
    prisma.document.findMany({ where:{patientId:b.id}}),
  ]);
  const aBridge = aDocs.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  const bBridge = bDocs.map(d => ({ id: d.id, name: d.originalName, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const, text: d.text }));
  const aAnalysis = aBridge.length ? analyseBridge(aBridge).analysis : null;
  const bAnalysis = bBridge.length ? analyseBridge(bBridge).analysis : null;
  if (!aAnalysis || !bAnalysis) return res.status(400).json({ error: 'Both patients need at least one document to compare' });
  res.json(compareBridge(aAnalysis, bAnalysis));
});

export default r;