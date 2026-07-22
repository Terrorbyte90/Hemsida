/* Röst-labb — a looping, entirely client-side visualization of Ted's AI
   podcast-production pipeline. Nothing here calls a real API or produces a
   real episode; it's a choreographed "director" that steps through the same
   stages the real workflow goes through, with randomized content pools so
   repeated viewing shows genuine variation instead of an obvious loop. */
(() => {
  'use strict';
  const stage = document.querySelector('[data-lab-stage]');
  const stepperEl = document.querySelector('[data-lab-stepper]');
  if (!stage || !stepperEl) return;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const SHOWS = [
    { key: 'overvakad', name: 'Övervakad', img: 'assets/podcasts/overvakad.jpg' },
    { key: 'ai-zonen', name: 'AI-Zonen', img: 'assets/podcasts/ai-zonen.jpg' },
  ];

  const SEARCH_POOL = {
    overvakad: {
      prefix: ['Reddit-tråd om', 'Arkiverat forum:', 'Creepypasta-databas —', 'Vittnesmål:', 'Nattlig sökning:', 'Darknet-referens:', 'Anonym rapport om', 'Gammal logg:', 'Användarinlägg:', 'Diskussionstråd —', 'Källa hittad:', 'Sparad artikel:'],
      topic: ['övergivna serverrum', 'AI som drömmer', 'signaler från döda nätverk', 'spöklika chattbotar', 'digitala skuggor', 'algoritmer som minns', 'backrooms-teorin', 'röster i statisk', 'okända IP-adresser', 'the void protocol', 'AI-genererade mardrömmar', 'glömda databaser', 'spegel-anomalier', 'nattskiftet på servern', 'det tysta larmet', 'korrupta filer', 'elektronisk possession', 'AI:n som vägrade stänga av', 'signal 73', 'den sista uppdateringen', 'ett meddelande utan avsändare', 'kameran som såg fel'],
    },
    'ai-zonen': {
      prefix: ['Senaste nytt om', 'Jämförelse:', 'Guide till', 'Forskningsrapport om', 'Intervju om', 'Sammanfattning av', 'Trendrapport:', 'Expertanalys —', 'Community-tråd om', 'Produktlansering:', 'Benchmark-resultat:', 'Analys av'],
      topic: ['nya språkmodeller', 'AI-agenter i vardagen', 'öppna modeller vs molntjänster', 'prompting-tekniker', 'AI-etik 2026', 'self-hosted AI', 'AI i skolan', 'röstkloning', 'AI-genererad musik', 'modellbenchmarks', 'AI-assistenter för nybörjare', 'datasäkerhet och AI', 'AI i vården', 'framtidens AI-hårdvara', 'AI-regleringar i EU', 'kostnadsjämförelse mellan modeller', 'AI och kreativitet', 'chatbot-arkitekturer', 'multimodal AI', 'AI-agenter som kodar', 'kontextfönster i praktiken', 'lokala modeller på telefon'],
    },
  };

  const TEMPLATES = {
    overvakad: [
      { nm: 'Fil-rapport', sn: 'Ett dokument. En stämning. En röst som läser det som inte borde läsas högt.' },
      { nm: 'Vittnesmål', sn: 'Första person. Osäkert minne. Historien byggs medan berättaren tvekar.' },
      { nm: 'Arkivfynd', sn: 'En gammal logg återupptäcks. Vad hände egentligen den natten?' },
      { nm: 'Två röster', sn: 'En berättare, en motröst som ifrågasätter. Dialogdriven skräck.' },
      { nm: 'Nedräkning', sn: 'Tiden rinner ut i realtid. Varje minut för oss närmre något.' },
      { nm: 'Spegelavsnitt', sn: 'En historia som speglar en tidigare — med en fördröjd twist.' },
    ],
    'ai-zonen': [
      { nm: 'Nybörjarguide', sn: 'Ett begrepp, förklarat från grunden, utan floskler.' },
      { nm: 'Nyhetsgenomgång', sn: 'Veckans tre viktigaste AI-händelser, kort och koncist.' },
      { nm: 'Jämförelse', sn: 'Två verktyg, samma uppgift. Vad vinner och varför?' },
      { nm: 'Djupdykning', sn: 'Ett ämne, tjugo minuter, inga genvägar.' },
      { nm: 'Frågelåda', sn: 'Lyssnarfrågor, ärliga svar, inga garanterade siffror.' },
      { nm: 'Framtidsspaning', sn: 'Vad händer om tolv månader? Kvalificerade gissningar.' },
    ],
  };

  const GREETING = ['Hej och välkommen till', 'Du lyssnar på', 'Det här är', 'Ännu en gång, välkommen till', 'Redo? Det här är'];
  const HOOK = [
    'Dagens avsnitt handlar om något jag inte kunnat sluta tänka på.',
    'Vi går rakt in i ett ämne som känns aktuellt just nu.',
    'Det här är en historia som började med en enda rad text.',
    'Idag gräver vi djupare än vanligt.',
    'Det som väntar är svårare att förklara än att uppleva.',
    'Vi börjar lugnt. Det brukar vi inte göra länge.',
    'Jag har samlat ihop det viktigaste, utan omvägar.',
    'Häng med — det här blir intressant.',
    'Det finns ingen bra väg att mjuklanda det här ämnet på.',
    'Låt oss ta det från början, steg för steg.',
  ];

  const VOICE_LIBRARY = ['Evelina', 'Nova', 'Anna', 'Elin Nilsson', 'Sanna Hartfield', 'Berättarröst (kvinnlig)', 'Berättarröst (manlig)', 'Svensk nyhetsankare', 'Professor Krumelur', 'Lugn manlig röst'];

  const STEPS = ['Ämne', 'Research', 'Manus', 'Utkast', 'Röster', 'Generering', 'Granskning', 'Godkänt', 'Publicerat'];

  function renderStepper(activeIdx, doneUpTo) {
    stepperEl.innerHTML = STEPS.map((s, i) => {
      const cls = i === activeIdx ? 'active' : (i < doneUpTo ? 'done' : '');
      return `<span class="lab-step ${cls}">${String(i + 1).padStart(2, '0')} · ${s}</span>`;
    }).join('');
  }

  function setStage(headline, title) {
    stage.innerHTML = `
      <div class="lab-headline"><span class="dot"></span>${headline}</div>
      <div class="lab-title">${title}</div>
      <div class="lab-body" data-lab-body></div>
    `;
    return stage.querySelector('[data-lab-body]');
  }

  async function run() {
    while (true) {
      const show = rnd(SHOWS);

      // 1. Pick show
      renderStepper(0, 0);
      const b1 = setStage('Väljer ämne', 'Poddar');
      b1.innerHTML = `<div class="lab-shows">${SHOWS.map(s => `
        <div class="lab-show-card" data-show="${s.key}"><img src="${s.img}" alt=""><div class="nm">${s.name}</div></div>
      `).join('')}</div>`;
      await sleep(600);
      stage.querySelector(`[data-show="${show.key}"]`)?.classList.add('picked');
      await sleep(1400);

      // 2. Research
      renderStepper(1, 1);
      const b2 = setStage('Research', `Gör research på dagens ämne — ${show.name}`);
      const feed = document.createElement('div'); feed.className = 'lab-search-feed'; b2.appendChild(feed);
      const countEl = document.createElement('div'); countEl.className = 'lab-search-count'; b2.appendChild(countEl);
      const searchCount = rndInt(2, 7);
      const pool = SEARCH_POOL[show.key];
      countEl.textContent = `0 / ${searchCount} sökningar`;
      for (let i = 0; i < searchCount; i++) {
        countEl.textContent = `${i + 1} / ${searchCount} sökningar`;
        const linesN = rndInt(6, 12);
        for (let j = 0; j < linesN; j++) {
          const line = document.createElement('div');
          line.className = 'lab-search-line';
          line.textContent = `${rnd(pool.prefix)} ${rnd(pool.topic)}`;
          feed.appendChild(line);
          feed.scrollTop = feed.scrollHeight;
          if (feed.children.length > 40) feed.removeChild(feed.firstChild);
          await sleep(rndInt(45, 110));
        }
        await sleep(200);
      }
      await sleep(500);

      // 3. Script templates
      renderStepper(2, 2);
      const b3 = setStage('Manusstruktur', 'Undersöker manusmallar');
      const tpls = TEMPLATES[show.key];
      b3.innerHTML = `<div class="lab-templates">${tpls.map(t => `<div class="lab-tpl" data-tpl="${t.nm}"><div class="nm">${t.nm}</div><div class="sn">${t.sn}</div></div>`).join('')}</div>`;
      await sleep(900);
      const chosenTpl = rnd(tpls);
      stage.querySelector(`[data-tpl="${chosenTpl.nm}"]`)?.classList.add('picked');
      await sleep(1200);

      // 4. Draft opening
      renderStepper(3, 3);
      const b4 = setStage('Utkast', `Skriver de första styckena — "${chosenTpl.nm}"`);
      const draftEl = document.createElement('div'); draftEl.className = 'lab-draft'; b4.appendChild(draftEl);
      const opener = `${rnd(GREETING)} ${show.name}. ${rnd(HOOK)} ${rnd(HOOK)}`;
      draftEl.innerHTML = '<span class="cursor"></span>';
      let acc = '';
      for (const ch of opener) {
        acc += ch;
        draftEl.innerHTML = acc.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<span class="cursor"></span>';
        await sleep(rndInt(12, 30));
      }
      await sleep(1400);

      // 5. Voice connect
      renderStepper(4, 4);
      const b5 = setStage('Röstmotor', 'Ansluter till röstmotorn');
      const vScroll = document.createElement('div'); vScroll.className = 'lab-voice-scroll'; b5.appendChild(vScroll);
      const pickedEl = document.createElement('div'); pickedEl.className = 'lab-voice-picked'; b5.appendChild(pickedEl);
      vScroll.innerHTML = shuffle(VOICE_LIBRARY).map(v => `<div class="lab-voice-row" data-v="${v}">${v}<span>tillgänglig</span></div>`).join('');
      await sleep(700);
      const twoVoices = shuffle(VOICE_LIBRARY).slice(0, 2);
      for (const v of twoVoices) {
        stage.querySelector(`[data-v="${v}"]`)?.classList.add('picked');
        await sleep(400);
      }
      pickedEl.innerHTML = twoVoices.map(v => `<span class="lab-voice-chip">🎙 ${v}</span>`).join('');
      await sleep(1200);

      // 6. Generate audio (with occasional revision loop)
      let revised = false;
      do {
        renderStepper(5, 5);
        const b6 = setStage('Genererar', revised ? 'Genererar ny version av rösten' : 'Genererar röst');
        const wf = document.createElement('div'); wf.className = 'lab-waveform';
        wf.innerHTML = Array.from({ length: 48 }, () => `<span style="animation-delay:${(Math.random() * 1.1).toFixed(2)}s"></span>`).join('');
        b6.appendChild(wf);
        await sleep(rndInt(2200, 3600));

        // 7. File ready
        renderStepper(6, 6);
        const b7 = setStage('Klart', 'Avsnitt klart!');
        b7.innerHTML = `<div class="lab-file-pop"><div class="lab-file-icon">MP3</div><div>${show.name} — ${chosenTpl.nm}.mp3</div></div>`;
        await sleep(1000);

        // 8. Review / listen-and-improve, ~random 18-30s
        const b8 = setStage('Granskning', 'Lyssnar och förbättrar');
        const prog = document.createElement('div'); prog.className = 'lab-progress';
        const bar = document.createElement('i'); prog.appendChild(bar);
        const label = document.createElement('div'); label.className = 'lab-progress-label';
        b8.appendChild(prog); b8.appendChild(label);
        const total = rndInt(18000, 30000);
        const t0 = performance.now();
        while (performance.now() - t0 < total) {
          const pct = Math.min(100, ((performance.now() - t0) / total) * 100);
          bar.style.width = pct + '%';
          label.textContent = `Lyssnar igenom avsnittet … ${Math.round(pct)}%`;
          await sleep(180);
        }
        bar.style.width = '100%';

        revised = Math.random() < 0.35;
        if (revised) {
          label.textContent = 'Reviderar avsnittet …';
          await sleep(1500);
        }
      } while (revised);

      // 9. Approved
      renderStepper(7, 7);
      const b9 = setStage('Godkänt', 'Kvalitetskontroll klar');
      b9.innerHTML = `<div class="lab-badge"><span class="ic">✓</span> Avsnitt godkänt</div>`;
      await sleep(1600);

      // 10. Filing
      const b10 = setStage('Arkivering', 'Lägger avsnitt i podd-banken');
      b10.innerHTML = `<div class="lab-move">
        <div class="folder">Genererat/</div>
        <div class="arrow">→</div>
        <div class="folder">${show.name} — Färdiga avsnitt/</div>
      </div>`;
      await sleep(2000);

      // 11. Uploading
      renderStepper(8, 8);
      const b11 = setStage('Publicering', 'Laddar upp avsnitt till podcast');
      const prog2 = document.createElement('div'); prog2.className = 'lab-progress';
      const bar2 = document.createElement('i'); prog2.appendChild(bar2);
      const label2 = document.createElement('div'); label2.className = 'lab-progress-label';
      b11.appendChild(prog2); b11.appendChild(label2);
      const upTotal = rndInt(2500, 4500);
      const t1 = performance.now();
      while (performance.now() - t1 < upTotal) {
        const pct = Math.min(100, ((performance.now() - t1) / upTotal) * 100);
        bar2.style.width = pct + '%';
        label2.textContent = `Laddar upp … ${Math.round(pct)}%`;
        await sleep(120);
      }

      // 12. Published
      const b12 = setStage('Klart', 'Avsnitt publicerat');
      b12.innerHTML = `<div class="lab-badge"><span class="ic">🎉</span> ${show.name} — nytt avsnitt är live</div>`;
      await sleep(2600);

      // Sometimes idle before next cycle
      if (Math.random() < 0.4) {
        setStage('Vilar', 'Väntar på nästa ämne …');
        await sleep(rndInt(2500, 5000));
      }
    }
  }

  run();

  /* ---------- meet-the-voices players ---------- */
  document.querySelectorAll('[data-voice-play]').forEach(btn => {
    const audio = new Audio(btn.dataset.voicePlay);
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-voice-play]').forEach(b => { if (b !== btn) b.classList.remove('playing'); });
      if (btn.classList.contains('playing')) { audio.pause(); btn.classList.remove('playing'); return; }
      audio.currentTime = 0; audio.play().catch(() => {});
      btn.classList.add('playing');
    });
    audio.addEventListener('ended', () => btn.classList.remove('playing'));
  });
})();
