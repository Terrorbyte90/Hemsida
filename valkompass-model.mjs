export const PARTIES = ['S','M','SD','V','C','MP','KD','L'];
export const TOPICS = ['ekonomi','välfärd','klimat','migration','trygghet','energi','europa','demokrati','skola','arbetsmarknad','bostad','försvar','jämställdhet','landsbygd'];
export const PARTY_POSITIONS = {
  ekonomi:{S:0,M:2,SD:1,V:-2,C:2,MP:-1,KD:1,L:2}, välfärd:{S:2,M:0,SD:0,V:2,C:-1,MP:1,KD:1,L:0},
  klimat:{S:1,M:-1,SD:-2,V:2,C:1,MP:2,KD:-1,L:1}, migration:{S:-1,M:-1,SD:-2,V:2,C:1,MP:2,KD:-1,L:0},
  trygghet:{S:1,M:2,SD:2,V:-1,C:0,MP:-1,KD:1,L:1}, energi:{S:1,M:2,SD:2,V:-1,C:1,MP:-2,KD:1,L:1},
  europa:{S:1,M:1,SD:-2,V:-1,C:2,MP:2,KD:1,L:2}, demokrati:{S:1,M:1,SD:-1,V:1,C:1,MP:1,KD:1,L:1},
  skola:{S:1,M:1,SD:1,V:1,C:0,MP:1,KD:1,L:2}, arbetsmarknad:{S:1,M:2,SD:1,V:-1,C:2,MP:0,KD:1,L:2},
  bostad:{S:1,M:-1,SD:0,V:2,C:0,MP:1,KD:0,L:-1}, försvar:{S:1,M:2,SD:2,V:-1,C:1,MP:0,KD:2,L:2},
  jämställdhet:{S:2,M:1,SD:-1,V:2,C:1,MP:2,KD:0,L:2}, landsbygd:{S:1,M:1,SD:2,V:0,C:2,MP:0,KD:2,L:1}
};
export const PARTY_SOURCES = {
  S:'https://www.socialdemokraterna.se/val-2026', M:'https://moderaterna.se/valmanifest-2026/',
  SD:'https://event.sd.se/wp-content/uploads/2026/05/valplattform-2026.pdf', V:'https://www.vansterpartiet.se/val2026/valplattform-2026-lattlast/',
  C:'https://val2026.centerpartiet.se/', MP:'https://www.mp.se/valmanifest2026/',
  KD:'https://kristdemokraterna.se/var-politik/val-2026/valmanifest', L:'https://www.liberalerna.se/var-politik-valet-2026'
};

export function scoreAnswers(answers = {}, priorities = {}) {
  const totals = Object.fromEntries(PARTIES.map(p => [p, {distance:0, weight:0}]));
  for (const topic of TOPICS) { const answer = Number(answers[topic] || 0); const weight = Number(priorities[topic] || 1); for (const p of PARTIES) { totals[p].distance += Math.abs(answer - PARTY_POSITIONS[topic][p]) * weight; totals[p].weight += 4 * weight; } }
  const scores = Object.fromEntries(PARTIES.map(p => [p, Math.round(100 * (1 - totals[p].distance / Math.max(1, totals[p].weight)))]));
  for (const p of PARTIES) { const accept = Number(answers[`accept_${p}`] || 0); scores[p] += accept * Number(priorities[`accept_${p}`] || 1) * 2; scores[p] = Math.max(0, Math.min(100, Math.round(scores[p]))); }
  return scores;
}

export function buildProfile(answers = {}, priorities = {}, acceptances = {}) {
  const priorityEntries = TOPICS.map(key => ({key, value:Number(priorities[key] || 0)})).sort((a,b)=>b.value-a.value);
  const stance = Object.fromEntries(TOPICS.map(key => [key, Number(answers[key]||0) > .4 ? 'för' : Number(answers[key]||0) < -.4 ? 'emot' : 'blandad']));
  return { priorities: priorityEntries, stance, acceptances };
}

export function matchConfidence(scores = {}) {
  const values = Object.values(scores).sort((a,b) => b-a);
  const gap = Math.max(0, (values[0] ?? 0) - (values[1] ?? 0));
  return { gap, label: gap >= 12 ? 'tydlig' : gap >= 6 ? 'måttlig' : 'låg' };
}
