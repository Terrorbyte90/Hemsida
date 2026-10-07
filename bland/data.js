/* Teds Kalasfärg AB – simulerad data + datalager.
   Allt som rör hämtning/skrivning går via `Api` längst ner. När Business Central
   kopplas in byts implementationen där (OData/API v2.0: productionOrders,
   prodOrderComponents, items, qualityMeasures …) utan att UI:t behöver ändras. */

const MACHINES = [
  { id: 'stjarnan', name: 'Stjärnan', type: 'Dissolver 2 000 L', kg: [900, 1800] },
  { id: 'duon', name: 'Duon', type: 'Dubbelaxlad 3 000 L', kg: [1400, 3000] },
  { id: 'byttan', name: 'Byttan', type: 'Labbdissolver 1 000 L', kg: [300, 900] },
  { id: 'storduon', name: 'Storduon', type: 'Dubbelaxlad 10 000 L', kg: [6000, 9200] },
  { id: 'tranemo', name: 'Tranemo', type: 'Planetblandare 8 000 L', kg: [3000, 7200] },
  { id: 'loskarl', name: 'Löskärl', type: 'Flyttbart kärl 600 L', kg: [120, 520] },
];

const MATERIALS = [
  { no: 'RV0001', art: '810000', name: 'Vatten', cat: 'Lösningsmedel', stock: 99999, min: 0, bulk: true },
  { no: 'RV1101', art: '812101', name: 'Kronos 2310', cat: 'Pigment', stock: 18450, min: 4000 },
  { no: 'RV1102', art: '812140', name: 'Hydrocarb 90', cat: 'Fyllnadsmedel', stock: 32600, min: 6000 },
  { no: 'RV1103', art: '812155', name: 'Finntalc M15', cat: 'Fyllnadsmedel', stock: 7400, min: 2000 },
  { no: 'RV1104', art: '812160', name: 'Polestar 200P', cat: 'Fyllnadsmedel', stock: 5100, min: 1500 },
  { no: 'RV1105', art: '812188', name: 'Acematt TS 100', cat: 'Tillsats', stock: 310, min: 150 },
  { no: 'RV2001', art: '813012', name: 'Primal AC-337', cat: 'Bindemedel', stock: 24800, min: 5000 },
  { no: 'RV2002', art: '813027', name: 'Acronal S 790', cat: 'Bindemedel', stock: 13900, min: 5000 },
  { no: 'RV2003', art: '813044', name: 'Neopac E-125', cat: 'Bindemedel', stock: 2900, min: 2500 },
  { no: 'RV3001', art: '815310', name: 'Natrosol 250 HBR', cat: 'Reologi', stock: 64, min: 80 },
  { no: 'RV3002', art: '815322', name: 'Acrysol RM-8W', cat: 'Reologi', stock: 145, min: 120 },
  { no: 'RV3003', art: '815335', name: 'Acrysol RM-2020 NPR', cat: 'Reologi', stock: 680, min: 150 },
  { no: 'RV3004', art: '815401', name: 'Orotan 731 A', cat: 'Tillsats', stock: 920, min: 200 },
  { no: 'RV3005', art: '815418', name: 'Foamaster MO 2111', cat: 'Tillsats', stock: 410, min: 100 },
  { no: 'RV3006', art: '815460', name: 'Ammoniak 25 %', cat: 'Tillsats', stock: 540, min: 100 },
  { no: 'RV3007', art: '815477', name: 'Nuosept BMc', cat: 'Tillsats', stock: 260, min: 120 },
  { no: 'RV4001', art: '814006', name: 'BDG', cat: 'Lösningsmedel', stock: 1250, min: 200 },
  { no: 'RV4002', art: '814019', name: 'Coasol 290', cat: 'Lösningsmedel', stock: 860, min: 200 },
  { no: 'RV5001', art: '816201', name: 'Oxidgul (oY)', cat: 'Kulörpasta', stock: 380, min: 60 },
  { no: 'RV5002', art: '816214', name: 'Ftalogrön (G)', cat: 'Kulörpasta', stock: 42, min: 50 },
  { no: 'RV5003', art: '816227', name: 'Kimrök (B)', cat: 'Kulörpasta', stock: 210, min: 40 },
  { no: 'RV5004', art: '816240', name: 'Oxidröd (oR)', cat: 'Kulörpasta', stock: 195, min: 40 },
];

/* Kvalitetsmått. sort = sorteringsordning som i BC. bool = OK/Ej OK. */
const MEASURES = {
  densitet: { no: 1, sort: 10, name: 'Densitet', unit: 'g/ml', dec: 3 },
  ici:      { no: 3, sort: 30, name: 'Viskositet ICI', unit: 'cP', dec: 0 },
  mpas:     { no: 4, sort: 40, name: 'Viskositet mPas 5/10', unit: 'mPas', dec: 0 },
  kulor:    { no: 6, sort: 60, name: 'Kulörprov dE CMC', unit: 'dE', dec: 2 },
  ku:       { no: 9, sort: 80, name: 'Viskositet KU', unit: 'KU', dec: 1 },
  bryt:     { no: 12, sort: 90, name: 'Brytstyrka', unit: 'g', dec: 0 },
  hegman:   { no: 16, sort: 95, name: 'Finhet (Hegman)', unit: '', bool: true },
  glans:    { no: 14, sort: 100, name: 'Glans 60°', unit: 'GU', dec: 1 },
  mm3:      { no: 21, sort: 110, name: 'Rinngräns 3 mm', unit: '', bool: true },
  mm4:      { no: 22, sort: 120, name: 'Rinngräns 4 mm', unit: '', bool: true },
  upp:      { no: 69, sort: 593, name: 'Uppstrykningsprov', unit: '', bool: true },
};

const SPEC = {
  vagg:   { densitet: [1.30, 1.45], ici: [160, 200], mpas: [10000, 20000], ku: [98, 104], glans: [3, 8], kulor: [0, 1], upp: [1, 1] },
  tak:    { densitet: [1.45, 1.62], ici: [100, 140], mpas: [15000, 30000], ku: [95, 105], glans: [0.5, 3], upp: [1, 1] },
  lack:   { densitet: [1.10, 1.25], ici: [190, 210], ku: [105, 110], hegman: [1, 1], glans: [35, 45], kulor: [0, 1], upp: [1, 1] },
  fasad:  { densitet: [1.25, 1.40], ici: [150, 190], mpas: [8000, 16000], ku: [100, 108], glans: [10, 20], kulor: [0, 1], mm3: [1, 1], mm4: [1, 1], upp: [1, 1] },
  spackel:{ densitet: [1.65, 1.85], mpas: [60000, 90000], ku: [125, 135], bryt: [120, 180], upp: [1, 1] },
  grund:  { densitet: [1.35, 1.50], ici: [120, 160], mpas: [9000, 15000], ku: [92, 100], hegman: [1, 1], upp: [1, 1] },
};

const BASE = {
  vagg:   { RV0001: 210, RV3004: 7, RV3005: 3, RV3001: 4, RV1101: 170, RV1102: 230, RV1103: 70, RV2001: 230, RV4002: 12, RV4001: 8, RV3006: 2, RV3007: 2, RV3002: 6 },
  tak:    { RV0001: 260, RV3004: 6, RV3005: 3, RV3001: 5, RV1101: 120, RV1102: 330, RV1104: 90, RV2002: 150, RV4002: 8, RV3006: 2, RV3007: 2 },
  lack:   { RV0001: 120, RV3004: 6, RV3005: 4, RV1101: 230, RV2003: 520, RV4001: 30, RV4002: 25, RV3003: 18, RV3002: 8, RV3006: 2, RV3007: 2 },
  fasad:  { RV0001: 150, RV3004: 7, RV3005: 4, RV3001: 3, RV1101: 190, RV1102: 140, RV1103: 60, RV2002: 340, RV4002: 15, RV4001: 10, RV3003: 6, RV3006: 2, RV3007: 2 },
  spackel:{ RV0001: 160, RV3004: 4, RV3005: 2, RV3001: 6, RV1102: 610, RV1103: 90, RV2001: 110, RV3007: 2 },
  grund:  { RV0001: 240, RV3004: 7, RV3005: 3, RV3001: 4, RV1101: 90, RV1102: 280, RV1104: 80, RV2001: 220, RV4002: 10, RV3006: 2, RV3007: 2 },
};

const ADJUST = {
  vagg:   ['RV4001', 'RV0001', 'RV3001', 'RV3002', 'RV3003', 'RV3006', 'RV1105'],
  tak:    ['RV0001', 'RV3001', 'RV3002', 'RV4001', 'RV3006'],
  lack:   ['RV4001', 'RV0001', 'RV3003', 'RV3002', 'RV3006'],
  fasad:  ['RV4001', 'RV0001', 'RV3001', 'RV3002', 'RV3003', 'RV1105'],
  spackel:['RV0001', 'RV3001'],
  grund:  ['RV0001', 'RV3001', 'RV3002', 'RV4001'],
};

const RECIPES = [
  ['RL10001', 'Takfärg Vit', 'tak', [], ['stjarnan', 'storduon']],
  ['RL10014', 'Takfärg Djupmatt 2', 'tak', [], ['stjarnan', 'duon']],
  ['RL12200', 'Väggfärg 7 A-bas', 'vagg', [], ['storduon', 'tranemo', 'stjarnan']],
  ['RL12230', 'Väggfärg 7 C-bas', 'vagg', [], ['duon', 'tranemo']],
  ['RL12210', 'Väggfärg 07 S 2020-G10Y', 'vagg', [['RV5002', 1.4], ['RV5001', 2.2], ['RV5003', 0.3]], ['duon', 'byttan']],
  ['RL12241', 'Väggfärg 07 S 1505-Y20R', 'vagg', [['RV5001', 0.9], ['RV5004', 0.2]], ['duon', 'loskarl', 'stjarnan']],
  ['RL12400', 'Väggfärg 20 A-bas', 'vagg', [], ['tranemo', 'stjarnan']],
  ['RL12432', 'Kalas Projekt 20 C-bas', 'vagg', [], ['stjarnan', 'tranemo']],
  ['RL30140', 'Glanslack 40 A-bas', 'lack', [], ['tranemo', 'duon', 'stjarnan']],
  ['RL30142', 'Glanslack 40 Svart', 'lack', [['RV5003', 18]], ['stjarnan', 'byttan']],
  ['RL37014', 'Glanslack 80 Blank', 'lack', [], ['byttan', 'loskarl']],
  ['RL38550', 'Snickerilack Ekorre', 'lack', [['RV5001', 6], ['RV5004', 2.5], ['RV5003', 0.8]], ['stjarnan', 'loskarl']],
  ['RL61991', 'Fönsterlack V Mörkgrå', 'lack', [['RV5003', 6.5]], ['stjarnan', 'byttan']],
  ['RL41500', 'Fasadfärg Akrylat Röd', 'fasad', [['RV5004', 9.5], ['RV5003', 0.6]], ['storduon', 'tranemo']],
  ['RL41510', 'Fasadfärg Akrylat A-bas', 'fasad', [], ['storduon', 'stjarnan']],
  ['RL52003', 'Allgrund V', 'grund', [], ['stjarnan', 'byttan']],
  ['RL52003.1', 'Allgrund V (lågemission)', 'grund', [], ['stjarnan']],
  ['RL68040', 'Rostskyddsprimer V Grå', 'grund', [['RV5003', 2.2]], ['stjarnan', 'loskarl']],
  ['RL05210', 'Kalas Sammet Matt A-bas', 'vagg', [], ['stjarnan', 'duon']],
  ['RL60031', 'Finspackel Lätt', 'spackel', [], ['loskarl', 'byttan']],
].map(([no, name, type, tint, machines]) => {
  const formula = { ...BASE[type] };
  tint.forEach(([m, kg]) => formula[m] = kg);
  const sum = Object.values(formula).reduce((a, b) => a + b, 0);
  Object.keys(formula).forEach(k => formula[k] = formula[k] * 1000 / sum);
  return { no, name, type, formula, spec: SPEC[type], adjust: ADJUST[type], machines };
});

/* "Sann" effekt per kg råvara per ton batch – används ENBART för att simulera historik.
   Appens rekommendationer räknas från historiken, inte härifrån. */
const TRUE_EFFECT = {
  RV4001: { ici: -108, mpas: -21600, ku: -10.8 },
  RV3003: { ici: 55, ku: 2.5, mpas: 1500 },
  RV3001: { ku: 7, mpas: 12000, ici: 6 },
  RV3002: { ku: 9, mpas: 5000, ici: 18 },
  RV0001: { ku: -0.25, mpas: -420, ici: -2, densitet: -0.0006 },
  RV1105: { glans: -3.5, ku: 0.6 },
  RV3006: { mpas: 900, ku: 0.4 },
};

const TAPP_LINES = ['Tapplinje 1 (1 L–3 L)', 'Tapplinje 2 (10 L)', 'Storsäck / IBC', 'Handtapp'];
/* Återkommande tendens per recept (i halva intervallbredder) – ger historiken något att lära sig av. */
const BIAS = {
  RL12210: { ici: -1.5 }, RL12400: { ici: 1.4, ku: 0.8 }, RL30140: { ku: -1.4 }, RL10001: { mpas: 1.3 },
  RL41510: { ku: 1.3 }, RL12200: { ici: 1.2 }, RL12241: { mpas: -1.3 }, RL38550: { ici: -1.3 }, RL52003: { ku: -1.2 },
  RL12432: { ici: 1.3 }, RL05210: { ku: 1.4 }, RL61991: { ici: 1.3 },
};
const OPERATORS = ['TEDDIC', 'PERHOL', 'ANNLIN', 'JONBER', 'MALSVE'];

/* ---------- Seeding ---------- */
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

function seedState() {
  const r = rng(20261007);
  const pick = a => a[Math.floor(r() * a.length)];
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
  const now = new Date(); now.setSeconds(0, 0);
  const at = (dayOff, h, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + dayOff); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const seqByDay = {};
  const batchNo = iso => { const d = new Date(iso); const k = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; seqByDay[k] = (seqByDay[k] || 10) + 1 + Math.floor(r() * 3); return k + String(seqByDay[k]).padStart(2, '0'); };
  const round = (v, key) => { const d = MEASURES[key].dec ?? 0; return Number(v.toFixed(d)); };
  const roundW = kg => r() < 0.35 ? Math.round(kg * 10) / 10 : Math.round(kg / 5) * 5;

  const batches = [];
  const mk = (machine, recipe, planned, extra = {}) => {
    const m = MACHINES.find(x => x.id === machine);
    const weight = extra.weight || roundW(m.kg[0] + r() * (m.kg[1] - m.kg[0]));
    const tapp = weight > 4000 ? pick([TAPP_LINES[1], TAPP_LINES[2]]) : weight < 400 ? TAPP_LINES[3] : pick(TAPP_LINES.slice(0, 3));
    const b = { id: batchNo(planned), recipe: recipe.no, machine, weight, line: tapp, planned, mix: 'planned', test: null, tapp: null,
      started: null, stopped: null, rows: [], adjustments: [], machineAdj: [], note: '', tappRows: [], log: [], ...extra };
    batches.push(b); return b;
  };
  const initialValues = (recipe, wild = 0.5) => {
    const v = {};
    for (const [k, [lo, hi]] of Object.entries(recipe.spec)) {
      if (MEASURES[k].bool) { v[k] = r() < 0.9 ? 1 : 0; continue; }
      const mid = (lo + hi) / 2, half = (hi - lo) / 2;
      v[k] = round(k === 'kulor' ? Math.abs(mid * 0.6 + gauss() * 0.45) : mid + ((BIAS[recipe.no]?.[k] || 0) + gauss() * wild * 1.4) * half, k);
    }
    return v;
  };
  const outOf = (recipe, v) => Object.keys(v).filter(k => { const [lo, hi] = recipe.spec[k]; return v[k] < lo || v[k] > hi; });
  const applyEffect = (v, mat, kg, weight, noise = 0.12) => {
    const e = TRUE_EFFECT[mat] || {}; const x = kg / (weight / 1000); const out = { ...v };
    for (const k of Object.keys(e)) if (k in out) out[k] = round(out[k] + e[k] * x * (1 + gauss() * noise), k);
    return out;
  };
  /* Väljer en realistisk korrigering för ett mått utanför intervall. */
  const chooseFix = (recipe, v, weight) => {
    const bad = outOf(recipe, v).filter(k => ['ici', 'ku', 'mpas', 'glans'].includes(k)).sort((a, c) => ['ici', 'ku', 'mpas', 'glans'].indexOf(a) - ['ici', 'ku', 'mpas', 'glans'].indexOf(c));
    if (!bad.length) return null;
    const k = bad[0]; const [lo, hi] = recipe.spec[k]; const target = (lo + hi) / 2;
    const cands = recipe.adjust.filter(m => TRUE_EFFECT[m]?.[k] && Math.sign(TRUE_EFFECT[m][k]) === Math.sign(target - v[k]));
    if (!cands.length) return null;
    const mat = cands[0]; const x = (target - v[k]) / TRUE_EFFECT[mat][k];
    let kg = x * weight / 1000; kg = kg > 20 ? Math.round(kg) : Math.round(kg * 2) / 2 || 0.5;
    return { mat, kg };
  };
  const addRows = (b, vals, time, by, keys) => {
    let t = new Date(time).getTime();
    (keys || Object.keys(vals)).forEach(k => { t += 60000 * (1 + Math.floor(r() * 3)); b.rows.push({ key: k, value: vals[k], time: new Date(t).toISOString(), by }); });
    return new Date(t).toISOString();
  };
  /* Kör en hel simulerad provning med justeringar. */
  const simulateTest = (b, recipe, startIso, by, maxRounds = 3, init) => {
    let v = { ...initialValues(recipe), ...init };
    let t = addRows(b, v, startIso, by);
    for (let i = 0; i < maxRounds; i++) {
      const fix = chooseFix(recipe, v, b.weight);
      if (!fix) break;
      t = new Date(new Date(t).getTime() + 6 * 60000).toISOString();
      b.adjustments.push({ mat: fix.mat, kg: fix.kg, time: t, by });
      const affected = Object.keys(TRUE_EFFECT[fix.mat]).filter(k => k in v);
      v = applyEffect(v, fix.mat, fix.kg, b.weight);
      t = addRows(b, v, new Date(new Date(t).getTime() + 12 * 60000).toISOString(), by, affected);
    }
    // Slutkontroll: kvarvarande avvikelser ommäts/åtgärdas så att klara batcher hamnar inom intervall
    const fix = {};
    for (const k of outOf(recipe, v)) { const [lo, hi] = recipe.spec[k]; fix[k] = MEASURES[k].bool ? 1 : round(lo + (hi - lo) * (0.35 + r() * 0.3), k); }
    if (Object.keys(fix).length) { v = { ...v, ...fix }; t = addRows(b, fix, new Date(new Date(t).getTime() + 20 * 60000).toISOString(), by); }
    b.note = b.adjustments.map((a, i) => noteLine(i + 1, a.kg, a.mat, b.weight)).join('\n');
    return { v, end: t };
  };

  // Historik: stoppade + tappade batcher senaste ~45 dagarna
  for (let d = -45; d <= -1; d++) {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const recipe = pick(RECIPES); const machine = pick(recipe.machines); const by = pick(OPERATORS);
      const b = mk(machine, recipe, at(d, 6 + Math.floor(r() * 10), pick([0, 15, 30, 45])));
      b.started = b.planned;
      const { v, end } = simulateTest(b, recipe, new Date(new Date(b.started).getTime() + 70 * 60000).toISOString(), by);
      b.machineAdj = b.adjustments.map(a => ({ mat: a.mat, kg: a.kg }));
      b.mix = 'stopped'; b.test = 'stopped'; b.tapp = 'done';
      b.stopped = new Date(new Date(end).getTime() + 25 * 60000).toISOString();
      const ref = v.ici;
      const tt = new Date(new Date(b.stopped).getTime() + 40 * 60000);
      if (ref != null) b.tappRows.push({ key: 'ici', value: Math.round(ref * (1 + gauss() * 0.02)), time: tt.toISOString(), by: pick(OPERATORS) });
      b.tappRows.push({ key: 'upp', value: 1, time: new Date(tt.getTime() + 180000).toISOString(), by: pick(OPERATORS) });
      b.tappDone = new Date(tt.getTime() + 300000).toISOString();
      b.log.push({ t: b.started, txt: 'Batch startad', by }, { t: b.stopped, txt: 'Batch stoppad', by }, { t: b.tappDone, txt: 'Prov tapp godkänd', by });
    }
  }

  // Användarens referensfall: 7 200 kg, +2 kg BDG → KU 101,2→98,2, ICI 200→170, mPas 18 000→12 000
  {
    const recipe = RECIPES.find(x => x.no === 'RL12200');
    const b = mk('tranemo', recipe, at(-12, 7, 30), { weight: 7200 });
    b.started = b.planned; const by = 'TEDDIC';
    let t = addRows(b, { densitet: 1.382, ici: 200, mpas: 18000, ku: 101.2, glans: 5.1, kulor: 0.42, upp: 1 }, at(-12, 8, 45), by);
    b.adjustments.push({ mat: 'RV4001', kg: 2, time: at(-12, 9, 10), by });
    addRows(b, { ici: 170, mpas: 12000, ku: 98.2 }, at(-12, 9, 25), by);
    b.machineAdj = [{ mat: 'RV4001', kg: 2 }]; b.note = noteLine(1, 2, 'RV4001', 7200);
    Object.assign(b, { mix: 'stopped', test: 'stopped', tapp: 'done', stopped: at(-12, 10, 5), tappDone: at(-12, 11, 0) });
    b.tappRows.push({ key: 'ici', value: 168, time: at(-12, 10, 50), by: 'PERHOL' }, { key: 'upp', value: 1, time: at(-12, 10, 55), by: 'PERHOL' });
  }

  // Pågående läge – ett exempel per steg i flödet
  const R = no => RECIPES.find(x => x.no === no);
  { // Stjärnan: pausad i blandning, provning pågår med värden utanför
    const b = mk('stjarnan', R('RL12400'), at(0, 6, 0), { weight: 1460 });
    Object.assign(b, { mix: 'paused', test: 'running', started: at(0, 6, 5) });
    addRows(b, { densitet: 1.364, ici: 214, mpas: 21900, ku: 105.4, glans: 6.2, kulor: 0.61, upp: 1 }, at(0, 7, 20), 'PERHOL');
    b.log.push({ t: b.started, txt: 'Batch startad', by: 'PERHOL' }, { t: at(0, 7, 15), txt: 'Batch pausad', by: 'PERHOL' }, { t: at(0, 7, 18), txt: 'Provning startad', by: 'PERHOL' });
  }
  { // Duon: blandar just nu
    const b = mk('duon', R('RL12210'), at(0, 7, 30), { weight: 2234 });
    Object.assign(b, { mix: 'running', test: 'waiting', started: at(0, 7, 40) });
    b.log.push({ t: b.started, txt: 'Batch startad', by: 'TEDDIC' });
  }
  { // Storduon: provning klar, väntar på att blandaren lägger in justering och stoppar
    const recipe = R('RL41510');
    const b = mk('storduon', recipe, at(0, 5, 30), { weight: 8600 });
    Object.assign(b, { mix: 'paused', started: at(0, 5, 35) });
    simulateTest(b, recipe, at(0, 6, 50), 'JONBER', 2, { ku: 110.6, mpas: 17900, ici: 196 });
    b.test = 'stopped';
    b.log.push({ t: b.started, txt: 'Batch startad', by: 'JONBER' }, { t: at(0, 8, 0), txt: 'Provning stoppad', by: 'JONBER' });
  }
  { // Tranemo: stoppad, väntar på prov tapp
    const recipe = R('RL30140');
    const b = mk('tranemo', recipe, at(0, 4, 0), { weight: 6400 });
    const { end } = simulateTest(b, recipe, at(0, 5, 10), 'PERHOL');
    b.machineAdj = b.adjustments.map(a => ({ mat: a.mat, kg: a.kg }));
    Object.assign(b, { mix: 'stopped', test: 'stopped', tapp: 'waiting', started: at(0, 4, 5), stopped: new Date(new Date(end).getTime() + 20 * 60000).toISOString() });
  }
  { // Löskärl: i prov tapp
    const recipe = R('RL37014');
    const b = mk('loskarl', recipe, at(0, 3, 30), { weight: 380 });
    simulateTest(b, recipe, at(0, 4, 20), 'MALSVE');
    b.machineAdj = b.adjustments.map(a => ({ mat: a.mat, kg: a.kg }));
    Object.assign(b, { mix: 'stopped', test: 'stopped', tapp: 'running', started: at(0, 3, 35), stopped: at(0, 6, 10) });
  }

  // Omarbetning: gammal batch som körs om med tillsats
  mk('stjarnan', R('RL30142'), at(1, 6, 0), { weight: 1060, rework: true });

  // Planerade batcher kommande dagar
  for (const m of MACHINES) {
    const recs = RECIPES.filter(x => x.machines.includes(m.id));
    let slot = 0;
    for (let d = 0; d <= 3; d++) {
      const n = d === 0 ? 2 : 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) { mk(m.id, pick(recs), at(d, d === 0 ? 10 + i * 3 : 6 + i * 4, pick([0, 30]))); slot++; }
    }
  }
  return { batches, materials: MATERIALS.map(m => ({ ...m })), version: 6 };
}

function noteLine(i, kg, mat, weight) { const pct = kg / weight * 100; return `${i}. +${fmtKg(kg)} kg${pct >= 0.1 ? ` (${pct.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} %)` : ''} ${MATERIALS.find(m => m.no === mat).name}`; }
function fmtKg(kg) { return Number(kg).toLocaleString('sv-SE', { maximumFractionDigits: 1 }); }

/* ---------- Datalager (ersätts mot Business Central senare) ---------- */
const STORE_KEY = 'kalasfarg-demo-v1';
const Api = {
  state: null,
  load() {
    try { this.state = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { this.state = null; }
    if (!this.state || this.state.version !== 6) { this.state = seedState(); this.save(); }
    for (const m of this.state.materials) { const d = MATERIALS.find(x => x.no === m.no); if (d) { m.name = d.name; m.art = d.art; } }
  },
  rev: 0,
  save() { this.rev++; try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch {} },
  reset() { this.rev++; this.state = seedState(); this.save(); },
  batches() { return this.state.batches; },
  batch(id) { return this.state.batches.find(b => b.id === id); },
  recipe(no) { return RECIPES.find(r => r.no === no); },
  material(no) { return this.state.materials.find(m => m.no === no); },
  machine(id) { return MACHINES.find(m => m.id === id); },
};
