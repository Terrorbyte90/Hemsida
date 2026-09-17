(() => {
  const mount = document.querySelector('#city-canvas');
  if (!mount || !window.THREE) return;

  const CAST = [
    { id: 'mira', name: 'Mira', role: 'Bibliotekarie', color: '#76d6c6', hex: 0x76d6c6,
      line: 'Hej — jag är Mira. Simuleringen är pausad just nu.' },
    { id: 'elias', name: 'Elias', role: 'Stadsplanerare', color: '#f1bc78', hex: 0xf1bc78,
      line: 'Elias här. Stadens motor är tillfälligt offline.' },
    { id: 'noor', name: 'Noor', role: 'Kulturproducent', color: '#ec8fa0', hex: 0xec8fa0,
      line: 'Noor. Vi tar en paus — kvarteret sover tills vidare.' },
    { id: 'liv', name: 'Liv', role: 'Lärare', color: '#a99be8', hex: 0xa99be8,
      line: 'Liv. Simuleringen är pausad. Vi ses snart igen.' },
    { id: 'august', name: 'August', role: 'Reparatör', color: '#8eb7ed', hex: 0x8eb7ed,
      line: 'August. Motorn vilar — jag håller koll tills den startar.' }
  ];

  const $ = s => document.querySelector(s);
  let scene, camera, renderer, city, hemi, ambient, sun, rim;
  const meshes = [];
  let yaw = 0.35, last = performance.now(), loopT = 0;
  let phase = 'walk'; // walk | speak | hold | reset
  let speaker = 0;
  let phaseT = 0;
  let dragging = false, lastX = 0;

  function mat(c, rough = .7, metal = .05) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
  }
  function box(w, h, d, c, p, parent, rough) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c, rough) : c);
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function sphere(r, c, p, parent, seg = 12) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), typeof c === 'number' ? mat(c) : c);
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true; parent.add(m); return m;
  }
  function cyl(rt, rb, h, c, p, parent, seg = 16) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? mat(c) : c);
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function softShadow(g, s = .45) {
    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(s, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2; sh.position.y = .01; g.add(sh);
  }
  function limb(g, x, y, color) {
    const upper = new THREE.Group();
    upper.position.set(x, y, 0);
    g.add(upper);
    box(.12, .44, .13, color, [0, -.22, 0], upper);
    sphere(.08, 0xe0a888, [0, -.46, 0], upper, 10);
    box(.11, .34, .12, color, [0, -.64, 0], upper);
    sphere(.07, 0xe0a888, [0, -.84, 0], upper, 10);
    return upper;
  }
  function nameplate(name, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    roundRect(ctx, 16, 12, 224, 40, 12); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#f2f5fb';
    ctx.font = 'bold 22px system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(2.2, .55, 1);
    spr.position.set(0, 2.55, 0);
    return spr;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makeAvatar(agent, x) {
    const g = new THREE.Group();
    g.userData.id = agent.id;
    g.position.set(x, 0, 6);
    softShadow(g, .4);
    const dark = mat(0x1a1f2e, .95);
    const pants = mat(agent.id === 'august' ? 0x2a3e55 : 0x1c2a3e, .82);
    const shirt = mat(agent.hex, .58, .08);
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
    const la = limb(g, -.36, 1.12, agent.hex);
    const ra = limb(g, .36, 1.12, agent.hex);
    const ll = box(.17, .56, .18, pants, [-.15, .05, 0], g);
    const rl = box(.17, .56, .18, pants, [.15, .05, 0], g);
    box(.2, .09, .3, 0x0e121c, [-.15, 0, .07], g);
    box(.2, .09, .3, 0x0e121c, [.15, 0, .07], g);
    if (agent.id === 'mira') box(.12, .04, .16, 0x4a3428, [.32, 1.0, .12], g);
    if (agent.id === 'august') box(.05, .28, .05, 0x8899aa, [-.42, .95, .08], g);
    const key = new THREE.PointLight(agent.hex, .55, 3.6, 2);
    key.position.set(0, 1.6, .3); g.add(key);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.34, .46, 40),
      new THREE.MeshBasicMaterial({ color: agent.hex, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
    g.add(nameplate(agent.name, agent.color));
    g.scale.setScalar(1.18);
    g.userData.parts = { la, ra, ll, rl, phase: Math.random() * 6.28 };
    g.userData.homeX = x;
    g.userData.homeZ = 6;
    city.add(g);
    return g;
  }

  function buildStage() {
    city = new THREE.Group();
    scene.add(city);
    // Plaza floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a2838, roughness: .92, metalness: .05 })
    );
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; city.add(floor);
    // Step / podium
    box(10, .28, 3.2, 0x243448, [0, .14, -1.2], city, .85);
    box(8.5, .22, 2.4, 0x2a3c52, [0, .36, -1.5], city, .85);
    // Soft backdrop buildings (silhouettes)
    for (let i = -3; i <= 3; i++) {
      const h = 4 + Math.abs(i) * .6 + (i % 2 ? 1.4 : 0);
      box(2.4, h, 2.2, 0x121c2a, [i * 3.4, h / 2, -10], city, .95);
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, h * .55),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xf3c98b : 0x75d6c7, transparent: true, opacity: .12 })
      );
      win.position.set(i * 3.4, h * .45, -8.88); city.add(win);
    }
    // Plaza ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7.5, 8.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x2f455c, roughness: .8, metalness: .1 })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = .02; city.add(ring);
    // Ambient lamps
    [-6, 6].forEach(x => {
      cyl(.06, .08, 2.4, 0x1c2432, [x, 1.2, 4], city, 8);
      const lamp = new THREE.PointLight(0xffc878, .7, 10, 2);
      lamp.position.set(x, 2.5, 4); city.add(lamp);
      sphere(.12, new THREE.MeshBasicMaterial({ color: 0xffe0a8 }), [x, 2.5, 4], city, 10);
    });
    CAST.forEach((a, i) => {
      const x = (i - 2) * 2.15;
      meshes.push(makeAvatar(a, x));
    });
  }

  function setBubble(agent, text, visible) {
    let el = document.querySelector(`[data-bubble="${agent.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'city-bubble paused-bubble';
      el.dataset.bubble = agent.id;
      mount.appendChild(el);
    }
    el.style.setProperty('--bubble-accent', agent.color);
    el.innerHTML = `<b>${agent.name}</b><span>${text}</span>`;
    const m = meshes.find(x => x.userData.id === agent.id);
    if (m && renderer && camera) {
      const v = m.position.clone(); v.y += 2.7;
      v.project(camera);
      const r = mount.getBoundingClientRect();
      const sx = (v.x * .5 + .5) * r.width;
      const sy = (-v.y * .5 + .5) * r.height;
      el.style.left = '0';
      el.style.top = '0';
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -120%)`;
      const on = !!(visible && text && v.z < 1);
      el.classList.toggle('is-off', !on);
      el.style.opacity = on ? '1' : '0';
      el.style.visibility = on ? 'visible' : 'hidden';
    } else {
      el.classList.add('is-off');
    }
  }

  function clearBubbles() {
    CAST.forEach(a => setBubble(a, '', false));
  }

  function animateWalk(mesh, t, moving) {
    const p = mesh.userData.parts;
    if (!p) return;
    const swing = moving ? Math.sin(t * 8 + p.phase) : Math.sin(t * 1.5 + p.phase) * .08;
    p.ll.rotation.x = swing * (moving ? .55 : .12);
    p.rl.rotation.x = -swing * (moving ? .55 : .12);
    p.la.rotation.x = -swing * (moving ? .4 : .1);
    p.ra.rotation.x = swing * (moving ? .4 : .1);
    mesh.position.y = moving ? Math.abs(Math.sin(t * 8 + p.phase)) * .04 : Math.sin(t * 1.8 + p.phase) * .015;
  }

  function updateCaption(title, copy) {
    const t = $('#scene-title'), c = $('#scene-copy');
    if (t) t.textContent = title;
    if (c) c.textContent = copy;
  }

  function renderCast() {
    const list = $('#agent-list');
    if (!list) return;
    list.innerHTML = CAST.map(a =>
      `<button class="agent-card ${speaker >= 0 && CAST[speaker]?.id === a.id ? 'selected' : ''}" data-id="${a.id}" style="--agent-color:${a.color};--need:70%">
        <span class="agent-orb"></span><strong>${a.name}</strong><small>${a.role}</small>
        <span class="agent-mood">pausad</span><span class="agent-status"><i></i></span>
      </button>`
    ).join('');
    const active = $('#active-count');
    if (active) active.textContent = 'pausad';
    const detail = $('#agent-detail-content');
    const a = CAST[Math.max(0, Math.min(speaker, CAST.length - 1))];
    if (detail && a) {
      detail.innerHTML =
        `<div class="agent-hero"><span class="agent-orb" style="--agent-color:${a.color}"></span>
         <div><h2>${a.name}</h2><p>${a.role} · invånare i Kvarter 07</p></div></div>
         <p class="paused-detail">Simuleringen är tillfälligt offline. ${a.name} väntar på att staden ska starta igen.</p>`;
    }
    const qn = $('#question-name');
    if (qn) qn.textContent = a?.name || 'Mira';
    const ans = $('#conversation-answer');
    if (ans) ans.textContent = 'Stadens motor är pausad — samtal är avstängt just nu.';
  }

  function tick(dt) {
    loopT += dt;
    phaseT += dt;

    if (phase === 'walk') {
      updateCaption('De tar ett steg fram', 'Invånarna samlas på torget.');
      const progress = Math.min(1, phaseT / 3.2);
      meshes.forEach((m, i) => {
        const targetZ = -0.4;
        m.position.z = m.userData.homeZ + (targetZ - m.userData.homeZ) * easeOut(progress);
        // Step up onto podium near end
        const stepUp = Math.max(0, (progress - .65) / .35);
        m.position.y = stepUp * .38;
        // Walk toward -Z, then ease turn to face camera (+Z)
        m.rotation.y = easeOut(Math.max(0, (progress - .7) / .3)) * Math.PI;
        animateWalk(m, loopT + i, progress < .98);
      });
      if (progress >= 1) { phase = 'speak'; phaseT = 0; speaker = 0; clearBubbles(); }
    } else if (phase === 'speak') {
      const a = CAST[speaker];
      const m = meshes[speaker];
      updateCaption(`${a.name} presenterar sig`, 'Simuleringen är pausad.');
      // Step slightly forward
      const nudge = Math.min(1, phaseT / .45);
      m.rotation.y = Math.PI;
      m.position.z = -0.4 - nudge * .55;
      m.position.y = .38 + Math.sin(Math.min(phaseT, .4) * Math.PI / .4) * .12 * (phaseT < .4 ? 1 : 0);
      if (phaseT >= .35) setBubble(a, a.line, true);
      meshes.forEach((mesh, i) => animateWalk(mesh, loopT + i, false));
      // Highlight speaker ring opacity via scale pulse
      m.scale.setScalar(1.18 + Math.sin(phaseT * 3) * .02);
      if (phaseT >= 3.4) {
        setBubble(a, a.line, false);
        m.scale.setScalar(1.18);
        m.position.z = -0.4;
        speaker += 1;
        phaseT = 0;
        if (speaker >= CAST.length) { phase = 'hold'; phaseT = 0; }
      }
    } else if (phase === 'hold') {
      updateCaption('Simuleringen är pausad', 'Kort scen · loopar tills staden är tillbaka.');
      CAST.forEach((a, i) => {
        if (i === 2) setBubble(a, 'Simuleringen är tillfälligt offline.', true);
        else setBubble(a, '', false);
      });
      meshes.forEach((m, i) => {
        m.rotation.y = Math.PI;
        animateWalk(m, loopT + i, false);
        m.position.y = .38 + Math.sin(loopT * 1.4 + i) * .02;
      });
      if (phaseT >= 3.2) { phase = 'reset'; phaseT = 0; clearBubbles(); }
    } else if (phase === 'reset') {
      updateCaption('Omstart av scenen', 'Loopen börjar om.');
      const progress = Math.min(1, phaseT / 2.2);
      meshes.forEach((m, i) => {
        m.position.z = -0.4 + (m.userData.homeZ + 0.4) * easeIn(progress);
        m.position.y = .38 * (1 - progress);
        animateWalk(m, loopT + i, progress < .95);
      });
      if (progress >= 1) {
        phase = 'walk'; phaseT = 0; speaker = 0;
        meshes.forEach(m => { m.position.z = m.userData.homeZ; m.position.y = 0; });
      }
    }
    renderCast();
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t; }

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1729);
    scene.fog = new THREE.Fog(0x0b1729, 22, 55);
    camera = new THREE.PerspectiveCamera(40, 1, .1, 120);
    camera.position.set(0, 6.5, 14);
    camera.lookAt(0, 1.2, -1);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    mount.appendChild(renderer.domElement);
    hemi = new THREE.HemisphereLight(0xc5dff5, 0x1a2a22, 1.0);
    scene.add(hemi);
    ambient = new THREE.AmbientLight(0x7a90a8, .4);
    scene.add(ambient);
    sun = new THREE.DirectionalLight(0xffe8c4, 1.6);
    sun.position.set(6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    rim = new THREE.DirectionalLight(0x88aacc, .35);
    rim.position.set(-8, 4, -6);
    scene.add(rim);
    const glow = new THREE.PointLight(0xffc878, .8, 20, 1.8);
    glow.position.set(0, 3, 0); scene.add(glow);
    buildStage();
    resize();
    addEventListener('resize', resize);
    mount.onpointerdown = e => { dragging = true; lastX = e.clientX; };
    addEventListener('pointerup', () => dragging = false);
    addEventListener('pointermove', e => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * .004;
      lastX = e.clientX;
    });
    const status = $('#model-status');
    if (status) status.textContent = 'Simulering · pausad';
    const dot = $('#model-dot');
    if (dot) { dot.classList.add('paused'); }
    renderCast();
    requestAnimationFrame(loop);
  }

  function resize() {
    const r = mount.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = Math.max(r.width / Math.max(r.height, 1), .35);
    camera.fov = r.height > r.width * 1.1 ? 48 : 40;
    camera.updateProjectionMatrix();
  }

  function loop(now = performance.now()) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    tick(dt);
    const focus = new THREE.Vector3(0, 1.1, -0.5);
    const radius = mount.clientWidth < 680 ? 16 : 13.5;
    const elev = mount.clientWidth < 680 ? 8.5 : 6.8;
    camera.position.x += ((focus.x + Math.sin(yaw) * radius) - camera.position.x) * .06;
    camera.position.y += ((focus.y + elev) - camera.position.y) * .06;
    camera.position.z += ((focus.z + Math.cos(yaw) * radius) - camera.position.z) * .06;
    camera.lookAt(focus);
    // Keep bubbles aligned
    if (phase === 'speak' && CAST[speaker]) setBubble(CAST[speaker], CAST[speaker].line, phaseT >= .35);
    if (phase === 'hold') setBubble(CAST[2], 'Simuleringen är tillfälligt offline.', true);
    renderer.render(scene, camera);
  }

  // UI: no backend, no spam
  document.querySelectorAll('.speed, #pause-btn, [data-cam], .weather, .time-mode, #ask-agent, #new-law').forEach(el => {
    if (!el) return;
    el.disabled = true;
    el.classList.add('is-disabled');
  });
  const ask = $('#ask-agent');
  if (ask) ask.onclick = e => { e.preventDefault(); };
  const input = $('#agent-question');
  if (input) { input.disabled = true; input.placeholder = 'Samtal pausat…'; }

  try { init(); }
  catch (e) {
    const fb = $('#webgl-fallback');
    if (fb) {
      fb.style.display = 'block';
      fb.textContent = 'WebGL saknas — simuleringen är pausad. Mira, Elias, Noor, Liv och August väntar.';
    }
  }
})();
