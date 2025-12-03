
// localAI.js - Ultra Simulation Engine (local, no API)
import healthData from './healthData.js';

function normalize(s){ return (s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
function simTokens(a,b){
  a = normalize(a); b = normalize(b);
  if(!a||!b) return 0;
  const sa = new Set(a.split(' ')); const sb = new Set(b.split(' '));
  let inter=0; sa.forEach(t=>{ if(sb.has(t)) inter++; });
  return inter/Math.max(1, Math.max(sa.size, sb.size));
}
function scoreEntry(input, entry){
  const s1 = simTokens(input, entry.symptom);
  const s2 = entry.aliases? entry.aliases.reduce((m,al)=> Math.max(m, simTokens(input, al)), 0):0;
  const norm = normalize(input);
  let boost = 0; if(normalize(entry.symptom).includes(norm) && norm.length>2) boost = 0.15;
  return Math.min(1, s1*0.7 + s2*0.7 + boost);
}
const LocalAI = {
  data: healthData,
  findMatches(input, topN=5){
    const scores = this.data.map(e=>({id:e.id, score:scoreEntry(input,e), entry:e}));
    scores.sort((a,b)=> b.score - a.score);
    return scores.slice(0, topN).map(s=>({id:s.id, score:+s.score.toFixed(3), symptom:s.entry.symptom, specialist:s.entry.specialist}));
  },
  getClarifyingQuestions(matchId){
    const e = this.data.find(x=>x.id===matchId); if(!e) return [];
    return e.questions.slice(0,6);
  },
  analyze(matchId, answersMap){
    const e = this.data.find(x=>x.id===matchId); if(!e) return {error:'not found'};
    const answersText = Object.values(answersMap||{}).join(' ');
    const overlap = simTokens(e.symptom + ' ' + (e.aliases||[]).join(' '), answersText);
    const baseProb = Math.min(0.95, 0.4 + overlap*0.6);
    const neighbors = this.data.map(x=>({id:x.id,score:simTokens(e.symptom,x.symptom), symptom:x.symptom}));
    neighbors.sort((a,b)=> b.score - a.score);
    const possible = neighbors.slice(1,6).slice(0,3).map((n,i)=>({ name: n.symptom, probability: +(Math.max(0.03, (baseProb*(0.7 - i*0.18))).toFixed(2)) }));
    const structured = {
      urgency: (e.risk_level==='emergency'||e.risk_level==='high')? 'see-doctor-soon' : (e.risk_level==='medium' ? 'see-doctor-soon' : 'self-care'),
      specialist: e.specialist||null,
      household_care: e.household_cure.slice(0,6),
      possible_diagnoses: possible.map(p=>p.name),
      prescription_suggestions: e.prescriptions.slice(0,6),
      explain: e.explain
    };
    const diagnosisText = `Likely: ${e.symptom}. Suggested care: ${structured.household_care.slice(0,3).join('; ')}. If symptoms worsen, consult ${structured.specialist}.`;
    return { structured, diagnosisText, probabilities: possible, matched: e };
  },
  generateReport(matchId, answersMap, userNotes){
    const analysis = this.analyze(matchId, answersMap);
    const now = new Date().toISOString();
    return { id: 'localai-'+matchId+'-'+now, createdAt: now, inputAnswers: answersMap, result: analysis, notes: userNotes||'' };
  }
};
export default LocalAI;
