/* Kvarter 07 — en koreograferad dag (Claude 2026-10-11).
   Fem invånare lever ett helt dygn i en loop: de går mellan hem och arbete, möts och pratar,
   och ljuset skiftar från gryning till natt. Ingen backend: allt körs i webbläsaren.
   AI-motorn med riktiga invånare vilar; den här scenen visar staden medan den sover. */
(() => {
  const mount = document.querySelector('#city-canvas');
  if (!mount || !window.THREE) return;
  const $ = s => document.querySelector(s);

  /* ───────── Världen ───────── */
  const PLACES = {
    torget:   { pos: [0, 2.4],   name: 'Torget' },
    bibliotek:{ pos: [-9, -6],   name: 'Biblioteket' },
    stadshus: { pos: [0, -10.5], name: 'Stadshuset' },
    scen:     { pos: [9, -6],    name: 'Scenen' },
    skola:    { pos: [-9, 7],    name: 'Skolan' },
    verkstad: { pos: [9, 7],     name: 'Verkstaden' },
    kafe:     { pos: [4.5, 3.5], name: 'Kaféet' },
  };
  const CAST = [
    { id: 'mira', name: 'Mira', role: 'Bibliotekarie', color: '#76d6c6', hex: 0x76d6c6, home: [-15, -1],
      plan: [[0,'hem','Sover'],[7,'kafe','Morgonkaffe'],[8,'bibliotek','Öppnar biblioteket'],[12,'torget','Lunch på torget'],[13,'bibliotek','Sagostund för barnen'],[17,'torget','Kvällspromenad'],[18,'scen','Lyssnar på konserten'],[21.5,'hem','Läser innan sömnen']] },
    { id: 'elias', name: 'Elias', role: 'Stadsplanerare', color: '#f1bc78', hex: 0xf1bc78, home: [-5, -15.5],
      plan: [[0,'hem','Sover'],[6.5,'torget','Morgonrunda i kvarteret'],[8,'stadshus','Ritar en ny cykelbana'],[12,'torget','Lunch på torget'],[13,'stadshus','Möte om parken'],[16,'verkstad','Kollar gatlyktorna'],[18,'scen','På konserten'],[21,'hem','Hemma för kvällen']] },
    { id: 'noor', name: 'Noor', role: 'Kulturproducent', color: '#ec8fa0', hex: 0xec8fa0, home: [15, -1],
      plan: [[0,'hem','Sover'],[9,'scen','Repar inför kvällen'],[12,'torget','Lunch på torget'],[13,'scen','Ljudprov'],[18,'scen','Spelar konsert'],[21,'kafe','Efterhäng på kaféet'],[23,'hem','Sover']] },
    { id: 'liv', name: 'Liv', role: 'Lärare', color: '#a99be8', hex: 0xa99be8, home: [-15, 12],
      plan: [[0,'hem','Sover'],[7,'skola','Förbereder lektionen'],[8,'skola','Undervisar'],[12,'torget','Lunch på torget'],[13,'skola','Rättar uppsatser'],[16,'bibliotek','Lånar böcker hos Mira'],[18,'scen','På konserten'],[21,'hem','Planerar morgondagen']] },
    { id: 'august', name: 'August', role: 'Reparatör', color: '#8eb7ed', hex: 0x8eb7ed, home: [15, 12],
      plan: [[0,'hem','Sover'],[5.5,'verkstad','Tänder i verkstaden'],[6,'torget','Lagar fontänen'],[9,'verkstad','Reparerar en cykel'],[12,'torget','Lunch på torget'],[13,'verkstad','Svetsar en ny bänk'],[16,'verkstad','Byter en lykta med Elias'],[17.5,'torget','Tänder gatlyktorna'],[18,'scen','På konserten'],[22,'hem','Sover']] },
  ];
  const DIALOGS = [
    { at: 6.4,  lines: [['august', 'Fontänen droppar igen. Tio minuter, sen är den som ny.']] },
    { at: 7.3,  lines: [['mira', 'Första koppen är alltid bäst. Nu öppnar vi biblioteket.']] },
    { at: 12.3, lines: [['elias', 'Jag har ritat en cykelbana genom parken.'], ['liv', 'Får barnen vara med och tycka till?'], ['elias', 'Självklart. Vi röstar på fredag.']] },
    { at: 12.7, lines: [['noor', 'Konsert i kväll klockan sex. Alla är välkomna!'], ['august', 'Då tänder jag lyktorna lite tidigare.']] },
    { at: 13.5, lines: [['mira', 'Sagostunden börjar. I dag handlar den om en stad som drömmer.']] },
    { at: 16.4, lines: [['liv', 'Har du något om stjärnor? Klassen vill veta allt.'], ['mira', 'En hel hylla. Börja med den här.']] },
    { at: 16.6, lines: [['elias', 'Lykta nummer fyra blinkar.'], ['august', 'Lös kontakt. Klart före konserten.']] },
    { at: 18.4, lines: [['noor', 'Tack för att ni kom! Första låten handlar om det här kvarteret.']] },
    { at: 20.3, lines: [['liv', 'Det här var den bästa kvällen på länge.'], ['mira', 'Samma tid nästa vecka?'], ['noor', 'Jag lovar.']] },
    { at: 22.4, lines: [['august', 'Lyktorna lyser. Kvarteret sover gott.']] },
  ];
  const EVENTS = [[6, 'August lagar fontänen'], [12, 'Lunch på torget'], [16, 'Liv lånar böcker om stjärnor'], [18, 'Konsert med Noor på scenen'], [22, 'Lyktorna lyser natten igenom']];
  const SKY = [[0, 0x0a1424], [4.6, 0x0a1424], [6, 0x4b5583], [7, 0xe3a988], [8.5, 0x8fc2e6], [16.5, 0x8fc2e6], [18, 0xeea173], [19.3, 0x58457a], [20.8, 0x0e1a33], [24, 0x0a1424]];

  /* ───────── Tillstånd ───────── */
  let hour = 5.4, day = 1, weather = 'clear', selected = 'mira';
  let scene, camera, renderer, hemi, sun, moonLight, stars, rain, snow, waterJet;
  const windows = [], lamps = [], people = {};
  let yaw = 0.5, autoYaw = true, dragging = false, lastX = 0, last = performance.now(), uiT = 0;
  let talk = null; // { lines, idx, t }
  const doneDialogs = new Set();
  const log = [];

  /* ───────── Byggstenar ───────── */
  const mat = (c, r = .75, m = .05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  function add(geo, material, p, parent, rot) {
    const m = new THREE.Mesh(geo, material); m.position.set(p[0], p[1], p[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (w, h, d, c, p, parent) => add(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c) : c, p, parent);
  const cyl = (rt, rb, h, c, p, parent, seg = 16) => add(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? mat(c) : c, p, parent);
  const ball = (r, c, p, parent, seg = 14) => add(new THREE.SphereGeometry(r, seg, seg), typeof c === 'number' ? mat(c) : c, p, parent);

  function label(text, color = '#f2f5fb', w = 2.6) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 72;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(8,12,20,.74)'; x.beginPath();
    if (x.roundRect) x.roundRect(10, 10, 300, 52, 16); else x.rect(10, 10, 300, 52);
    x.fill(); x.strokeStyle = color; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#f2f5fb'; x.font = '600 26px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 160, 37);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(w, w * 72 / 320, 1); return s;
  }

  function windowPane(w, h, p, parent, rotY = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffcf86, transparent: true, opacity: .1 }));
    m.position.set(p[0], p[1], p[2]); m.rotation.y = rotY; parent.add(m); windows.push(m); return m;
  }

  function house(x, z, color, roof, faceAngle, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = faceAngle; g.scale.setScalar(scale);
    box(2.6, 2.1, 2.4, color, [0, 1.05, 0], g);
    const r = add(new THREE.ConeGeometry(2.15, 1.3, 4), mat(roof, .85), [0, 2.75, 0], g); r.rotation.y = Math.PI / 4;
    box(.6, 1.05, .06, 0x3b2a22, [0, .53, 1.21], g);
    windowPane(.55, .5, [-.78, 1.35, 1.215], g); windowPane(.55, .5, [.78, 1.35, 1.215], g);
    box(.18, .7, .18, 0x6b5a50, [.7, 3.1, -.4], g); // skorsten
    scene.add(g); return g;
  }

  function building(key, w, h, d, color, roof, accent, faceAngle) {
    const [x, z] = PLACES[key].pos;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = faceAngle;
    box(w, h, d, color, [0, h / 2, 0], g);
    box(w + .3, .25, d + .3, roof, [0, h + .12, 0], g);
    box(w * .8, .12, .5, accent, [0, h * .62, d / 2 + .25], g); // markis
    for (let i = 0; i < 3; i++) windowPane(w / 5, h * .28, [(i - 1) * w / 3.2, h * .38, d / 2 + .01], g);
    for (let i = 0; i < 3; i++) windowPane(w / 5, h * .2, [(i - 1) * w / 3.2, h * .8, d / 2 + .01], g);
    const l = label(PLACES[key].name, '#' + accent.toString(16).padStart(6, '0'), 2.4); l.position.set(0, h + 1.1, 0); g.add(l);
    scene.add(g); return g;
  }

  function tree(x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    cyl(.12, .16, 1.2, 0x5b4636, [0, .6, 0], g, 8);
    ball(.75, mat(0x3f7a5a, .9), [0, 1.65, 0], g, 10);
    ball(.55, mat(0x4c8d68, .9), [.35, 2.1, .1], g, 10);
    scene.add(g);
  }

  function lamp(x, z) {
    cyl(.05, .07, 2.6, 0x1c2432, [x, 1.3, z], scene, 8);
    const bulb = ball(.13, new THREE.MeshBasicMaterial({ color: 0x664f2a }), [x, 2.65, z], scene, 10);
    const light = new THREE.PointLight(0xffc878, 0, 9, 2); light.position.set(x, 2.6, z); scene.add(light);
    lamps.push({ bulb, light });
  }

  function person(a) {
    const g = new THREE.Group();
    const skin = mat(0xe0a888, .9), dark = mat(0x1a1f2e, .95), shirt = mat(a.hex, .55, .08), pants = mat(0x1c2a3e, .82);
    box(.52, .66, .32, shirt, [0, .98, 0], g);
    ball(.25, skin, [0, 1.58, 0], g, 16);
    const hair = ball(.26, dark, [0, 1.7, -.02], g, 12); hair.scale.set(1, .55, 1);
    if (a.id === 'mira') ball(.1, dark, [.16, 1.86, -.06], g, 8);
    if (a.id === 'noor') { ball(.11, dark, [-.17, 1.75, 0], g, 8); ball(.11, dark, [.17, 1.75, 0], g, 8); }
    if (a.id === 'liv') { ball(.13, dark, [-.22, 1.52, 0], g, 8); ball(.13, dark, [.22, 1.52, 0], g, 8); }
    if (a.id === 'elias') box(.2, .02, .02, 0x1a1f2e, [0, 1.6, .25], g);
    [-.085, .085].forEach(ex => { const e = ball(.035, new THREE.MeshBasicMaterial({ color: 0x1a1520 }), [ex, 1.6, .23], g, 8); e.castShadow = false; });
    const arm = side => { const p = new THREE.Group(); p.position.set(side * .34, 1.28, 0); g.add(p); box(.12, .6, .13, shirt, [0, -.3, 0], p); ball(.07, skin, [0, -.62, 0], p, 8); return p; };
    const leg = side => { const p = new THREE.Group(); p.position.set(side * .14, .64, 0); g.add(p); box(.16, .62, .17, pants, [0, -.31, 0], p); box(.18, .08, .28, 0x0e121c, [0, -.62, .05], p); return p; };
    const parts = { la: arm(-1), ra: arm(1), ll: leg(-1), rl: leg(1) };
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.38, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; g.add(shadow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .52, 32), new THREE.MeshBasicMaterial({ color: a.hex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
    const nl = label(a.name, a.color, 1.7); nl.position.set(0, 2.35, 0); g.add(nl);
    g.scale.setScalar(1.15);
    g.position.set(a.home[0], 0, a.home[1]);
    scene.add(g);
    return { g, parts, ring, phase: Math.random() * 6.3, pos: new THREE.Vector2(a.home[0], a.home[1]), target: null, inside: true, vis: 0 };
  }

  function buildWorld() {
    // mark och gångar
    add(new THREE.CircleGeometry(30, 64), mat(0x264536, .97), [0, 0, 0], scene, [-Math.PI / 2, 0, 0]).castShadow = false;
    add(new THREE.CircleGeometry(6.4, 64), mat(0x7a7366, .92), [0, .01, 1], scene, [-Math.PI / 2, 0, 0]).castShadow = false;
    const path = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const m = add(new THREE.PlaneGeometry(1.1, len), mat(0x6c6458, .95), [(x1 + x2) / 2, .015, (z1 + z2) / 2], scene, [-Math.PI / 2, 0, 0]);
      m.rotation.z = -Math.atan2(x2 - x1, z2 - z1); m.castShadow = false;
    };
    Object.values(PLACES).forEach(p => path(0, 1, p.pos[0], p.pos[1]));
    CAST.forEach(a => path(0, 1, a.home[0], a.home[1]));
    // fontän
    cyl(2, 2.2, .5, mat(0x9c958a, .7), [0, .25, 1], scene, 32);
    add(new THREE.CircleGeometry(1.8, 32), new THREE.MeshStandardMaterial({ color: 0x4f8fb8, roughness: .15, metalness: .3 }), [0, .46, 1], scene, [-Math.PI / 2, 0, 0]);
    cyl(.22, .3, 1.4, 0x9c958a, [0, .9, 1], scene, 16);
    waterJet = ball(.32, new THREE.MeshStandardMaterial({ color: 0x9fd4f2, transparent: true, opacity: .7, roughness: .1 }), [0, 1.75, 1], scene, 16);
    // byggnader
    building('bibliotek', 4.6, 3.4, 3.2, 0xc9b79a, 0x6f4f3e, 0x76d6c6, Math.atan2(9, 7));
    building('stadshus', 5.4, 4.4, 3.4, 0xd8d0c2, 0x485a6e, 0xf1bc78, 0);
    building('skola', 4.6, 3, 3.2, 0xd7a98b, 0x7b4a3a, 0xa99be8, Math.atan2(9, -6));
    building('verkstad', 4.2, 2.8, 3.2, 0x8a95a3, 0x3c4654, 0x8eb7ed, Math.atan2(-9, -6));
    // scen
    const [sx, sz] = PLACES.scen.pos;
    const sg = new THREE.Group(); sg.position.set(sx, 0, sz); sg.rotation.y = Math.atan2(-9, 7); scene.add(sg);
    box(4.6, .5, 3, 0x3a2f3f, [0, .25, -.6], sg);
    box(.3, 3.4, .3, 0x2a2230, [-2.2, 1.7, -2], sg); box(.3, 3.4, .3, 0x2a2230, [2.2, 1.7, -2], sg);
    box(4.8, .35, .4, 0xec8fa0, [0, 3.4, -2], sg);
    const sl = label(PLACES.scen.name, '#ec8fa0', 2.4); sl.position.set(0, 4.3, -2); sg.add(sl);
    const spot = new THREE.SpotLight(0xff9ec0, 0, 14, .6, .5); spot.position.set(0, 5, 3); spot.target.position.set(0, 0, -.6);
    sg.add(spot); sg.add(spot.target); scene.userData.stageSpot = spot;
    // kafé
    const [kx, kz] = PLACES.kafe.pos;
    cyl(.5, .5, .06, 0xe8ddc9, [kx + 1, .75, kz + .8], scene, 20); cyl(.05, .05, .75, 0x333, [kx + 1, .38, kz + .8], scene, 6);
    const para = add(new THREE.ConeGeometry(1.1, .5, 12), mat(0xe86f5a, .7), [kx + 1, 2.2, kz + .8], scene); cyl(.03, .03, 2, 0xcccccc, [kx + 1, 1.2, kz + .8], scene, 6);
    const kl = label(PLACES.kafe.name, '#e86f5a', 2); kl.position.set(kx + 1, 3, kz + .8); scene.add(kl);
    // hem
    CAST.forEach(a => house(a.home[0], a.home[1], [0xe7d7c1, 0xd9c7b0, 0xe8c9c4, 0xd8d2e8, 0xcfdbe6][CAST.indexOf(a)], 0x8a4b3c, Math.atan2(-a.home[0], 1 - a.home[1])));
    // träd och lyktor
    [[-5, -3], [5, -3], [-5, 6.5], [6.5, 7.2], [-12, -9], [12, -10], [-3, 13], [4, 14], [-19, 5], [19, 5], [0, -17], [-11, 15], [11, -14]].forEach(([x, z], i) => tree(x, z, .9 + (i % 3) * .15));
    [[-4.5, -1.5], [4.5, -1.5], [-4.5, 4.5], [4.5, 5.2], [-6.5, 9], [6.5, 9.5]].forEach(([x, z]) => lamp(x, z));
    // stjärnor
    const sg2 = new THREE.BufferGeometry(); const sp = [];
    for (let i = 0; i < 700; i++) { const t = Math.random() * Math.PI * 2, p = Math.random() * .45 + .05, r = 70; sp.push(Math.cos(t) * Math.cos(p) * r, Math.sin(p) * r + 6, Math.sin(t) * Math.cos(p) * r); }
    sg2.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: .45, transparent: true, opacity: 0, depthWrite: false })); scene.add(stars);
    // nederbörd
    const precip = (n, color, size) => {
      const geo = new THREE.BufferGeometry(); const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - .5) * 44; a[i * 3 + 1] = Math.random() * 18; a[i * 3 + 2] = (Math.random() - .5) * 44; }
      geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dx = dot.getContext('2d');
      const gr = dx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); dx.fillStyle = gr; dx.fillRect(0, 0, 32, 32);
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: new THREE.CanvasTexture(dot), transparent: true, opacity: .8, depthWrite: false }));
      p.visible = false; scene.add(p); return p;
    };
    rain = precip(1600, 0x9fc6e8, .09); snow = precip(1200, 0xffffff, .2);
    CAST.forEach(a => { people[a.id] = person(a); });
  }

  /* ───────── Dygnet ───────── */
  const lerpColor = (h) => {
    for (let i = 0; i < SKY.length - 1; i++) {
      const [h1, c1] = SKY[i], [h2, c2] = SKY[i + 1];
      if (h >= h1 && h <= h2) return new THREE.Color(c1).lerp(new THREE.Color(c2), (h - h1) / (h2 - h1));
    }
    return new THREE.Color(SKY[0][1]);
  };
  const daylight = h => Math.max(0, Math.min(1, Math.sin((h - 5.6) / 13.6 * Math.PI) * 1.4));
  const fmt = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  function current(a, h) { let cur = a.plan[0]; for (const p of a.plan) if (h >= p[0]) cur = p; return cur; }
  function placePos(a, key) {
    const i = CAST.indexOf(a);
    if (key === 'hem') return new THREE.Vector2(a.home[0] * .86, a.home[1] * .86);
    const [x, z] = PLACES[key].pos;
    if (key === 'torget') { const ang = i / CAST.length * Math.PI * 2 + .3; return new THREE.Vector2(Math.cos(ang) * 3.1, 1 + Math.sin(ang) * 3.1); }
    const len = Math.hypot(x, z) || 1, dx = -x / len, dz = -z / len; // riktning mot torget
    if (key === 'scen') {
      if (a.id === 'noor') return new THREE.Vector2(x + dx * .2, z + dz * .2);
      const k = i - (i > 2 ? 1 : 0) - 1.5; // fyra i publiken
      return new THREE.Vector2(x + dx * 4.4 - dz * k * 1.2, z + dz * 4.4 + dx * k * 1.2);
    }
    const k = (i - 2) * .55;
    return new THREE.Vector2(x + dx * 2.6 - dz * k, z + dz * 2.6 + dx * k);
  }
  function phaseName(h) {
    if (h < 5) return ['Natt', 'Kvarteret sover', 'Bara lyktorna och stjärnorna är vakna.'];
    if (h < 7) return ['Gryning', 'Kvarteret vaknar', 'August är först ute, som vanligt.'];
    if (h < 12) return ['Morgon', 'Alla till sitt', 'Biblioteket öppnar, skolan börjar, verkstaden surrar.'];
    if (h < 13) return ['Lunch', 'Lunch på torget', 'Alla fem samlas vid fontänen.'];
    if (h < 17.5) return ['Eftermiddag', 'Ärenden och möten', 'Böcker, lyktor och en ny bänk.'];
    if (h < 21) return ['Kväll', 'Konsert på scenen', 'Noor spelar, och hela kvarteret lyssnar.'];
    return ['Natt', 'God natt, Kvarter 07', 'Fönster tänds, och ett efter ett släcks de.'];
  }

  /* ───────── Pratbubblor ───────── */
  function bubble(id, text, on) {
    let el = document.querySelector(`[data-bubble="${id}"]`);
    const a = CAST.find(c => c.id === id);
    if (!el) { el = document.createElement('div'); el.className = 'city-bubble paused-bubble'; el.dataset.bubble = id; mount.appendChild(el); }
    el.style.setProperty('--bubble-accent', a.color);
    if (text) el.innerHTML = `<b>${a.name}</b><span>${text}</span>`;
    const p = people[id]; if (!p) return;
    const v = new THREE.Vector3(p.g.position.x, 2.9, p.g.position.z).project(camera);
    const r = mount.getBoundingClientRect();
    el.style.left = '0'; el.style.top = '0';
    el.style.transform = `translate(${(v.x * .5 + .5) * r.width}px, ${(-v.y * .5 + .5) * r.height}px) translate(-50%, -110%)`;
    const vis = on && v.z < 1 && p.vis > .5;
    el.style.opacity = vis ? '1' : '0'; el.style.visibility = vis ? 'visible' : 'hidden';
  }

  function pushLog(who, text) {
    log.unshift({ t: fmt(hour), who, text }); log.length = Math.min(log.length, 10);
    const el = $('#social-log'); if (!el) return;
    el.innerHTML = log.map(l => `<div class="social-item"><b>${l.t} · ${l.who}</b><span>${l.text}</span></div>`).join('');
  }

  /* ───────── Uppdatering ───────── */
  function step(dt) {
    // klockan går långsamt när någon pratar, snabbare på natten
    const rate = talk ? .03 : (hour < 5 || hour > 22.8 ? 1.1 : .36);
    hour += dt * rate;
    if (hour >= 24) { hour -= 24; day += 1; doneDialogs.clear(); }
    // samtal
    if (!talk) {
      const d = DIALOGS.find(d => !doneDialogs.has(d.at) && hour >= d.at && hour < d.at + 1.5);
      if (d && d.lines.every(([id]) => people[id].vis > .9 && (!people[id].target || people[id].pos.distanceTo(people[id].target) < 2.5))) { talk = { lines: d.lines, idx: -1, t: 99 }; doneDialogs.add(d.at); }
    }
    if (talk) {
      talk.t += dt;
      if (talk.t > 2.8) {
        if (talk.idx >= 0) bubble(talk.lines[talk.idx][0], '', false);
        talk.idx += 1; talk.t = 0;
        if (talk.idx >= talk.lines.length) talk = null;
        else { const [id, line] = talk.lines[talk.idx]; bubble(id, line, true); pushLog(CAST.find(c => c.id === id).name, line); }
      }
    }
    // invånarna
    CAST.forEach(a => {
      const p = people[a.id], [, key] = current(a, hour);
      const goal = placePos(a, key);
      const atHome = key === 'hem';
      if (p.pos.distanceTo(goal) > .15) p.target = goal; else p.target = null;
      if (p.target) {
        if (p.inside) { p.inside = false; }
        const dir = p.target.clone().sub(p.pos); const dist = dir.length();
        const speed = 2.6 * dt; p.pos.add(dir.normalize().multiplyScalar(Math.min(speed, dist)));
        p.g.rotation.y = Math.atan2(dir.x, dir.y);
      } else {
        // vänd mot det som händer
        let look = null;
        if (key === 'scen' && a.id !== 'noor') look = people.noor.pos;
        else if (talk) { const sp = people[talk.lines[Math.max(0, talk.idx)][0]]; if (sp !== p && sp.pos.distanceTo(p.pos) < 6) look = sp.pos; }
        else if (key === 'torget') look = new THREE.Vector2(0, 1);
        else if (a.id === 'noor' && key === 'scen') look = new THREE.Vector2(0, 1);
        if (look) { const want = Math.atan2(look.x - p.pos.x, look.y - p.pos.y); let d = want - p.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); p.g.rotation.y += d * Math.min(1, dt * 4); }
        if (atHome) p.inside = true;
      }
      p.vis += ((p.inside && !p.target ? 0 : 1) - p.vis) * Math.min(1, dt * 3);
      p.g.visible = p.vis > .02; p.g.scale.setScalar(1.15 * (.6 + .4 * p.vis));
      p.g.position.set(p.pos.x, 0, p.pos.y);
      const moving = !!p.target, t = performance.now() / 1000 + p.phase;
      const sw = moving ? Math.sin(t * 9) : Math.sin(t * 1.6) * .06;
      p.parts.ll.rotation.x = sw * (moving ? .6 : .1); p.parts.rl.rotation.x = -sw * (moving ? .6 : .1);
      p.parts.la.rotation.x = -sw * (moving ? .45 : .1); p.parts.ra.rotation.x = sw * (moving ? .45 : .1);
      const talking = talk && talk.idx >= 0 && talk.lines[talk.idx][0] === a.id;
      if (talking) p.parts.ra.rotation.x = -.6 + Math.sin(t * 4) * .25;
      if (a.id === 'noor' && key === 'scen' && hour >= 18 && hour < 21) { p.parts.la.rotation.x = -1.2 + Math.sin(t * 6) * .2; p.parts.ra.rotation.x = -1 + Math.cos(t * 6) * .25; }
      p.g.position.y = moving ? Math.abs(Math.sin(t * 9)) * .05 : 0;
      p.ring.material.opacity = (a.id === selected ? .55 : talking ? .4 : 0) * p.vis;
    });
    if (talk && talk.idx >= 0) bubble(talk.lines[talk.idx][0], '', true);
    // ljus och himmel
    const dl = daylight(hour), sky = lerpColor(hour);
    if (weather !== 'clear') sky.lerp(new THREE.Color(weather === 'snow' ? 0xb8c4d2 : 0x5d6b7a), .45 * Math.max(dl, .3));
    scene.background = sky; scene.fog.color = sky;
    const ang = (hour - 6) / 12 * Math.PI;
    sun.position.set(Math.cos(ang) * 22, Math.max(2, Math.sin(ang) * 26), 8);
    sun.intensity = 1.25 * dl * (weather === 'clear' ? 1 : .5);
    sun.color.setHSL(.09, .6, .55 + dl * .35);
    hemi.intensity = .25 + dl * .45; moonLight.intensity = .35 * (1 - dl);
    stars.material.opacity = Math.max(0, 1 - dl * 2.5) * (weather === 'clear' ? 1 : .2);
    const night = 1 - dl;
    windows.forEach((w, i) => { const lit = night > .4 && !((i * 37 + Math.floor(hour * 2)) % 7 === 0 && hour > 22.5); w.material.opacity += ((lit ? .85 : .08) - w.material.opacity) * Math.min(1, dt * 2); });
    const lampsOn = hour >= 17.5 || hour < 6.6;
    lamps.forEach(l => { l.light.intensity += ((lampsOn ? 1.1 : 0) - l.light.intensity) * Math.min(1, dt * 3); l.bulb.material.color.setHex(lampsOn ? 0xffe2a8 : 0x5c4a2c); });
    scene.userData.stageSpot.intensity = hour >= 18 && hour < 21 ? 2.2 + Math.sin(performance.now() / 300) * .5 : 0;
    waterJet.scale.y = 1 + Math.sin(performance.now() / 260) * .18;
    [rain, snow].forEach(pr => {
      pr.visible = (pr === rain && weather === 'rain') || (pr === snow && weather === 'snow');
      if (!pr.visible) return;
      const a = pr.geometry.attributes.position, sp = pr === rain ? 16 : 2.2;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - sp * dt; if (y < 0) y += 18; a.setY(i, y);
        if (pr === snow) a.setX(i, a.getX(i) + Math.sin(y + i) * dt * .3);
      }
      a.needsUpdate = true;
    });
  }

  /* ───────── Panelerna ───────── */
  function ui() {
    const [ph, title, copy] = phaseName(hour);
    $('#city-time').textContent = fmt(hour);
    $('#city-weather').textContent = `${{ clear: 'Klart', rain: 'Regn', snow: 'Snö' }[weather]} · ${ph.toLowerCase()}`;
    $('#scene-day').textContent = `DAG ${day} · ${ph.toUpperCase()}`;
    $('#scene-title').textContent = title; $('#scene-copy').textContent = copy;
    const out = CAST.filter(a => people[a.id].vis > .5).length;
    $('#active-count').textContent = `${out} ute`;
    $('#agent-list').innerHTML = CAST.map(a => {
      const [, key, act] = current(a, hour); const energy = Math.round(100 - Math.max(0, Math.min(1, (hour - 6) / 17)) * 70);
      return `<button class="agent-card ${a.id === selected ? 'selected' : ''}" data-id="${a.id}" style="--agent-color:${a.color};--need:${key === 'hem' && hour < 6 ? 100 : energy}%">
        <span class="agent-orb"></span><strong>${a.name}</strong><small>${a.role}</small>
        <span class="agent-mood">${act}</span><span class="agent-status"><i></i></span></button>`;
    }).join('');
    const a = CAST.find(c => c.id === selected), [, key, act] = current(a, hour);
    $('#agent-detail-content').innerHTML = `<div class="agent-hero"><span class="agent-orb" style="--agent-color:${a.color}"></span>
      <div><h2>${a.name}</h2><p>${a.role} · Kvarter 07</p></div></div>
      <p class="paused-detail"><b style="color:${a.color}">Just nu:</b> ${act}${key !== 'hem' ? ` · ${PLACES[key].name}` : ' · hemma'}</p>
      <div class="day-plan">${a.plan.filter(p => p[0] > 0).map(p => `<div class="${p === current(a, hour) ? 'now' : ''}"><span>${fmt(p[0])}</span>${p[2]}</div>`).join('')}</div>`;
    $('#question-name').textContent = a.name;
    const next = EVENTS.find(e => e[0] > hour) || EVENTS[0];
    $('#event-list').innerHTML = EVENTS.map(e => `<div class="event-item ${e === next ? 'next' : ''}"><b>${fmt(e[0])}</b> ${e[1]}</div>`).join('');
  }

  /* ───────── Start ───────── */
  function init() {
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a1424, 34, 80);
    camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    mount.appendChild(renderer.domElement);
    hemi = new THREE.HemisphereLight(0xcfe4f7, 0x2a3a2a, .8); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffe8c4, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, far: 80 }); scene.add(sun);
    moonLight = new THREE.DirectionalLight(0x8aa6ff, .3); moonLight.position.set(-10, 20, -12); scene.add(moonLight);
    buildWorld(); resize();
    addEventListener('resize', resize);
    mount.addEventListener('pointerdown', e => { dragging = true; autoYaw = false; lastX = e.clientX; });
    addEventListener('pointerup', () => { dragging = false; setTimeout(() => autoYaw = true, 6000); });
    addEventListener('pointermove', e => { if (!dragging) return; yaw += (e.clientX - lastX) * .005; lastX = e.clientX; });
    $('#agent-list').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { selected = b.dataset.id; ui(); } });
    document.querySelectorAll('.weather').forEach(b => b.addEventListener('click', () => {
      weather = b.dataset.weather; document.querySelectorAll('.weather').forEach(x => x.classList.toggle('active', x === b));
    }));
    document.querySelectorAll('.time-mode').forEach(b => b.addEventListener('click', () => {
      hour = b.dataset.mode === 'day' ? 11.6 : 20.8; talk = null; CAST.forEach(a => bubble(a.id, '', false));
      b.classList.add('active'); setTimeout(() => b.classList.remove('active'), 600);
    }));
    pushLog('Kvarter 07', 'En ny dag börjar. Fem invånare, ett dygn, en loop.');
    ui(); requestAnimationFrame(loop);
  }
  function resize() {
    const r = mount.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(r.height, 1);
    camera.fov = r.height > r.width ? 58 : 42; camera.updateProjectionMatrix();
  }
  function loop(now = performance.now()) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    step(dt);
    if (autoYaw) yaw += dt * .035;
    const narrow = mount.clientWidth < 680, R = narrow ? 40 : 27, E = narrow ? 26 : 15;
    camera.position.set(Math.sin(yaw) * R, E, Math.cos(yaw) * R + 1);
    camera.lookAt(0, 0, -.5);
    renderer.render(scene, camera);
    uiT += dt; if (uiT > .3) { uiT = 0; ui(); }
  }

  document.querySelectorAll('.weather, .time-mode').forEach(el => { el.disabled = false; el.classList.remove('is-disabled'); });
  try { init(); }
  catch (e) {
    const fb = $('#webgl-fallback');
    if (fb) { fb.style.display = 'block'; fb.textContent = '3D-läget kunde inte starta i den här webbläsaren. Mira, Elias, Noor, Liv och August lever vidare i panelerna nedan.'; }
  }
})();
