// Intelligence engines: ChangeMap, CareLoop, Drift, Attention

export interface ChangeItem { entity: string; field: string; from?: string; to?: string; date: string; classification: 'NEW'|'CHANGED'|'REPEATED'|'RESOLVED'|'OPEN'|'CONFLICTING'; evidence: any[]; }
export interface CareLoop { type: string; name: string; status: 'OPEN'|'RESOLVED'|'PARTIAL'; orderedDate?: string; completedDate?: string; result?: string; lastMention?: string; evidence: any[]; }
export interface Conflict { field: string; entity: string; entries: Array<{ value: string; date?: string; source: string; page?: number }>; status: string; }

export function buildChangeMap(meds: any[], investigations: any[], events: any[]): ChangeItem[] {
  const items: ChangeItem[] = [];
  // Medication changes
  const byName: Record<string, any[]> = {};
  for (const m of meds) { const k = m.name.toLowerCase(); (byName[k] = byName[k]||[]).push(m); }
  for (const [name, list] of Object.entries(byName)) {
    if (list.length === 1) {
      items.push({ entity: list[0].name, field: 'Medication', to: list[0].dose || 'unknown dose', date: list[0].startDate || '', classification: 'NEW', evidence: list });
    } else {
      const doses = [...new Set(list.map(x=>x.dose))];
      if (doses.length > 1) {
        // Check if conflicting (dose goes back)
        const uniqueCount = doses.length;
        const first = list[0].dose, last = list[list.length-1].dose;
        if (uniqueCount === 2 && first !== last) {
          items.push({ entity: list[0].name, field: 'Medication', from: first, to: last, date: list[list.length-1].startDate || '', classification: 'CHANGED', evidence: list });
        } else if (uniqueCount > 2 || (first === last && doses.length>1)) {
          items.push({ entity: list[0].name, field: 'Medication', from: first, to: last, date: list[list.length-1].startDate || '', classification: 'CONFLICTING', evidence: list });
        } else {
          items.push({ entity: list[0].name, field: 'Medication', from: first, to: last, date: list[list.length-1].startDate || '', classification: 'CHANGED', evidence: list });
        }
      } else {
        items.push({ entity: list[0].name, field: 'Medication', to: doses[0], date: list[0].startDate || '', classification: 'REPEATED', evidence: list });
      }
    }
  }
  // Investigation changes
  const invByName: Record<string, any[]> = {};
  for (const inv of investigations) { const k=inv.name.toLowerCase(); (invByName[k]=invByName[k]||[]).push(inv); }
  for (const [name, list] of Object.entries(invByName)) {
    if (list.length===1) {
      const s = list[0].status;
      items.push({ entity: list[0].name, field: 'Investigation', to: s, date: list[0].orderedDate||list[0].performedDate||'', classification: s==='ORDERED'?'OPEN': s==='RESULT_AVAILABLE'?'RESOLVED':'NEW', evidence: list });
    } else {
      const statuses = list.map(x=>x.status);
      if (statuses.includes('ORDERED') && statuses.includes('RESULT_AVAILABLE')) {
        items.push({ entity: list[0].name, field: 'Investigation', from: 'ORDERED', to: 'RESULT_AVAILABLE', date: list[list.length-1].performedDate||'', classification: 'RESOLVED', evidence: list });
      } else if (statuses.every(s=>s==='ORDERED')) {
        items.push({ entity: list[0].name, field: 'Investigation', to: 'ORDERED', date: list[0].orderedDate||'', classification: 'OPEN', evidence: list });
      } else {
        items.push({ entity: list[0].name, field: 'Investigation', to: statuses[statuses.length-1], date: '', classification: 'CHANGED', evidence: list });
      }
    }
  }
  return items;
}

export function buildCareLoops(investigations: any[], referrals: any[], followups: any[]): CareLoop[] {
  const loops: CareLoop[] = [];
  for (const inv of investigations) {
    // Each investigation forms a loop
    let status: CareLoop['status'] = 'OPEN';
    if (inv.status === 'RESULT_AVAILABLE' || inv.result) status='RESOLVED';
    else if (inv.status === 'COMPLETED') status='PARTIAL';
    else status='OPEN';
    loops.push({ type: 'Investigation', name: inv.name, status, orderedDate: inv.orderedDate, completedDate: inv.performedDate, result: inv.result, evidence: [inv] });
  }
  for (const r of referrals) {
    const status = r.outcome ? 'RESOLVED' : 'OPEN';
    loops.push({ type: 'Referral', name: `Referral to ${r.specialty}`, status, orderedDate: r.date, result: r.outcome, evidence: [r] });
  }
  for (const f of followups) {
    const status = f.actualDate ? 'RESOLVED' : 'OPEN';
    loops.push({ type: 'Follow-up', name: f.description.slice(0,60), status, orderedDate: f.recommendedDate, completedDate: f.actualDate, evidence: [f] });
  }
  // Deduplicate by name+type keeping latest
  const dedup: Record<string, CareLoop> = {};
  for (const l of loops) {
    const k = l.type+':'+l.name.toLowerCase();
    if (!dedup[k] || (l.status==='RESOLVED' && dedup[k].status!=='RESOLVED')) dedup[k]=l;
    else if (!dedup[k]) dedup[k]=l;
  }
  return Object.values(dedup);
}

export function buildConflicts(meds: any[], investigations: any[], fullText: string): Conflict[] {
  const conflicts: Conflict[] = [];
  // Medication dose conflicts
  const byName: Record<string, any[]> = {};
  for (const m of meds) { const k=m.name.toLowerCase(); (byName[k]=byName[k]||[]).push(m); }
  for (const [k, list] of Object.entries(byName)) {
    const doses=[...new Set(list.map(x=>x.dose).filter(Boolean))];
    if (doses.length>1) {
      conflicts.push({ field:'Medication dose', entity:list[0].name, entries:list.map(x=>({value:x.dose||'unknown', date:x.startDate, source:x.sourceText, page:x.page})), status:'CONFLICTING' });
    }
  }
  // Allergy conflict
  const hasNoAllergy = /no known allergies/i.test(fullText);
  const hasAllergy = /(allergy to|allergic to)\s+([A-Za-z]+)/i.test(fullText);
  if (hasNoAllergy && hasAllergy) {
    const m=fullText.match(/(allergy to|allergic to)\s+([A-Za-z]+)/i);
    conflicts.push({ field:'Allergy', entity:'Allergy status', entries:[{value:'No known allergies', source:'Document states no known allergies'},{value:`Allergy to ${m?.[2]||'unknown'}`, source:m?.[0]||''}], status:'CONFLICTING' });
  }
  // Smoking etc
  const smokingMatches=[...fullText.matchAll(/smoking\s*[:\-]?\s*(current|former|never|non-smoker|ex-smoker)/gi)];
  if (smokingMatches.length>1) {
    const vals=[...new Set(smokingMatches.map(m=>m[1].toLowerCase()))];
    if (vals.length>1) conflicts.push({ field:'Smoking status', entity:'Smoking', entries:smokingMatches.map(m=>({value:m[1], source:m[0]})), status:'CONFLICTING' });
  }
  return conflicts;
}

export function buildAttention(changeMap: ChangeItem[], careLoops: CareLoop[], conflicts: Conflict[]) {
  const items: Array<{ type: string; title: string; detail: string; priority: number }> = [];
  for (const c of careLoops.filter(x=>x.status==='OPEN')) items.push({ type:'Open Care Loop', title:c.name, detail:`Ordered ${c.orderedDate||'date unknown'} — no completion report found in available record.`, priority:1 });
  for (const c of conflicts) items.push({ type:'Documentation Conflict', title:c.entity, detail:`Conflicting documentation requires review.`, priority:1 });
  for (const ch of changeMap.filter(x=>x.classification==='CHANGED')) items.push({ type:'Medication Change', title:ch.entity, detail:`${ch.from||''} → ${ch.to||''}`, priority:2 });
  for (const ch of changeMap.filter(x=>x.classification==='NEW')) items.push({ type:'New Item', title:ch.entity, detail:`Newly documented`, priority:3 });
  for (const ch of changeMap.filter(x=>x.classification==='RESOLVED')) items.push({ type:'Recently Resolved', title:ch.entity, detail:`Resolved`, priority:4 });
  return items.sort((a,b)=>a.priority-b.priority);
}
