/**
 * Grounded lexical retrieval over the extracted patient record and the source
 * chunks. No vector database, no model inference — a query either matches
 * documented text or it does not. No match returns an explicit no-match result.
 */

import { Chunk, PatientAnalysis, SearchHit } from './types.js';
import { formatDate } from './text.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to',
  'for', 'and', 'or', 'what', 'whats', 'did', 'does', 'do', 'has',
  'have', 'had', 'patient', 'please', 'tell', 'me', 'about', 'his', 'her',
  'their', 'with', 'from', 'any', 'there', 'this', 'that', 'be', 'been',
  'as', 'by', 'we', 'i', 'you', 'they', 'he', 'she',
]);

export function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s\-/]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Scores how strongly a piece of text answers the query.
 * Phrase hits score highest, then per-token coverage.
 */
function scoreText(text: string, tokens: string[], phrase: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  if (phrase.length > 3 && lower.includes(phrase)) score += 12;
  for (const t of tokens) {
    if (lower.includes(t)) score += 3;
    else {
      // partial stem match (e.g. "medicat" in "medication")
      const stem = t.slice(0, Math.max(4, t.length - 2));
      if (stem.length >= 4 && lower.includes(stem)) score += 1;
    }
  }
  return score;
}

export interface RetrievalResult {
  hits: SearchHit[];
  noMatch: boolean;
  message: string | null;
  query: string;
}

export function searchPatient(
  analysis: PatientAnalysis,
  chunks: Chunk[],
  query: string
): RetrievalResult {
  const tokens = tokenize(query);
  const phrase = query.toLowerCase().trim();

  if (tokens.length === 0 && phrase.length < 2) {
    return {
      hits: [],
      noMatch: true,
      message: 'Please enter a clinical question to search the available record.',
      query,
    };
  }

  const hits: SearchHit[] = [];

  for (const c of chunks) {
    const s = scoreText(c.text, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'chunk',
        label: `${c.documentName} — page ${c.page}`,
        text: c.text,
        documentName: c.documentName,
        page: c.page,
        score: s + (c.text.toLowerCase().includes(phrase) ? 8 : 0),
        field: 'Source text',
      });
    }
  }

  for (const m of analysis.medications) {
    const s = scoreText(`${m.name} ${m.dose ?? ''} ${m.frequency ?? ''} ${m.documentedReason ?? ''}`, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'medication',
        label: `Medication: ${m.name}`,
        text: `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''} — status ${m.status}${m.startDate ? `, documented ${formatDate(m.startDate)}` : ''}`,
        documentName: m.evidence.documentName,
        page: m.evidence.page,
        score: s + 6,
        field: m.evidence.field,
      });
    }
  }

  for (const i of analysis.investigations) {
    const s = scoreText(`${i.name} ${i.status} ${i.result ?? ''} ${i.finding ?? ''}`, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'investigation',
        label: `Investigation: ${i.name}`,
        text: `${i.name} — ${i.status.replace(/_/g, ' ').toLowerCase()}${i.result ? `; result: ${i.result}` : ''}${i.orderedDate ? `; ordered ${formatDate(i.orderedDate)}` : ''}${i.performedDate ? `; performed ${formatDate(i.performedDate)}` : ''}`,
        documentName: i.evidence[0]?.documentName ?? '—',
        page: i.evidence[0]?.page ?? null,
        score: s + 6,
        field: i.evidence[0]?.field ?? 'Investigation',
      });
    }
  }

  for (const e of analysis.events) {
    const s = scoreText(`${e.title} ${e.description} ${e.type}`, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'event',
        label: `${e.type}: ${e.title}`,
        text: e.description,
        documentName: e.evidence.documentName,
        page: e.evidence.page,
        score: s + 4,
        field: e.evidence.field,
      });
    }
  }

  for (const f of analysis.findings) {
    const s = scoreText(f.finding, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'finding',
        label: 'Documented finding',
        text: f.finding,
        documentName: f.evidence.documentName,
        page: f.evidence.page,
        score: s + 4,
        field: f.evidence.field,
      });
    }
  }

  for (const l of analysis.labs) {
    const s = scoreText(`${l.test} ${l.value} ${l.unit ?? ''}`, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'lab',
        label: `Laboratory: ${l.test}`,
        text: `${l.test}: ${l.value}${l.unit ? ` ${l.unit}` : ''}${l.referenceRange ? ` (reference ${l.referenceRange})` : ''}${l.date ? ` — ${formatDate(l.date)}` : ''}`,
        documentName: l.evidence.documentName,
        page: l.evidence.page,
        score: s + 5,
        field: l.evidence.field,
      });
    }
  }

  for (const c of analysis.conflicts) {
    const s = scoreText(`${c.entity} ${c.field} ${c.entries.map((e) => e.value).join(' ')}`, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'conflict',
        label: `Documentation conflict: ${c.entity}`,
        text: `${c.field} — ${c.entries.map((e) => `${e.value}${e.date ? ` (${formatDate(e.date)})` : ''}`).join(' vs ')}. ${c.interpretation}`,
        documentName: '—',
        page: null,
        score: s + 5,
        field: c.field,
      });
    }
  }

  for (const l of analysis.careLoops) {
    const s = scoreText(`${l.name} ${l.type} ${l.status}`, tokens, phrase);
    if (s > 0) {
      hits.push({
        kind: 'careloop',
        label: `CareLoop: ${l.name}`,
        text: `${l.type} care loop — ${l.status}. ${l.stages
          .filter((st) => !st.documented)
          .map((st) => st.note)
          .join(' ')}`,
        documentName: l.evidence[0]?.documentName ?? '—',
        page: l.evidence[0]?.page ?? null,
        score: s + 5,
        field: 'CareLoop',
      });
    }
  }

  const ranked = hits
    .filter((h) => h.score > 3)
    .sort((a, b) => b.score - a.score || (a.page ?? 0) - (b.page ?? 0))
    .slice(0, 12);

  if (ranked.length === 0) {
    const searched = `${analysis.documents.length} document${analysis.documents.length === 1 ? '' : 's'}`;
    return {
      hits: [],
      noMatch: true,
      message: `I couldn't find that information in the available record. The ${searched} provided ${analysis.documents.length === 1 ? 'contains' : 'contain'} no matching text.`,
      query,
    };
  }

  return { hits: ranked, noMatch: false, message: null, query };
}

/**
 * Answers a question strictly from retrieved evidence.
 * Returns DOCUMENTED / UNKNOWN provenance and never fills gaps.
 */

/** A question about what the patient takes is answered from the
    documented medication list: the medications are the answer, and
    lexical matching cannot know that "taking" refers to them. */
const MEDICATION_INTENT =
  /\b(?:taking|take|taken|medications?|medicines?|prescriptions?|current\s+drugs?|what\s+drugs?)\b/i;

export function answerFromRecord(
  analysis: PatientAnalysis,
  chunks: Chunk[],
  question: string
): {
  answer: string;
  provenance: 'DOCUMENTED' | 'UNKNOWN';
  hits: SearchHit[];
} {
  if (MEDICATION_INTENT.test(question) && analysis.medications.length > 0) {
    const lines = analysis.medications.slice(0, 8).map((m) => {
      const src = m.evidence.page
        ? `${m.evidence.documentName}, page ${m.evidence.page}`
        : m.evidence.documentName;
      return `• Medication: ${m.name}${m.dose ? ` ${m.dose}` : ''}${
        m.frequency ? ` ${m.frequency}` : ''
      } — status ${m.status.toLowerCase()}${
        m.startDate ? `, documented ${formatDate(m.startDate)}` : ''
      } [${src}]`;
    });
    const hits: SearchHit[] = analysis.medications.slice(0, 4).map((m) => ({
      kind: 'medication',
      label: `Medication: ${m.name}`,
      text: `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''} — status ${m.status}`,
      documentName: m.evidence.documentName,
      page: m.evidence.page,
      score: 10,
      field: m.evidence.field,
    }));
    return {
      answer: `Based only on the document${analysis.documents.length === 1 ? '' : 's'} you provided:\n\n${lines.join('\n\n')}`,
      provenance: 'DOCUMENTED',
      hits,
    };
  }

  const result = searchPatient(analysis, chunks, question);
  if (result.noMatch) {
    return {
      answer:
        result.message ??
        `I couldn't find that information in the available record. ${
          analysis.patient.name ? `Nothing matching "${question}" was documented for ${analysis.patient.name} in the ${analysis.documents.length} document(s) provided.` : ''
        }`.trim(),
      provenance: 'UNKNOWN',
      hits: [],
    };
  }

  const top = result.hits.slice(0, 4);
  const lines = top.map((h) => {
    const src = h.page ? `${h.documentName}, page ${h.page}` : h.documentName;
    return `• ${h.label}: ${h.text.length > 320 ? h.text.slice(0, 320) + '…' : h.text} [${src}]`;
  });

  const otherDocs = analysis.documents.length - new Set(top.map((h) => h.documentName)).size;
  const tail =
    otherDocs > 0
      ? `\n\nOnly the ${analysis.documents.length} document(s) you provided were searched. ${otherDocs} further document(s) in the record contained no matching text.`
      : '';

  return {
    answer: `Based only on the document${analysis.documents.length === 1 ? '' : 's'} you provided:\n\n${lines.join('\n\n')}${tail}`,
    provenance: 'DOCUMENTED',
    hits: top,
  };
}