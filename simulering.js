(() => {
  const mount = document.querySelector('#city-canvas');
  if (!mount || !window.CityAgents || !window.THREE) return;
  const A = window.CityAgents, Memory = window.CityMemory, $ = s => document.querySelector(s);
  const CITY_API = 'https://5.175.249.12.nip.io/city/api/city';
  const state = A.createSimulationState();
  A.askQwen = async () => null;
  let scene, camera, renderer, city, rain, snow, sun, moon, ambient, hemi, rim, skyMesh, skyMat, waterMesh, waterMat;
  let selected = state.selected, yaw = 0.18, dragging = false, lastX = 0, last = performance.now(), simAccum = 0;
  let meshes = [], colliders = [], lamps = [], windowLights = [], lastSocial = 0, lastSync = 0;
  let directorIndex = 0, directorChanged = performance.now(), dust, fireflies, stars, sunMesh, moonMesh, plazaGlow;
  let talkLines = null;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mat = (c, rough = .78, metal = .05, opts = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, ...opts });
  const emissiveMat = (c, e, intensity = .55) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: intensity, roughness: .38, metalness: .08 });

  function canvasTex(size, draw, repeatX = 1, repeatY = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 8;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    t.needsUpdate = true;
    return t;
  }

  const texCobble = canvasTex(256, (g, s) => {
    g.fillStyle = '#2a3b4e'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 14) {
      const ox = (y / 14) % 2 ? 8 : 0;
      for (let x = -10; x < s; x += 18) {
        g.fillStyle = `rgb(${40 + ((x * 13 + y * 7) % 28)},${55 + ((x + y) % 22)},${70 + ((x * 3) % 18)})`;
        g.fillRect(x + ox + 1, y + 1, 15, 11);
      }
    }
  }, 8, 8);
  const texGrass = canvasTex(256, (g, s) => {
    g.fillStyle = '#1a3a2e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = i % 4 ? '#245c43' : '#2f7a56';
      g.fillRect((i * 37) % s, (i * 91) % s, 2, 3 + (i % 4));
    }
  }, 6, 6);
  const texRoad = canvasTex(128, (g, s) => {
    g.fillStyle = '#1c2636'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#c9a86a'; g.lineWidth = 3; g.setLineDash([10, 10]);
    g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.stroke();
  }, 1, 10);
  const texBrick = canvasTex(128, (g, s) => {
    g.fillStyle = '#3d4558'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 10) {
      const ox = (y / 10) % 2 ? 8 : 0;
      for (let x = -8; x < s; x += 16) {
        g.fillStyle = `rgb(${55 + ((x + y) % 18)},${48 + (x % 12)},${58 + (y % 14)})`;
        g.fillRect(x + ox + 1, y + 1, 14, 8);
      }
    }
  }, 4, 3);

  const add = (o, p = [0, 0, 0], parent = city) => {
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
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .02;
    shadow.castShadow = false;
    parent.add(shadow);
    return shadow;
  }

  function pane(group, x, y, z, w = .36, h = .4) {
    const dayMat = new THREE.MeshStandardMaterial({ color: 0xc5def0, roughness: .12, metalness: .28 });
    const nightMat = emissiveMat(0xffc978, 0xffb14a, 1.05);
    const glass = box(w, h, .04, dayMat, [x, y, z], group);
    glass.userData.window = true;
    glass.userData.dayMat = dayMat;
    glass.userData.nightMat = nightMat;
    windowLights.push(glass);
    box(w + .05, .035, .05, 0x24324a, [x, y + h + .01, z], group, .7);
    return glass;
  }

  function signband(group, text, y, z, accent, width) {
    box(width, .34, .08, accent, [0, y, z], group, .5);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#0c121c'; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#f3c98b';
    g.font = '700 34px "Avenir Next", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 34);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * .92, .26), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    mesh.position.set(0, y + .17, z - .05);
    mesh.castShadow = false;
    group.add(mesh);
  }

  function furnish(group, kind, w, d) {
    const wood = 0x6a4a32, cloth = 0x355a6e;
    if (kind === 'library') {
      for (let x = -w / 2 + .55; x < w / 2 - .4; x += .7) {
        box(.42, 1.55, .28, 0x4a3428, [x, .28, -d / 2 + .45], group, .85);
        box(.38, .08, .26, 0xc4a36a, [x, .7, -d / 2 + .45], group);
        box(.38, .08, .26, 0x7a3040, [x, 1.05, -d / 2 + .45], group);
      }
      box(1.5, .08, .7, wood, [0, .72, .2], group, .8);
      box(.12, .72, .12, wood, [-.65, .28, .45], group);
      box(.12, .72, .12, wood, [.65, .28, -.05], group);
    } else if (kind === 'workshop') {
      box(2.2, .12, .8, 0x4a5568, [0, .78, 0], group, .45);
      box(.4, .55, .4, 0x2a3344, [-.9, .28, .4], group);
      box(.55, .35, .4, 0x6b4a32, [.8, .28, -.2], group, .85);
      cyl(.08, .08, 1.1, 0x8899aa, [.7, .28, .35], group, 8);
    } else if (kind === 'school') {
      for (let i = -1; i <= 1; i++) {
        box(.7, .08, .45, wood, [i * .85, .62, .15], group, .8);
        box(.12, .62, .12, wood, [i * .85 - .25, .28, .3], group);
      }
      box(1.6, .9, .06, 0x2a4a3c, [0, .7, -d / 2 + .2], group);
    } else if (kind === 'hall') {
      box(2.4, .1, .9, 0x3a2a22, [0, .78, .1], group, .7);
      cyl(.16, .2, .78, 0xc4a36a, [0, .28, -.7], group, 10);
      box(.55, .08, .55, 0x1c2736, [0, 1.06, -.7], group);
    } else if (kind === 'cafe') {
      box(1.4, .7, .4, 0x4a3228, [0, .28, -.35], group, .7);
      cyl(.28, .28, .08, 0xf0e6d8, [-.55, .72, .45], group, 16);
      cyl(.28, .28, .08, 0xf0e6d8, [.55, .72, .45], group, 16);
      cyl(.04, .04, .72, 0xddd4c4, [-.55, .28, .45], group, 8);
    } else if (kind === 'home') {
      box(.95, .14, .55, wood, [0, .42, .05], group, .8);
      box(.9, .08, .5, cloth, [0, .56, .05], group, .9);
      box(.22, .16, .18, 0xe8d8c8, [0, .62, -.18], group);
    }
  }

  function civic({ x, z, w, d, h, wall, accent, label, interior, openSouth = true }) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    city.add(group);
    box(w + .4, .2, d + .4, 0x1a2436, [0, 0, 0], group, .92);
    const brick = mat(wall, .82, .04, { map: texBrick });
    box(w, .18, d, brick, [0, .2, 0], group);
    box(.18, h, d, brick, [-w / 2 + .09, .38, 0], group);
    box(.18, h, d, brick, [w / 2 - .09, .38, 0], group);
    box(w, h, .18, brick, [0, .38, -d / 2 + .09], group);
    if (openSouth) {
      box(.22, h, .22, brick, [-w / 2 + .12, .38, d / 2 - .1], group);
      box(.22, h, .22, brick, [w / 2 - .12, .38, d / 2 - .1], group);
      box(w, .55, .14, brick, [0, .38, d / 2 - .07], group);
      box(w + .08, .1, .2, accent, [0, .38 + h - .08, d / 2 - .04], group, .6);
    } else {
      box(w, h * .62, .16, brick, [0, .38, d / 2 - .08], group);
    }
    box(w + .2, .12, d + .2, accent, [0, .38 + h, 0], group, .62);
    box(w - .2, .08, d - .2, 0x1a2436, [0, .5 + h, 0], group, .9);
    const deck = box(w - .5, .035, d - .5, accent, [0, .46 + h, 0], group, .65);
    deck.castShadow = false;
    const floor = box(w - .36, .05, d - .3, 0x3a4d62, [0, .22, .02], group, .88);
    floor.castShadow = false;
    furnish(group, interior, w, d);
    for (let y = 1.15; y < h - .15; y += 1.05) {
      for (let xx = -w / 2 + .85; xx < w / 2 - .55; xx += 1.15) pane(group, xx, y, -d / 2 - .02);
    }
    signband(group, label, 1.42, d / 2 + .02, accent, Math.min(w - .7, 3.8));
    box(1.4, .14, .7, 0x2a3648, [0, 0, d / 2 + .4], group, .85);
    box(1.1, .14, .55, 0x323e52, [0, .14, d / 2 + .28], group, .85);
    colliders.push({ x, z, w: w + .5, d: d + .5 });
    return group;
  }

  function townhouse(x, z, wall, accent) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    city.add(group);
    const w = 2.55, d = 2.35, h = 2.2;
    box(w + .28, .16, d + .5, 0x1a2436, [0, 0, -.15], group, .92);
    const brick = mat(wall, .8, .04, { map: texBrick });
    box(w, h, d, brick, [0, .16, 0], group);
    box(w + .14, .1, d + .14, accent, [0, h + .12, 0], group, .6);
    box(w - .18, .07, d - .18, 0x1a2436, [0, h + .2, 0], group, .9);
    furnish(group, 'home', w, d);
    pane(group, -.45, 1.25, d / 2 + .02, .32, .36);
    pane(group, .45, 1.25, d / 2 + .02, .32, .36);
    box(.42, .95, .08, 0x1c2638, [0, .16, -d / 2 - .02], group, .55);
    sphere(.035, emissiveMat(0xf5c878, 0xf5c878, .9), [.12, .62, -d / 2 - .08], group);
    box(1.7, .08, .85, 0x3a3228, [0, .32, -d / 2 - .55], group, .85);
    box(.08, .34, .08, 0x2a3344, [-.75, 0, -d / 2 - .85], group);
    box(.08, .34, .08, 0x2a3344, [.75, 0, -d / 2 - .85], group);
    box(.55, .08, .12, accent, [0, 1.55, -d / 2 - .04], group);
    colliders.push({ x, z, w: w + .3, d: d + .3 });
    return group;
  }

  function tree(x, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    city.add(g);
    softShadow(g, .5 * scale, .2);
    cyl(.08 * scale, .13 * scale, 1.0 * scale, 0x4a3428, [0, 0, 0], g, 8);
    const canopy = (r, y, col, ox = 0, oz = 0) => {
      const s = sphere(r * scale, col, [ox * scale, y * scale, oz * scale], g, 11);
      s.material.roughness = .94;
      return s;
    };
    canopy(.62, 1.5, 0x1f4f42);
    canopy(.44, 2.0, 0x2d6b55, -.18, .1);
    canopy(.38, 1.9, 0x3a7d62, .2, -.12);
    canopy(.24, 2.28, 0x4a9474, .04, .1);
    g.userData.sway = Math.random() * 6.28;
    return g;
  }

  function lamp(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    city.add(g);
    softShadow(g, .26, .16);
    cyl(.05, .07, .14, 0x3a465c, [0, 0, 0], g, 8);
    cyl(.03, .034, 2.35, 0x4a566c, [0, .14, 0], g, 8);
    box(.42, .04, .08, 0x2a3344, [.12, 2.42, 0], g);
    const bulb = sphere(.1, new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), [.28, 2.38, 0], g, 12);
    bulb.castShadow = false;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .22, depthWrite: false }));
    glow.position.set(.28, 2.38, 0);
    g.add(glow);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(.7, 24), new THREE.MeshBasicMaterial({ color: 0xffc878, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(.28, .03, 0);
    g.add(halo);
    const l = new THREE.PointLight(0xffc878, 1.25, 7.2, 1.7);
    l.position.set(.28, 2.38, 0);
    g.add(l);
    lamps.push({ light: l, bulb, glow, halo });
  }

  function planter(x, z, color = 0xd18a52) {
    box(.7, .4, .52, color, [x, 0, z], city, .7);
    box(.66, .1, .48, 0x3d6b4f, [x, .4, z], city, .95);
    sphere(.2, 0x3a8a62, [x, .7, z], city, 10);
    sphere(.12, 0x4fa574, [x + .12, .76, z - .04], city, 8);
  }

  function bench(x, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    city.add(g);
    box(1.2, .08, .38, 0x5c4030, [0, .38, 0], g, .85);
    box(1.2, .32, .06, 0x5c4030, [0, .55, -.16], g, .85);
    box(.08, .38, .08, 0x2a3344, [-.5, 0, .12], g);
    box(.08, .38, .08, 0x2a3344, [.5, 0, .12], g);
    box(.08, .38, .08, 0x2a3344, [-.5, 0, -.12], g);
    box(.08, .38, .08, 0x2a3344, [.5, 0, -.12], g);
  }

  function stall(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    city.add(g);
    box(1.5, .08, .7, 0x6b4a32, [0, .75, 0], g, .8);
    box(.08, .75, .08, 0x3a3228, [-.65, 0, .25], g);
    box(.08, .75, .08, 0x3a3228, [.65, 0, .25], g);
    box(.08, .75, .08, 0x3a3228, [-.65, 0, -.25], g);
    box(.08, .75, .08, 0x3a3228, [.65, 0, -.25], g);
    const cloth = box(1.7, .04, .9, emissiveMat(0xec8fa0, 0x7a3040, .12), [0, 1.35, 0], g);
    cloth.castShadow = false;
    box(.22, .18, .22, 0xc45c4a, [-.35, .83, .1], g);
    box(.18, .14, .18, 0xe8d08a, [.3, .83, -.05], g);
  }

  function bike(x, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    city.add(g);
    const hoop = (ox) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(.22, .025, 8, 16), mat(0x1a1f2e, .4, .6));
      t.position.set(ox, .22, 0);
      t.rotation.y = Math.PI / 2;
      g.add(t);
    };
    hoop(-.28); hoop(.28);
    box(.58, .03, .03, 0x2a3344, [0, .34, 0], g);
    box(.03, .28, .03, 0x2a3344, [.18, .22, 0], g);
  }

  function nameplate(name, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 72;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(8,12,20,0.84)';
    g.beginPath();
    const r = 16;
    g.moveTo(r, 8); g.lineTo(256 - r, 8); g.quadraticCurveTo(248, 8, 248, 8 + r);
    g.lineTo(248, 64 - r); g.quadraticCurveTo(248, 64, 256 - r, 64);
    g.lineTo(r, 64); g.quadraticCurveTo(8, 64, 8, 64 - r);
    g.lineTo(8, 8 + r); g.quadraticCurveTo(8, 8, r, 8); g.closePath();
    g.fill();
    g.strokeStyle = color; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#f4f7fb';
    g.font = '700 30px "Avenir Next", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, 128, 38);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    spr.scale.set(1.5, .42, 1);
    spr.position.set(0, 2.62, 0);
    spr.renderOrder = 20;
    spr.castShadow = false;
    return spr;
  }

  function limb(parent, x, y, color) {
    const upper = new THREE.Group();
    upper.position.set(x, y, 0);
    parent.add(upper);
    box(.12, .44, .13, color, [0, -.22, 0], upper);
    sphere(.08, 0xe0a888, [0, -.46, 0], upper, 10);
    box(.11, .34, .12, color, [0, -.64, 0], upper);
    sphere(.07, 0xe0a888, [0, -.84, 0], upper, 10);
    return upper;
  }


  function makeAvatar(agent) {
    const g = new THREE.Group();
    g.userData.id = agent.id;
    const p0 = A.slotOf(agent, agent.place);
    g.position.set(p0[0], 0, p0[1]);
    softShadow(g, .4, .34);
    const dark = mat(0x1a1f2e, .95);
    const pants = mat(agent.id === 'august' ? 0x2a3e55 : 0x1c2a3e, .82);
    const shirt = mat(agent.color, .58, .08);
    const skin = mat(0xe0a888, .9);
    box(.56, .7, .34, shirt, [0, .72, 0], g);
    box(.62, .14, .36, shirt, [0, 1.1, 0], g);
    if (agent.id === 'liv') box(.6, .55, .32, shirt, [0, .55, 0], g);
    if (agent.id === 'noor') {
      box(.62, .12, .38, 0xc45c6e, [0, 1.18, 0], g);
      box(.12, .4, .08, 0xc45c6e, [.28, .78, .12], g);
    }
    if (agent.id === 'elias') box(.5, .42, .3, 0xd4b48a, [0, .85, .02], g, .7);
    if (agent.id === 'august') box(.58, .28, .36, 0x3d5a78, [0, .95, 0], g);
    cyl(.08, .09, .12, skin, [0, 1.34, 0], g, 10);
    sphere(.28, skin, [0, 1.7, 0], g, 16);
    sphere(.055, mat(0xd9927a, .9), [-.17, 1.64, .17], g, 8);
    sphere(.055, mat(0xd9927a, .9), [.17, 1.64, .17], g, 8);
    const hair = agent.id === 'mira' ? 'bun' : agent.id === 'elias' ? 'side' : agent.id === 'noor' ? 'curls' : agent.id === 'liv' ? 'bob' : 'short';
    if (hair === 'bun') {
      sphere(.27, dark, [0, 1.84, 0], g, 12);
      sphere(.11, dark, [.18, 1.98, -.02], g, 10);
    } else if (hair === 'curls') {
      for (let i = -1; i <= 1; i++) {
        sphere(.12, dark, [i * .17, 1.9, 0], g, 10);
        sphere(.1, dark, [i * .15, 1.76, -.12], g, 8);
      }
    } else {
      const cap = sphere(.29, dark, [0, 1.86, 0], g, 12);
      cap.scale.set(1, .48, 1.02);
      if (hair === 'side') sphere(.14, dark, [-.24, 1.8, .02], g, 10);
      if (hair === 'bob') { sphere(.15, dark, [-.24, 1.66, 0], g, 10); sphere(.15, dark, [.24, 1.66, 0], g, 10); }
    }
    const eye = (s, col) => { const e = sphere(.042, col, s, g, 8); e.material = new THREE.MeshBasicMaterial({ color: col }); return e; };
    eye([-.085, 1.72, .25], 0xf5f0ea); eye([.085, 1.72, .25], 0xf5f0ea);
    eye([-.085, 1.72, .285], 0x1a1520); eye([.085, 1.72, .285], 0x1a1520);
    if (agent.id === 'elias') box(.22, .02, .02, 0x1a1f2e, [0, 1.73, .29], g);
    box(.075, .016, .018, 0x1a1f2e, [-.085, 1.8, .26], g).rotation.z = .15;
    box(.075, .016, .018, 0x1a1f2e, [.085, 1.8, .26], g).rotation.z = -.15;
    box(.075, .015, .015, mat(0xc47868), [0, 1.58, .27], g);
    const la = limb(g, -.36, 1.12, agent.color);
    const ra = limb(g, .36, 1.12, agent.color);
    const ll = box(.17, .56, .18, pants, [-.15, .05, 0], g);
    const rl = box(.17, .56, .18, pants, [.15, .05, 0], g);
    box(.2, .09, .3, 0x0e121c, [-.15, 0, .07], g);
    box(.2, .09, .3, 0x0e121c, [.15, 0, .07], g);
    if (agent.id === 'mira') box(.12, .04, .16, 0x4a3428, [.32, 1.0, .12], g);
    if (agent.id === 'august') box(.05, .28, .05, 0x8899aa, [-.42, .95, .08], g);
    const key = new THREE.PointLight(agent.color, .7, 4.2, 2);
    key.position.set(0, 1.6, .3);
    g.add(key);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.38, .52, 40), new THREE.MeshBasicMaterial({ color: agent.color, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
    const outer = new THREE.Mesh(new THREE.RingGeometry(.54, .66, 40), new THREE.MeshBasicMaterial({ color: agent.color, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = .032; g.add(outer);
    const plate = nameplate(agent.name, agent.color);
    g.add(plate);
    g.scale.setScalar(1.22);
    g.userData.parts = { la, ra, ll, rl, ring, outer, key, plate, phase: Math.random() * 6.28 };
    g.userData.target = new THREE.Vector3(p0[0], 0, p0[1]);
    city.add(g);
    return g;
  }

  function fountain() {
    cyl(2.45, 2.65, .2, 0x2a4258, [0, .12, -1.55], city, 42);
    waterMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, night: { value: 0 } },
      transparent: true,
      vertexShader: 'uniform float t; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; p.z += sin(uv.x*14.0+t)*0.045+cos(uv.y*11.0+t*1.2)*0.03; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
      fragmentShader: 'uniform float t; uniform float night; varying vec2 vUv; void main(){ float w=sin(vUv.x*20.0+t*2.2)*0.5+0.5; vec3 a=vec3(0.22,0.62,0.70); vec3 b=vec3(0.62,0.90,0.92); vec3 col=mix(a,b,w); col=mix(col, vec3(0.12,0.28,0.42), night); gl_FragColor=vec4(col, 0.9); }'
    });
    waterMesh = new THREE.Mesh(new THREE.CircleGeometry(2.18, 48), waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, .34, -1.55);
    waterMesh.receiveShadow = true;
    city.add(waterMesh);
    cyl(.5, .64, .52, 0x2f4a60, [0, .34, -1.55], city, 20);
    cyl(.24, .32, .66, 0x35556c, [0, .82, -1.55], city, 16);
    sphere(.12, emissiveMat(0xa8e8ec, 0x7ad4da, .7), [0, 1.52, -1.55], city, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sphere(.045, emissiveMat(0xf3c98b, 0xf3c98b, .55), [Math.cos(a) * 2.15, .4, -1.55 + Math.sin(a) * 2.15], city, 8);
    }
  }

  function buildCity() {
    city = new THREE.Group();
    scene.add(city);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 34), mat(0x16352c, .95, .02, { map: texGrass }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -1); ground.receiveShadow = true; city.add(ground);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(5.4, 56), mat(0x2a3d52, .88, .04, { map: texCobble }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, .07, -0.4); plaza.receiveShadow = true; city.add(plaza);
    const plazaRing = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.4, 56), mat(0x3a5268, .65, .08));
    plazaRing.rotation.x = -Math.PI / 2; plazaRing.position.set(0, .08, -0.4); city.add(plazaRing);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 26), mat(0x222e40, .92, .04, { map: texRoad }));
    roadZ.rotation.x = -Math.PI / 2; roadZ.position.set(0, .075, -1); roadZ.receiveShadow = true; city.add(roadZ);
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(28, 2.7), mat(0x222e40, .92, .04));
    roadX.rotation.x = -Math.PI / 2; roadX.position.set(0, .074, -2.2); roadX.receiveShadow = true; city.add(roadX);

    civic({ x: -7.4, z: -8.25, w: 5.8, d: 3.05, h: 3.35, wall: 0x2f4a68, accent: 0x1e334c, label: 'BIBLIOTEK', interior: 'library' });
    civic({ x: 7.4, z: -8.25, w: 5.8, d: 3.05, h: 3.05, wall: 0x4e3a4e, accent: 0x3a2a3c, label: 'VERKSTAD', interior: 'workshop' });
    civic({ x: 0, z: -8.15, w: 5.3, d: 3.1, h: 3.2, wall: 0x5a4248, accent: 0x423238, label: 'RÅDHUS', interior: 'hall' });
    civic({ x: -7.4, z: -1.85, w: 5.2, d: 2.85, h: 2.7, wall: 0x355a6e, accent: 0x244454, label: 'SKOLA', interior: 'school' });
    civic({ x: 0, z: 3.85, w: 3.05, d: 2.15, h: 1.7, wall: 0x4a3a32, accent: 0x352820, label: 'CAFÉ', interior: 'cafe', openSouth: false });

    const houseColors = [[0x2a4a48, 0x1c3634], [0x4a3a32, 0x352820], [0x3a3a55, 0x2a2a40], [0x4a3240, 0x352030], [0x2a3a50, 0x1c2838]];
    A.HOME_X.forEach((x, i) => townhouse(x, 7.15, houseColors[i][0], houseColors[i][1]));

    fountain();
    const trees = [];
    for (let x = -13; x <= 13; x += 4.4) {
      trees.push(tree(x, 10.4, .88 + (Math.abs(x) % 3) * .07));
      if (Math.abs(x) > 4) trees.push(tree(x, -12.2, .82));
    }
    trees.push(tree(-4.8, 2.3, .68), tree(4.8, 2.3, .72), tree(-10.4, -4.2, .78), tree(10.4, -4.2, .78), tree(-3.2, -4.6, .55), tree(3.2, -4.6, .55));
    city.userData.trees = trees;
    for (let x = -12; x <= 12; x += 6) { lamp(x, 1.6); lamp(x, -9.4); }
    lamp(-4.2, 4.2); lamp(4.2, 4.2);
    for (let x = -3.4; x <= 3.4; x += 1.7) planter(x, 1.85);
    bench(-3.4, 0.05, .25); bench(3.4, 0.05, -.25); bench(-2.2, 1.15, 0);
    stall(-4.6, 3.3); bike(5.2, 3.6, .4); bike(5.7, 3.85, -.2);
    for (let i = 0; i < 4; i++) {
      box(.7, .28, .7, 0x6b4a32, [6.6 + (i % 2) * .85, 0, 0.35 + Math.floor(i / 2) * .9], city, .85);
      box(.64, .16, .64, 0x3d7a52, [6.6 + (i % 2) * .85, .28, 0.35 + Math.floor(i / 2) * .9], city, .95);
      sphere(.16, 0x4fa574, [6.6 + (i % 2) * .85, .56, 0.35 + Math.floor(i / 2) * .9], city, 8);
    }
    box(42, 2.8, 2.2, 0x0a121c, [0, 0, -16.4], city, 1);
    box(8, 4.2, 2, 0x0c1520, [-13, 0, -15.8], city, 1);
    box(6.5, 3.4, 2, 0x0b141e, [12, 0, -15.8], city, 1);
    talkLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .85 }));
    talkLines.frustumCulled = false;
    city.add(talkLines);
    state.agents.forEach(a => meshes.push(makeAvatar(a)));
    createAtmosphere();
  }

  function createAtmosphere() {
    const rainGeo = new THREE.BufferGeometry(); const rainPos = [];
    for (let i = 0; i < 480; i++) rainPos.push((Math.random() - .5) * 32, Math.random() * 12, (Math.random() - .5) * 26 - 3);
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
    rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xb8d8f0, size: .045, transparent: true, opacity: .55, depthWrite: false }));
    rain.visible = false; scene.add(rain);
    const snowGeo = new THREE.BufferGeometry(); const snowPos = [];
    for (let i = 0; i < 300; i++) snowPos.push((Math.random() - .5) * 32, Math.random() * 11, (Math.random() - .5) * 26 - 3);
    snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
    snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xf0f6ff, size: .08, transparent: true, opacity: .75, depthWrite: false }));
    snow.visible = false; scene.add(snow);
    const dustGeo = new THREE.BufferGeometry(); const dustPos = [];
    for (let i = 0; i < 90; i++) dustPos.push((Math.random() - .5) * 20, .5 + Math.random() * 5, (Math.random() - .5) * 16);
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe8c0, size: .032, transparent: true, opacity: .22, depthWrite: false }));
    scene.add(dust);
    const ffGeo = new THREE.BufferGeometry(); const ffPos = [];
    for (let i = 0; i < 48; i++) ffPos.push((Math.random() - .5) * 18, .4 + Math.random() * 3, (Math.random() - .5) * 14);
    ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(ffPos, 3));
    fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xc8f5a0, size: .07, transparent: true, opacity: .7, depthWrite: false }));
    fireflies.visible = false; scene.add(fireflies);
    const starGeo = new THREE.BufferGeometry(); const starPos = [];
    for (let i = 0; i < 420; i++) {
      const a = Math.random() * Math.PI * 2, h = 8 + Math.random() * 22, r = 20 + Math.random() * 16;
      starPos.push(Math.cos(a) * r, h, Math.sin(a) * r - 6);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe8f0ff, size: .06, transparent: true, opacity: .0, depthWrite: false }));
    scene.add(stars);
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false,
      uniforms: { top: { value: new THREE.Color(0x6a9db0) }, mid: { value: new THREE.Color(0x8fb4c4) }, bot: { value: new THREE.Color(0x1a2838) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h=normalize(vP).y; vec3 col=mix(bot, mid, smoothstep(-0.25,0.18,h)); col=mix(col, top, smoothstep(0.18,0.72,h)); gl_FragColor=vec4(col,1.0); }'
    });
    skyMesh = new THREE.Mesh(new THREE.SphereGeometry(52, 28, 18), skyMat);
    scene.add(skyMesh);
    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(.7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe6b0 }));
    scene.add(sunMesh);
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd0dcec }));
    scene.add(moonMesh);
  }

  function addSocial(a, b, text) {
    const line = text || a.dialog || `${a.name} pratar med ${b.name}.`;
    (state.social_log ||= []).unshift({ time: A.clock(state.minute), from: a.name, to: b.name, text: `${a.name} → ${b.name}: ${line}` });
    state.social_log = state.social_log.slice(0, 12);
    Memory?.rememberConversation(a, b.name, line);
    Memory?.rememberConversation(b, a.name, b.dialog || line);
    renderSocial();
  }

  function renderSocial() {
    const el = $('#social-log');
    if (!el) return;
    const rows = (state.social_log || []).slice(0, 8);
    el.innerHTML = rows.map(x => `<div class="social-line"><time>${x.time}</time><span>${x.text}</span></div>`).join('')
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
    const spoken = agent.dialog || agent._dialog || agent.thought;
    el.innerHTML = kind === 'thought' ? `<i>· · ·</i><span>${agent.thought}</span>` : `<b>${agent.name}</b><span>${spoken}</span>`;
    const m = meshes[state.agents.indexOf(agent)];
    if (!m) return;
    const v = new THREE.Vector3(m.position.x, 2.55, m.position.z);
    v.project(camera);
    el.style.left = `${(v.x * .5 + .5) * mount.clientWidth}px`;
    el.style.top = `${(-v.y * .5 + .5) * mount.clientHeight}px`;
    el.style.display = (v.z > -1 && v.z < 1) ? 'grid' : 'none';
  }

  function renderAgentList() {
    const list = $('#agent-list');
    list.innerHTML = state.agents.map(a =>
      `<button class="agent-card ${a.id === selected ? 'selected' : ''}" data-id="${a.id}" style="--agent-color:${a.color};--need:${100 - a.needs.sleep}%"><span class="agent-orb"></span><strong>${a.name}</strong><small>${a.actionLabel}</small><span class="agent-mood">${a.mood || ''}</span><span class="agent-status"><i></i></span></button>`
    ).join('');
    list.querySelectorAll('.agent-card').forEach(x => x.onclick = () => { selected = x.dataset.id; renderAgentList(); renderDetail(); });
    $('#active-count').textContent = `${state.agents.filter(a => a.action !== 'sleep').length} vakna`;
  }

  function renderDetail() {
    const a = state.agents.find(x => x.id === selected) || state.agents[0];
    $('#question-name').textContent = a.name;
    const rel = a.relationships || a.relationship || {};
    const relHtml = Object.entries(rel).map(([id, v]) => {
      const other = state.agents.find(x => x.id === id);
      const pct = Math.max(0, Math.min(100, 50 + Number(v)));
      return `<span class="rel-row"><b>${other ? other.name : id}</b><i style="--value:${pct}%;--agent-color:${a.color}"></i></span>`;
    }).join('');
    $('#agent-detail-content').innerHTML =
      `<div class="agent-hero"><span class="agent-orb" style="--agent-color:${a.color}"></span><div><h2>${a.name}</h2><p>${a.role} · ${a.trait}</p></div></div>` +
      `<div class="thought">“${a.thought}”</div>` +
      `<div class="needs">${Object.entries(a.needs).map(([k, v]) =>
        `<span class="need" style="--agent-color:${a.color};--value:${v}%"><b>${({ sleep: 'sömn', hunger: 'mat', social: 'socialt', curiosity: 'nyfiken', purpose: 'mening' })[k]}</b><i></i></span>`
      ).join('')}</div>` +
      `<p class="panel-meta place-pill">${a.actionLabel} · ${A.PLACE_SV[a.place] || a.place} · ${a.mood || ''}</p>` +
      `<div class="rel-block"><span class="panel-label">Relationer</span><div class="rels">${relHtml}</div></div>`;
  }

  function renderLaws() {
    $('#law-list').innerHTML = state.laws.map(l =>
      `<div class="law"><div class="law-title">${l.title}</div><div class="law-meta"><span>${l.author} · ${l.status}</span><span class="law-vote" data-law="${l.id}">Ja ${l.yes} · Nej ${l.no}</span></div></div>`
    ).join('');
  }
  function renderEvents() {
    $('#event-list').innerHTML = state.events.slice(0, 6).map(e => `<div class="event"><time>${e.time}</time><span>${e.text}</span></div>`).join('');
  }
  function renderDirector() {
    const sceneInfo = state.scene || A.sceneStory(state);
    $('#scene-title').textContent = sceneInfo.title;
    $('#scene-copy').textContent = sceneInfo.copy;
    const hour = A.hourOf(state.minute);
    const night = hour >= 21 || hour < 5.5;
    const dusk = !night && (hour < 8 || hour >= 17);
    $('#scene-day').textContent = `DAG ${state.day} · ${(sceneInfo.phase || (night ? 'natt' : dusk ? 'skymning' : 'dag')).toUpperCase()}`;
  }

  function avoidFountain(x, z) {
    const dx = x - 0, dz = z + 1.55, d = Math.hypot(dx, dz);
    if (d < 2.55 && d > 0.01) { const s = 2.55 / d; return [dx * s, -1.55 + dz * s]; }
    return [x, z];
  }

  function updateAtmosphere(now, night, solar) {
    if (rain.visible) {
      const pos = rain.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) { pos[i] -= 0.18 * state.speed; if (pos[i] < 0) pos[i] = 11; }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    if (snow.visible) {
      const pos = snow.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += Math.sin(now / 800 + i) * .008; pos[i + 1] -= 0.04 * state.speed; if (pos[i + 1] < 0) pos[i + 1] = 10;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
    if (dust) {
      dust.visible = !night && state.weather === 'clear';
      dust.material.opacity = .12 + solar * .18;
      const pos = dust.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) { pos[i] += Math.sin(now / 2000 + i) * .004; pos[i + 1] += Math.cos(now / 1800 + i * .1) * .003; }
      dust.geometry.attributes.position.needsUpdate = true;
    }
    if (fireflies) {
      fireflies.visible = night && state.weather === 'clear';
      const pos = fireflies.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += Math.sin(now / 600 + i) * .012; pos[i + 1] += Math.cos(now / 700 + i) * .01; pos[i + 2] += Math.sin(now / 900 + i * .3) * .01;
      }
      fireflies.geometry.attributes.position.needsUpdate = true;
      fireflies.material.opacity = .45 + Math.sin(now / 400) * .25;
    }
    if (stars) stars.material.opacity = night ? .85 : 0;
    (city.userData.trees || []).forEach((t, i) => { t.rotation.z = Math.sin(now / 1400 + (t.userData.sway || i)) * .025; });
    windowLights.forEach((w, i) => {
      if (!w.userData.window) return;
      w.material = (night || (solar < .25 && i % 3 !== 0)) ? w.userData.nightMat : w.userData.dayMat;
    });
    lamps.forEach((L, i) => {
      const pulse = night ? 1.7 + Math.sin(now / 500 + i) * .18 : .18;
      L.light.intensity = night ? pulse : .22;
      L.glow.material.opacity = night ? .28 + Math.sin(now / 450 + i) * .06 : .04;
      L.halo.material.opacity = night ? .17 : .03;
      L.bulb.material.color.setHex(night ? 0xffe0a0 : 0xd0c8b0);
    });
    if (waterMat) { waterMat.uniforms.t.value = now / 400; waterMat.uniforms.night.value = night ? 1 : 0; }
  }

  function updateTalkLines() {
    if (!talkLines) return;
    const positions = [], colors = [];
    const col = new THREE.Color();
    state.agents.forEach((a, i) => {
      if (!a.talking_with) return;
      const bIndex = state.agents.findIndex(x => x.id === a.talking_with);
      if (bIndex <= i) return;
      const ma = meshes[i], mb = meshes[bIndex];
      if (!ma || !mb) return;
      positions.push(ma.position.x, 1.6, ma.position.z, mb.position.x, 1.6, mb.position.z);
      col.set(a.color); colors.push(col.r, col.g, col.b);
      col.set(state.agents[bIndex].color); colors.push(col.r, col.g, col.b);
    });
    if (!positions.length) { talkLines.visible = false; return; }
    talkLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    talkLines.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    talkLines.geometry.computeBoundingSphere();
    talkLines.visible = true;
  }

  function updateScene(now) {
    const dtFactor = Math.min(2.2, state.speed);
    state.agents.forEach((a, i) => {
      const m = meshes[i];
      if (!m) return;
      const target = Array.isArray(a.target) ? a.target : A.slotOf(a, a.place);
      let x = lerp(m.position.x, target[0], 0.045 * dtFactor);
      let z = lerp(m.position.z, target[1], 0.045 * dtFactor);
      [x, z] = avoidFountain(x, z);
      const dx = target[0] - m.position.x, dz = target[1] - m.position.z;
      const dist = Math.hypot(dx, dz);
      const moving = dist > .12 && a.action !== 'sleep';
      m.position.x = x; m.position.z = z;
      let desiredYaw = m.rotation.y;
      if (a.talking_with) {
        const other = meshes.find(n => n.userData.id === a.talking_with);
        if (other) desiredYaw = Math.atan2(other.position.x - m.position.x, other.position.z - m.position.z);
      } else if (moving && dist > 0) desiredYaw = Math.atan2(dx, dz);
      let dy = desiredYaw - m.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      m.rotation.y += dy * .14;
      const q = m.userData.parts;
      const walk = moving ? Math.sin(now / 130 + q.phase) : 0;
      const walkAmt = moving ? .42 : 0;
      if (a.action === 'sleep') {
        q.la.rotation.z = lerp(q.la.rotation.z, .55, .08);
        q.ra.rotation.z = lerp(q.ra.rotation.z, -.55, .08);
        q.ll.rotation.x = lerp(q.ll.rotation.x, .95, .08);
        q.rl.rotation.x = lerp(q.rl.rotation.x, .95, .08);
        m.position.y = lerp(m.position.y, .02, .08);
      } else if (a.talking_with) {
        q.la.rotation.z = Math.sin(now / 280 + q.phase) * .35;
        q.ra.rotation.z = Math.cos(now / 320 + q.phase) * .28;
        q.ll.rotation.x = 0; q.rl.rotation.x = 0;
        m.position.y = Math.sin(now / 520 + q.phase) * .02;
      } else if (['work', 'repair', 'garden'].includes(a.action) && !moving) {
        q.la.rotation.z = .2 + Math.sin(now / 180) * .45;
        q.ra.rotation.z = -.15;
        q.ll.rotation.x = 0; q.rl.rotation.x = 0;
        m.position.y = Math.abs(Math.sin(now / 180)) * .03;
      } else {
        q.la.rotation.z = walk * walkAmt;
        q.ra.rotation.z = -walk * walkAmt;
        q.ll.rotation.x = -walk * walkAmt * .85;
        q.rl.rotation.x = walk * walkAmt * .85;
        const breath = Math.sin(now / 520 + q.phase) * .016;
        m.position.y = moving ? Math.abs(Math.sin(now / 130 + q.phase)) * .055 : breath;
      }
      if (q.ring) {
        q.ring.material.opacity = .4 + Math.sin(now / 700 + q.phase) * .12 + (a.id === selected ? .22 : 0);
        q.outer.material.opacity = .12 + Math.sin(now / 900 + q.phase) * .04;
        q.ring.scale.setScalar(1 + Math.sin(now / 800 + q.phase) * .05);
      }
      if (q.key) q.key.intensity = .55 + Math.sin(now / 600 + q.phase) * .14 + (a.id === selected ? .28 : 0);
      if (q.plate) q.plate.material.opacity = a.id === selected ? 1 : .88;
      bubble(a, a.talking_with ? 'speech' : 'thought');
    });
    updateTalkLines();
    const talking = state.agents.filter(a => a.talking_with);
    if (talking.length >= 2 && now - lastSocial > 7000) {
      const a = talking[0], b = state.agents.find(x => x.id === a.talking_with);
      if (b) addSocial(a, b, a.dialog);
      lastSocial = now;
    }
    const hour = A.hourOf(state.minute);
    const solar = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
    const night = solar < .12;
    const dusk = !night && solar < .45;
    scene.background.lerp(new THREE.Color(night ? 0x0e1a2c : dusk ? 0x2a4060 : 0x6a9db0), .04);
    scene.fog.color.lerp(new THREE.Color(night ? 0x122238 : dusk ? 0x2c4560 : 0x7aabba), .04);
    if (skyMat) {
      skyMat.uniforms.top.value.lerp(new THREE.Color(night ? 0x0b1728 : dusk ? 0x3a5a78 : 0x7eb8cc), .04);
      skyMat.uniforms.mid.value.lerp(new THREE.Color(night ? 0x152438 : dusk ? 0x6a5a70 : 0xc5d8e4), .04);
      skyMat.uniforms.bot.value.lerp(new THREE.Color(night ? 0x0a121c : dusk ? 0x2a2838 : 0x4a6a60), .04);
    }
    const ang = (hour - 12) / 24 * Math.PI * 2;
    sun.position.set(Math.cos(ang) * 16, 2.5 + solar * 16, Math.sin(ang) * 14);
    sun.intensity = night ? .48 : (.2 + solar * 1.9);
    sun.color.setHex(dusk ? 0xffc090 : night ? 0xb0c8e8 : 0xffe6c4);
    hemi.intensity = night ? .78 : .88 + solar * .38;
    ambient.intensity = night ? .42 : .26 + solar * .16;
    if (rim) rim.intensity = night ? .55 : .14;
    if (plazaGlow) plazaGlow.intensity = night ? 1.15 : .25;
    if (sunMesh) { sunMesh.position.copy(sun.position); sunMesh.visible = solar > .05; }
    if (moonMesh) { moonMesh.position.set(-sun.position.x * .6, 10, -sun.position.z * .6); moonMesh.visible = night; }
    scene.fog.near = night ? 26 : 24;
    scene.fog.far = night ? 62 : 56;
    renderer.toneMappingExposure = night ? 1.14 : dusk ? 1.08 : 1.16;
    updateAtmosphere(now, night, solar);
    rain.visible = state.weather === 'rain';
    snow.visible = state.weather === 'snow';
    $('#city-time').textContent = A.clock(state.minute);
    $('#city-weather').textContent = ({ clear: 'Klart · 14°', rain: 'Regn · 11°', snow: 'Snö · 2°' })[state.weather];
    renderDirector();
  }

  function syncCity() {
    fetch(CITY_API, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(remote => {
      if (!remote?.agents || remote.agents.length !== 5) return;
      A.applyRemote(state, remote);
      lastSync = performance.now();
      renderAgentList(); renderDetail(); renderEvents(); renderLaws(); renderSocial(); renderDirector();
      $('#model-status').textContent = state.mode === 'replay' ? 'Repris · senaste dygnet' : 'Stadens motor · aktiv';
    }).catch(() => {});
  }

  function askSelected() {
    const input = $('#agent-question'), q = input.value.trim(), a = state.agents.find(x => x.id === selected);
    if (!q || !a) return;
    $('#conversation-answer').textContent = 'Tänker…';
    input.value = '';
    fetch(`${CITY_API}/conversation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: a.id, question: q })
    }).then(r => r.json()).then(result => {
      const answer = result.answer || 'Jag behöver lite tid att tänka.';
      Memory?.rememberConversation(a, 'besökaren', q);
      Memory?.rememberConversation(a, 'besökaren', answer);
      a.thought = answer;
      $('#conversation-answer').textContent = answer;
      (state.social_log ||= []).unshift({ time: A.clock(state.minute), text: `Du → ${a.name}: ${q}` });
      renderSocial(); renderDetail();
    }).catch(() => $('#conversation-answer').textContent = 'Staden svarar inte just nu — prova igen om en stund.');
  }

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1729);
    scene.fog = new THREE.Fog(0x0b1729, 22, 58);
    camera = new THREE.PerspectiveCamera(44, 1, .1, 140);
    camera.position.set(0, 14, 18);
    camera.lookAt(0, .8, -0.4);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputEncoding = THREE.sRGBEncoding;
    if ('physicallyCorrectLights' in renderer) renderer.physicallyCorrectLights = true;
    mount.appendChild(renderer.domElement);
    hemi = new THREE.HemisphereLight(0xb8d4f0, 0x1a2a22, 1.0);
    scene.add(hemi);
    ambient = new THREE.AmbientLight(0x6a7f9a, .3);
    scene.add(ambient);
    sun = new THREE.DirectionalLight(0xffe0b8, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 52;
    sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    rim = new THREE.DirectionalLight(0x88aacc, .25);
    rim.position.set(-8, 4, -10);
    scene.add(rim);
    plazaGlow = new THREE.PointLight(0xffc878, .4, 14, 2);
    plazaGlow.position.set(0, 2.4, -0.4);
    scene.add(plazaGlow);
    buildCity(); resize(); addEventListener('resize', resize); bind(); loop();
  }

  function resize() {
    const r = mount.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = Math.max(r.width / Math.max(r.height, 1), .35);
    const portrait = r.height > r.width * 1.1;
    camera.fov = portrait ? 54 : (r.width < 680 ? 48 : 42);
    camera.updateProjectionMatrix();
  }

  function bind() {
    document.querySelectorAll('.speed').forEach(b => b.onclick = () => {
      state.speed = +b.dataset.speed;
      document.querySelectorAll('.speed').forEach(x => x.classList.toggle('active', x === b));
    });
    $('#pause-btn').onclick = () => { state.paused = !state.paused; $('#pause-btn').textContent = state.paused ? 'Fortsätt' : 'Pausa'; };
    document.querySelectorAll('.weather').forEach(b => b.onclick = () => {
      state.weather = b.dataset.weather;
      document.querySelectorAll('.weather').forEach(x => x.classList.toggle('active', x === b));
    });
    document.querySelectorAll('.time-mode').forEach(b => b.onclick = () => { state.minute = b.dataset.mode === 'day' ? 720 : 1320; });
    $('#ask-agent').onclick = askSelected;
    $('#agent-question').onkeydown = e => { if (e.key === 'Enter') askSelected(); };
    mount.onpointerdown = e => { dragging = true; lastX = e.clientX; };
    addEventListener('pointerup', () => dragging = false);
    addEventListener('pointermove', e => { if (dragging) { yaw += (e.clientX - lastX) * .004; lastX = e.clientX; } });
    mount.onclick = e => {
      if (dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
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
      const liveFresh = state.mode === 'live' && now - lastSync < 25000;
      if (!liveFresh && state.mode !== 'replay') A.tickAgents(state, 1);
      simAccum = 0;
      renderAgentList(); renderDetail(); renderEvents(); renderDirector();
    }
    if (now - directorChanged > 18000 && !dragging) {
      const awake = meshes.filter(m => {
        const a = state.agents.find(x => x.id === m.userData.id);
        return a && a.action !== 'sleep';
      });
      directorIndex = (directorIndex + 1) % Math.max((awake.length || meshes.length), 1);
      directorChanged = now;
    }
    const plaza = new THREE.Vector3(0, .85, -0.4);
    const selMesh = meshes.find(m => m.userData.id === selected);
    const awake = meshes.filter(m => (state.agents.find(x => x.id === m.userData.id) || {}).action !== 'sleep');
    const dirMesh = (awake[directorIndex] || meshes[directorIndex] || meshes[0]);
    const agentMesh = selMesh || dirMesh;
    const focus = plaza.clone();
    if (agentMesh) focus.lerp(new THREE.Vector3(agentMesh.position.x, 1.05, agentMesh.position.z), .32);
    const mobile = mount.clientWidth < 680 || innerWidth < 680;
    const radius = mobile ? 19.8 : 16.8;
    const elev = mobile ? 13.8 : 11.8;
    const desired = new THREE.Vector3(focus.x + Math.sin(yaw) * radius, focus.y + elev, focus.z + Math.cos(yaw) * radius);
    camera.position.lerp(desired, .048);
    camera.lookAt(focus);
    updateScene(now);
    renderer.render(scene, camera);
  }

  renderAgentList(); renderDetail(); renderLaws(); renderEvents(); renderSocial(); renderDirector();
  setInterval(syncCity, 12000);
  syncCity();
  try { init(); }
  catch (e) {
    $('#webgl-fallback').style.display = 'block';
    $('#webgl-fallback').textContent = 'WebGL saknas — textläget är aktivt.';
  }
})();
