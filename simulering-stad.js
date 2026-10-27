/* Kvarter 07 — en självstyrd stad (Claude 2026-10-11).
   Tio AI-invånare lever sina liv. Varje natt simulerar Leia (lokal modell på Teds server) hela nästa dag
   i snabbt tempo: planer, samtal, affärer, stämma och dagbok. Här spelas dagen upp i verklig svensk tid,
   08:00–22:00. Inget skickas härifrån; sidan läser bara den publicerade, filtrerade dagen från GitHub. */
(() => {
  const mount = document.querySelector('#city-canvas');
  if (!mount) return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DATA = 'https://raw.githubusercontent.com/Terrorbyte90/Hemsida/stad/';
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const fmt = m => { m = ((Math.floor(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const WAKE = 480, SLEEP = 1320;

  /* ───────── Karta ─────────
     Gator: X = ±14, ±30 · Z = −22, −8, 8, 22. Torget i mitten, sjön i söder. */
  const XR = [-30, -14, 14, 30], ZR = [-22, -8, 8, 22];
  const P = {
    torget:     { n: 'Torget',          pos: [0, 0],      spot: [0, 3.2] },
    stadshus:   { n: 'Stadshuset',      pos: [0, -15.5],  spot: [0, -10.4], face: 0 },
    bibliotek:  { n: 'Biblioteket',     pos: [-22, -15.5],spot: [-22, -10.4], face: 0 },
    skola:      { n: 'Skolan',          pos: [22, -15.5], spot: [22, -10.4], face: 0 },
    butik:      { n: 'Butiken',         pos: [-22.5, -3.4], spot: [-16.2, -3.4], face: Math.PI / 2 },
    redaktion:  { n: 'Kvartersbladet',  pos: [-22.5, 3.6],  spot: [-16.2, 3.6], face: Math.PI / 2 },
    kafe:       { n: 'Kaféet Koppen',   pos: [22.5, -3.4],  spot: [16.2, -3.4], face: -Math.PI / 2 },
    bageri:     { n: 'Bageriet',        pos: [22.5, 3.6],   spot: [16.2, 3.6], face: -Math.PI / 2 },
    vardcentral:{ n: 'Vårdcentralen',   pos: [-22, 15.5], spot: [-22, 10.4], face: Math.PI },
    verkstad:   { n: 'Verkstaden',      pos: [22, 15.5],  spot: [22, 10.4], face: Math.PI },
    park:       { n: 'Parken',          pos: [-5, 15],    spot: [-4, 11.6] },
    scen:       { n: 'Scenen',          pos: [7, 17.5],   spot: [7, 12.6], face: Math.PI },
    odling:     { n: 'Stadsodlingen',   pos: [-22, 29],   spot: [-22, 24.6] },
    brygga:     { n: 'Bryggan',         pos: [9, 31],     spot: [9, 30.5] },
  };
  const HOME_X = [-27, -21, -15, -9, -3, 3, 9, 15, 21, 27];
  const LOTS = [[-38, -15], [38, -15], [-38, 0], [38, 0], [-38, 15], [38, 15], [-38, 29], [38, 29]];
  const KATALOG_N = { lekplats: 'Lekplats', marknad: 'Marknadsplats', bastu: 'Bastu', konsthall: 'Konsthall', idrottsplats: 'Idrottsplats',
    vaktstuga: 'Vaktstuga', vaxthus: 'Växthus', bostader: 'Nya bostäder', fyr: 'Fyr', verkstadshall: 'Verkstadshall', biograf: 'Biograf', radhus: 'Radhus' };

  /* ───────── Tillstånd ───────── */
  let D = null, index = null, live = true, speed = 1, simMin = 0, selected = null, follow = false, archived = false;
  let scene, camera, renderer, hemi, sun, fill, stars, rain, snow, clouds = [], water;
  const windows = [], lamps = [], people = {}, homes = {}, lotGroups = [], cars = [], birds = [], ducks = [];
  let skyMat = null, waterGeo = null;
  let yaw = 0.62, pitch = 0.72, dist = 64, autoYaw = true, dragging = false, lastX = 0, lastY = 0, pinch = 0;
  let target = new THREE.Vector3(0, 0, 3), last = performance.now(), uiT = 0, lastRenderedDay = null;

  const stockholmMin = () => {
    const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const g = t => +p.find(x => x.type === t).value;
    return g('hour') * 60 + g('minute') + g('second') / 60;
  };
  const stockholmDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());

  /* ───────── Byggstenar ───────── */
  const matCache = {};
  const mat = (c, r = .8, m = .03) => matCache[c + '|' + r + '|' + m] ||= new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  function add(geo, material, p, parent, rot) {
    const m = new THREE.Mesh(geo, typeof material === 'number' ? mat(material) : material);
    m.position.set(p[0], p[1], p[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (w, h, d, c, p, parent, rot) => add(new THREE.BoxGeometry(w, h, d), c, p, parent, rot);
  const cyl = (rt, rb, h, c, p, parent, seg = 14) => add(new THREE.CylinderGeometry(rt, rb, h, seg), c, p, parent);
  const ball = (r, c, p, parent, seg = 12) => add(new THREE.SphereGeometry(r, seg, seg), c, p, parent);
  function gable(w, d, h, c, y, parent) { // sadeltak
    const s = new THREE.Shape(); s.moveTo(-w / 2 - .25, 0); s.lineTo(0, h); s.lineTo(w / 2 + .25, 0); s.lineTo(-w / 2 - .25, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d + .5, bevelEnabled: false }); g.translate(0, 0, -(d + .5) / 2);
    return add(g, mat(c, .9), [0, y, 0], parent);
  }
  function sign(text, color = '#f3c98b', w = 5) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = 'rgba(10,14,22,.82)'; x.beginPath(); x.roundRect ? x.roundRect(6, 10, 500, 76, 22) : x.rect(6, 10, 500, 76); x.fill();
    x.strokeStyle = color; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#f4f1ea'; x.font = '600 40px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(w, w * 96 / 512, 1); s.renderOrder = 10; return s;
  }
  function win(w, h, p, parent, rotY = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x1d2a3a, emissive: 0xffc77a, emissiveIntensity: 0, roughness: .2, metalness: .3 }));
    m.position.set(p[0], p[1], p[2]); m.rotation.y = rotY; parent.add(m); windows.push(m); return m;
  }
  function facadeWindows(g, w, h, d, rows, cols, y0 = 1.2, gapY = 1.5) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * (w / cols);
      win(w / cols * .5, .8, [x, y0 + r * gapY, d / 2 + .02], g);
      win(w / cols * .5, .8, [x, y0 + r * gapY, -d / 2 - .02], g, Math.PI);
    }
  }
  function group(x, z, rot = 0) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); return g; }
  function awning(g, w, y, z, c1, c2) {
    const n = Math.max(4, Math.round(w / .5));
    for (let i = 0; i < n; i++) box(w / n, .08, 1, i % 2 ? c1 : c2, [-w / 2 + (i + .5) * w / n, y, z], g, [-.35, 0, 0]);
  }
  function tree(x, z, s = 1, kind = 0) {
    const g = group(x, z); g.scale.setScalar(s);
    cyl(.13, .2, 1.4, 0x5a4332, [0, .7, 0], g, 7);
    if (kind === 1) { // gran
      add(new THREE.ConeGeometry(1.1, 2.2, 8), mat(0x2f5e45, .95), [0, 2.1, 0], g);
      add(new THREE.ConeGeometry(.8, 1.8, 8), mat(0x356a4d, .95), [0, 3.1, 0], g);
    } else {
      const c = [0x4b8a5f, 0x5c9a63, 0x6a9e57, 0x3f7a55][Math.floor(Math.abs(x * 7 + z * 3)) % 4];
      ball(.95, mat(c, .95), [0, 2, 0], g, 9); ball(.7, mat(c, .95), [.45, 2.5, .2], g, 8); ball(.6, mat(c, .95), [-.4, 2.4, -.25], g, 8);
    }
  }
  function lamp(x, z) {
    cyl(.05, .08, 3, 0x1e2633, [x, 1.5, z], scene, 6);
    const bulb = ball(.16, new THREE.MeshBasicMaterial({ color: 0x5a4a30 }), [x, 3.05, z], scene, 8); bulb.castShadow = false;
    const light = new THREE.PointLight(0xffc27a, 0, 11, 2); light.position.set(x, 3, z); scene.add(light);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(3.2, 3.2, 1); halo.position.set(x, 3.05, z); scene.add(halo);
    lamps.push({ bulb, light, halo });
  }
  let _glow = null;
  function glowTex() {
    if (_glow) return _glow;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return _glow = new THREE.CanvasTexture(c);
  }
  function grassTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#5b7f4c'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = Math.random(); x.fillStyle = v < .5 ? 'rgba(74,108,60,.35)' : v < .85 ? 'rgba(112,140,84,.28)' : 'rgba(150,160,100,.2)'; x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 2 + Math.random() * 5); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(22, 22); t.encoding = THREE.sRGBEncoding; return t;
  }
  function flowers(x, z, w, d) {
    const g = group(x, z); box(w, .25, d, 0x6b4a32, [0, .12, 0], g);
    for (let i = 0; i < w * d * 3; i++) ball(.12, [0xe5566b, 0xf2c14e, 0xf7f3e8, 0xb07ad9, 0xef8a4a][i % 5], [(Math.random() - .5) * (w - .3), .35, (Math.random() - .5) * (d - .3)], g, 5).castShadow = false;
  }
  function hedge(x, z, w, d) { const h = box(w, .9, d, mat(0x3f6e45, .95), [x, .45, z], scene); return h; }
  function car(i) {
    const g = new THREE.Group(); const col = [0xd94c3d, 0x2f6fb0, 0xf2f2ee, 0x2b2f36, 0xf0b13d, 0x5aa36a, 0x8a5ab0][i % 7];
    box(1.3, .55, 2.6, mat(col, .4, .3), [0, .55, 0], g); box(1.15, .5, 1.4, mat(0x1d2633, .2, .4), [0, 1.05, -.15], g);
    for (const [wx, wz] of [[-.62, .85], [.62, .85], [-.62, -.85], [.62, -.85]]) { const w = cyl(.28, .28, .2, 0x111111, [wx, .28, wz], g, 10); w.rotation.z = Math.PI / 2; }
    const hl = new THREE.MeshBasicMaterial({ color: 0x555544 }); box(.25, .14, .05, hl, [-.4, .6, 1.31], g); box(.25, .14, .05, hl, [.4, .6, 1.31], g);
    scene.add(g);
    // slinga längs gatorna
    const loops = [[[-30, -22], [30, -22], [30, 22], [-30, 22]], [[-14, -8], [14, -8], [14, 8], [-14, 8]], [[-30, -8], [-14, -8], [-14, 22], [-30, 22]], [[14, -22], [30, -22], [30, 8], [14, 8]]];
    const L = loops[i % loops.length]; const path = [...L, L[0]].map(([x, z]) => [x + (i % 2 ? .7 : -.7), z + (i % 2 ? .7 : -.7)]);
    if (i % 2) path.reverse();
    return { g, path, f: Math.random(), v: .012 + Math.random() * .01, hl };
  }
  function bench(x, z, r = 0) { const g = group(x, z, r); box(1.6, .1, .5, 0x8a6446, [0, .45, 0], g); box(1.6, .5, .08, 0x8a6446, [0, .75, -.22], g); box(.08, .45, .45, 0x2b313a, [-.7, .22, 0], g); box(.08, .45, .45, 0x2b313a, [.7, .22, 0], g); }

  /* ───────── Byggnader ───────── */
  const B = {
    stadshus(g) {
      box(13, 6.5, 7, 0xe9e1d2, [0, 3.25, 0], g); box(13.6, .5, 7.6, 0xb9ae9a, [0, 6.6, 0], g);
      gable(13, 7, 2.2, 0x3e4f63, 6.85, g);
      box(3.2, 5, 3.2, 0xe9e1d2, [0, 9.5, 0], g); add(new THREE.ConeGeometry(2.5, 3, 4), mat(0x2f6b5d, .6, .3), [0, 13.5, 0], g, [0, Math.PI / 4, 0]);
      const clock = cyl(.95, .95, .12, new THREE.MeshStandardMaterial({ color: 0xf8f2e2, emissive: 0xffe2a8, emissiveIntensity: .15 }), [0, 10.3, 1.62], g, 24); clock.rotation.x = Math.PI / 2;
      for (let i = -2; i <= 2; i++) cyl(.32, .36, 4.6, 0xf4efe6, [i * 2.1, 2.3, 4.1], g);
      box(11, .25, 2.2, 0xd5cbb8, [0, 4.75, 4.2], g);
      for (let s = 0; s < 3; s++) box(9 - s * .6, .22, .7, 0xcfc6b5, [0, .11 + s * .22, 5.6 - s * .5], g);
      facadeWindows(g, 13, 6.5, 7, 2, 6, 2, 2.4);
      cyl(.05, .05, 4, 0xdddddd, [5.5, 9, 0], g); box(1.4, .8, .03, 0x2a64b8, [6.2, 10.5, 0], g); box(1.4, .16, .04, 0xf3cc3a, [6.2, 10.5, 0], g); box(.16, .8, .04, 0xf3cc3a, [5.95, 10.5, 0], g);
    },
    bibliotek(g) {
      box(10, 5.4, 7, 0xa65b45, [0, 2.7, 0], g); box(10.4, .4, 7.4, 0x7c4334, [0, 5.6, 0], g); gable(10, 7, 2.4, 0x4a3a36, 5.8, g);
      for (let i = -3; i <= 3; i += 2) { win(1.1, 2.2, [i * 1.2, 2.2, 3.52], g); add(new THREE.CylinderGeometry(.55, .55, .1, 16, 1, false, 0, Math.PI), mat(0xe9d9c0), [i * 1.2, 3.3, 3.55], g, [Math.PI / 2, 0, Math.PI / 2]); }
      box(2, 2.6, .3, 0x3a2a22, [0, 1.3, 3.6], g); facadeWindows(g, 10, 5.4, 7, 1, 4, 4.3);
    },
    skola(g) {
      box(11, 5, 6.5, 0xf0c66a, [0, 2.5, 0], g); box(4.5, 5, 9, 0xf0c66a, [-6.8, 2.5, -1.2], g); gable(11, 6.5, 1.8, 0x8b4b3a, 5, g);
      facadeWindows(g, 11, 5, 6.5, 2, 6, 1.5, 2); box(2, 2.3, .2, 0x2e5c78, [0, 1.15, 3.3], g);
      // skolgård
      box(9, .05, 3.2, 0x8f8f8f, [2, .03, 5.4], g, null); cyl(.05, .05, 2.4, 0xd0d0d0, [5.5, 1.2, 5.4], g); box(1.2, .9, .05, 0xffffff, [5.5, 2.4, 5.4], g);
    },
    butik(g) {
      box(7, 4, 5.5, 0xdfe5ea, [0, 2, 0], g); box(7.3, .5, 5.8, 0x315a8a, [0, 4.2, 0], g);
      win(5.6, 2.2, [0, 1.6, 2.77], g); awning(g, 7, 3.1, 3.2, 0x315a8a, 0xf4f4f4);
      for (let i = -1; i <= 1; i++) box(.8, .6, .6, [0xd94c3d, 0xf2b84b, 0x6ab04c][i + 1], [i * 1.2 + 1, .3, 3.6], g);
    },
    redaktion(g) {
      box(5.5, 8, 5.5, 0x4b5768, [0, 4, 0], g); box(5.8, .4, 5.8, 0x2c3440, [0, 8.2, 0], g);
      facadeWindows(g, 5.5, 8, 5.5, 4, 3, 1.4, 1.8); cyl(.04, .06, 3, 0xbfc7d2, [1.5, 9.8, 1], g, 6); ball(.15, 0xff5a4a, [1.5, 11.3, 1], g);
    },
    kafe(g) {
      box(7, 4, 5.5, 0xf4ead8, [0, 2, 0], g); gable(7, 5.5, 1.6, 0x6b3f30, 4, g);
      win(2.4, 1.8, [-1.7, 1.7, 2.77], g); win(2.4, 1.8, [1.7, 1.7, 2.77], g); awning(g, 7, 3, 3.2, 0x2f7a6a, 0xf4ead8);
      for (const x of [-2.2, 0, 2.2]) { cyl(.45, .45, .06, 0xf1f1f1, [x, .8, 4.9], g); cyl(.04, .04, .8, 0x333333, [x, .4, 4.9], g); cyl(.05, .05, 2.2, 0xdddddd, [x, 1.1, 4.9], g); add(new THREE.ConeGeometry(1, .5, 8), mat(0xe86b4f), [x, 2.3, 4.9], g); }
    },
    bageri(g) {
      box(7, 4.2, 5.5, 0xe6b98c, [0, 2.1, 0], g); gable(7, 5.5, 1.8, 0x7d3e2c, 4.2, g);
      win(5, 1.8, [0, 1.6, 2.77], g); awning(g, 7, 3, 3.2, 0xb23a3a, 0xfaf0e0); box(.6, 2.2, .6, 0x8a6b5a, [2.2, 6, -1], g);
    },
    vardcentral(g) {
      box(11, 5, 7, 0xf5f7f8, [0, 2.5, 0], g); box(11.3, .4, 7.3, 0xb9c4cc, [0, 5.2, 0], g); facadeWindows(g, 11, 5, 7, 2, 6, 1.5, 2);
      box(.6, 2, .1, 0x2f9a5a, [0, 3.9, 3.56], g); box(2, .6, .1, 0x2f9a5a, [0, 3.9, 3.56], g); box(2.4, 2.4, .2, 0x8ec7d8, [0, 1.2, 3.55], g);
    },
    verkstad(g) {
      box(10, 4.6, 7, 0x8a8f96, [0, 2.3, 0], g);
      for (let i = 0; i < 12; i++) box(.06, 4.6, .04, 0x6f747b, [-4.8 + i * .87, 2.3, 3.52], g);
      box(4, 3.3, .2, 0x3a4048, [-1.8, 1.65, 3.55], g); box(10.4, .35, 7.4, 0xc2582f, [0, 4.75, 0], g);
      box(1.4, .9, 1, 0xd65a2b, [3.2, .45, 4.6], g); cyl(.35, .35, .2, 0x222222, [2.7, .35, 5.2], g);
    },
    scen(g) {
      box(9, 1, 5, 0x3a3340, [0, .5, 0], g);
      add(new THREE.CylinderGeometry(3.6, 3.6, 9, 24, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8a6ab0, side: THREE.DoubleSide, roughness: .6 }), [0, 1, -.5], g, [0, 0, Math.PI / 2]);
      box(1, 2, 1, 0x111111, [-4, 2, 1.8], g); box(1, 2, 1, 0x111111, [4, 2, 1.8], g);
      const spot = new THREE.SpotLight(0xffd7a8, 0, 22, .55, .5); spot.position.set(0, 7, 6); spot.target.position.set(0, 1, 0); g.add(spot); g.add(spot.target); g.userData.spot = spot;
    },
    park(g) {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: .45, metalness: .05 }));
      pond.rotation.x = -Math.PI / 2; pond.position.set(-1, .06, 1); g.add(pond);
      bench(-1, -3.4, 0); bench(4, 1, -Math.PI / 2);
    },
    odling(g) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        box(2.6, .5, 1.2, 0x7a5a3d, [(i - 1.5) * 3, .25, j * 2.2 - 1.1], g);
        for (let k = 0; k < 4; k++) ball(.28, [0x5aa04a, 0x7cb342, 0xe0574a, 0xf0b13d][(i + k) % 4], [(i - 1.5) * 3 - .9 + k * .6, .7, j * 2.2 - 1.1], g, 6);
      }
      const gh = box(4, 2.6, 3, new THREE.MeshStandardMaterial({ color: 0xcfe9f0, transparent: true, opacity: .45, roughness: .1 }), [7, 1.3, 0], g); gh.castShadow = false;
    },
    brygga(g) {
      box(2.2, .25, 11, 0x9a7656, [0, .45, 4.5], g);
      for (let i = 0; i < 6; i++) { cyl(.12, .12, 1.2, 0x5a4332, [-1, 0, i * 2], g, 6); cyl(.12, .12, 1.2, 0x5a4332, [1, 0, i * 2], g, 6); }
      const boat = new THREE.Group(); boat.position.set(2.6, .3, 7); g.add(boat);
      box(1.2, .5, 3, 0xd9d2c3, [0, 0, 0], boat); box(1.3, .12, 3.1, 0x2b5f8a, [0, .25, 0], boat); g.userData.boat = boat;
    },
  };
  const CATALOG = {
    lekplats(g) { box(.1, 2, .1, 0xd84a3a, [-1, 1, -1], g); box(.1, 2, .1, 0xd84a3a, [1, 1, -1], g); box(2.2, .1, .1, 0xd84a3a, [0, 2, -1], g); box(.6, .06, .3, 0x333333, [-.4, .6, -1], g); box(1, .1, 3, 0x3a8ad8, [2, .9, 1], g, [.45, 0, 0]); box(1, 2, 1, 0xf0c13a, [2, 1, -.6], g); },
    marknad(g) { for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 2.4; box(2, .9, 1.2, 0x9a7656, [x, .45, 0], g); awning(Object.assign(g, {}), 2, 2.1, 0, [0xd94c3d, 0x3a8ad8, 0xf0b13d, 0x5aa04a][i], 0xf4f4f4); box(.08, 2, .08, 0x666666, [x - .9, 1, .5], g); box(.08, 2, .08, 0x666666, [x + .9, 1, .5], g); } },
    bastu(g) { box(4, 2.6, 3, 0x6e4a32, [0, 1.3, 0], g); gable(4, 3, 1.2, 0x2f2f2f, 2.6, g); box(.3, 1.4, .3, 0x444444, [1.2, 3.6, -.6], g); },
    konsthall(g) { box(7, 4.5, 6, 0xf5f5f2, [0, 2.25, 0], g); box(3, 4.5, 6.1, 0x1d1d1d, [-2, 2.25, 0], g); win(3, 3, [1.5, 2, 3.02], g); },
    idrottsplats(g) { box(10, .06, 6, 0x3f9a4f, [0, .04, 0], g); box(.1, 1.2, 2, 0xffffff, [-4.8, .6, 0], g); box(.1, 1.2, 2, 0xffffff, [4.8, .6, 0], g); box(.05, .07, 6, 0xffffff, [0, .06, 0], g); },
    vaktstuga(g) { box(3.4, 3, 3.4, 0x2c3e5a, [0, 1.5, 0], g); add(new THREE.ConeGeometry(2.6, 1.5, 4), mat(0x1c2433), [0, 3.75, 0], g, [0, Math.PI / 4, 0]); ball(.25, 0x3a7bff, [0, 4.7, 0], g); },
    vaxthus(g) { const m = new THREE.MeshStandardMaterial({ color: 0xd8f0f4, transparent: true, opacity: .4, roughness: .05 }); box(6, 3, 4, m, [0, 1.5, 0], g).castShadow = false; for (let i = 0; i < 5; i++) ball(.5, 0x5aa04a, [-2 + i, .5, 0], g, 6); },
    bostader(g) { box(7, 10, 6, 0xd9c7b0, [0, 5, 0], g); box(7.3, .4, 6.3, 0x6b6b6b, [0, 10.2, 0], g); facadeWindows(g, 7, 10, 6, 5, 4, 1.4, 1.9); },
    fyr(g) { cyl(.9, 1.3, 9, 0xf4f4f4, [0, 4.5, 0], g); cyl(.95, .95, 1.5, 0xd84a3a, [0, 6, 0], g); const l = ball(.6, new THREE.MeshBasicMaterial({ color: 0xfff1b0 }), [0, 9.6, 0], g); g.userData.beacon = l; },
    verkstadshall(g) { box(9, 5, 6, 0x7f8a96, [0, 2.5, 0], g); box(9.3, .4, 6.3, 0x3a6a8a, [0, 5.2, 0], g); box(4, 3.8, .2, 0x2a3038, [0, 1.9, 3.05], g); },
    biograf(g) { box(8, 6, 6.5, 0x5a2a3a, [0, 3, 0], g); box(6, 1.4, .3, new THREE.MeshStandardMaterial({ color: 0x220a10, emissive: 0xffc04a, emissiveIntensity: .7 }), [0, 4.6, 3.3], g); },
    radhus(g) { for (let i = 0; i < 3; i++) { box(2.6, 3.6, 5, [0xb5473a, 0xe8d29a, 0xf2f2ee][i], [(i - 1) * 2.7, 1.8, 0], g); win(.8, .8, [(i - 1) * 2.7, 2.4, 2.52], g); } gable(8.2, 5, 1.4, 0x3a3a3a, 3.6, g); },
  };

  function house(i) {
    const x = HOME_X[i], z = -29.5;
    const g = group(x, z, 0);
    const cols = [0xa63a2c, 0xe4c26b, 0xf2efe8, 0x8fb3c9, 0xa63a2c, 0xd9a07a, 0xf2efe8, 0x9cbf8f, 0xe4c26b, 0xa63a2c];
    box(4.2, 3.2, 4.4, cols[i], [0, 1.6, 0], g); gable(4.2, 4.4, 1.7, i % 3 ? 0x34383f : 0x5a2d26, 3.2, g);
    box(.8, 1.6, .08, 0x3a2a22, [0, .8, 2.22], g);
    win(.8, .7, [-1.3, 1.8, 2.22], g); win(.8, .7, [1.3, 1.8, 2.22], g);
    for (let k = -1.9; k <= 1.9; k += .48) box(.08, .7, .08, 0xf4f4f4, [k, .35, 3.6], g); box(4, .08, .06, 0xf4f4f4, [0, .6, 3.6], g);
    return { g, door: [x, -26.6], spot: [x, -24.6] };
  }

  /* ───────── Scen ───────── */
  function init() {
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch { $('#webgl-fallback').style.display = 'grid'; return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    mount.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x9fc3dd, 70, 170);
    camera = new THREE.PerspectiveCamera(38, 1, .5, 400);

    hemi = new THREE.HemisphereLight(0xcfe4ff, 0x4d5a3c, .55); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff0d8, 1.2); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 220 }); sun.shadow.bias = -.0004;
    scene.add(sun); scene.add(sun.target);
    fill = new THREE.DirectionalLight(0x8fb0ff, .15); fill.position.set(-30, 40, -20); scene.add(fill);

    // mark, gator, torg, sjö
    const ground = add(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }), [0, 0, 0], scene, [-Math.PI / 2, 0, 0]); ground.castShadow = false;
    skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(0x5d8fc7) }, hor: { value: new THREE.Color(0xcfe2f0) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff0d0) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vp; void main(){ float h = clamp(vp.y*1.6,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.7)); float s = max(dot(normalize(vp), normalize(sunDir)),0.0); c += sunCol * (pow(s,180.0)*1.4 + pow(s,8.0)*0.18); gl_FragColor = vec4(c,1.0); }' });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), skyMat));
    const walk = mat(0xc9c3b6, .95);
    for (const x of XR) for (const sx of [-2.3, 2.3]) box(1.2, .1, 64, walk, [x + sx, .05, 1], scene).castShadow = false;
    for (const z of ZR) for (const sz of [-2.3, 2.3]) box(66, .1, 1.2, walk, [0, .052, z + sz], scene).castShadow = false;
    flowers(-9, -5.8, 3, 1); flowers(9, -5.8, 3, 1); flowers(-9, 5.8, 3, 1); flowers(9, 5.8, 3, 1); flowers(-26, -10.6, 2, .8); flowers(26, -10.6, 2, .8); flowers(-6, -10.6, 2.2, .8); flowers(6, -10.6, 2.2, .8);
    hedge(-13.2, 0, .6, 12); hedge(13.2, 0, .6, 12); hedge(-22, 21, 14, .6);
    for (let i = 0; i < 7; i++) { const c = car(i); cars.push(c); }
    for (let i = 0; i < 9; i++) { const b = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: 0x222831, side: THREE.DoubleSide });
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(.6, .18), m); w1.position.x = -.3; const w2 = w1.clone(); w2.position.x = .3; b.add(w1, w2); scene.add(b); birds.push({ g: b, w1, w2, r: 14 + i * 2.2, h: 18 + (i % 4) * 2, s: .25 + (i % 3) * .05, o: i * .7 }); }
    for (let i = 0; i < 4; i++) { const d = new THREE.Group(); ball(.22, 0xf4f1e8, [0, .2, 0], d, 8); ball(.13, i ? 0x3f7a4a : 0xf4f1e8, [0, .38, .18], d, 8); box(.08, .05, .14, 0xf0a030, [0, .36, .32], d); scene.add(d); ducks.push({ g: d, o: i * 1.6, r: 1.6 + i * .5 }); }
    const asphalt = mat(0x3b4048, .95), curb = mat(0xb9b4aa, .9), line = new THREE.MeshBasicMaterial({ color: 0xe9e3cf });
    for (const x of XR) { box(3, .05, 64, asphalt, [x, .03, 1], scene).castShadow = false; box(.25, .12, 64, curb, [x - 1.6, .06, 1], scene); box(.25, .12, 64, curb, [x + 1.6, .06, 1], scene); }
    for (const z of ZR) { box(66, .06, 3, asphalt, [0, .035, z], scene).castShadow = false; }
    for (const x of XR) for (let z = -30; z < 32; z += 3) box(.12, .07, 1.3, line, [x, .07, z], scene).castShadow = false;
    for (const z of ZR) for (let x = -32; x < 33; x += 3) box(1.3, .07, .12, line, [x, .075, z], scene).castShadow = false;
    const plaza = box(26, .08, 14, mat(0xcbbfa8, .95), [0, .04, 0], scene); plaza.castShadow = false;
    for (let i = -6; i <= 6; i++) box(.05, .09, 14, mat(0xb8ab92), [i * 2, .045, 0], scene).castShadow = false;
    // fontän
    cyl(3, 3.2, .7, 0xd8d0c0, [0, .35, 0], scene, 32);
    const pool = cyl(2.7, 2.7, .1, new THREE.MeshStandardMaterial({ color: 0x5fb3d2, roughness: .1, metalness: .2 }), [0, .66, 0], scene, 32); pool.castShadow = false;
    cyl(.35, .5, 2, 0xd8d0c0, [0, 1.3, 0], scene); cyl(1, .6, .3, 0xd8d0c0, [0, 2.3, 0], scene);
    const jet = add(new THREE.ConeGeometry(.35, 1.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .55 }), [0, 3.1, 0], scene); jet.castShadow = false; scene.userData.jet = jet;
    // sjön
    waterGeo = new THREE.PlaneGeometry(200, 60, 60, 18); water = add(waterGeo, new THREE.MeshStandardMaterial({ color: 0x3d7fa6, roughness: .12, metalness: .35 }), [0, .08, 62], scene, [-Math.PI / 2, 0, 0]); water.castShadow = false;
    box(200, .1, 3, mat(0xd9c99e, 1), [0, .05, 32.5], scene).castShadow = false;

    // byggnader
    for (const [k, f] of Object.entries(B)) {
      const p = P[k]; const g = group(p.pos[0], p.pos[1], p.face ?? 0); f(g); p.g = g;
      const s = sign(p.n); s.position.set(0, k === 'stadshus' ? 16.5 : k === 'redaktion' ? 12.6 : k === 'park' || k === 'odling' || k === 'brygga' ? 3.6 : 8.6, 0); g.add(s); p.sign = s;
    }
    HOME_X.forEach((_, i) => { homes[i] = house(i); });
    LOTS.forEach(([x, z]) => { const g = group(x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2); lotGroups.push(g); });

    // träd, lyktor, bänkar
    const treeSpots = [[-34, -34], [-26, -36], [-14, -35], [0, -36], [14, -35], [26, -36], [34, -34], [-12, 12], [-12, 19], [12, 20], [-8, 20.5], [1, 20.5],
      [-34, 22], [34, 22], [-44, -10], [-44, 6], [44, -10], [44, 6], [-44, 22], [44, 22], [-30, 36], [30, 36], [-11, -11], [11, -11], [-28, 8.5], [28, 8.5]];
    treeSpots.forEach(([x, z], i) => tree(x, z, .9 + (i % 3) * .15, i % 4 === 0 ? 1 : 0));
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; tree(Math.cos(a) * 58, Math.sin(a) * 50 - 6, 1.1 + (i % 3) * .2, i % 2); }
    for (const x of XR) for (const z of [-15, 0, 15]) lamp(x + 1.9, z);
    for (const z of ZR) for (const x of [-22, 0, 22]) lamp(x, z - 1.9);
    bench(-6, 5.5, Math.PI); bench(6, 5.5, Math.PI); bench(-6, -5.5, 0); bench(6, -5.5, 0);

    // himmel
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * .9 + .1, r = 180; sp.push(Math.cos(a) * r * Math.cos(e), r * Math.sin(e), Math.sin(a) * r * Math.cos(e)); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: .9, transparent: true, opacity: 0, fog: false })); scene.add(stars);
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .7, roughness: 1, fog: false });
      for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 2, 10, 8), m); b.position.set(k * 2.6 - 5, Math.random(), Math.random() * 2); b.scale.y = .55; c.add(b); }
      c.position.set(-90 + i * 22, 78 + Math.random() * 10, -120 + Math.random() * 80); scene.add(c); clouds.push(c);
    }
    rain = particles(1600, 0x9ec8ff, .14, 'rain'); snow = particles(1100, 0xffffff, .35, 'snow');
    bindControls(); resize(); addEventListener('resize', resize);
    return true;
  }
  function particles(n, color, size, kind) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * 110; p[i * 3 + 1] = Math.random() * 40; p[i * 3 + 2] = (Math.random() - .5) * 90; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: .8 }));
    pts.visible = false; pts.userData.kind = kind; scene.add(pts); return pts;
  }

  /* ───────── Invånare ───────── */
  function makePerson(a, i) {
    const g = new THREE.Group(); const hex = parseInt(a.farg.slice(1), 16);
    const skin = mat([0xf0c4a4, 0xc68a62, 0xe8b490, 0x9a6444, 0xf2cfb0][i % 5], .9), hairC = mat([0x2a1d16, 0x5a3a22, 0x111111, 0xc9a25a, 0x7a4a2a][(i * 3) % 5], .95);
    const shirt = mat(hex, .6), pants = mat([0x1c2a3e, 0x3a3a3a, 0x4a3b2a, 0x22324a][i % 4], .85);
    box(.55, .7, .34, shirt, [0, 1, 0], g);
    ball(.26, skin, [0, 1.62, 0], g, 14); const hair = ball(.275, hairC, [0, 1.72, -.03], g, 12); hair.scale.set(1, .6, 1);
    if (i % 3 === 1) box(.42, .3, .12, hairC, [0, 1.55, -.2], g);
    [-.09, .09].forEach(ex => ball(.035, new THREE.MeshBasicMaterial({ color: 0x1a1520 }), [ex, 1.64, .24], g, 6).castShadow = false);
    const limb = (x, y, w, h, m, foot) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); box(w, h, w, m, [0, -h / 2, 0], p); if (foot) box(w + .03, .08, w + .14, 0x101318, [0, -h, .05], p); else ball(.07, skin, [0, -h - .02, 0], p, 6); return p; };
    const parts = { la: limb(-.36, 1.3, .13, .62, shirt), ra: limb(.36, 1.3, .13, .62, shirt), ll: limb(-.14, .66, .17, .64, pants, 1), rl: limb(.14, .66, .17, .64, pants, 1) };
    const ring = new THREE.Mesh(new THREE.RingGeometry(.48, .6, 32), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .04; g.add(ring);
    const nl = sign(a.namn.split(' ')[0], a.farg, 3.2); nl.position.set(0, 2.45, 0); g.add(nl);
    g.scale.setScalar(1.2); scene.add(g);
    g.userData = { parts, ring, a, hx: 0, hz: 0, walk: 0 };
    return g;
  }

  /* ───────── Vägar ───────── */
  const nearest = (arr, v) => arr.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, arr[0]);
  function route(a, b) {
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 9) return [a, b];
    const za = nearest(ZR, a[1]), zb = nearest(ZR, b[1]), xr = nearest(XR, (a[0] + b[0]) / 2);
    const pts = [a, [a[0], za]];
    if (za !== zb) { pts.push([xr, za], [xr, zb]); }
    pts.push([b[0], zb], b);
    return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > .01);
  }
  const plen = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);
  function along(pts, f) {
    const L = plen(pts) * Math.max(0, Math.min(1, f)); let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc + s >= L) { const t = s ? (L - acc) / s : 0; return [[pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t], Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])]; }
      acc += s;
    }
    const n = pts.length - 1; return [pts[n], Math.atan2(pts[n][0] - pts[Math.max(0, n - 1)][0], pts[n][1] - pts[Math.max(0, n - 1)][1])];
  }

  /* ───────── Dagens schema ───────── */
  let AG = [], idx = {}, convs = [], council = null, chats = [], thoughts = [];
  function prepare() {
    AG = D.agenter; idx = {}; AG.forEach((a, i) => { idx[a.id] = i; a.home = i; });
    convs = (D.samtal || []).map(c => { const t = toMin(c.tid), dur = Math.max(4, c.repliker.length * .9); return { ...c, t0: t, t1: t + dur }; });
    council = D.stamma || null;
    chats = (D.smaprat || []).map(c => ({ ...c, t0: toMin(c.tid), t1: toMin(c.tid) + Math.max(1.5, c.repliker.length * .8) }));
    const order = {}; thoughts = (D.tankar || []).map(t => { const k = order[t.tid] = (order[t.tid] || 0) + 1; return { ...t, t0: toMin(t.tid) + 2 + (k - 1) * 5, t1: toMin(t.tid) + 2 + (k - 1) * 5 + 4.5 }; });
    for (const a of AG) a.steps = a.plan.map(p => ({ ...p, t: toMin(p.tid) })).sort((x, y) => x.t - y.t);
    // byggnader på tomter
    lotGroups.forEach(g => { while (g.children.length) g.remove(g.children[0]); });
    for (const b of (D.stad?.byggnader || [])) {
      const g = lotGroups[b.tomt]; if (!g || !CATALOG[b.typ]) continue;
      const done = b.status === 'klar';
      if (done) CATALOG[b.typ](g);
      else { box(6, .1, 5, 0x9a8a70, [0, .05, 0], g); for (let i = 0; i < 4; i++) { box(.12, 4, .12, 0xd09a3a, [(i % 2 ? 2.8 : -2.8), 2, (i < 2 ? 2.3 : -2.3)], g); } box(5.8, .12, .12, 0xd09a3a, [0, 4, 2.3], g); box(.3, 8, .3, 0xf0b13d, [3.5, 4, -2], g); box(6, .3, .3, 0xf0b13d, [1, 8, -2], g); }
      const s = sign(KATALOG_N[b.typ] + (done ? '' : ' · byggs'), done ? '#9bd28a' : '#f0b13d', 2.8); s.position.set(0, 7, 0); g.add(s);
    }
    for (const id in people) { scene.remove(people[id]); delete people[id]; }
    AG.forEach((a, i) => { people[a.id] = makePerson(a, i); });
    if (!selected || !idx.hasOwnProperty(selected)) selected = AG[0].id;
    setWeather();
  }
  function spotFor(key, aIdx, t) {
    if (key === 'hem') return homes[aIdx].spot;
    const p = P[key] || P.torget;
    // sprid ut folk kring platsen
    const n = AG.length, ang = (aIdx / n) * Math.PI * 2 + (key === 'torget' ? 0 : 1.3);
    const r = key === 'torget' ? 4.4 : key === 'stadshus' && t >= 1020 && t < 1065 ? 1.6 + (aIdx % 3) * .9 : 1.2 + (aIdx % 2) * .7;
    if (key === 'stadshus' && t >= 1020 && t < 1065) return [p.pos[0] - 4 + (aIdx % 5) * 2, p.pos[1] + 6.6 + Math.floor(aIdx / 5) * 1.3];
    return [p.spot[0] + Math.cos(ang) * r, p.spot[1] + Math.sin(ang) * r * .6];
  }
  function stateOf(a, m) {
    const i = a.home;
    if (m < WAKE || m >= SLEEP) return { pos: homes[i].door, heading: Math.PI, place: 'hem', act: m >= SLEEP - 10 || m < WAKE ? 'Sover' : 'Hemma', moving: false, sleeping: true };
    // stämman
    if (council && council.narvarande?.includes(a.id) && m >= 1020 && m < 1065) return { pos: spotFor('stadshus', i, m), heading: Math.PI, place: 'stadshus', act: 'På stämman i stadshuset', moving: false };
    // samtal
    const c = convs.find(c => c.deltagare.includes(a.id) && m >= c.t0 && m < c.t1);
    let steps = a.steps, cur = steps[0], prev = null;
    for (const s of steps) if (s.t <= m) { prev = cur === s ? prev : cur; cur = s; }
    if (m < steps[0].t) cur = { plats: 'hem', aktivitet: 'Vaknar', t: WAKE };
    const ci = steps.indexOf(cur);
    const before = ci > 0 ? steps[ci - 1] : { plats: 'hem', t: WAKE };
    const from = spotFor(before.plats, i, m), to = spotFor(cur.plats, i, m);
    if (c) {
      const others = c.deltagare.filter(x => x !== a.id); const o = AG[idx[others[0]]];
      const base = P[c.plats]?.spot || to; const k = c.deltagare.indexOf(a.id);
      const pos = [base[0] + (k === 0 ? -.75 : .75), base[1] + (k > 1 ? 1 : 0)];
      return { pos, heading: k === 0 ? Math.PI / 2 : -Math.PI / 2, place: c.plats, act: `Pratar med ${others.map(o => AG[idx[o]].namn.split(' ')[0]).join(' och ')}`, moving: false, conv: c };
    }
    const path = route(from, to), L = plen(path), dur = Math.min(16, Math.max(2, L / 3.2));
    if (m - cur.t < dur && L > .5) { const [pos, h] = along(path, (m - cur.t) / dur); return { pos, heading: h, place: cur.plats, act: `På väg: ${cur.aktivitet}`, moving: true }; }
    return { pos: to, heading: Math.atan2(-to[0] + (P[cur.plats]?.pos[0] ?? to[0]), -to[1] + (P[cur.plats]?.pos[1] ?? to[1])) || 0, place: cur.plats, act: cur.aktivitet, moving: false };
  }

  /* ───────── Ljus & väder ───────── */
  const SKY = [[0, 0x0a1424], [300, 0x0d1830], [360, 0x4b5583], [420, 0xe0a98a], [500, 0x9cc6e6], [990, 0x9cc6e6], [1080, 0xeca373], [1150, 0x5a477a], [1240, 0x101c35], [1440, 0x0a1424]];
  function lerpColor(stops, m) {
    for (let i = 1; i < stops.length; i++) if (m <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], f = (m - t0) / (t1 - t0);
      return new THREE.Color(c0).lerp(new THREE.Color(c1), f);
    }
    return new THREE.Color(stops[0][1]);
  }
  function setWeather() {
    const v = D?.vader || 'sol';
    rain.visible = v === 'regn'; snow.visible = v === 'snö';
    clouds.forEach((c, i) => c.visible = v !== 'sol' || i % 3 === 0);
  }
  function light(m) {
    const v = D?.vader || 'sol';
    const day = Math.max(0, Math.sin((m - 390) / (1170 - 390) * Math.PI));
    const dim = v === 'regn' || v === 'snö' ? .62 : v === 'moln' || v === 'dimma' ? .78 : 1;
    let sky = lerpColor(SKY, m); if (dim < 1) sky.lerp(new THREE.Color(0x8d98a6), (1 - dim) * day * 1.2);
    scene.background = sky; scene.fog.color.copy(sky);
    if (skyMat) { skyMat.uniforms.hor.value.copy(sky).lerp(new THREE.Color(0xffffff), .18 * day); skyMat.uniforms.top.value.copy(sky).multiplyScalar(.62 + .1 * day); }
    scene.fog.near = v === 'dimma' ? 18 : 70; scene.fog.far = v === 'dimma' ? 80 : 170;
    const a = (m - 390) / (1170 - 390) * Math.PI;
    sun.position.set(Math.cos(a) * 70, Math.max(6, Math.sin(a) * 80), -30); sun.intensity = 1.35 * day * dim + .05;
    sun.color.set(day < .35 ? 0xffb27a : 0xfff0d8);
    hemi.intensity = .2 + .45 * day * (dim * .7 + .3);
    renderer.toneMappingExposure = .8 + .22 * day;
    const night = 1 - Math.min(1, day * 2.4);
    stars.material.opacity = v === 'sol' || v === 'blåst' ? night * .9 : night * .25;
    if (skyMat) { skyMat.uniforms.sunDir.value.copy(sun.position).normalize(); skyMat.uniforms.sunCol.value.setRGB(1, .85 + .1 * day, .6 + .3 * day).multiplyScalar(day > .02 ? dim : 0); }
    cars.forEach(c => c.hl.color.setHex(night > .3 ? 0xfff2c0 : 0x555544));
    lamps.forEach(l => { l.halo.material.opacity = night * .55; l.light.intensity = night * 1.5; l.bulb.material.color.setHex(night > .2 ? 0xffd28a : 0x5a4a30); });
    windows.forEach((w, i) => { const on = night > .3 ? ((i * 7) % 10) < (m > 1380 || m < 330 ? 2 : 7) : (i % 9 === 0 ? 1 : 0); w.material.emissiveIntensity = on ? .9 * Math.max(night, .3) : 0; });
    const sc = P.scen.g?.userData.spot; if (sc) sc.intensity = (m > 1080 && m < 1320) ? 2.6 : 0;
  }

  /* ───────── Kamera ───────── */
  function bindControls() {
    const el = renderer.domElement;
    el.addEventListener('pointerdown', e => { dragging = true; autoYaw = false; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (!dragging) return; yaw -= (e.clientX - lastX) * .006; pitch = Math.max(.25, Math.min(1.35, pitch + (e.clientY - lastY) * .004)); lastX = e.clientX; lastY = e.clientY; });
    el.addEventListener('pointerup', e => { if (dragging && Math.abs(e.clientX - lastX) < 3) pick(e); dragging = false; });
    el.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(18, Math.min(130, dist * (1 + e.deltaY * .001))); }, { passive: false });
    el.addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) dist = Math.max(18, Math.min(130, dist * pinch / d)); pinch = d; } }, { passive: true });
    el.addEventListener('touchend', () => pinch = 0);
  }
  const ray = new THREE.Raycaster();
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const hit = ray.intersectObjects(Object.values(people), true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.a) o = o.parent; if (o) select(o.userData.a.id, true); }
  }
  function resize() { const w = mount.clientWidth, h = mount.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  /* ───────── Bubblor ───────── */
  const bubbles = $('#bubbles');
  const bubbleEls = {};
  function bubble(id, text, kind = '') {
    let b = bubbleEls[id]; if (!b) { b = bubbleEls[id] = document.createElement('div'); b.className = 'bubble'; bubbles.appendChild(b); }
    if (b.dataset.t !== text) { b.dataset.t = text; b.innerHTML = text ? `<b style="color:${AG[idx[id]].farg}">${esc(AG[idx[id]].namn.split(' ')[0])}${kind === 'thought' ? ' tänker' : ''}</b>${esc(text)}` : ''; }
    b.className = 'bubble' + (text ? ' on' : '') + (kind ? ' ' + kind : '');
    return b;
  }
  const v3 = new THREE.Vector3();
  function placeBubble(b, obj) {
    v3.set(0, 3.1, 0); obj.localToWorld(v3); v3.project(camera);
    const r = mount.getBoundingClientRect();
    b.style.transform = `translate(${(v3.x * .5 + .5) * r.width}px, ${(-v3.y * .5 + .5) * r.height}px) translate(-50%,-100%)`;
    b.style.visibility = v3.z < 1 ? 'visible' : 'hidden';
  }

  /* ───────── Loop ───────── */
  function frame(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (live) simMin = stockholmMin(); else simMin = Math.min(1439.9, simMin + dt * speed / 60 * (speed > 1 ? 1 : 1));
    if (D) {
      const m = simMin;
      light(m);
      for (const a of AG) {
        const g = people[a.id], s = stateOf(a, m); const u = g.userData;
        g.visible = !s.sleeping;
        u.hx += (s.pos[0] - u.hx) * Math.min(1, dt * 6); u.hz += (s.pos[1] - u.hz) * Math.min(1, dt * 6);
        if (Math.hypot(s.pos[0] - u.hx, s.pos[1] - u.hz) > 8) { u.hx = s.pos[0]; u.hz = s.pos[1]; }
        g.position.set(u.hx, 0, u.hz);
        let dh = s.heading - g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); g.rotation.y += dh * Math.min(1, dt * 8);
        const walking = s.moving;
        u.walk += dt * (walking ? 9 : 0);
        const sit = !walking && !s.conv && ['kafe', 'bageri', 'park', 'brygga'].includes(s.place) && a.home % 2 === 0;
        const work = !walking && !s.conv && s.place === a.arbete;
        let la = 0, ra = 0, ll = 0, rl = 0;
        if (walking) { const w = Math.sin(u.walk) * .6; la = w; ra = -w; ll = -w; rl = w; }
        else if (s.conv) { la = Math.sin(now / 420 + a.home) * .35 - .2; ra = Math.sin(now / 530 + a.home * 2) * .25; }
        else if (sit) { ll = rl = -1.35; la = ra = -.5; }
        else if (work && ['verkstad', 'bageri', 'odling'].includes(s.place)) { ra = -1.2 + Math.abs(Math.sin(now / 260)) * .9; la = -.4; }
        else if (work) { la = ra = -.9 + Math.sin(now / 1400 + a.home) * .08; }
        u.parts.la.rotation.x = la; u.parts.ra.rotation.x = ra; u.parts.ll.rotation.x = ll; u.parts.rl.rotation.x = rl;
        g.position.y = sit ? -.42 : walking ? Math.abs(Math.sin(u.walk)) * .05 : 0;
        u.ring.material.opacity = a.id === selected ? .9 : 0;
        a.now = s;
        // bubbla
        let text = '', kind = '';
        if (s.conv) {
          const c = s.conv, n = c.repliker.length, k = Math.min(n - 1, Math.floor((m - c.t0) / ((c.t1 - c.t0) / n)));
          if (c.repliker[k][0] === a.id) text = c.repliker[k][1];
        } else if (s.place === 'stadshus' && m >= 1020 && m < 1065 && council?.inlagg) {
          const L = council.inlagg, k = Math.floor((m - 1022) / (40 / Math.max(1, L.length)));
          if (L[k] && L[k][0] === a.id) { text = L[k][1]; kind = 'council'; }
        }
        if (!text && !s.sleeping) {
          const c = chats.find(c => m >= c.t0 && m < c.t1 && c.repliker.some(r => r[0] === a.id));
          if (c) { const n = c.repliker.length, k = Math.min(n - 1, Math.floor((m - c.t0) / ((c.t1 - c.t0) / n))); if (c.repliker[k][0] === a.id) { text = c.repliker[k][1]; kind = 'chat'; } }
        }
        if (!text && !s.sleeping && !s.conv) {
          const t = thoughts.find(t => t.vem === a.id && m >= t.t0 && m < t.t1);
          if (t) { text = t.text; kind = 'thought'; }
        }
        const b = bubble(a.id, g.visible ? text : '', kind); if (text) placeBubble(b, g);
      }
      if (follow && selected && people[selected]?.visible) target.lerp(people[selected].position, Math.min(1, dt * 2));
      else target.lerp(new THREE.Vector3(0, 0, 3), Math.min(1, dt * .8));
      if (scene.userData.jet) scene.userData.jet.scale.y = 1 + Math.sin(now / 180) * .08;
      const fyr = lotGroups.find(g => g.userData.beacon); if (fyr) fyr.userData.beacon.material.color.setHex(Math.sin(now / 400) > 0 ? 0xfff1b0 : 0x554a20);
      const boat = P.brygga.g?.userData.boat; if (boat) { boat.position.y = .3 + Math.sin(now / 900) * .06; boat.rotation.z = Math.sin(now / 1100) * .04; }
    }
    const tt = now / 1000;
    if (waterGeo) { const a = waterGeo.attributes.position; for (let i = 0; i < a.count; i++) a.setZ(i, Math.sin(a.getX(i) * .25 + tt * 1.3) * .08 + Math.cos(a.getY(i) * .4 + tt) * .06); a.needsUpdate = true; waterGeo.computeVertexNormals(); }
    const nightAmb = D ? (simMin < 420 || simMin > 1290) : false;
    cars.forEach((c, i) => {
      c.g.visible = !nightAmb || i < 2;
      c.f = (c.f + dt * c.v * (speed > 1 && !live ? Math.min(speed, 20) / 4 + 1 : 1)) % 1;
      const [pos, h] = along(c.path, c.f); c.g.position.set(pos[0], 0, pos[1]); c.g.rotation.y = h;
    });
    birds.forEach(b => { const a = tt * b.s + b.o; b.g.position.set(Math.cos(a) * b.r, b.h + Math.sin(tt * 2 + b.o) * .6, Math.sin(a) * b.r * .7 - 4); b.g.rotation.y = -a; const f = Math.sin(tt * 9 + b.o) * .5; b.w1.rotation.z = f; b.w2.rotation.z = -f; b.g.visible = !nightAmb; });
    ducks.forEach(d => { const a = tt * .15 + d.o; d.g.position.set(P.park.pos[0] - 1 + Math.cos(a) * d.r, .06, P.park.pos[1] + 1 + Math.sin(a) * d.r * .8); d.g.rotation.y = -a; });
    clouds.forEach((c, i) => { c.position.x += dt * (.6 + i * .05) * (D?.vader === 'blåst' ? 4 : 1); if (c.position.x > 110) c.position.x = -110; });
    for (const p of [rain, snow]) if (p.visible) {
      const a = p.geometry.attributes.position; const fall = p.userData.kind === 'rain' ? 34 : 3.5;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - fall * dt; if (y < 0) y = 40; a.setY(i, y); if (p.userData.kind === 'snow') a.setX(i, a.getX(i) + Math.sin(now / 900 + i) * dt * .5); }
      a.needsUpdate = true;
    }
    if (autoYaw && !follow) yaw += dt * .025;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(target);
    renderer.render(scene, camera);
    uiT += dt; if (uiT > .5 && D) { uiT = 0; ui(); }
    requestAnimationFrame(frame);
  }

  /* ───────── Gränssnitt ───────── */
  const VADER = { sol: 'Sol', moln: 'Molnigt', regn: 'Regn', 'snö': 'Snö', 'blåst': 'Blåsigt', dimma: 'Dimma' };
  const NAME = id => AG[idx[id]]?.namn.split(' ')[0] || id;
  const placeName = k => k === 'hem' ? 'Hemma' : P[k]?.n || k;
  function phase(m) {
    if (m < WAKE) return ['NATT', 'Staden sover', 'Alla vaknar klockan 08:00. Leia simulerar dagen i natt.'];
    if (m >= SLEEP) return ['NATT', 'Alla har lagt sig', 'Dagböckerna är skrivna och Kvartersbladet har kommit ut.'];
    if (m >= 1020 && m < 1065) return ['STÄMMA', 'Stämman i stadshuset', 'Invånarna röstar om stadens förslag.'];
    const c = convs.filter(c => m >= c.t0 && m < c.t1);
    if (c.length) return ['SAMTAL' + (c.length > 1 ? ` · ${c.length} PÅGÅR` : ''), c[0].deltagare.map(NAME).join(' & ') + ' · ' + placeName(c[0].plats), c[0].sammanfattning];
    const h = (D.handelser || []).filter(h => toMin(h.tid) <= m && toMin(h.tid) > m - 45 && h.typ === 'handelse').pop();
    if (h) return ['HÄNDELSE', placeName(h.plats), h.text];
    return [m < 720 ? 'FÖRMIDDAG' : m < 1020 ? 'EFTERMIDDAG' : 'KVÄLL', 'Livet i Kvarter 07', `${AG.filter(a => a.now && !a.now.sleeping && a.now.place !== 'hem').length} av ${AG.length} invånare är ute i staden.`];
  }
  function ui() {
    const m = simMin;
    $('#city-time').textContent = fmt(m);
    $('#city-weather').textContent = `${VADER[D.vader] || D.vader} · ${D.temperatur}°`;
    const [k, t, c] = phase(m);
    $('#scene-day').textContent = `DAG ${D.dag} · ${k}`; $('#scene-title').textContent = t; $('#scene-copy').textContent = c;
    $('#model-status').textContent = archived ? `Arkiv · ${D.datum}` : live ? 'Senaste dagen · i realtid' : `Uppspelning ${speed}×`;
    $('#model-dot').className = 'model-dot' + (live && !archived ? '' : ' off');
    const sl = $('#scrub'); if (document.activeElement !== sl) sl.value = Math.round(m);
    // invånare
    $('#active-count').textContent = `${AG.filter(a => a.now && !a.now.sleeping).length} vakna`;
    $('#agent-list').innerHTML = AG.map(a => `<button class="agent-row${a.id === selected ? ' on' : ''}" data-id="${a.id}">
      <span class="sw" style="background:${a.farg}"></span><span class="nm"><b>${esc(a.namn)}</b><small>${esc(a.yrke)}</small></span>
      <span class="ac">${esc(a.now?.act || '')}<small>${esc(placeName(a.now?.place))}</small></span></button>`).join('');
    detail(m); city(m); feed(m); paper(m);
  }
  function bar(v, lo = 0, hi = 100) { const p = (v - lo) / (hi - lo) * 100; return `<span class="bar"><i style="width:${Math.max(2, Math.min(100, p))}%"></i></span>`; }
  function detail(m) {
    const a = AG[idx[selected]]; if (!a) return;
    const curT = a.steps.filter(s => s.t <= m).pop();
    const rel = Object.entries(a.relationer || {}).sort((x, y) => Math.abs(y[1].vanskap) - Math.abs(x[1].vanskap)).slice(0, 5);
    const mine = convs.filter(c => c.deltagare.includes(a.id) && c.t0 <= m);
    $('#agent-detail').innerHTML = `<div class="panel-label">Vald invånare</div>
      <div class="ad-head"><span class="sw big" style="background:${a.farg}"></span><div><h3>${esc(a.namn)}</h3><p>${a.alder} år · ${esc(a.yrke)}</p></div></div>
      <p class="ad-now">${esc(a.now?.act || '')} · <span>${esc(placeName(a.now?.place))}</span></p>
      <div class="ad-stats"><div><small>Mynt</small><b>${a.mynt}</b></div><div><small>Humör</small><b>${esc(a.humor)}</b></div><div><small>Rykte</small>${bar(a.rykte)}</div><div><small>Hälsa</small>${bar(a.halsa)}</div></div>
      <p class="ad-p"><b>Personlighet</b> ${esc(a.personlighet)}</p><p class="ad-p"><b>Mål</b> ${esc(a.mal)}</p>
      ${(() => { const t = thoughts.filter(t => t.vem === a.id && t.t0 <= m).pop(); return t ? `<blockquote>”${esc(t.text)}”<small>Tänker · ${fmt(t.t0)}</small></blockquote>` : a.tanke ? `<blockquote>”${esc(a.tanke)}”<small>Morgontanke</small></blockquote>` : ''; })()}
      <div class="ad-sec">Dagens plan</div><ol class="plan">${a.steps.map(s => `<li class="${s === curT ? 'cur' : s.t < m ? 'past' : ''}"><time>${s.tid}</time><span>${esc(s.aktivitet)}<small>${esc(placeName(s.plats))}${s.andrad ? ' · <em>ändrad under dagen</em>' : ''}</small></span></li>`).join('')}</ol>
      <div class="ad-sec">Relationer</div><ul class="rels">${rel.map(([id, r]) => `<li><span>${esc(NAME(id))}</span>${relbar(r.vanskap)}<small>${r.vanskap > 50 ? 'nära vän' : r.vanskap > 20 ? 'vän' : r.vanskap > -10 ? 'bekant' : r.vanskap > -40 ? 'ogillar' : 'ovän'}</small></li>`).join('')}</ul>
      ${mine.length ? `<div class="ad-sec">Samtal idag</div>${mine.map(c => `<p class="ad-c"><time>${c.tid}</time> ${esc(c.sammanfattning)}</p>`).join('')}` : ''}
      ${m >= 1305 && a.dagbok?.dagbok ? `<div class="ad-sec">Dagbok</div><p class="diary">${esc(a.dagbok.dagbok)}</p>${a.dagbok.insikt ? `<p class="ad-p"><b>Insikt</b> ${esc(a.dagbok.insikt)}</p>` : ''}` : ''}
      <label class="follow"><input type="checkbox" id="follow" ${follow ? 'checked' : ''}> Följ med kameran</label>`;
  }
  const relbar = v => `<span class="rbar"><i style="left:${v < 0 ? 50 + v / 2 : 50}%;width:${Math.abs(v) / 2}%;background:${v < 0 ? '#e0796b' : '#75d6c7'}"></i></span>`;
  function city(m) {
    const s = D.stad || {};
    const st = council && m >= 1050 ? council.forslag : null;
    $('#city-panel').innerHTML = `<div class="panel-label">Staden · dag ${D.dag}</div>
      <div class="ad-stats"><div><small>Stadskassa</small><b>${s.kassa} mynt</b></div><div><small>Skatt</small><b>${s.skatt}%</b></div><div><small>Borgmästare</small><b>${s.borgmastare ? esc(NAME(s.borgmastare)) : '—'}</b></div><div><small>Nybyggen</small><b>${(s.byggnader || []).length}</b></div></div>
      ${(s.byggnader || []).length ? `<div class="ad-sec">Byggnader</div><ul class="list">${s.byggnader.map(b => `<li>${esc(b.namn)} <small>${b.status === 'klar' ? 'klar' : 'byggs, klar dag ' + b.klar_dag}</small></li>`).join('')}</ul>` : ''}
      <div class="ad-sec">Stämman 17:00</div>${!council || !council.forslag?.length ? '<p class="muted">Inga förslag idag.</p>' :
        council.forslag.map(f => `<div class="prop"><b>${esc(f.titel)}</b><small>${esc(NAME(f.av))} · ${esc(f.typ)}</small><p>${esc(f.beskrivning)}</p>${st ? `<div class="votes"><span class="ja">${f.ja} ja</span><span class="nej">${f.nej} nej</span><em>${esc(f.resultat || '')}</em></div>` : `<div class="votes"><em>${m >= 1020 ? 'Röstning pågår …' : 'Röstas 17:00'}</em></div>`}</div>`).join('')}
      <div class="ad-sec">Lagar</div><ul class="list">${(s.lagar || []).slice(-5).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      ${(s.rykten || []).length && m >= 720 ? `<div class="ad-sec">Det viskas om</div><ul class="list">${s.rykten.slice(-3).map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}`;
  }
  function feed(m) {
    const items = [];
    (D.handelser || []).forEach(h => items.push({ t: toMin(h.tid), html: `<span class="tag ${h.typ}">${h.typ === 'stamma' ? 'Stämma' : h.typ === 'ekonomi' ? 'Stad' : 'Händelse'}</span>${esc(h.text)}` }));
    convs.forEach((c, i) => items.push({ t: c.t0, i, html: `<span class="tag samtal">Samtal</span><b>${c.deltagare.map(NAME).join(' & ')}</b> · ${esc(placeName(c.plats))}<br>${esc(c.sammanfattning)}${c.handlingar?.length ? `<span class="acts">${c.handlingar.map(h => esc(h.text)).join(' · ')}</span>` : ''}` }));
    chats.forEach(c => items.push({ t: c.t0, html: `<span class="tag chat">Småprat</span>${c.repliker.map(([id, t]) => `<b>${esc(NAME(id))}:</b> ${esc(t)}`).join(' ')}` }));
    (D.omplaneringar || []).forEach(c => items.push({ t: toMin(c.beslut || c.tid), html: `<span class="tag plan">Ny plan</span><b>${esc(NAME(c.vem))}</b> ändrar sig: ${esc(c.aktivitet)} · ${esc(placeName(c.plats))} ${esc(c.tid)}` }));
    convs.forEach(c => (c.planandringar || []).forEach(p => items.push({ t: c.t0 + 1, html: `<span class="tag plan">Ny plan</span><b>${esc(NAME(p.vem))}</b> efter samtalet: ${esc(p.aktivitet)} · ${esc(placeName(p.plats))} ${esc(p.tid)}` })));
    if (council?.forslag?.length && m >= 1050) items.push({ t: 1050, html: `<span class="tag stamma">Beslut</span>${council.forslag.map(f => `${esc(f.titel)}: <b>${esc(f.resultat)}</b>`).join(' · ')}` });
    const shown = items.filter(x => x.t <= m).sort((a, b) => b.t - a.t);
    const key = shown.length + ':' + (convs.find(c => m >= c.t0 && m < c.t1)?.tid || '');
    if ($('#feed').dataset.k === key) return; $('#feed').dataset.k = key;
    $('#feed').innerHTML = shown.length ? shown.map(x => `<li${x.i !== undefined ? ` data-c="${x.i}"` : ''}><time>${fmt(x.t)}</time><div>${x.html}</div></li>`).join('') : '<li class="muted">Dagen har inte börjat än.</li>';
  }
  function paper(m) {
    const p = D.tidning || {};
    const show = (m >= 1315 || archived || m < WAKE) && p.rubrik;
    $('#paper').innerHTML = show ? `<div class="panel-label">Kvartersbladet · kvällsupplagan dag ${D.dag}</div><h3>${esc(p.rubrik)}</h3><p class="ing">${esc(p.ingress)}</p><ul>${(p.notiser || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul>`
      : `<div class="panel-label">Kvartersbladet</div><p class="muted">Kvällsupplagan kommer ut 21:55, när dagen är över.</p>`;
  }
  function dialog(i) {
    const c = convs[i]; if (!c) return;
    $('#dlg').innerHTML = `<div class="dlg-in"><button class="x" aria-label="Stäng">×</button><div class="panel-label">${c.tid} · ${esc(placeName(c.plats))}</div><h3>${c.deltagare.map(NAME).join(' & ')}</h3>
      ${c.repliker.map(([id, t]) => `<p class="line"><b style="color:${AG[idx[id]].farg}">${esc(NAME(id))}</b>${esc(t)}</p>`).join('')}
      ${c.handlingar?.length ? `<div class="ad-sec">Det här hände</div>${c.handlingar.map(h => `<p class="ad-p">${esc(h.text)}${h.upptackt === false ? ' <small>(ingen märkte något)</small>' : ''}</p>`).join('')}` : ''}</div>`;
    $('#dlg').classList.add('on');
  }
  function select(id, fromScene) { selected = id; uiT = 1; if (fromScene) document.querySelector('#agent-detail')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }

  document.addEventListener('click', e => {
    const r = e.target.closest('.agent-row'); if (r) select(r.dataset.id);
    const f = e.target.closest('#feed li[data-c]'); if (f) dialog(+f.dataset.c);
    if (e.target.closest('#dlg .x') || e.target.id === 'dlg') $('#dlg').classList.remove('on');
    const sp = e.target.closest('[data-speed]');
    if (sp) { const v = sp.dataset.speed; if (v === 'live') { live = true; speed = 1; if (archived) load(index?.senaste); } else { if (live) simMin = Math.max(WAKE, stockholmMin() >= SLEEP ? WAKE : stockholmMin()); live = false; speed = +v; } document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', b === sp)); }
  });
  document.addEventListener('change', e => { if (e.target.id === 'follow') { follow = e.target.checked; autoYaw = !follow; } if (e.target.id === 'archive') load(e.target.value, true); });
  $('#scrub')?.addEventListener('input', e => { live = false; if (speed === 1 && !document.querySelector('[data-speed].on:not([data-speed=live])')) speed = 1; simMin = +e.target.value; document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', b.dataset.speed === String(speed))); });

  /* ───────── Data ───────── */
  async function getJSON(u) { const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 120000), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function load(date, isArchive = false) {
    try { D = await getJSON(DATA + (date ? `dagar/${date}.json` : 'senaste.json')); }
    catch { try { D = await getJSON('simulering-demo.json'); } catch { $('#scene-title').textContent = 'Staden kunde inte laddas'; return; } }
    const today = stockholmDate();
    archived = isArchive && D.datum !== today;
    if (archived) { live = false; speed = 60; simMin = WAKE; document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', b.dataset.speed === '60')); }
    $('#replay-note').textContent = D.datum === today ? '' : archived ? `Du tittar på dag ${D.dag} (${D.datum}) i efterhand.` : `Visar senast simulerade dagen (${D.datum}) – nästa dag simuleras i natt.`;
    lastRenderedDay = D.datum; prepare(); uiT = 1;
  }
  async function boot() {
    if (!init()) return;
    try { index = await getJSON(DATA + 'index.json'); } catch { index = null; }
    if (index?.dagar?.length) $('#archive').innerHTML = index.dagar.slice().reverse().map(d => `<option value="${d}">${d}${d === index.senaste ? ' (senaste)' : ''}</option>`).join('');
    await load();
    requestAnimationFrame(frame);
    // titta efter nästa dag när den publicerats (strax efter att Leia är klar på morgonen)
    setInterval(async () => { if (!live) return; try { const i = await getJSON(DATA + 'index.json'); if (i.senaste !== lastRenderedDay) { index = i; load(); } } catch {} }, 5 * 60 * 1000);
  }
  boot();
})();
