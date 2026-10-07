/* Teds Kalasfärg AB – produktionsklient (demo) */
Api.load();

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, dec = 0) => v == null || v === '' ? '–' : Number(v).toLocaleString('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const dt = iso => { if (!iso) return '–'; const d = new Date(iso); return d.toLocaleDateString('sv-SE') + ' ' + d.toTimeString().slice(0, 5); };
const tm = iso => iso ? new Date(iso).toTimeString().slice(0, 5) : '–';
const dayLabel = iso => {
  const d = new Date(iso), t = new Date(); t.setHours(0, 0, 0, 0); const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((dd - t) / 864e5);
  return diff === 0 ? 'Idag' : diff === 1 ? 'Imorgon' : diff === -1 ? 'Igår' : d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
};
const nowIso = () => new Date().toISOString();
let operator = localStorage.getItem('kalas-op') || 'TEDDIC';

/* ---------- Domänlogik ---------- */
const fmtVal = (key, v) => MEASURES[key].bool ? (v >= 1 ? 'OK' : 'Ej OK') : nf(v, MEASURES[key].dec);
const inRange = (v, [lo, hi]) => v >= lo && v <= hi;
const fmtRange = (key, [lo, hi]) => MEASURES[key].bool ? 'OK' : `${nf(lo, MEASURES[key].dec)} – ${nf(hi, MEASURES[key].dec)}`;
const sortedSpecKeys = spec => Object.keys(spec).sort((a, b) => MEASURES[a].sort - MEASURES[b].sort);
const latest = (rows, key, before) => {
  let best = null;
  for (const r of rows) if (r.key === key && (!before || r.time < before) && (!best || r.time > best.time)) best = r;
  return best;
};
const currentValues = b => { const o = {}; for (const k of Object.keys(Api.recipe(b.recipe).spec)) { const r = latest(b.rows, k); if (r) o[k] = r.value; } return o; };
const components = b => {
  const rec = Api.recipe(b.recipe);
  return Object.entries(rec.formula).map(([no, perTon]) => {
    const m = Api.material(no); const kg = perTon * b.weight / 1000;
    const after = m.stock - kg;
    const level = m.bulk ? 'ok' : m.stock < kg ? 'short' : after < m.min ? 'low' : 'ok';
    return { m, kg, level, after };
  }).sort((a, b) => b.kg - a.kg);
};
const stockWarnings = b => components(b).filter(c => c.level !== 'ok');
const matShort = no => { const n = Api.material(no).name; return n.replace(/^(Kulörpasta|HEC-förtjockare|Associativ förtjockare|ICI-förtjockare|Dispergeringsmedel|Skumdämpare|Konserveringsmedel|Koalescent|Matteringsmedel)\s/, ''); };

/* Historisk effekt: före = senaste värdet innan justeringen, efter = första värdet efter
   (innan nästa justering). Effekten normaliseras till "per kg råvara per ton batch". */
function adjustmentHistory(matNo, excludeId) {
  const out = [];
  for (const b of Api.batches()) {
    if (b.id === excludeId || !b.adjustments.length) continue;
    const adj = [...b.adjustments].sort((x, y) => x.time.localeCompare(y.time));
    adj.forEach((a, i) => {
      if (a.mat !== matNo) return;
      const next = adj[i + 1]?.time || '9999';
      const before = {}, after = {}, effect = {};
      for (const k of new Set(b.rows.map(r => r.key))) {
        if (MEASURES[k].bool) continue;
        const pre = latest(b.rows, k, a.time);
        const post = b.rows.filter(r => r.key === k && r.time > a.time && r.time < next).sort((x, y) => x.time.localeCompare(y.time))[0];
        if (pre && post) { before[k] = pre.value; after[k] = post.value; effect[k] = (post.value - pre.value) / (a.kg / (b.weight / 1000)); }
      }
      if (Object.keys(effect).length) out.push({ batch: b, recipe: Api.recipe(b.recipe), kg: a.kg, time: a.time, before, after, effect });
    });
  }
  return out.sort((x, y) => y.time.localeCompare(x.time));
}

function recommend(b) {
  const rec = Api.recipe(b.recipe); const cur = currentValues(b);
  const keys = Object.keys(rec.spec).filter(k => !MEASURES[k].bool && k !== 'kulor' && cur[k] != null);
  const bad = keys.filter(k => !inRange(cur[k], rec.spec[k]));
  const results = [];
  for (const mat of rec.adjust) {
    const hist = adjustmentHistory(mat, b.id);
    if (!hist.length) { results.push({ mat, hist, none: true }); continue; }
    const eff = {}, wsum = {};
    for (const h of hist) {
      const w = h.recipe.type === rec.type ? 2 : 1;
      for (const [k, e] of Object.entries(h.effect)) { eff[k] = (eff[k] || 0) + e * w; wsum[k] = (wsum[k] || 0) + w; }
    }
    for (const k in eff) eff[k] /= wsum[k];
    // Minsta kvadrat mot intervallens mittpunkt, viktat med intervallbredd
    let num = 0, den = 0;
    for (const k of keys) {
      if (eff[k] == null) continue;
      const [lo, hi] = rec.spec[k]; const mid = (lo + hi) / 2; const w = ((hi - lo) / 2) ** 2;
      num += eff[k] * (cur[k] - mid) / w; den += eff[k] ** 2 / w;
    }
    const x = den ? -num / den : 0;
    if (x <= 0) { results.push({ mat, hist, eff, wrongDir: true }); continue; }
    const pred = {}; let inCnt = 0, resid = 0;
    for (const k of keys) {
      pred[k] = cur[k] + (eff[k] || 0) * x;
      if (inRange(pred[k], rec.spec[k])) inCnt++;
      const [lo, hi] = rec.spec[k]; resid += ((pred[k] - (lo + hi) / 2) / ((hi - lo) / 2)) ** 2;
    }
    let kg = x * b.weight / 1000; kg = kg >= 20 ? Math.round(kg) : Math.round(kg * 10) / 10;
    results.push({ mat, hist, eff, kg, perTon: x, pred, inCnt, resid, all: inCnt === keys.length });
  }
  results.sort((a, z) => (a.kg == null) - (z.kg == null) || (z.inCnt ?? -1) - (a.inCnt ?? -1) || (a.kg ?? 0) - (z.kg ?? 0));
  return { cur, keys, bad, results };
}

/* ---------- Statusövergångar ---------- */
const log = (b, txt) => b.log.push({ t: nowIso(), txt, by: operator });
const actions = {
  startMix(b) { if (b.mix !== 'planned') return; b.mix = 'running'; b.test = 'waiting'; b.started = nowIso(); log(b, 'Batch startad'); toast(`Batch ${b.id} startad på ${Api.machine(b.machine).name}`); },
  pauseMix(b) { b.mix = 'paused'; log(b, 'Batch pausad'); toast(`Batch ${b.id} pausad – starta den nu under Provning`); },
  resumeMix(b) { b.mix = 'running'; log(b, 'Batch återupptagen'); toast(`Batch ${b.id} återupptagen`); },
  startTest(b) {
    if (b.mix === 'running') return toast('Pausa batchen i maskinen innan provningen startas.', 'err');
    b.test = 'running'; log(b, 'Provning startad'); toast(`Provning startad för ${b.id}`); },
  stopTest(b) { b.test = 'stopped'; log(b, 'Provning stoppad'); toast(`Provning stoppad – gå till ${Api.machine(b.machine).name} och stoppa batchen`); },
  reopenTest(b) { b.test = 'running'; log(b, 'Provning återöppnad'); },
  stopMix(b) {
    if (b.test !== 'stopped') return toast('Provningen måste stoppas innan batchen kan stoppas.', 'err');
    for (const c of components(b)) if (!c.m.bulk) c.m.stock = Math.max(0, c.m.stock - c.kg);
    for (const a of b.machineAdj) { const m = Api.material(a.mat); if (!m.bulk) m.stock = Math.max(0, m.stock - a.kg); }
    b.mix = 'stopped'; b.tapp = 'waiting'; b.stopped = nowIso(); log(b, 'Batch stoppad – rapporterad förbrukning');
    toast(`Batch ${b.id} stoppad – nu i Prov tapp`); },
  startTapp(b) { b.tapp = 'running'; log(b, 'Prov tapp startad'); },
  finishTapp(b) { b.tapp = 'done'; b.tappDone = nowIso(); log(b, 'Prov tapp godkänd'); toast(`Batch ${b.id} klar för tappning ✓`); },
};
function act(name, id, after) { const b = Api.batch(id); actions[name](b); Api.save(); after ? location.hash = after : render(); }

/* ---------- UI-komponenter ---------- */
function toast(msg, kind = 'ok') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3700);
}
const st = (txt, kind = '') => `<span class="st ${kind}">${esc(txt)}</span>`;
function statusPill(b, ctx) {
  if (ctx === 'test') return b.test === 'running' ? st('Provning pågår', 'blue') : b.test === 'stopped' ? st('Provning klar', 'green') : b.mix === 'running' ? st('Blandas') : st('Väntar', 'amber');
  if (ctx === 'tapp') return b.tapp === 'running' ? st('Tapp pågår', 'blue') : b.tapp === 'done' ? st('Godkänd', 'green') : st('Väntar', 'amber');
  return { planned: st('Planerad'), running: st('Blandar', 'blue'), paused: st('Pausad', 'amber'), stopped: st('Stoppad', 'green') }[b.mix];
}
const recNo = b => { const n = Api.recipe(b.recipe).no; return b.rework ? 'RB' + n.slice(2) : n; };
const reworkTag = b => b.rework ? ' <span class="tag">Omarbetning</span>' : '';
const swatch = rec => `<span class="swatch" style="--c:${recipeColor(rec)}"></span>`;
function recipeColor(rec) {
  const f = rec.formula;
  if (f.RV5003 > 5) return f.RV5003 > 12 ? '#26262b' : '#55585e'; if (f.RV5001 > 4) return '#8a6a45'; if (f.RV5002) return '#8fa98a'; if (f.RV5004 > 5) return '#8e3a2b'; if (f.RV5001) return '#d9cdb4';
  if (rec.type === 'lack') return '#eef1f4'; if (rec.type === 'spackel') return '#e7e2d8'; return '#fbfaf7';
}
function batchRow(b, href, ctx, showDay) {
  const rec = Api.recipe(b.recipe); const warn = b.mix === 'planned' && stockWarnings(b).some(c => c.level === 'short');
  return `<a class="brow" href="${href}">
    <div><div class="t">${tm(b.planned)}</div>${showDay ? `<div class="muted" style="font-size:.76rem">${esc(dayLabel(b.planned))}</div>` : ''}</div>
    <div style="min-width:0"><div class="n">${swatch(rec)}${esc(rec.name)}${reworkTag(b)}</div>
      <div class="m"><span class="mono">${b.id}</span><span class="mono">${recNo(b)}</span>${ctx ? `<span>${esc(Api.machine(b.machine).name)}</span>` : ''}${ctx === 'tapp' ? `<span>${esc(b.line)}</span>` : ''}</div></div>
    <div class="side"><span class="w">${nf(b.weight)} kg</span>${warn ? st('Råvara saknas', 'red') : ctx || b.mix !== 'planned' ? statusPill(b, ctx) : ''}</div>
    <span class="go">→</span></a>`;
}
const listCard = (rows, emptyTxt, emptySub = '') => `<div class="list card">${rows || empty(emptyTxt, emptySub)}</div>`;
const empty = (t, s = '') => `<div class="empty"><b>${esc(t)}</b>${esc(s)}</div>`;
const tabs = (list, active, base) => `<div class="tabs">${list.map(([k, l, n]) => `<a href="${base}/${k}" class="${k === active ? 'on' : ''}">${l}${n != null ? `<span class="cnt">${n}</span>` : ''}</a>`).join('')}</div>`;
const header = (crumbs, title, sub = '', right = '') => `
  <div class="crumbs">${crumbs.map(([l, h]) => h ? `<a href="${h}">${esc(l)}</a>` : `<span>${esc(l)}</span>`).join('<i>/</i>')}</div>
  <div class="phead"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="phead-r">${right}</div></div>`;
const subline = (...parts) => parts.filter(Boolean).join('<span class="sep">·</span>');
const panel = (title, body, right = '') => `<section class="card panel"><div class="ph"><h3>${title}</h3>${right}</div>${body}</section>`;

/* ---------- Vyer ---------- */
const byPlanned = (a, b) => a.planned.localeCompare(b.planned);
const byStoppedDesc = (a, b) => (b.stopped || '').localeCompare(a.stopped || '');

function viewHome() {
  const all = Api.batches(); const today = new Date().toDateString(); const h = new Date().getHours();
  const cards = MACHINES.map(m => {
    const bs = all.filter(b => b.machine === m.id);
    const active = bs.find(b => b.mix === 'running') || bs.find(b => b.mix === 'paused');
    const next = bs.filter(b => b.mix === 'planned').sort(byPlanned)[0];
    const cls = active ? (active.mix === 'running' ? 'run' : 'pause') : '';
    return `<a class="card mcard ${cls}" href="#/maskin/${m.id}">
      <div class="mc-head"><h3>${m.name}</h3>${active ? statusPill(active) : st('Ledig')}</div>
      <div class="mc-now">${active
        ? `<b>${swatch(Api.recipe(active.recipe))}${esc(Api.recipe(active.recipe).name)}</b><span>${nf(active.weight)} kg · ${active.id}</span>`
        : `<b class="muted" style="font-weight:500">Nästa ${next ? tm(next.planned) : '–'}</b><span>${next ? esc(Api.recipe(next.recipe).name) : 'Inget planerat'}</span>`}</div></a>`;
  }).join('');
  const testing = all.filter(b => b.test === 'running' || b.test === 'waiting').sort(byPlanned);
  const tapp = all.filter(b => b.tapp === 'waiting' || b.tapp === 'running');
  const low = Api.state.materials.filter(m => !m.bulk && m.stock < m.min);
  return `<div class="eyebrow">${new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })} · Fabrik Kalasvägen</div>
    <div class="phead" style="margin-top:16px"><h1>God ${h < 10 ? 'morgon' : h < 18 ? 'dag' : 'kväll'}, <em>${esc(operator.charAt(0) + operator.slice(1).toLowerCase())}</em></h1></div>
    <div class="stats four">
      <a class="card stat" href="#/maskin/${localStorage.getItem('kalas-m') || 'stjarnan'}/planerade"><span class="eyebrow">Att starta</span><b>${all.filter(b => b.mix === 'planned' && new Date(b.planned).toDateString() === today).length}</b><span>planerade idag</span></a>
      <a class="card stat" href="#/provning/startade"><span class="eyebrow">Pågående</span><b>${all.filter(b => b.mix === 'running').length + all.filter(b => b.test === 'running').length}</b><span>blandning & provning</span></a>
      <a class="card stat" href="#/provning/startade"><span class="eyebrow">Pausad</span><b>${all.filter(b => b.mix === 'paused').length}</b><span>väntar på provning/stopp</span></a>
      <a class="card stat" href="#/tapp"><span class="eyebrow">Godkänn</span><b>${tapp.length}</b><span>i prov tapp</span></a>
    </div>
    ${low.length ? `<a class="alert amber" href="#/ravaror" style="margin:16px 0 0"><div><b>${low.length} råvaror under minnivå:</b> ${low.map(m => esc(m.name)).join(', ')}</div></a>` : ''}
    <h2 class="sec">Maskiner</h2><div class="mgrid">${cards}</div>
    <h2 class="sec">Provning <a href="#/provning/startade">Alla →</a></h2>${listCard(testing.map(b => batchRow(b, `#/prov/${b.id}`, 'test')).join(''), 'Inget i provning')}
    <h2 class="sec">Prov tapp <a href="#/tapp">Alla →</a></h2>${listCard(tapp.map(b => batchRow(b, `#/tapp/${b.id}`, 'tapp')).join(''), 'Inget väntar på tapp')}`;
}

const machineChips = id => `<div class="chips">${MACHINES.map(m => `<a href="#/maskin/${m.id}" class="${m.id === id ? 'on' : ''}">${m.name}</a>`).join('')}</div>`;
function viewMachine(id, tab = 'planerade') {
  const m = Api.machine(id); const bs = Api.batches().filter(b => b.machine === id);
  const groups = { planerade: bs.filter(b => b.mix === 'planned').sort(byPlanned), startade: bs.filter(b => b.mix === 'running' || b.mix === 'paused').sort(byPlanned), stoppade: bs.filter(b => b.mix === 'stopped').sort(byStoppedDesc) };
  const list = groups[tab];
  let body;
  if (tab === 'planerade') {
    const days = {}; list.forEach(b => (days[dayLabel(b.planned)] ||= []).push(b));
    body = Object.entries(days).map(([d, arr]) => `<div class="dayh">${esc(d)}</div>${listCard(arr.map(b => batchRow(b, `#/batch/${b.id}`)).join(''))}`).join('') || listCard('', 'Inget planerat');
  } else body = listCard(list.slice(0, 40).map(b => batchRow(b, `#/batch/${b.id}`, null, tab === 'stoppade')).join(''), tab === 'startade' ? 'Ingen startad batch' : 'Inga stoppade batcher', tab === 'startade' ? 'Starta en planerad batch för att börja blanda.' : '');
  return header([['Översikt', '#/'], ['Maskiner']], `<em>${m.name}</em>`, m.type)
    + machineChips(id)
    + tabs([['planerade', 'Planerade', groups.planerade.length], ['startade', 'Startade', groups.startade.length], ['stoppade', 'Stoppade', groups.stoppade.length]], tab, `#/maskin/${id}`)
    + body;
}

function infoGrid(b) {
  const rec = Api.recipe(b.recipe);
  return `<div class="info">
    <div><small>Batchnummer</small><b class="mono">${b.id}</b></div><div><small>Receptnummer</small><b class="mono">${recNo(b)}</b></div>
    <div><small>Operation</small><b>${esc(Api.machine(b.machine).name)} Blandning</b></div><div><small>Tappas på</small><b>${esc(b.line)}</b></div><div><small>Vikt</small><b>${nf(b.weight)} kg</b></div>
    <div><small>Planerat</small><b>${dt(b.planned)}</b></div><div><small>Startad</small><b>${dt(b.started)}</b></div></div>`;
}
const titleFor = rec => `${swatch(rec)}<span>${esc(rec.name)}</span>`;

function viewBatch(id) {
  const b = Api.batch(id); if (!b) return empty('Batchen finns inte');
  const rec = Api.recipe(b.recipe); const m = Api.machine(b.machine); const comps = components(b);
  const warns = comps.filter(c => c.level !== 'ok');
  let actionsHtml = '';
  if (b.mix === 'planned') actionsHtml = `<button class="btn primary big" onclick="act('startMix','${b.id}')">Starta batch</button>`;
  if (b.mix === 'running') actionsHtml = `<button class="btn amber big" onclick="act('pauseMix','${b.id}')">Pausa batch</button>`;
  if (b.mix === 'paused') actionsHtml = `<button class="btn danger big" ${b.test !== 'stopped' ? 'disabled' : ''} onclick="confirmStop('${b.id}')">Stoppa batch</button><button class="btn ghost" onclick="act('resumeMix','${b.id}')">Återuppta blandning</button>`;
  actionsHtml += `<button class="btn ghost" onclick="printBatch('${b.id}')">Skriv ut</button>`;
  const compTable = `<table class="tbl"><thead><tr><th>Råvara</th><th class="r">Andel</th><th class="r">Kg</th><th class="r">I lager</th></tr></thead><tbody>
    ${comps.map(c => `<tr class="${c.level}"><td>${esc(c.m.name)} <span class="mono muted">${c.m.art}</span></td><td class="r num muted">${nf(c.kg / b.weight, 5)}</td><td class="r num"><b>${nf(c.kg, 2)}</b></td><td class="r num">${c.m.bulk ? '<span class="muted">ledning</span>' : `${c.level === 'short' ? '<span class="tag red">Saknas</span> ' : c.level === 'low' ? '<span class="tag">Lågt</span> ' : ''}${nf(c.m.stock)}`}</td></tr>`).join('')}
    </tbody></table>`;
  let alert = '';
  if (warns.length && b.mix !== 'stopped') alert = `<div class="alert ${warns.some(w => w.level === 'short') ? 'red' : 'amber'}"><div><b>Lågt lager:</b> ${warns.map(w => esc(matShort(w.m.no))).join(', ')}</div></div>`;
  if (b.mix === 'paused' && b.test !== 'stopped') alert += `<div class="alert blue"><div>Batchen är pausad. ${b.test === 'running' ? 'Provning pågår' : 'Starta provningen'} under <a href="#/prov/${b.id}">Provning →</a> Därefter lägger du in justeringar och stoppar här.</div></div>`;
  const stoppedAdj = b.mix === 'stopped' && b.machineAdj.length ? panel('Rapporterade justeringar', `<div class="adjlist">${b.machineAdj.map(a => `<div class="adjrow"><span>${esc(Api.material(a.mat).name)}</span><b class="${a.kg < 0 ? 'neg' : 'posv'}">${a.kg > 0 ? '+' : ''}${nf(a.kg, 1)} kg</b></div>`).join('')}</div>`) : '';
  const back = `#/maskin/${m.id}/${b.mix === 'planned' ? 'planerade' : b.mix === 'stopped' ? 'stoppade' : 'startade'}`;
  return header([['Översikt', '#/'], [m.name, back], [b.id]], titleFor(rec), subline(`<span class="mono">${b.id}</span>`, `<span class="mono">${recNo(b)}</span>`, esc(m.name), `${nf(b.weight)} kg`, statusPill(b)))
    + flowSteps(b) + (b.rework ? `<div class="alert amber"><div><b>Omarbetning.</b> Batchen körs om på recept ${rec.no} – kontrollera mätvärden extra noga.</div></div>` : '') + alert + `<div class="actions">${actionsHtml}</div>`
    + `<div class="grid-b"><div>${b.mix === 'paused' && b.test === 'stopped' ? adjustPanel(b) : ''}${panel('Komponenter', compTable, `<span class="muted">${comps.length} råvaror</span>`)}</div>
       <div>${panel('Batch', infoGrid(b))}${stoppedAdj}${b.rows.length ? panel('Provning', measureSummary(b), `<a href="#/prov/${b.id}">Öppna →</a>`) : ''}${logPanel(b)}</div></div>`;
}
const logPanel = b => b.log.length ? panel('Händelser', `<ul class="timeline">${[...b.log].reverse().map(l => `<li>${esc(l.txt)}<span>${tm(l.t)} · ${esc(l.by)}</span></li>`).join('')}</ul>`) : '';
function flowSteps(b) {
  const steps = [['Blandning', b.mix !== 'planned' && b.mix !== 'running'], ['Provning', b.test === 'stopped'], ['Justering', b.mix === 'stopped'], ['Prov tapp', b.tapp === 'done']];
  if (b.mix === 'planned') return '';
  const cur = steps.findIndex(s => !s[1]);
  return `<ol class="flow">${steps.map(([l, d], i) => `<li class="${d ? 'done' : ''} ${i === cur ? 'cur' : ''}">${d ? '✓ ' : ''}${l}</li>`).join('')}</ol>`;
}
function measureSummary(b) {
  const rec = Api.recipe(b.recipe); const cur = currentValues(b);
  return `<div class="msum">${sortedSpecKeys(rec.spec).filter(k => cur[k] != null).map(k => `<div class="${inRange(cur[k], rec.spec[k]) ? 'ok' : 'bad'}"><small>${esc(MEASURES[k].name)}</small><b>${fmtVal(k, cur[k])}</b></div>`).join('')}</div>`;
}

function adjustPanel(b) {
  const rec = Api.recipe(b.recipe);
  if (!b._adjInit) { b.machineAdj = b.machineAdj.length ? b.machineAdj : b.adjustments.map(a => ({ mat: a.mat, kg: a.kg })); b._adjInit = true; Api.save(); }
  const opts = [...new Set([...rec.adjust, ...Object.keys(rec.formula)])];
  return panel('Lägg till / ta bort råvaror', `
    ${b.note ? `<div class="note"><small>Från provningen</small><pre>${esc(b.note)}</pre></div>` : ''}
    <div class="adjlist">${b.machineAdj.map((a, i) => `<div class="adjrow"><span>${esc(Api.material(a.mat).name)}</span><b class="${a.kg < 0 ? 'neg' : 'posv'}">${a.kg > 0 ? '+' : ''}${nf(a.kg, 1)} kg</b><button class="x" onclick="rmMachineAdj('${b.id}',${i})">✕</button></div>`).join('') || '<div class="muted" style="padding:6px 0">Inga justeringar.</div>'}</div>
    <form class="addrow" onsubmit="addMachineAdj(event,'${b.id}')"><select name="mat">${opts.map(o => `<option value="${o}">${esc(Api.material(o).name)}</option>`).join('')}</select>
      <input name="kg" type="number" step="0.1" placeholder="kg  (minus = ta bort)" required><button class="btn">Lägg till</button></form>`);
}
window.addMachineAdj = (e, id) => { e.preventDefault(); const b = Api.batch(id); const f = new FormData(e.target); const kg = parseFloat(String(f.get('kg')).replace(',', '.')); if (!kg) return; b.machineAdj.push({ mat: f.get('mat'), kg }); Api.save(); render(); };
window.rmMachineAdj = (id, i) => { Api.batch(id).machineAdj.splice(i, 1); Api.save(); render(); };
window.confirmStop = id => {
  const b = Api.batch(id);
  modal(`<h3>Stoppa batch ${b.id}?</h3><p>Förbrukningen rapporteras${b.machineAdj.length ? ` inklusive ${b.machineAdj.length} justering(ar)` : ''} och batchen går vidare till prov tapp.</p>`,
    [['Avbryt', 'ghost'], ['Stoppa batch', 'danger', () => act('stopMix', id)]]);
};

/* ---------- Provning ---------- */
function viewTestList(tab = 'startade') {
  const all = Api.batches();
  const g = { startade: all.filter(b => b.test === 'running' || b.test === 'waiting').sort(byPlanned), stoppade: all.filter(b => b.test === 'stopped').sort(byStoppedDesc) };
  return header([['Översikt', '#/'], ['Kvalitet']], '<em>Provning</em>', 'Kvalitetskontroll av blandade batcher')
    + tabs([['startade', 'Startat', g.startade.length], ['stoppade', 'Stoppade', g.stoppade.length]], tab, '#/provning')
    + listCard(g[tab].slice(0, 50).map(b => batchRow(b, `#/prov/${b.id}`, 'test', tab === 'stoppade')).join(''), 'Inget i provning', 'Batcher dyker upp här när de startas i en maskin.');
}

let draftAdj = null;
function measureRow(k, v, spec, prevVals, input) {
  const M = MEASURES[k]; const ok = v != null && inRange(v, spec);
  return `<div class="mrow ${v == null ? '' : ok ? 'ok' : 'bad'}">
    <div class="lbl"><b>${esc(M.name)}</b><span>${fmtRange(k, spec)} ${M.unit}</span>${prevVals?.length ? `<div class="prev">Före: ${prevVals.slice(0, 3).map(p => fmtVal(k, p.value)).join(' ← ')}</div>` : ''}</div>
    <div class="val">${v == null ? '<span class="none">—</span>' : fmtVal(k, v)}${!M.bool && v != null ? `<em>${M.unit}</em>` : ''}</div>
    ${input || '<div></div>'}</div>`;
}
/* Kvalitetsmått som kompakt tabell (samma struktur som i BC): en rad per mätning, senaste överst per mått. */
function qualityTable(keys, specs, rows, editable, id, fnNum, fnBool) {
  const body = keys.map(k => {
    const M = MEASURES[k]; const spec = specs[k];
    const hist = rows.filter(r => r.key === k).sort((x, y) => y.time.localeCompare(x.time));
    const input = !editable ? '' : M.bool ? boolInput(fnBool, id, k) : numInput(fnNum, id, k, hist.length);
    const lim = i => M.bool ? 1 : nf(spec[i], M.dec);
    const line = (r, i) => `<tr class="${r ? (inRange(r.value, spec) ? 'gok' : 'gbad') : 'gnone'} ${i ? 'old' : ''}">
      <td class="num">${i ? '' : M.no}</td><td>${i ? '' : esc(M.name)}</td>
      <td class="r num v">${r ? fmtVal(k, r.value) : '–'}</td><td class="r num">${lim(0)}</td><td class="r num">${lim(1)}</td>
      <td class="num t">${r ? `${tm(r.time)} <span>${esc(r.by)}</span>` : ''}</td><td class="in">${i ? '' : input}</td></tr>`;
    return hist.length ? hist.map((r, i) => line(r, i)).join('') : line(null, 0);
  }).join('');
  return `<div class="scroll"><table class="tbl qtbl"><thead><tr><th>Nr</th><th>Beskrivning</th><th class="r">Värde</th><th class="r">Min</th><th class="r">Max</th><th>Uppdaterad</th><th>${editable ? 'Nytt värde' : ''}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
const numInput = (fn, id, k, has) => `<form class="qin" onsubmit="${fn}(event,'${id}','${k}')"><input name="v" inputmode="decimal" placeholder="${has ? 'Ny rad' : 'Värde'}" autocomplete="off"><button class="btn">+</button></form>`;
const boolInput = (fn, id, k) => `<div class="boolbtns qin"><button class="btn ok" onclick="${fn}('${id}','${k}',1)">OK</button><button class="btn bad" onclick="${fn}('${id}','${k}',0)">Ej OK</button></div>`;

function viewTest(id) {
  const b = Api.batch(id); if (!b) return empty('Batchen finns inte');
  const rec = Api.recipe(b.recipe); const m = Api.machine(b.machine);
  const keys = sortedSpecKeys(rec.spec); const cur = currentValues(b);
  const editable = b.test === 'running';
  let top = '';
  if (b.test === 'waiting') top = b.mix === 'running'
    ? `<div class="alert amber"><div>Batchen blandas fortfarande. Pausa den i <a href="#/batch/${b.id}">${esc(m.name)} →</a> och starta sedan provningen här.</div></div>`
    : `<div class="actions"><button class="btn primary big" onclick="act('startTest','${b.id}')">Starta provning</button></div>`;
  if (editable) top = `<div class="actions"><button class="btn danger big" onclick="act('stopTest','${b.id}')">Stoppa provning</button></div>`;
  if (b.test === 'stopped') top = b.mix === 'paused'
    ? `<div class="alert green"><div>Provningen är klar. Gå till <a href="#/batch/${b.id}">${esc(m.name)} →</a> för att lägga in justeringar och stoppa batchen.</div></div><div class="actions"><a class="btn primary big" href="#/batch/${b.id}">Till ${esc(m.name)}</a><button class="btn ghost" onclick="act('reopenTest','${b.id}')">Återöppna provning</button></div>`
    : `<div class="alert green"><div>Provningen är klar${b.tapp === 'done' ? ' och batchen godkänd i prov tapp' : ''}.</div></div>`;

  const table = qualityTable(keys, rec.spec, b.rows, editable, b.id, 'addRowForm', 'addRow');
  const adjEvents = [...b.adjustments].sort((x, y) => x.time.localeCompare(y.time));

  const notePanel = panel('Anteckning & justering', `
      <textarea class="notearea" ${editable ? '' : 'readonly'} placeholder="Vad har du gått i med och hur mycket?" onchange="saveNote('${b.id}',this.value)">${esc(b.note)}</textarea>
      ${adjEvents.length ? `<div class="adjlist">${adjEvents.map(a => `<div class="adjrow"><span class="muted mono">${tm(a.time)}</span><span>${esc(matShort(a.mat))}</span><b class="posv">+${nf(a.kg, 1)} kg</b></div>`).join('')}</div>` : ''}
      ${editable ? `<form class="addrow" onsubmit="addAdj(event,'${b.id}')"><select name="mat">${rec.adjust.map(o => `<option value="${o}" ${draftAdj?.mat === o ? 'selected' : ''}>${esc(Api.material(o).name)}</option>`).join('')}</select><input name="kg" id="adjKg" type="number" step="0.1" min="0.1" placeholder="kg" value="${draftAdj?.kg ?? ''}" required><button class="btn primary">Registrera</button></form>` : ''}`);
  draftAdj = null;
  return header([['Översikt', '#/'], ['Provning', '#/provning/' + (b.test === 'stopped' ? 'stoppade' : 'startade')], [b.id]], titleFor(rec), subline('Kvalitetsmått', `<span class="mono">${b.id}</span>`, esc(m.name), `${nf(b.weight)} kg`, statusPill(b, 'test')))
    + flowSteps(b) + top
    + `<div class="grid-t"><div><section class="card panel"><div class="ph"><h3>Kvalitetsmått</h3><span class="muted">${b.rows.length} rader</span></div>${table}</section></div>
      <div>${b.test !== 'waiting' ? recommendPanel(b) : ''}${b.test !== 'waiting' ? notePanel : ''}</div></div>`;
}
window.addRow = (id, key, value) => { const b = Api.batch(id); b.rows.push({ key, value, time: nowIso(), by: operator }); Api.save(); render(); };
window.addRowForm = (e, id, key) => {
  e.preventDefault(); const v = parseFloat(String(new FormData(e.target).get('v')).replace(/\s/g, '').replace(',', '.'));
  if (isNaN(v)) return toast('Ange ett numeriskt värde', 'err');
  const rec = Api.recipe(Api.batch(id).recipe); addRow(id, key, v);
  inRange(v, rec.spec[key]) ? toast(`${MEASURES[key].name} ${fmtVal(key, v)} – inom intervall`) : toast(`${MEASURES[key].name} ${fmtVal(key, v)} – utanför intervall`, 'err');
};
window.saveNote = (id, v) => { Api.batch(id).note = v; Api.save(); };
window.addAdj = (e, id) => {
  e.preventDefault(); const b = Api.batch(id); const f = new FormData(e.target);
  const kg = parseFloat(String(f.get('kg')).replace(',', '.')); const mat = f.get('mat'); if (!(kg > 0)) return;
  b.adjustments.push({ mat, kg, time: nowIso(), by: operator });
  b.note = (b.note ? b.note.trimEnd() + '\n' : '') + noteLine(b.adjustments.length, kg, mat, b.weight); Api.save();
  toast(`+${nf(kg, 1)} kg ${matShort(mat)} registrerat – mät igen efter omrörning`); render();
};
window.useRec = (mat, kg) => { draftAdj = { mat, kg }; render(); setTimeout(() => { $('#adjKg')?.focus(); $('#adjKg')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30); };

function recommendPanel(b) {
  const rec = Api.recipe(b.recipe); const R = recommend(b);
  if (!R.keys.length) return panel('Rekommendation', `<p class="hint" style="margin-top:0">Ange viskositetsvärden för att få ett förslag.</p>`);
  if (!R.bad.length) return panel('Rekommendation', `<p class="recok">Alla värden inom intervall.</p><p class="hint" style="margin-top:-6px">Ingen justering behövs.</p>`);
  const opts = R.results.filter(x => x.kg != null);
  if (!opts.length) return panel('Rekommendation', `<p class="hint" style="margin-top:0">Ingen råvara med historik förbättrar värdena.</p>`);
  const x = opts[0]; const same = x.hist.filter(h => h.recipe.type === rec.type).length;
  const hero = `<div class="rec-hero">
      <div class="eyebrow">Föreslagen justering</div>
      <div class="big"><span class="kg">+${nf(x.kg, x.kg < 20 ? 1 : 0)}<small>kg</small></span><span class="mat">${esc(matShort(x.mat))}</span></div>
      <div class="why">Baserat på ${x.hist.length} tidigare justeringar (${same} på liknande recept), skalat till ${nf(b.weight)} kg.</div>
      <table class="pred">${R.keys.map(k => `<tr><td>${esc(MEASURES[k].name)}</td><td class="r num ${inRange(R.cur[k], rec.spec[k]) ? 'tok' : 'tbad'}">${fmtVal(k, R.cur[k])}</td><td class="r num ${x.eff[k] == null ? '' : inRange(x.pred[k], rec.spec[k]) ? 'tok' : 'tbad'}">${x.eff[k] != null ? '→ ' + fmtVal(k, x.pred[k]) : '<span class="muted">–</span>'}</td></tr>`).join('')}</table>
      ${b.test === 'running' ? `<button class="btn primary wide" onclick="useRec('${x.mat}',${x.kg})">Använd förslaget</button>` : ''}
      <details style="margin-top:14px"><summary>Så räknades det</summary>
        <p class="hint">Snitteffekt per kg per ton: ${Object.entries(x.eff).filter(([k]) => R.keys.includes(k)).map(([k, e]) => `${MEASURES[k].name.replace('Viskositet ', '')} ${e > 0 ? '+' : ''}${nf(e, Math.abs(e) < 10 ? 2 : 0)}`).join(', ')}. ${nf(x.perTon, 3)} kg/ton × ${nf(b.weight / 1000, 2)} ton = <b>${nf(x.kg, 1)} kg</b>.</p>
        <table class="tbl mini"><thead><tr><th>Batch</th><th class="r">Vikt</th><th class="r">Tillsats</th><th class="r">Skalat</th></tr></thead><tbody>
        ${x.hist.slice(0, 5).map(h => `<tr><td><a href="#/rapport/${h.batch.id}" class="mono">${h.batch.id}</a></td><td class="r num">${nf(h.batch.weight)}</td><td class="r num">+${nf(h.kg, 1)}</td><td class="r num">${nf(h.kg / h.batch.weight * b.weight, 1)} kg</td></tr>`).join('')}</tbody></table>
      </details></div>`;
  const alts = opts.slice(1, 4);
  return panel('Rekommendation', hero + (alts.length ? `<div class="alt"><div class="eyebrow">Alternativ</div>${alts.map(a => `<div class="altrow"><span>${esc(matShort(a.mat))}</span><b>+${nf(a.kg, a.kg < 20 ? 1 : 0)} kg</b>${b.test === 'running' ? `<button onclick="useRec('${a.mat}',${a.kg})">Välj</button>` : ''}</div>`).join('')}</div>` : ''),
    `<span class="muted">${R.bad.length} utanför</span>`);
}

/* ---------- Prov tapp ---------- */
function tappRef(b) { const r = latest(b.rows, 'ici'); return r ? r.value : null; }
function viewTappList() {
  const all = Api.batches();
  const list = all.filter(b => b.tapp === 'waiting' || b.tapp === 'running').sort(byStoppedDesc);
  const done = all.filter(b => b.tapp === 'done').sort((a, b) => (b.tappDone || '').localeCompare(a.tappDone || '')).slice(0, 6);
  return header([['Översikt', '#/'], ['Kvalitet']], '<em>Prov tapp</em>', 'Uppstrykning och ICI-kontroll innan tappning')
    + listCard(list.map(b => batchRow(b, `#/tapp/${b.id}`, 'tapp')).join(''), 'Inget väntar på prov tapp', 'Batcher hamnar här när de stoppas i maskinen.')
    + `<h2 class="sec">Senast godkända</h2>` + listCard(done.map(b => batchRow(b, `#/rapport/${b.id}`, 'tapp', true)).join(''), 'Inga ännu');
}
function viewTapp(id) {
  const b = Api.batch(id); if (!b) return empty('Batchen finns inte');
  const rec = Api.recipe(b.recipe); const ref = tappRef(b);
  const spec = { upp: [1, 1], ...(ref != null ? { ici: [Math.round(ref * 0.95), Math.round(ref * 1.05)] } : {}) };
  const cur = {}; for (const k in spec) { const r = latest(b.tappRows, k); if (r) cur[k] = r.value; }
  const allOk = Object.keys(spec).every(k => cur[k] != null && inRange(cur[k], spec[k]));
  const editable = b.tapp === 'running';
  const table = qualityTable(Object.keys(spec), spec, b.tappRows, editable, b.id, 'addTappForm', 'addTapp');
  let top = '';
  if (b.tapp === 'waiting') top = `<div class="actions"><button class="btn primary big" onclick="act('startTapp','${b.id}')">Starta prov tapp</button></div>`;
  if (editable) top = `<div class="actions"><button class="btn primary big" ${allOk ? '' : 'disabled'} onclick="act('finishTapp','${b.id}','#/tapp')">Godkänn och stoppa</button>${allOk ? '' : '<span class="muted">Båda proven måste vara gröna</span>'}</div>`;
  if (b.tapp === 'done') top = `<div class="alert green"><div>Godkänd ${dt(b.tappDone)}. <a href="#/rapport/${b.id}">Visa rapport →</a></div></div>`;
  return header([['Översikt', '#/'], ['Prov tapp', '#/tapp'], [b.id]], titleFor(rec), subline('Prov tapp', `<span class="mono">${b.id}</span>`, esc(Api.machine(b.machine).name), `${nf(b.weight)} kg`, statusPill(b, 'tapp')))
    + flowSteps(b) + top
    + `<div class="grid-t"><div><section class="card panel"><div class="ph"><h3>Kvalitetsmått</h3></div>${table}</section>
      ${ref != null ? `<p class="hint" style="margin:0 4px">ICI-intervallet är ±5 % av provningens sista värde (${nf(ref)} cP).</p>` : ''}</div>
      <div>${panel('Från provningen', measureSummary(b), `<a href="#/prov/${b.id}">Öppna →</a>`)}</div></div>`;
}
window.addTapp = (id, key, value) => { Api.batch(id).tappRows.push({ key, value, time: nowIso(), by: operator }); Api.save(); render(); };
window.addTappForm = (e, id, key) => { e.preventDefault(); const v = parseFloat(String(new FormData(e.target).get('v')).replace(/\s/g, '').replace(',', '.')); if (isNaN(v)) return; addTapp(id, key, v); };

/* ---------- Historik / rapport ---------- */
let histQ = '';
function viewHistory() {
  const q = histQ.toLowerCase();
  const list = Api.batches().filter(b => b.mix === 'stopped').filter(b => { const r = Api.recipe(b.recipe); return !q || [b.id, r.no, r.name, Api.machine(b.machine).name].join(' ').toLowerCase().includes(q); }).sort(byStoppedDesc);
  return header([['Översikt', '#/'], ['Data']], '<em>Historik</em>', 'Stoppade batcher, provningar och justeringar')
    + `<input class="search" placeholder="Sök batch, recept eller maskin" value="${esc(histQ)}" oninput="histQ=this.value;render();this.focus();this.setSelectionRange(this.value.length,this.value.length)">`
    + `<section class="card panel"><div class="scroll"><table class="tbl click"><thead><tr><th>Stoppad</th><th>Benämning</th><th>Batch</th><th>Maskin</th><th class="r">Vikt</th><th class="r">Just.</th><th>Status</th></tr></thead><tbody>
      ${list.slice(0, 120).map(b => { const r = Api.recipe(b.recipe); return `<tr onclick="location.hash='#/rapport/${b.id}'"><td class="num">${dt(b.stopped)}</td><td><span style="display:inline-flex;gap:8px;align-items:center">${swatch(r)}${esc(r.name)}</span></td><td class="mono">${b.id}</td><td>${esc(Api.machine(b.machine).name)}</td><td class="r num">${nf(b.weight)}</td><td class="r num">${b.adjustments.length || '–'}</td><td>${statusPill(b, 'tapp')}</td></tr>`; }).join('')}
      </tbody></table></div></section>`;
}
function viewReport(id) {
  const b = Api.batch(id); if (!b) return empty('Batchen finns inte');
  const rec = Api.recipe(b.recipe);
  const events = [...b.rows.map(r => ({ t: r.time, html: `<td>${esc(MEASURES[r.key].name)}</td><td class="r num ${inRange(r.value, rec.spec[r.key]) ? 'tok' : 'tbad'}">${fmtVal(r.key, r.value)}</td><td class="r muted">${fmtRange(r.key, rec.spec[r.key])}</td>` })),
    ...b.adjustments.map(a => ({ t: a.time, adj: true, html: `<td colspan="3">+${nf(a.kg, 1)} kg ${esc(Api.material(a.mat).name)}</td>` }))].sort((x, y) => x.t.localeCompare(y.t));
  return header([['Översikt', '#/'], ['Historik', '#/historik'], [b.id]], titleFor(rec), subline('Batchrapport', `<span class="mono">${b.id}</span>`, statusPill(b, 'tapp')), `<button class="btn ghost" onclick="printBatch('${b.id}')">Skriv ut</button>`)
    + `<div class="grid-b"><div>${panel('Provningsförlopp', `<div class="scroll"><table class="tbl"><thead><tr><th>Tid</th><th>Mått</th><th class="r">Värde</th><th class="r">Intervall</th></tr></thead><tbody>
      ${events.map(e => `<tr class="${e.adj ? 'adjline' : ''}"><td class="num">${tm(e.t)}</td>${e.html}</tr>`).join('') || '<tr><td colspan="4" class="muted">Ingen provning registrerad.</td></tr>'}</tbody></table></div>`)}
      ${b.tappRows.length ? panel('Prov tapp', `<table class="tbl"><tbody>${b.tappRows.map(r => `<tr><td class="num">${tm(r.time)}</td><td>${esc(MEASURES[r.key].name)}</td><td class="r num">${fmtVal(r.key, r.value)}</td><td class="muted">${esc(r.by)}</td></tr>`).join('')}</tbody></table>`) : ''}</div>
      <div>${panel('Batch', infoGrid(b))}${panel('Slutvärden', measureSummary(b))}${b.note ? panel('Anteckning', `<pre class="notepre">${esc(b.note)}</pre>`) : ''}</div></div>`;
}

function viewMaterials() {
  const ms = [...Api.state.materials].sort((a, b) => (a.stock / (a.min || 1)) - (b.stock / (b.min || 1)));
  const need = {}; for (const b of Api.batches().filter(b => b.mix === 'planned')) for (const c of components(b)) need[c.m.no] = (need[c.m.no] || 0) + c.kg;
  return header([['Översikt', '#/'], ['Data']], '<em>Råvaror</em>', 'Lagersaldo och behov för planerade batcher')
    + `<section class="card panel"><div class="scroll"><table class="tbl"><thead><tr><th>Råvara</th><th class="r">Saldo kg</th><th class="r">Behov</th><th>Nivå</th></tr></thead><tbody>
    ${ms.map(m => { const pct = m.bulk ? 100 : Math.min(100, m.stock / (Math.max(m.min * 3, (need[m.no] || 0) * 1.2) || 1) * 100); const lvl = m.bulk ? 'ok' : m.stock < m.min || m.stock < (need[m.no] || 0) ? 'red' : m.stock < m.min * 1.5 ? 'amber' : 'ok';
      return `<tr><td>${esc(m.name)}<div class="muted mono" style="font-size:.74rem">${m.art} · ${esc(m.cat)}</div></td><td class="r num">${m.bulk ? 'ledning' : nf(m.stock)}</td><td class="r num">${nf(need[m.no] || 0)}</td><td><div class="meter ${lvl}"><i style="width:${pct}%"></i></div></td></tr>`; }).join('')}</tbody></table></div></section>`;
}

/* ---------- Utskrift ---------- */
window.printBatch = id => {
  const b = Api.batch(id); const rec = Api.recipe(b.recipe); const comps = components(b);
  $('#print').innerHTML = `<div class="pr-head"><div><b>Teds Kalasfärg AB</b><span>Plocklista / tillverkningsorder</span></div><div class="pr-no">${b.id}</div></div>
    <table class="pr-info"><tr><td>Recept</td><td>${rec.no}</td><td>Benämning</td><td>${esc(rec.name)}</td></tr><tr><td>Maskin</td><td>${esc(Api.machine(b.machine).name)}</td><td>Vikt</td><td>${nf(b.weight)} kg</td></tr><tr><td>Planerat</td><td>${dt(b.planned)}</td><td>Utskriven</td><td>${dt(nowIso())} av ${esc(operator)}</td></tr></table>
    <table class="pr-tbl"><thead><tr><th>✓</th><th>Artikel</th><th>Råvara</th><th>Antal kg</th><th>Invägt kg</th><th>Sign</th></tr></thead><tbody>${comps.map(c => `<tr><td>☐</td><td>${c.m.art}</td><td>${esc(c.m.name)}</td><td class="r">${nf(c.kg, c.kg < 10 ? 2 : 1)}</td><td></td><td></td></tr>`).join('')}</tbody></table>
    <h4>Kvalitetskrav</h4><table class="pr-tbl"><tbody>${sortedSpecKeys(rec.spec).map(k => `<tr><td>${esc(MEASURES[k].name)}</td><td>${fmtRange(k, rec.spec[k])} ${MEASURES[k].unit}</td><td style="width:30%"></td></tr>`).join('')}</tbody></table>
    <div class="pr-sign"><span>Blandare: ____________________</span><span>Provare: ____________________</span></div>`;
  window.print();
};

/* ---------- Modal ---------- */
function modal(html, buttons) {
  const el = document.createElement('div'); el.className = 'modal-bg';
  el.innerHTML = `<div class="modal">${html}<div class="modal-btns"></div></div>`;
  buttons.forEach(([l, k, fn]) => { const btn = document.createElement('button'); btn.className = `btn ${k}`; btn.textContent = l; btn.onclick = () => { el.remove(); fn?.(); }; el.querySelector('.modal-btns').append(btn); });
  el.onclick = e => e.target === el && el.remove(); document.body.append(el);
}

/* ---------- Navigering ---------- */
function nav() {
  const all = Api.batches(); const h = location.hash || '#/';
  const item = (href, label, badge, match) => `<a href="${href}" class="${(match || [href]).some(p => p === '#/' ? h === '#/' || h === '' : h.startsWith(p)) ? 'on' : ''}">${label}${badge ? `<span class="nb">${badge}</span>` : ''}</a>`;
  $('#nav').innerHTML = item('#/', 'Översikt')
    + item(`#/maskin/${localStorage.getItem('kalas-m') || 'stjarnan'}`, 'Maskiner', '', ['#/maskin', '#/batch'])
    + item('#/provning', 'Provning', all.filter(b => b.test === 'running' || b.test === 'waiting').length, ['#/provning', '#/prov/'])
    + item('#/tapp', 'Prov tapp', all.filter(b => b.tapp === 'waiting' || b.tapp === 'running').length)
    + item('#/historik', 'Historik', '', ['#/historik', '#/rapport'])
    + item('#/ravaror', 'Råvaror');
}
function render() {
  const [, route, a, b2] = (location.hash || '#/').split('/');
  if (route === 'maskin' && a) try { localStorage.setItem('kalas-m', a); } catch {}
  const views = { '': viewHome, maskin: () => viewMachine(a, b2), batch: () => viewBatch(a), provning: () => viewTestList(a), prov: () => viewTest(a), tapp: () => a ? viewTapp(a) : viewTappList(), historik: viewHistory, rapport: () => viewReport(a), ravaror: viewMaterials };
  const y = window.scrollY; const same = render.last === location.hash;
  $('#main').innerHTML = (views[route] || viewHome)();
  nav(); render.last = location.hash; window.scrollTo(0, same ? y : 0);
  document.body.classList.remove('menu');
}
window.addEventListener('hashchange', render);
window.act = act;

$('#op').innerHTML = OPERATORS.map(o => `<option ${o === operator ? 'selected' : ''}>${o}</option>`).join('');
$('#op').onchange = e => { operator = e.target.value; localStorage.setItem('kalas-op', operator); render(); };
$('#reset').onclick = () => modal('<h3>Återställ demodata?</h3><p>All inmatning ersätts med nya simulerade batcher.</p>', [['Avbryt', 'ghost'], ['Återställ', 'danger', () => { Api.reset(); location.hash = '#/'; render(); toast('Demodata återställd'); }]]);
$('#burger').onclick = () => document.body.classList.toggle('menu');
render();
