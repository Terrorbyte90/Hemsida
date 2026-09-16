(() => {
  const mount = document.querySelector('#city-canvas');
  if (!mount || !window.CityAgents || !window.THREE) return;
  const A = window.CityAgents, Memory = window.CityMemory, $ = s => document.querySelector(s);
  const CITY_API = 'https://5.175.249.12.nip.io/city/api/city';
  const state = A.createSimulationState();
  A.askQwen = async () => null;
  const places = { home:[0,4], plaza:[0,0], library:[-7,-5], workshop:[7,-5], school:[-7,0], garden:[7,0], hall:[0,-5], cafe:[0,3] };
  let scene, camera, renderer, city, rain, snow, sun, ambient, hemi, rim, skyMesh;
  let selected = state.selected, yaw = 0, dragging = false, lastX = 0, last = performance.now(), simAccum = 0;
  let meshes = [], colliders = [], lamps = [], windowLights = [], socialLog = [], lastSocial = 0;
  let directorIndex = 0, directorChanged = performance.now(), dust, fireflies;
  const clockEase = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mat = (c, rough = .78, metal = .05, opts = {}) => new THREE.MeshStandardMaterial({
    color: c, roughness: rough, metalness: metal, ...opts
  });
  const emissiveMat = (c, e, intensity = .55) => new THREE.MeshStandardMaterial({
    color: c, emissive: e, emissiveIntensity: intensity, roughness: .35, metalness: .1
  });
  const add = (o, p = [0,0,0], parent = city) => {
    o.position.set(...p);
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    parent.add(o);
    return o;
  };
  const box = (w, h, d, c, p, parent = city, rough = .78) =>
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c, rough) : c), [p[0], p[1] + h / 2, p[2]], parent);
  const cyl = (rTop, rBot, h, c, p, parent = city, seg = 16) =>
    add(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), typeof c === 'number' ? mat(c) : c), [p[0], p[1] + h / 2, p[2]], parent);
  const sphere = (r, c, p, parent = city, seg = 16) =>
    add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), typeof c === 'number' ? mat(c, .88) : c), p, parent);

  function softShadow(parent, radius = .42, opacity = .28) {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .025;
    shadow.receiveShadow = false;
    shadow.castShadow = false;
    parent.add(shadow);
    return shadow;
  }

  function building(x, z, w, d, h, wallColor, accent, label) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    city.add(group);

    // Plinth
    box(w + .35, .22, d + .35, 0x1a2436, [0, 0, 0], group, .9);
    // Main body with slight inset base trim
    box(w, h, d, wallColor, [0, .22, 0], group, .72);
    // Cornice
    box(w + .18, .14, d + .18, accent, [0, h + .15, 0], group, .65);

    // Roof — soft hip / pyramid
    const roofSpan = Math.max(w, d) * .72;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(roofSpan, .95, 4), mat(0x151d2c, .85, .08));
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    roof.position.set(0, h + .22 + .95 / 2 + .05, 0);
    group.add(roof);

    // Chimney on larger buildings
    if (h > 3) {
      box(.28, .55, .28, 0x2a3348, [w * .22, h + .9, -d * .15], group);
      box(.34, .08, .34, 0x1a2233, [w * .22, h + 1.2, -d * .15], group);
    }

    // Front door
    const door = box(.55, 1.05, .08, 0x1c2638, [0, .22, -d / 2 - .02], group, .6);
    door.userData.door = true;
    sphere(.04, emissiveMat(0xf5c878, 0xf5c878, .8), [.18, .72, -d / 2 - .08], group);

    // Windows with night glow
    const winMatDay = mat(0xc9dff0, .15, .35);
    const winMatNight = emissiveMat(0xffc978, 0xffb14a, .95);
    for (let y = 1.35; y < h - .2; y += 1.05) {
      for (let xx = -w / 2 + .75; xx < w / 2 - .35; xx += 1.15) {
        const pane = box(.38, .42, .04, winMatDay, [xx, y, -d / 2 - .02], group);
        pane.userData.window = true;
        pane.userData.dayMat = winMatDay;
        pane.userData.nightMat = winMatNight;
        windowLights.push(pane);
        // Window frame trim
        box(.42, .04, .05, 0x24324a, [xx, y + .23, -d / 2 - .01], group, .7);
      }
    }

    // Awning / sign band
    const signW = Math.min(w - .8, 3.6);
    const sign = box(signW, .32, .08, accent, [0, 1.55, -d / 2 - .06], group, .55);
    sign.userData.label = label;
    // Soft glow strip under awning
    const strip = box(signW * .92, .04, .03, emissiveMat(0xf3c98b, 0xf3c98b, .35), [0, 1.35, -d / 2 - .09], group);

    // Side facade subtle depth (rear wall darker windows)
    for (let y = 1.4; y < h - .3; y += 1.2) {
      const back = box(.32, .28, .03, 0x1a2838, [0, y, d / 2 + .02], group);
      back.userData.window = true;
      back.userData.dayMat = mat(0x8aa8bc, .2, .2);
      back.userData.nightMat = emissiveMat(0xe8a85a, 0xd4893a, .5);
      windowLights.push(back);
    }

    colliders.push({ x, z, w: w + .7, d: d + .7 });
    return group;
  }

  function tree(x, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    city.add(g);
    softShadow(g, .55 * scale, .22);
    cyl(.09 * scale, .14 * scale, 1.05 * scale, 0x4a3428, [0, 0, 0], g, 8);
    const canopy = (r, y, col, ox = 0, oz = 0) => {
      const s = sphere(r * scale, col, [ox * scale, y * scale, oz * scale], g, 12);
      s.material.roughness = .92;
      return s;
    };
    canopy(.68, 1.55, 0x1f4f42);
    canopy(.48, 2.05, 0x2d6b55, -.2, .08);
    canopy(.42, 1.95, 0x3a7d62, .22, -.1);
    canopy(.28, 2.35, 0x4a9474, .05, .12);
    g.userData.sway = Math.random() * Math.PI * 2;
    g.userData.scale = scale;
    return g;
  }

  function lamp(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    city.add(g);
    softShadow(g, .28, .18);
    cyl(.04, .06, .12, 0x3a465c, [0, 0, 0], g, 8);
    cyl(.028, .032, 2.2, 0x4a566c, [0, .12, 0], g, 8);
    // Lamp head
    const head = cyl(.12, .08, .18, 0x2a3344, [0, 2.32, 0], g, 10);
    const bulb = sphere(.11, new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), [0, 2.42, 0], g, 12);
    bulb.castShadow = false;
    // Soft halo disc
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(.55, 24),
      new THREE.MeshBasicMaterial({ color: 0xffc878, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = .03;
    g.add(halo);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(.22, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .22, depthWrite: false })
    );
    glow.position.set(0, 2.42, 0);
    g.add(glow);
    const l = new THREE.PointLight(0xffc878, 1.35, 6.5, 1.6);
    l.position.set(0, 2.4, 0);
    l.castShadow = false;
    g.add(l);
    lamps.push({ light: l, bulb, glow, halo });
  }

  function planter(x, z, color = 0xd18a52) {
    box(.72, .42, .55, color, [x, 0, z], city, .7);
    box(.68, .12, .52, 0x3d6b4f, [x, .42, z], city, .95);
    // Small foliage
    sphere(.22, 0x3a8a62, [x, .72, z], city, 10);
    sphere(.14, 0x4fa574, [x + .12, .78, z - .05], city, 8);
  }

  function bench(x, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    city.add(g);
    box(1.15, .08, .38, 0x5c4030, [0, .38, 0], g, .85);
    box(1.15, .32, .06, 0x5c4030, [0, .55, -.16], g, .85);
    box(.08, .38, .08, 0x2a3344, [-.48, 0, .12], g);
    box(.08, .38, .08, 0x2a3344, [.48, 0, .12], g);
    box(.08, .38, .08, 0x2a3344, [-.48, 0, -.12], g);
    box(.08, .38, .08, 0x2a3344, [.48, 0, -.12], g);
  }

  function limb(parent, x, y, color) {
    const upper = new THREE.Group();
    upper.position.set(x, y, 0);
    parent.add(upper);
    box(.13, .46, .14, color, [0, -.23, 0], upper);
    sphere(.09, 0xe0a888, [0, -.48, 0], upper, 10);
    box(.12, .36, .13, color, [0, -.66, 0], upper);
    sphere(.075, 0xe0a888, [0, -.88, 0], upper, 10);
    return upper;
  }

  function makeAvatar(agent) {
    const g = new THREE.Group();
    g.userData.id = agent.id;
    const p = places[agent.place] || agent.home;
    g.position.set(p[0], 0, p[1]);
    softShadow(g, .38, .32);

    const dark = mat(0x1a1f2e, .95);
    const pants = mat(0x1c2a3e, .82);
    const shirt = mat(agent.color, .62, .08);
    const skin = mat(0xe0a888, .9);

    // Torso with soft shoulders
    box(.58, .72, .36, shirt, [0, .72, 0], g);
    box(.62, .14, .38, shirt, [0, 1.12, 0], g); // shoulders
    // Neck
    cyl(.08, .09, .12, skin, [0, 1.36, 0], g, 10);
    // Head
    sphere(.29, skin, [0, 1.72, 0], g, 16);
    // Cheeks subtle
    sphere(.06, mat(0xd9927a, .9), [-.18, 1.66, .18], g, 8);
    sphere(.06, mat(0xd9927a, .9), [.18, 1.66, .18], g, 8);

    const hairStyle = agent.id === 'mira' ? 'bun' : agent.id === 'elias' ? 'side' : agent.id === 'noor' ? 'curls' : agent.id === 'liv' ? 'bob' : 'short';
    if (hairStyle === 'bun') {
      sphere(.28, dark, [0, 1.86, 0], g, 12);
      sphere(.12, dark, [.2, 2.0, -.02], g, 10);
    } else if (hairStyle === 'curls') {
      for (let i = -1; i <= 1; i++) {
        sphere(.13, dark, [i * .18, 1.92, 0], g, 10);
        sphere(.1, dark, [i * .16, 1.78, -.12], g, 8);
      }
    } else {
      const cap = sphere(.3, dark, [0, 1.88, 0], g, 12);
      cap.scale.set(1, .48, 1.02);
      if (hairStyle === 'side') sphere(.15, dark, [-.26, 1.82, .02], g, 10);
      if (hairStyle === 'bob') {
        sphere(.16, dark, [-.26, 1.68, 0], g, 10);
        sphere(.16, dark, [.26, 1.68, 0], g, 10);
      }
    }

    // Eyes with sclera + pupil
    const eyeWhite = (s) => {
      const w = sphere(.045, 0xf5f0ea, s, g, 8);
      w.material = new THREE.MeshBasicMaterial({ color: 0xf5f0ea });
      return w;
    };
    const pupil = (s) => {
      const e = sphere(.028, 0x1a1520, s, g, 8);
      e.material = new THREE.MeshBasicMaterial({ color: 0x1a1520 });
      return e;
    };
    eyeWhite([-.09, 1.74, .26]); eyeWhite([.09, 1.74, .26]);
    pupil([-.09, 1.74, .295]); pupil([.09, 1.74, .295]);
    // Brows + smile
    box(.08, .018, .02, dark, [-.09, 1.82, .27], g).rotation.z = .15;
    box(.08, .018, .02, dark, [.09, 1.82, .27], g).rotation.z = -.15;
    box(.08, .016, .016, mat(0xc47868), [0, 1.6, .28], g);

    const la = limb(g, -.38, 1.15, agent.color);
    const ra = limb(g, .38, 1.15, agent.color);
    const ll = box(.18, .58, .19, pants, [-.16, .05, 0], g);
    const rl = box(.18, .58, .19, pants, [.16, .05, 0], g);
    box(.21, .1, .32, 0x0e121c, [-.16, 0, .08], g);
    box(.21, .1, .32, 0x0e121c, [.16, 0, .08], g);

    // Personal glow — soft key + rim ring
    const key = new THREE.PointLight(agent.color, .55, 3.2, 2);
    key.position.set(0, 1.55, .55);
    g.add(key);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.36, .48, 40),
      new THREE.MeshBasicMaterial({ color: agent.color, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .03;
    g.add(ring);
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(.5, .58, 40),
      new THREE.MeshBasicMaterial({ color: agent.color, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = .031;
    g.add(outer);

    g.userData.parts = { la, ra, ll, rl, ring, outer, key, phase: Math.random() * 6.28, bob: 0 };
    g.userData.target = new THREE.Vector3(p[0], 0, p[1]);
    city.add(g);
    return g;
  }

  function buildCity() {
    city = new THREE.Group();
    scene.add(city);

    // Terrain layers — deep ground, grass, plaza, roads
    box(36, .2, 30, 0x0d1520, [0, -.1, -2], city, .95);
    // Grass belts
    box(36, .08, 8, 0x1a3a30, [0, .05, 10], city, .95);
    box(36, .08, 6, 0x16352c, [0, .05, -12], city, .95);
    // Main plaza stone
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 48),
      mat(0x2a3d52, .88, .04)
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, .12, -1.5);
    plaza.receiveShadow = true;
    city.add(plaza);
    // Inner plaza ring
    const plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(2.8, 3.15, 48),
      mat(0x3a5268, .7, .08)
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.set(0, .13, -1.5);
    city.add(plazaRing);

    // Roads
    box(3.2, .06, 28, 0x222e40, [-.2, .14, -2], city, .92);
    box(34, .06, 3.0, 0x222e40, [0, .14, -2], city, .92);
    // Road edge lines
    box(3.2, .01, .08, 0xc9a86a, [-.2, .175, 4], city);
    box(.08, .01, 3.0, 0xc9a86a, [4, .175, -2], city);

    // Buildings — richer palette
    building(-7, -8, 6.2, 3.2, 3.9, 0x2f4a68, 0x1e334c, 'BIBLIOTEK');
    building(7, -8, 6.0, 3.1, 3.5, 0x4e3a4e, 0x3a2a3c, 'VERKSTAD');
    building(-7, -2, 5.1, 3.0, 2.9, 0x355a6e, 0x244454, 'SKOLA');
    building(7, -2, 5.1, 3.0, 3.2, 0x5a4248, 0x423238, 'RÅDHUS');
    building(0, 6.2, 17.5, 2.5, 2.45, 0x283848, 0x1c2836, 'BOSTÄDER');
    // Small cafe kiosk
    building(0, 3.4, 3.2, 2.0, 1.9, 0x4a3a32, 0x352820, 'CAFÉ');

    // Fountain — multi-tier
    const fountainBase = cyl(2.55, 2.75, .22, 0x2a4258, [0, .12, -1.5], city, 40);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(2.25, 40),
      new THREE.MeshStandardMaterial({ color: 0x4ec4c8, roughness: .08, metalness: .45, transparent: true, opacity: .88 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, .35, -1.5);
    water.receiveShadow = true;
    city.add(water);
    water.userData.water = true;
    cyl(.55, .7, .55, 0x2f4a60, [0, .35, -1.5], city, 20);
    cyl(.28, .35, .7, 0x35556c, [0, .85, -1.5], city, 16);
    const spout = sphere(.14, emissiveMat(0xa8e8ec, 0x7ad4da, .6), [0, 1.55, -1.5], city, 12);
    spout.userData.spout = true;
    // Fountain rim lights
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lx = Math.cos(a) * 2.2, lz = -1.5 + Math.sin(a) * 2.2;
      sphere(.05, emissiveMat(0xf3c98b, 0xf3c98b, .4), [lx, .42, lz], city, 8);
    }

    // Trees
    const trees = [];
    for (let x = -13; x <= 13; x += 4.3) {
      trees.push(tree(x, 9.2, .9 + (Math.abs(x) % 3) * .08));
      if (Math.abs(x) > 4) trees.push(tree(x, -11.5, .85));
    }
    trees.push(tree(-4.5, 2.5, .7), tree(4.5, 2.5, .75), tree(-10, -4, .8), tree(10, -4, .8));
    city.userData.trees = trees;

    // Lamps
    for (let x = -12; x <= 12; x += 6) {
      lamp(x, -1);
      lamp(x, -9.2);
    }
    lamp(-4, 4); lamp(4, 4);

    // Planters & benches on plaza
    for (let x = -3.6; x <= 3.6; x += 1.2) planter(x, 1.6);
    bench(-3.2, -.2, .2);
    bench(3.2, -.2, -.2);
    bench(0, 1.0, 0);
    // Garden crates
    for (let i = 0; i < 3; i++) {
      box(.55, .35, .55, 0x6b4a32, [6.5 + i * .7, 0, .5], city, .85);
      box(.5, .12, .5, 0x3d7a52, [6.5 + i * .7, .35, .5], city, .95);
    }

    // Distant low hills silhouette (simple dark boxes as horizon)
    box(40, 2.5, 2, 0x0a121c, [0, 0, -16], city, 1);
    box(8, 4, 2, 0x0c1520, [-12, 0, -15.5], city, 1);
    box(6, 3.2, 2, 0x0b141e, [11, 0, -15.5], city, 1);

    state.agents.forEach(a => meshes.push(makeAvatar(a)));
    createAtmosphere();
  }

  function createAtmosphere() {
    // Rain
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = [];
    for (let i = 0; i < 420; i++) rainPos.push((Math.random() - .5) * 32, Math.random() * 12, (Math.random() - .5) * 26 - 3);
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
    rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xb8d8f0, size: .045, transparent: true, opacity: .55, depthWrite: false }));
    rain.visible = false;
    scene.add(rain);

    // Snow
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = [];
    for (let i = 0; i < 280; i++) snowPos.push((Math.random() - .5) * 32, Math.random() * 11, (Math.random() - .5) * 26 - 3);
    snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
    snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xf0f6ff, size: .08, transparent: true, opacity: .75, depthWrite: false }));
    snow.visible = false;
    scene.add(snow);

    // Daytime dust motes
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = [];
    for (let i = 0; i < 80; i++) dustPos.push((Math.random() - .5) * 20, .5 + Math.random() * 5, (Math.random() - .5) * 16);
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe8c0, size: .035, transparent: true, opacity: .25, depthWrite: false }));
    scene.add(dust);

    // Night fireflies
    const ffGeo = new THREE.BufferGeometry();
    const ffPos = [];
    for (let i = 0; i < 40; i++) ffPos.push((Math.random() - .5) * 18, .4 + Math.random() * 3, (Math.random() - .5) * 14);
    ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(ffPos, 3));
    fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xc8f5a0, size: .07, transparent: true, opacity: .7, depthWrite: false }));
    fireflies.visible = false;
    scene.add(fireflies);

    // Soft sky dome (gradient feel via large sphere)
    const skyGeo = new THREE.SphereGeometry(48, 24, 16);
    skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ color: 0x0b1729, side: THREE.BackSide, fog: false }));
    scene.add(skyMesh);
  }

  function socialText(a, b) {
    const lines = [
      `${a.name}: Du ser också lyktorna tändas.`,
      `${b.name}: Ja. Torget känns nästan som hemma.`,
      `${a.name}: Ska vi skriva ner idén till rådhuset?`,
      `${b.name}: Absolut — tillsammans blir den bättre.`
    ];
    return lines[(Math.floor(state.minute / 7) + a.name.length + b.name.length) % lines.length]
      .replace(`${a.name}: `, '').replace(`${b.name}: `, '');
  }

  function addSocial(a, b) {
    const text = socialText(a, b);
    socialLog.unshift({ time: A.clock(state.minute), text: `${a.name} → ${b.name}: ${text}` });
    socialLog = socialLog.slice(0, 12);
    Memory?.rememberConversation(a, b.name, text);
    Memory?.rememberConversation(b, a.name, text);
    a.thought = `Jag tänker vidare på det ${b.name} sa.`;
    b.thought = `${a.name} lyssnar faktiskt.`;
    renderSocial();
    state.events.unshift({ time: A.clock(state.minute), text: `${a.name} och ${b.name} delar tankar på torget.` });
  }

  function renderSocial() {
    const el = $('#social-log');
    if (el) el.innerHTML = socialLog.slice(0, 8).map(x => `<div class="social-line"><time>${x.time}</time><span>${x.text}</span></div>`).join('')
      || '<div class="social-empty">Staden väntar på dagens första möte.</div>';
  }

  function bubble(agent, kind) {
    let el = document.querySelector(`[data-bubble="${agent.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.bubble = agent.id;
      el.className = 'city-bubble';
      mount.appendChild(el);
    }
    el.classList.toggle('thought-bubble', kind === 'thought');
    el.innerHTML = kind === 'thought'
      ? `<i>· · ·</i><span>${agent.thought}</span>`
      : `<b>${agent.name}</b><span>${agent._dialog || agent.thought}</span>`;
    const m = meshes[state.agents.indexOf(agent)];
    if (!m) return;
    const v = new THREE.Vector3(m.position.x, 2.75, m.position.z);
    v.project(camera);
    el.style.left = `${(v.x * .5 + .5) * mount.clientWidth}px`;
    el.style.top = `${(-v.y * .5 + .5) * mount.clientHeight}px`;
    el.style.display = (v.z > -1 && v.z < 1) ? 'grid' : 'none';
  }

  function renderAgentList() {
    const list = $('#agent-list');
    list.innerHTML = state.agents.map(a =>
      `<button class="agent-card ${a.id === selected ? 'selected' : ''}" data-id="${a.id}" style="--agent-color:${a.color};--need:${100 - a.needs.sleep}%"><span class="agent-orb"></span><strong>${a.name}</strong><small>${a.actionLabel}</small><span class="agent-status"><i></i></span></button>`
    ).join('');
    list.querySelectorAll('.agent-card').forEach(x => x.onclick = () => {
      selected = x.dataset.id;
      renderAgentList();
      renderDetail();
    });
    $('#active-count').textContent = `${state.agents.filter(a => a.needs.sleep < 78).length} vakna`;
  }

  function renderDetail() {
    const a = state.agents.find(x => x.id === selected) || state.agents[0];
    $('#question-name').textContent = a.name;
    $('#agent-detail-content').innerHTML =
      `<div class="agent-hero"><span class="agent-orb" style="--agent-color:${a.color}"></span><div><h2>${a.name}</h2><p>${a.role} · ${a.trait}</p></div></div><div class="thought">“${a.thought}”</div><div class="needs">${Object.entries(a.needs).map(([k, v]) =>
        `<span class="need" style="--agent-color:${a.color};--value:${v}%"><b>${({ sleep: 'sömn', hunger: 'mat', social: 'socialt', curiosity: 'nyfiken', purpose: 'mening' })[k]}</b><i></i></span>`
      ).join('')}</div><p class="panel-meta" style="margin-top:14px">${a.actionLabel} · ${a.place}</p>`;
  }

  function renderLaws() {
    $('#law-list').innerHTML = state.laws.map(l =>
      `<div class="law"><div class="law-title">${l.title}</div><div class="law-meta"><span>${l.author} · ${l.status}</span><span class="law-vote" data-law="${l.id}">Ja ${l.yes} · Nej ${l.no}</span></div></div>`
    ).join('');
  }

  function renderEvents() {
    $('#event-list').innerHTML = state.events.slice(0, 6).map(e =>
      `<div class="event"><time>${e.time}</time><span>${e.text}</span></div>`
    ).join('');
  }

  function updateAtmosphere(now, night, solar) {
    // Particles
    if (rain.visible) {
      const pos = rain.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] -= 0.18 * state.speed;
        if (pos[i] < 0) pos[i] = 11;
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    if (snow.visible) {
      const pos = snow.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += Math.sin(now / 800 + i) * .008;
        pos[i + 1] -= 0.04 * state.speed;
        if (pos[i + 1] < 0) pos[i + 1] = 10;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
    if (dust) {
      dust.visible = !night && state.weather === 'clear';
      dust.material.opacity = .15 + solar * .2;
      const pos = dust.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += Math.sin(now / 2000 + i) * .004;
        pos[i + 1] += Math.cos(now / 1800 + i * .1) * .003;
      }
      dust.geometry.attributes.position.needsUpdate = true;
    }
    if (fireflies) {
      fireflies.visible = night && state.weather === 'clear';
      const pos = fireflies.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += Math.sin(now / 600 + i) * .012;
        pos[i + 1] += Math.cos(now / 700 + i) * .01;
        pos[i + 2] += Math.sin(now / 900 + i * .3) * .01;
      }
      fireflies.geometry.attributes.position.needsUpdate = true;
      fireflies.material.opacity = .45 + Math.sin(now / 400) * .25;
    }

    // Tree sway
    (city.userData.trees || []).forEach((t, i) => {
      t.rotation.z = Math.sin(now / 1400 + (t.userData.sway || i)) * .025;
    });

    // Window lighting
    windowLights.forEach((w, i) => {
      if (!w.userData.window) return;
      const lit = night || (solar < .25 && (i % 3 !== 0));
      w.material = lit ? w.userData.nightMat : w.userData.dayMat;
    });

    // Lamps
    lamps.forEach((L, i) => {
      const pulse = night ? 1.5 + Math.sin(now / 500 + i) * .15 : .2;
      L.light.intensity = night ? pulse : .25;
      L.glow.material.opacity = night ? .28 + Math.sin(now / 450 + i) * .06 : .04;
      L.halo.material.opacity = night ? .16 : .03;
      L.bulb.material.color.setHex(night ? 0xffe0a0 : 0xd0c8b0);
    });
  }

  function updateScene(now) {
    const dtFactor = Math.min(2.2, state.speed);

    state.agents.forEach((a, i) => {
      const m = meshes[i];
      if (!m) return;
      const p = places[a.place] || a.home;
      const targetX = p[0], targetZ = p[1];
      const dx = targetX - m.position.x;
      const dz = targetZ - m.position.z;
      const dist = Math.hypot(dx, dz);
      const moving = dist > .08;
      // Smooth eased movement
      const step = Math.min(dist, .055 * dtFactor * (moving ? 1 : 0));
      if (moving && dist > 0) {
        m.position.x += (dx / dist) * step;
        m.position.z += (dz / dist) * step;
        const desiredYaw = Math.atan2(dx, dz);
        let dy = desiredYaw - m.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        m.rotation.y += dy * .12;
      }
      const q = m.userData.parts;
      const walk = moving ? Math.sin(now / 140 + q.phase) : 0;
      const walkAmt = moving ? .38 : 0;
      q.la.rotation.z = walk * walkAmt;
      q.ra.rotation.z = -walk * walkAmt;
      q.ll.rotation.x = -walk * walkAmt * .85;
      q.rl.rotation.x = walk * walkAmt * .85;
      // Idle breath + walk bob
      const breath = Math.sin(now / 520 + q.phase) * .018;
      const bob = moving ? Math.abs(Math.sin(now / 140 + q.phase)) * .06 : breath;
      m.position.y = bob;
      // Soft pulsing rings
      if (q.ring) {
        q.ring.material.opacity = .28 + Math.sin(now / 700 + q.phase) * .12 + (a.id === selected ? .18 : 0);
        q.outer.material.opacity = .08 + Math.sin(now / 900 + q.phase) * .04;
        q.ring.scale.setScalar(1 + Math.sin(now / 800 + q.phase) * .04);
      }
      if (q.key) q.key.intensity = .4 + Math.sin(now / 600 + q.phase) * .12 + (a.id === selected ? .25 : 0);
      bubble(a, 'thought');
    });

    const social = state.agents.filter(a => a.place === 'plaza' && a.action === 'socialise');
    if (social.length >= 2) {
      social[0]._dialog = socialText(social[0], social[1]);
      bubble(social[0], 'speech');
      bubble(social[1], 'speech');
      if (now - lastSocial > 6000) {
        addSocial(social[0], social[1]);
        lastSocial = now;
      }
    } else {
      document.querySelectorAll('.city-bubble:not(.thought-bubble)').forEach(x => x.remove());
    }

    const hour = (state.minute % 1440) / 60;
    const solar = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
    const night = solar < .12;
    const dusk = !night && solar < .45;

    // Sky & fog blend
    const skyTarget = night ? 0x060d18 : dusk ? 0x2a4060 : 0x6a9db0;
    const fogTarget = night ? 0x08111e : dusk ? 0x2c4560 : 0x7aabba;
    scene.background.lerp(new THREE.Color(skyTarget), .04);
    scene.fog.color.lerp(new THREE.Color(fogTarget), .04);
    if (skyMesh) skyMesh.material.color.copy(scene.background);

    // Sun path
    const ang = (hour - 12) / 24 * Math.PI * 2;
    sun.position.set(Math.cos(ang) * 16, 2.5 + solar * 16, Math.sin(ang) * 14);
    sun.intensity = .22 + solar * 1.85;
    sun.color.setHex(dusk ? 0xffc090 : night ? 0xa0b8d8 : 0xffe6c4);
    hemi.intensity = night ? .45 : .85 + solar * .4;
    ambient.intensity = night ? .18 : .28 + solar * .15;
    if (rim) rim.intensity = night ? .35 : .15;

    scene.fog.near = night ? 14 : 20;
    scene.fog.far = night ? 36 : 48;
    renderer.toneMappingExposure = night ? .95 : dusk ? 1.05 : 1.18;

    updateAtmosphere(now, night, solar);

    rain.visible = state.weather === 'rain';
    snow.visible = state.weather === 'snow';

    $('#city-time').textContent = A.clock(state.minute);
    $('#city-weather').textContent = ({ clear: 'Klart · 14°', rain: 'Regn · 11°', snow: 'Snö · 2°' })[state.weather];
    $('#scene-day').textContent = `DAG ${state.day} · ${night ? 'NATT' : dusk ? 'SKYMNING' : 'DAG'}`;
  }

  function syncCity() {
    fetch(CITY_API, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(remote => {
      if (!remote?.agents || remote.agents.length !== 5) return;
      state.mode = remote.mode || 'live';
      state.minute = remote.minute ?? state.minute;
      state.day = remote.day ?? state.day;
      state.weather = remote.weather || state.weather;
      remote.agents.forEach((a, i) => Object.assign(state.agents[i], a));
      state.events = remote.events || state.events;
      renderAgentList();
      renderDetail();
      renderEvents();
      $('#model-status').textContent = state.mode === 'replay' ? 'Repris · senaste dygnet' : 'Stadens motor · aktiv';
    }).catch(() => {});
  }

  function askSelected() {
    const input = $('#agent-question'), q = input.value.trim(), a = state.agents.find(x => x.id === selected);
    if (!q || !a) return;
    $('#conversation-answer').textContent = 'Tänker…';
    input.value = '';
    fetch(`${CITY_API}/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: a.id, question: q })
    }).then(r => r.json()).then(result => {
      const answer = result.answer || 'Jag behöver lite tid att tänka.';
      Memory?.rememberConversation(a, 'besökaren', q);
      Memory?.rememberConversation(a, 'besökaren', answer);
      $('#conversation-answer').textContent = answer;
      socialLog.unshift({ time: A.clock(state.minute), text: `Du → ${a.name}: ${q}` });
      renderSocial();
    }).catch(() => $('#conversation-answer').textContent = 'Staden svarar inte just nu — prova igen om en stund.');
  }

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1729);
    scene.fog = new THREE.Fog(0x0b1729, 18, 42);

    camera = new THREE.PerspectiveCamera(40, 1, .1, 120);
    camera.position.set(0, 6.2, 13);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputEncoding = THREE.sRGBEncoding;
    mount.appendChild(renderer.domElement);

    hemi = new THREE.HemisphereLight(0xb8d4f0, 0x1a2a22, 1.0);
    scene.add(hemi);
    ambient = new THREE.AmbientLight(0x6a7f9a, .32);
    scene.add(ambient);

    sun = new THREE.DirectionalLight(0xffe0b8, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);

    rim = new THREE.DirectionalLight(0x88aacc, .25);
    rim.position.set(-8, 4, -10);
    scene.add(rim);

    buildCity();
    resize();
    addEventListener('resize', resize);
    bind();
    loop();
  }

  function resize() {
    const r = mount.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }

  function bind() {
    document.querySelectorAll('.speed').forEach(b => b.onclick = () => {
      state.speed = +b.dataset.speed;
      document.querySelectorAll('.speed').forEach(x => x.classList.toggle('active', x === b));
    });
    $('#pause-btn').onclick = () => {
      state.paused = !state.paused;
      $('#pause-btn').textContent = state.paused ? 'Fortsätt' : 'Pausa';
    };
    document.querySelectorAll('.weather').forEach(b => b.onclick = () => {
      state.weather = b.dataset.weather;
      document.querySelectorAll('.weather').forEach(x => x.classList.toggle('active', x === b));
    });
    document.querySelectorAll('.time-mode').forEach(b => b.onclick = () => {
      state.minute = b.dataset.mode === 'day' ? 720 : 1320;
    });
    $('#ask-agent').onclick = askSelected;
    $('#agent-question').onkeydown = e => { if (e.key === 'Enter') askSelected(); };
    mount.onpointerdown = e => { dragging = true; lastX = e.clientX; };
    addEventListener('pointerup', () => dragging = false);
    addEventListener('pointermove', e => {
      if (dragging) { yaw += (e.clientX - lastX) * .004; lastX = e.clientX; }
    });
    mount.onclick = e => {
      if (dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        (e.clientX - rect.left) / rect.width * 2 - 1,
        -(e.clientY - rect.top) / rect.height * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(meshes, true).find(x => x.object.parent?.userData?.id || x.object.userData?.id);
      if (hit) {
        let g = hit.object;
        while (g && !g.userData.id) g = g.parent;
        if (g) { selected = g.userData.id; renderAgentList(); renderDetail(); }
      }
    };
  }

  function loop(now = performance.now()) {
    requestAnimationFrame(loop);
    const dt = Math.min(100, now - last);
    last = now;
    simAccum += dt;
    if (simAccum > 700) {
      if (state.mode !== 'replay') A.tickAgents(state, 1);
      simAccum = 0;
      renderAgentList();
      renderDetail();
      renderEvents();
    }
    if (now - directorChanged > 24000 && !dragging) {
      directorIndex = (directorIndex + 1) % 5;
      directorChanged = now;
    }
    const m = meshes[directorIndex];
    const focus = new THREE.Vector3(m.position.x, 1.35, m.position.z);
    const dist = innerWidth < 680 ? 6.4 : 8.4;
    const desired = new THREE.Vector3(
      focus.x + Math.sin(yaw) * dist,
      focus.y + 2.5,
      focus.z + Math.cos(yaw) * dist
    );
    camera.position.lerp(desired, .055);
    camera.lookAt(focus);
    updateScene(now);
    renderer.render(scene, camera);
  }

  renderAgentList();
  renderDetail();
  renderLaws();
  renderEvents();
  renderSocial();
  setInterval(syncCity, 15000);
  syncCity();
  try { init(); }
  catch (e) {
    $('#webgl-fallback').style.display = 'block';
    $('#webgl-fallback').textContent = 'WebGL saknas — textläget är aktivt.';
  }
})();
