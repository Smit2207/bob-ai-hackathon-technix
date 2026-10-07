/** Date normalisation + clinical text utilities shared by browser and server. */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface DateHit {
  iso: string;
  raw: string;
  index: number;
}

/** Both full and abbreviated forms, so "12 Jan 2026" and "12 January 2026" both parse. */
const MONTH_NAMES =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

/** Returns true when the text looks like a clinical record rather than prose. */
export function looksLikeClinicalRecord(text: string): boolean {
  if (!text || text.trim().length < 40) return false;
  const signals = [
    /\b(patient|pt)\b/i,
    /\b(admission|admitted|discharge|discharged)\b/i,
    /\b(diagnosis|diagnoses|history|assessment|plan)\b/i,
    /\b(medication|medicines|prescription|dose|mg)\b/i,
    /\b(allerg|referral|follow[- ]?up|investigat\w+)\b/i,
    /\b(clinician|doctor|dr\.?|ward|clinic|hospital|trust)\b/i,
    /\b(impression|impression:)\b/i,
  ];
  const hits = signals.filter((r) => r.test(text)).length;
  return hits >= 2;
}

function iso(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const yyyy = y < 100 ? 2000 + y : y;
  return `${yyyy}-${mm}-${dd}`;
}

/** Finds every clinically meaningful date in the text, normalised to ISO. */
export function findDates(text: string): DateHit[] {
  const out: DateHit[] = [];
  const push = (m: RegExpExecArray) => {
    const raw = m[0];
    const v = normaliseDate(raw);
    if (v) out.push({ iso: v, raw: raw.trim(), index: m.index });
  };

  // 12 Jan 2026 / 12 January 2026 / 12-Jan-26
  const re1 = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/]+(${MONTH_NAMES})[a-z]*[\\s\\-/]+(\\d{2,4})\\b`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)) !== null) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    const v = iso(parseInt(m[3], 10), mo, parseInt(m[1], 10));
    if (v) out.push({ iso: v, raw: m[0].trim(), index: m.index });
  }

  // 2026-01-12
  const re2 = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  while ((m = re2.exec(text)) !== null) {
    const v = iso(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
    if (v) out.push({ iso: v, raw: m[0], index: m.index });
  }

  // 12/01/2026 (day-first, UK clinical convention) and 12/01/26
  const re3 = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
  while ((m = re3.exec(text)) !== null) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    // Numeric dates are read day-first. Only when the second
    // component cannot be a month is the order read as
    // month-first (MM/DD/YYYY).
    const v = b <= 12 ? iso(y, b, a) : iso(y, a, b);
    if (v) out.push({ iso: v, raw: m[0], index: m.index });
  }

  return out.sort((a, b) => a.index - b.index);
}

/** Normalises a single date expression to ISO, or null. */
export function normaliseDate(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(
    new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/]+(${MONTH_NAMES})[a-z]*[\\s\\-/]+(\\d{2,4})`, 'i')
  );
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    return iso(parseInt(m[3], 10), mo, parseInt(m[1], 10));
  }
  const m2 = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) return iso(+m2[1], +m2[2], +m2[3]);
  const m3 = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m3) {
    const a = +m3[1];
    const b = +m3[2];
    const y = +m3[3];
    // Day-first unless the second component cannot be a month.
    return b <= 12 ? iso(y, b, a) : iso(y, a, b);
  }
  return null;
}

export function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'Not documented';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const names = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${parseInt(m[3], 10)} ${names[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

export function dateSortKey(isoDate: string | null): number {
  if (!isoDate) return -Infinity;
  const t = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isNaN(t) ? -Infinity : t;
}

/** Collapses whitespace and strips common PDF artefact characters. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/•/g, '•')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Best-effort sentence/line window around a match, used for evidence text. */
export function evidenceWindow(text: string, index: number, length: number): string {
  const from = Math.max(0, index - 90);
  const to = Math.min(text.length, index + length + 140);
  let out = text.slice(from, to).replace(/\s+/g, ' ').trim();
  if (from > 0) out = '…' + out;
  if (to < text.length) out = out + '…';
  return out;
}

export function sentenceAround(text: string, index: number, length: number): string {
  return sentenceAt(text, index) ?? text.slice(Math.max(0, index - 60), Math.min(text.length, index + length + 120)).replace(/\s+/g, ' ').trim();
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/**
 * Splits text into sentences while preserving character offsets.
 *
 * Newlines are treated as whitespace, not sentence boundaries, because clinical
 * records hard-wrap prose across lines: breaking at a newline would separate
 * "Chest X-ray on 23 Jan 2026" from "showed resolution of ...".
 * A full stop between digits is a decimal point, not a boundary.
 */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (start === -1) {
      if (!/\s/.test(ch)) start = i;
      continue;
    }
    const isBreak = ch === '.' || ch === ';' || ch === ':' || ch === '!' || ch === '?';
    if (!isBreak) continue;
    if (ch === '.' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) continue;
    // Consume the break plus trailing quotes / brackets.
    let end = i + 1;
    while (end < text.length && /["')\]]/.test(text[end])) end += 1;
    out.push({ text: text.slice(start, end).trim(), start, end });
    start = -1;
  }
  if (start !== -1 && text.slice(start).trim()) {
    out.push({ text: text.slice(start).trim(), start, end: text.length });
  }
  return out;
}

/** Returns the full sentence containing the given character offset. */
export function sentenceAt(text: string, index: number): string | null {
  const list = sentences(text);
  for (const s of list) {
    if (index >= s.start && index <= s.end) return s.text;
  }
  return list.length ? list[0].text : null;
}

/** Character offset of a sentence within its page text. */
export function sentenceOffset(pageText: string, sentence: string): number {
  const idx = pageText.indexOf(sentence);
  return idx >= 0 ? idx : 0;
}

export interface Unit {
  text: string;
  start: number;
  end: number;
  /** True when the unit is a section heading rather than a clinical statement. */
  isHeading: boolean;
  /** True when a section heading was absorbed into the front of this unit. */
  fromHeading: boolean;
}

function isUpperHeading(s: string): boolean {
  const t = s.trim();
  if (t.length === 0 || t.length > 70) return false;
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}

/**
 * Words that end a line only when the sentence continues on
 * the next line: articles, auxiliaries, prepositions,
 * conjunctions and pronouns. A line ending in one of these
 * is mid-sentence, so clinical hard-wrapping must be undone.
 */
const CONTINUATION_WORD =
  /\b(?:and|or|with|of|to|for|in|on|at|from|by|the|a|an|is|are|was|were|has|have|had|am|been|being|be|do|does|did|will|would|can|could|shall|should|may|might|must|that|which|who|whom|whose|this|these|those|not|but|if|when|than|as|also|such|so|yet|both|either|neither|next|last|following|previous|above|below|into|onto|upon|over|under|between|during|before|after|since|until|while|because|although|though|unless|whereas|whether|each|every|some|any|all|few|many|much|more|most|other|another|same|own|very|just|only|even|still|already|now|then|here|there|where|why|how|what|per|via|etc|his|her|their|our|your|my|its|he|she|they|we|you|it|him|them|us|me|no)\s*$/i;

/**
 * Splits a page into clinically meaningful units.
 *
 * Clinical records are line oriented, so a bare line split shreds sentences
 * ("INVESTIGATIONS PERFORMED TODAY" / "Lung function testing ..."). Units
 * therefore join a heading or list lead-in with the lines that continue it.
 */
export function units(text: string): Unit[] {
  const lines: Unit[] = [];
  const re = /[^\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (!t) continue;
    const isHeading = isUpperHeading(t);
    lines.push({
      text: t,
      start: m.index + lead,
      end: m.index + raw.length,
      isHeading,
      // A line sitting directly under a heading still carries that heading's
      // context even when the two are not merged into one unit.
      fromHeading: !isHeading && lines.length > 0 && lines[lines.length - 1].isHeading,
    });
  }

  const out: Unit[] = [];
  let i = 0;
  while (i < lines.length) {
    let cur = lines[i];
    const fromHeading = cur.fromHeading;
    let guard = 0;
    while (guard < 8 && i + 1 < lines.length) {
      const next = lines[i + 1];
      const t = cur.text;
      // A heading owns the line below it only when that line reads as a
      // continuation of it. A heading followed by a list of independent
      // statements must not absorb them into a single unreadable unit.
      const headingContinues =
        cur.isHeading &&
        (!/^[\s]*[A-Z0-9]/.test(next.text) || /[:]$/.test(t));
      const continues =
        !next.isHeading &&
        (/[:]$/.test(t) ||
          /[,;+\/]$/.test(t) ||
          /\b(?:and|or|with|of|to|for)\s*$/i.test(t) ||
          CONTINUATION_WORD.test(t) ||
          headingContinues);
      if (!continues) break;
      i += 1;
      cur = {
        text: `${cur.text} ${next.text}`,
        start: cur.start,
        end: next.end,
        isHeading: false,
        fromHeading,
      };
      guard += 1;
    }
    out.push(cur);
    i += 1;
  }
  return out;
}

/**
 * Splits normalised record text into page-preserving chunks.
 * Chunk boundaries follow sentence boundaries so evidence text stays readable.
 */
export function chunkPage(
  text: string,
  documentId: string,
  documentName: string,
  page: number,
  targetSize = 900
): Array<{ documentId: string; documentName: string; page: number; index: number; text: string }> {
  const out: Array<{ documentId: string; documentName: string; page: number; index: number; text: string }> = [];
  if (!text.trim()) return out;
  const sentences = text.split(/(?<=[.;:\n])\s+/).filter((s) => s.trim().length > 0);
  let buf = '';
  let idx = 0;
  for (const s of sentences) {
    if (buf.length + s.length > targetSize && buf.length > 0) {
      out.push({ documentId, documentName, page, index: idx++, text: buf.trim() });
      buf = s;
    } else {
      buf += (buf ? ' ' : '') + s;
    }
  }
  if (buf.trim()) out.push({ documentId, documentName, page, index: idx, text: buf.trim() });
  return out;
}
