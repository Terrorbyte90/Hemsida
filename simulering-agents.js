/* Society brain: a small town that lives, shops, drives and visits the zoo. */
(() => {
  const actions = {
    sleep: { label: 'sover hemma', place: 'home', duration: 85, need: 'sleep', pose: 'sleep' },
    eat: { label: 'äter på caféet', place: 'cafe', duration: 30, need: 'hunger', pose: 'sit' },
    sit: { label: 'sitter på caféet', place: 'cafe', duration: 18, need: 'social', pose: 'sit' },
    socialise: { label: 'pratar på torget', place: 'plaza', duration: 22, need: 'social', pose: 'talk' },
    read: { label: 'läser i biblioteket', place: 'library', duration: 48, need: 'curiosity', pose: 'read' },
    work: { label: 'arbetar i verkstaden', place: 'workshop', duration: 55, need: 'purpose', pose: 'work' },
    study: { label: 'pluggar i skolan', place: 'school', duration: 50, need: 'curiosity', pose: 'read' },
    garden: { label: 'odlar i trädgården', place: 'garden', duration: 40, need: 'purpose', pose: 'work' },
    vote: { label: 'röstar i rådhuset', place: 'hall', duration: 20, need: 'purpose', pose: 'talk' },
    debate: { label: 'debatterar en lag', place: 'hall', duration: 18, need: 'purpose', pose: 'talk' },
    repair: { label: 'lagar något tillsammans', place: 'workshop', duration: 32, need: 'purpose', pose: 'work' },
    teach: { label: 'håller lektion', place: 'school', duration: 36, need: 'curiosity', pose: 'talk' },
    perform: { label: 'spelar på torget', place: 'plaza', duration: 24, need: 'social', pose: 'perform' },
    shop: { label: 'handlar i butiken', place: 'shop', duration: 26, need: 'hunger', pose: 'shop' },
    visit_zoo: { label: 'besöker djurparken', place: 'zoo', duration: 34, need: 'curiosity', pose: 'look' },
    feed: { label: 'matar djuren', place: 'zoo', duration: 22, need: 'purpose', pose: 'feed' },
    drive: { label: 'åker bil genom stan', place: 'road', duration: 16, need: 'purpose', pose: 'drive' },
    stroll: { label: 'promenerar i parken', place: 'park', duration: 28, need: 'social', pose: 'walk' }
  };

  // Town-scale anchors (~10× spread vs old plaza cluster)
  const places = {
    plaza: [0, 0],
    cafe: [0, 10.5],
    library: [-18, -22],
    workshop: [18, -22],
    school: [-18, -4],
    garden: [22, -8],
    hall: [0, -22],
    shop: [18, 4],
    zoo: [-32, 2],
    park: [-14, 8],
    road: [0, -8],
    home: [0, 22]
  };

  // Distinct home lot for each resident (north residential street)
  const HOME_LOTS = [
    { x: -24, z: 22, label: 'Miras hus' },
    { x: -12, z: 22, label: 'Elias hus' },
    { x: 0, z: 22, label: 'Noors hus' },
    { x: 12, z: 22, label: 'Livs hus' },
    { x: 24, z: 22, label: 'Augusts hus' }
  ];
  const HOME_X = HOME_LOTS.map(h => h.x);
  const HOME_Z = HOME_LOTS.map(h => h.z);

  const PLACE_SV = {
    plaza: 'torget', cafe: 'caféet', library: 'biblioteket', workshop: 'verkstaden',
    school: 'skolan', garden: 'trädgården', hall: 'rådhuset', home: 'hemmet',
    shop: 'butiken', zoo: 'djurparken', park: 'parken', road: 'huvudgatan'
  };

  const profiles = [
    { id: 'mira', name: 'Mira', role: 'Bibliotekarie', trait: 'nyfiken · varm · undersökande', color: '#76d6c6', preferred: ['read', 'visit_zoo', 'vote'], stance: { trees: 1, 'late-library': 1, 'shared-garden': 1, 'zoo-hours': 1 } },
    { id: 'elias', name: 'Elias', role: 'Stadsplanerare', trait: 'metodisk · ansvarstagande · lugn', color: '#f1bc78', preferred: ['work', 'drive', 'garden'], stance: { trees: 1, 'late-library': 0, 'shared-garden': 1, 'zoo-hours': 1 } },
    { id: 'noor', name: 'Noor', role: 'Kulturproducent', trait: 'social · kreativ · spontan', color: '#ec8fa0', preferred: ['socialise', 'perform', 'shop'], stance: { trees: 1, 'late-library': 1, 'shared-garden': 1, 'zoo-hours': 1 } },
    { id: 'liv', name: 'Liv', role: 'Lärare', trait: 'skeptisk · empatisk · principfast', color: '#a99be8', preferred: ['study', 'teach', 'stroll'], stance: { trees: 1, 'late-library': 0, 'shared-garden': 1, 'zoo-hours': 0 } },
    { id: 'august', name: 'August', role: 'Reparatör', trait: 'uppfinningsrik · tävlingsinriktad · modig', color: '#8eb7ed', preferred: ['work', 'feed', 'repair'], stance: { trees: 0, 'late-library': 0, 'shared-garden': 1, 'zoo-hours': 1 } }
  ];

  const laws = [
    { id: 'trees', title: 'Fler träd längs huvudgatan', author: 'Elias', yes: 3, no: 1, status: 'pågående' },
    { id: 'late-library', title: 'Biblioteket öppet efter midnatt', author: 'Mira', yes: 2, no: 2, status: 'pågående' },
    { id: 'shared-garden', title: 'Gemensam odlingslott på torget', author: 'August', yes: 4, no: 0, status: 'antagen' },
    { id: 'zoo-hours', title: 'Djurparken öppen till skymning', author: 'Mira', yes: 3, no: 1, status: 'pågående' }
  ];

  const THOUGHTS = {
    sleep: ['Mitt hus luktar tystnad. I morgon tar vi om det här.', 'Jag låser dörren och släpper dagen.'],
    eat: ['Ångan från koppen luktar som att någon väntar.', 'Jag äter långsamt och lyssnar på staden.'],
    sit: ['Cafébordet är mitt favoritfönster mot torget.', 'Jag sitter kvar. Ingen brådska.'],
    socialise: ['Torget rymmer fler samtal än lagar.', 'Jag vill veta hur de andra egentligen har det.'],
    read: ['En mening i en bok kan flytta ett helt kvarter.', 'Jag stryker under det Elias skulle förneka.'],
    work: ['Om något kärvar lagar jag det innan kvällen.', 'Ritningen sitter. Nu är det händer som gäller.'],
    study: ['Eleverna förtjänar mer än färdiga svar.', 'Jag övar frågan jag ska ställa i morgon.'],
    garden: ['Jorden under naglarna är den ärligaste rapporten.', 'Om vi vattnar nu klarar lotten natten.'],
    vote: ['En lag utan samtal är bara ett papper.', 'Jag räknar rösterna mot det jag faktiskt sett.'],
    debate: ['Vi är oense — och det är så staden blir vuxen.', 'Jag backar inte, men jag lyssnar färdigt.'],
    repair: ['Två par händer, en trasig lampa, ett kvarter som ser.', 'Vi lagar det tillsammans eller inte alls.'],
    teach: ['Jag sänker rösten så att de lutar sig fram.', 'Kunskap som inte delas ruttnar i hyllan.'],
    perform: ['Om jag spelar nu samlas de av sig själva.', 'Musiken är mitt sätt att rösta.'],
    shop: ['Butiken har det som huset saknar.', 'Jag tar bröd, mjölk och något onödigt vackert.'],
    visit_zoo: ['Djuren tittar tillbaka. Det gör staden större.', 'Jag går sakta längs hägnet och räknar hovar.'],
    feed: ['En handfull pellets, ett tack som inte behöver ord.', 'Om vi matar rätt mår hela kvarteret bättre.'],
    drive: ['Huvudgatan öppnar sig. Jag kör försiktigt förbi caféet.', 'Bilen skakar lätt — August måste se över den.'],
    stroll: ['Parken andas mellan träden.', 'Jag går utan mål och det räcker.']
  };

  const DIALOG = {
    plaza: [['Se hur lyktorna tänder kvarteret.', 'Ja. Torget känns som att det andas.'], ['Ska vi ta upp det i rådhuset i kväll?', 'Bara om vi tar med fler röster.'], ['Jag hörde att lotten behöver vatten.', 'Då hämtar vi August innan skymningen.']],
    cafe: [['Koppen värmer mer än lamporna.', 'Sitt kvar. Jag vill höra slutet.'], ['Regn eller inte — caféet samlar oss.', 'Det är därför jag kommer hit när jag tvekar.']],
    library: [['Den här boken beskriver just vårt torg.', 'Läs högt. Jag minns bättre då.'], ['Om vi öppnar sent vinner nyfikenheten.', 'Eller så förlorar de som måste sova.']],
    workshop: [['Håll här. Skruven släpper om vi drar snett.', 'Jag håller. Du räknar varven.'], ['Lampan vid skolan flimrar igen.', 'Då tar vi den före mörkret.']],
    school: [['De förstår träden, men inte röstsedeln.', 'Då börjar vi med varför någon röstar nej.'], ['Kan du gästa lektionen i morgon?', 'Om jag får ta med en riktig ritning.']],
    garden: [['Jorden är torr mot mitten.', 'Jag hämtar kannan, du tar de gula bladen.'], ['Lotten är vår tystaste lag.', 'Och den enda som växer medan vi sover.']],
    hall: [['Fler träd, ja — men inte om vi skymmer lyktorna.', 'Då planterar vi mellan stolparna.'], ['Midnatt i biblioteket är vackert och oroligt.', 'Vi kan prova två kvällar och mäta.']],
    home: [['Vilken dag det blev.', 'Vila. Staden tar oss tillbaka i gryningen.'], ['Ditt hus luktar kaffe.', 'Kom in. Vi tar resten i morgon.']],
    shop: [['Har ni färskt bröd kvar?', 'Ja — och den nya sylten från lotten.'], ['Jag tar två liter mjölk och en lykta.', 'Lyktan är Augusts. Säg att den flimrar.']],
    zoo: [['Titta, renarna står i skuggan.', 'De vet mer om väder än vi gör.'], ['Ska vi mata änder innan stängning?', 'Bara om Liv säger att det är okej.'], ['Hägnen behöver en ny skylt.', 'Då målar Noor den efter föreställningen.']],
    park: [['Här är det tystare än på torget.', 'Just därför kommer jag hit.'], ['Ska vi sitta en stund under eken?', 'Ja. Sedan går vi till butiken.']],
    road: [['Kör sakta förbi skolan.', 'Jag gör det. Barnen springer ibland.'] ]
  };
  const CONFLICT = [['Du skyndar fram lagar.', 'Och du väntar tills ingenting händer.'], ['Jag hör principen. Jag ser också de som blir utan.', 'Principen är till för just dem.']];
  const COOP = [['Om vi gör det tillsammans hinner vi före skymningen.', 'Jag tar vänster sida, du tar höger.'], ['Räkna med mig.', 'Då är vi redan två mer än igår.']];

  const OBJECTS = {
    cafe_table: { place: 'cafe', label: 'cafébord', use: 'sit' },
    shop_counter: { place: 'shop', label: 'disk', use: 'shop' },
    zoo_gate: { place: 'zoo', label: 'djurparksgrind', use: 'visit_zoo' },
    feed_bin: { place: 'zoo', label: 'foderlåda', use: 'feed' },
    car_a: { place: 'road', label: 'blå bil', use: 'drive' },
    car_b: { place: 'road', label: 'gul bil', use: 'drive' },
    park_bench: { place: 'park', label: 'parkbänk', use: 'stroll' },
    fountain: { place: 'plaza', label: 'fontän', use: 'socialise' },
    workbench: { place: 'workshop', label: 'arbetsbänk', use: 'work' },
    bookshelf: { place: 'library', label: 'bokhylla', use: 'read' }
  };

  const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
  const clock = m => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  const hourOf = m => (m % 1440) / 60;
  const phaseOf = m => { const h = hourOf(m); return h >= 22 || h < 5 ? 'natt' : h < 8 ? 'morgon' : h < 17 ? 'dag' : h < 20 ? 'kväll' : 'skymning'; };
  const indexOf = id => Math.max(0, profiles.findIndex(p => p.id === id));

  function homeOf(agent) {
    const i = agent._index ?? indexOf(agent.id);
    const lot = HOME_LOTS[i] || HOME_LOTS[0];
    return [lot.x, lot.z];
  }

  function objectFor(action, place) {
    const hit = Object.entries(OBJECTS).find(([, o]) => o.use === action || o.place === place);
    return hit ? hit[0] : '';
  }

  function slotOf(agent, place) {
    const i = agent._index ?? indexOf(agent.id);
    const key = place || agent.place || 'plaza';
    if (key === 'home') return homeOf(agent);
    if (key === 'road') {
      // Driving lane waypoints — stagger by agent
      const lane = [[-20, -8], [-8, -8], [0, -8], [10, -8], [20, -8]];
      return lane[i % lane.length];
    }
    const p = places[key] || places.plaza;
    const r = key === 'plaza' ? 3.2 : key === 'zoo' ? 4.2 : key === 'park' ? 2.8 : 1.35;
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const stretch = key === 'zoo' ? 0.85 : 0.72;
    return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * stretch];
  }

  function localThought(agent, state) {
    const lines = THOUGHTS[agent.action] || THOUGHTS.socialise;
    const seed = Math.floor(state.minute / 9) + (agent._index || 0) * 3;
    const other = state.agents.find(x => x.id === agent.talking_with);
    let thought = lines[seed % lines.length];
    if (agent.using) {
      const obj = OBJECTS[agent.using];
      if (obj && seed % 3 === 0) thought = `Jag använder ${obj.label}. ${thought}`;
    }
    if (other) thought += ` ${other.name} är här.`;
    if (seed % 5 === 0) thought = ({ clear: 'Luften är klar. ', rain: 'Regnet sätter tempot. ', snow: 'Snön dämpar rösterna. ' })[state.weather] + thought;
    return thought;
  }

  function createAgent(profile, i) {
    const rel = {};
    profiles.forEach((p, k) => { if (p.id !== profile.id) rel[p.id] = 8 - Math.abs(i - k); });
    const home = homeOf({ _index: i, id: profile.id });
    return {
      ...profile, _index: i, home, homeLabel: HOME_LOTS[i].label,
      needs: { sleep: 28 + i * 6, hunger: 34 + i * 4, social: 42 - i * 3, curiosity: 38 + i * 3, purpose: 45 },
      relationship: rel, relationships: rel, knowledge: ['Staden har fem egna hus, en butik, en djurpark och en huvudgata.'],
      action: 'socialise', actionLabel: actions.socialise.label, place: 'plaza', progress: 0,
      pose: 'talk', using: '',
      target: slotOf({ _index: i, id: profile.id }, 'plaza'), thought: 'Jag undrar vad som händer idag.',
      dialog: '', talking_with: '', mood: 'nyfiken', memory: ['En ny kväll börjar på torget.'],
      online: false, action_started: 19 * 60 + 12, dialog_started: -20
    };
  }

  function createSimulationState() {
    const fresh = {
      minute: 19 * 60 + 12, day: 12, agents: profiles.map(createAgent),
      laws: laws.map(l => ({ ...l })), weather: 'clear', paused: false, speed: 1,
      events: [{ time: '19:12', text: 'Stadens fem invånare möts på det nya torget.' }],
      social_log: [], selected: 'mira', qwenEndpoint: '', lastQwen: 0, mode: 'local',
      scene: { title: 'Staden andas in', copy: 'Fem hus, en butik, en djurpark — ett liv i taget.', phase: 'kväll' },
      vehicles: [
        { id: 'car_a', label: 'blå bil', color: '#4a7ab0', t: 0.12, rider: '' },
        { id: 'car_b', label: 'gul bil', color: '#d4a84a', t: 0.62, rider: '' }
      ]
    };
    try {
      const saved = JSON.parse(localStorage.getItem('city-simulation-state') || 'null');
      if (saved?.agents?.length === 5 && !saved._skip) {
        fresh.minute = saved.minute ?? fresh.minute;
        fresh.day = saved.day ?? fresh.day;
        fresh.weather = saved.weather ?? fresh.weather;
      }
    } catch (e) { /* keep fresh */ }
    return fresh;
  }

  function choose(agent, state) {
    const n = agent.needs, hour = hourOf(state.minute);
    if (n.sleep > 82 || ((hour >= 22.5 || hour < 6) && n.sleep > 38)) return 'sleep';
    if (hour >= 22.5 || hour < 6) return 'sleep';
    if (n.hunger > 76) return hour % 2 < 1 ? 'eat' : 'shop';
    if (hour >= 6 && hour < 8) {
      if (agent.id === 'august' || agent.id === 'elias') return 'garden';
      if (agent.id === 'noor') return 'shop';
      return 'eat';
    }
    if (hour >= 8 && hour < 12) {
      return ({
        mira: hour > 10 ? 'visit_zoo' : 'read',
        elias: hour > 10 ? 'drive' : 'work',
        noor: hour > 10 ? 'perform' : 'socialise',
        liv: hour > 9 ? 'teach' : 'study',
        august: hour > 10 ? 'feed' : 'work'
      })[agent.id];
    }
    if (hour >= 12 && hour < 13.6) return n.hunger > 28 ? 'eat' : (agent.id === 'liv' ? 'stroll' : 'sit');
    if (hour >= 13.6 && hour < 17) {
      if (hour > 15.5 && (agent.id === 'elias' || agent.id === 'liv' || agent.id === 'mira')) return 'vote';
      if (hour > 14.5 && agent.id === 'august') return 'feed';
      if (hour > 14 && agent.id === 'noor') return 'shop';
      if (agent.id === 'mira') return 'visit_zoo';
      if (agent.id === 'elias') return hour > 14 ? 'drive' : 'work';
      if (agent.id === 'liv') return 'stroll';
      return ({ mira: 'read', elias: 'work', noor: 'socialise', liv: 'study', august: 'work' })[agent.id];
    }
    if (hour >= 17 && hour < 20) {
      if (agent.id === 'noor') return hour < 18.5 ? 'perform' : 'socialise';
      if (agent.id === 'mira') return hour < 18 ? 'sit' : 'socialise';
      if (agent.id === 'liv') return hour < 18.2 ? 'stroll' : 'socialise';
      if (agent.id === 'august') return hour < 18 ? 'repair' : 'socialise';
      if (agent.id === 'elias') return hour < 18 ? 'drive' : 'socialise';
      return n.hunger > 50 ? 'eat' : 'socialise';
    }
    if (hour >= 20 && hour < 22.5) {
      if (agent.id === 'mira') return 'read';
      if (agent.id === 'august') return state.weather === 'snow' ? 'read' : 'garden';
      if (agent.id === 'liv') return 'stroll';
      if (agent.id === 'elias') return 'shop';
      return 'socialise';
    }
    return agent.preferred[0] || 'socialise';
  }

  function startAction(agent, action, state) {
    const spec = actions[action] || actions.socialise;
    agent.action = action;
    agent.actionLabel = spec.label;
    agent.place = spec.place;
    agent.pose = spec.pose || 'walk';
    agent.using = objectFor(action, spec.place);
    agent.progress = 0;
    agent.action_started = state ? state.minute : agent.action_started;
    agent.target = slotOf(agent, spec.place);
    agent.talking_with = '';
    agent.dialog = '';
    if (state) {
      agent.thought = localThought(agent, state);
      // Vehicle occupancy
      (state.vehicles || []).forEach(v => { if (v.rider === agent.id) v.rider = ''; });
      if (action === 'drive' && state.vehicles?.length) {
        const free = state.vehicles.find(v => !v.rider) || state.vehicles[agent._index % state.vehicles.length];
        free.rider = agent.id;
        agent.using = free.id;
        agent.actionLabel = `kör ${free.label}`;
      }
    }
  }

  function relationKind(a, b) {
    const score = Number((a.relationships || a.relationship || {})[b.id] || 0);
    if (a.place === 'hall') {
      const sa = a.stance || {}, sb = b.stance || {};
      if (sa['late-library'] !== sb['late-library'] || sa.trees !== sb.trees || sa['zoo-hours'] !== sb['zoo-hours']) return 'conflict';
      return 'coop';
    }
    if (a.place === 'workshop' || a.place === 'garden' || a.place === 'zoo') return 'coop';
    if (score < 0) return 'conflict';
    if (score > 18) return 'coop';
    return 'talk';
  }

  function dialogPair(a, b, state) {
    const kind = relationKind(a, b);
    const seed = Math.floor(state.minute / 11) + (a._index || 0) + (b._index || 0);
    const pack = kind === 'conflict' ? CONFLICT : kind === 'coop' ? COOP : (DIALOG[a.place] || DIALOG.plaza);
    const pair = pack[seed % pack.length];
    return { kind, a: pair[0], b: pair[1] };
  }

  function moodOf(agent, state) {
    if (agent.action === 'sleep') return 'sömnig';
    if (agent.talking_with) {
      const other = state.agents.find(x => x.id === agent.talking_with);
      if (other && relationKind(agent, other) === 'conflict') return 'oense';
      if (other && relationKind(agent, other) === 'coop') return 'samarbetar';
      return 'samtal';
    }
    if (agent.needs.hunger > 70) return 'hungrig';
    if (['work', 'repair', 'garden', 'feed'].includes(agent.action)) return 'upptagen';
    if (['read', 'study', 'teach'].includes(agent.action)) return 'koncentrerad';
    if (agent.action === 'drive') return 'på väg';
    if (['visit_zoo', 'stroll'].includes(agent.action)) return 'utforskande';
    if (agent.action === 'shop') return 'handlar';
    return 'närvarande';
  }

  function sceneStory(state) {
    const phase = phaseOf(state.minute);
    const sleeping = state.agents.filter(a => a.action === 'sleep');
    const talking = state.agents.filter(a => a.talking_with);
    const driving = state.agents.find(a => a.action === 'drive');
    const atZoo = state.agents.filter(a => a.place === 'zoo');
    if (sleeping.length >= 4 && (phase === 'natt' || phase === 'morgon')) {
      return { title: 'Staden sover', copy: 'Fem hus är tysta. I gryningen börjar de om.', phase };
    }
    if (atZoo.length >= 2) {
      return { title: 'Besök i djurparken', copy: `${atZoo.map(a => a.name).join(' & ')} vid hägnen.`, phase };
    }
    if (driving) {
      return { title: `${driving.name} kör genom stan`, copy: driving.thought || 'Huvudgatan lever.', phase };
    }
    if (talking.length) {
      const a = talking[0], other = state.agents.find(x => x.id === a.talking_with);
      if (other) return { title: `${a.name} och ${other.name}`, copy: a.dialog || `De möts vid ${PLACE_SV[a.place]}.`, phase };
    }
    const busy = state.agents.find(a => a.action !== 'sleep') || state.agents[0];
    return { title: `${busy.name} ${busy.actionLabel}`, copy: busy.thought || 'Ett liv i taget, synligt från torget.', phase };
  }

  function socialTick(state) {
    const grouped = {};
    state.agents.forEach(a => {
      if (a.action === 'sleep' || a.action === 'drive') { a.talking_with = ''; a.dialog = ''; return; }
      (grouped[a.place] ||= []).push(a);
    });
    Object.entries(grouped).forEach(([place, group]) => {
      if (group.length < 2) { group.forEach(a => { a.talking_with = ''; a.dialog = ''; }); return; }
      for (let i = 0; i < group.length - 1; i += 2) {
        const a = group[i], b = group[i + 1];
        const elapsed = (state.minute - (a.dialog_started ?? -20) + 1440) % 1440;
        const sticky = a.talking_with === b.id && elapsed < 11;
        if (!sticky) {
          const pair = dialogPair(a, b, state);
          a.dialog = pair.a; b.dialog = pair.b;
          a.talking_with = b.id; b.talking_with = a.id;
          a.dialog_started = b.dialog_started = state.minute;
          const delta = pair.kind === 'coop' ? 3 : pair.kind === 'conflict' ? -2 : 1;
          a.relationship[b.id] = clamp((a.relationship[b.id] || 0) + delta, -100, 100);
          b.relationship[a.id] = clamp((b.relationship[a.id] || 0) + delta, -100, 100);
          a.relationships = a.relationship; b.relationships = b.relationship;
          if (window.CityMemory) {
            window.CityMemory.rememberConversation(a, b.name, pair.a, pair.kind === 'conflict' ? 'tense' : 'warm');
            window.CityMemory.rememberConversation(b, a.name, pair.b, pair.kind === 'conflict' ? 'tense' : 'warm');
          }
          const verb = { coop: 'samarbetar', conflict: 'är oense', talk: 'pratar' }[pair.kind];
          state.events.unshift({ time: clock(state.minute), text: `${a.name} och ${b.name} ${verb} vid ${PLACE_SV[place]}.` });
          (state.social_log ||= []).unshift({ time: clock(state.minute), from: a.name, to: b.name, text: `${a.name} → ${b.name}: ${pair.a}` });
        }
      }
    });
  }

  function tickVehicles(state) {
    (state.vehicles || []).forEach((v, i) => {
      v.t = ((v.t || 0) + 0.004 + i * 0.001) % 1;
      // Rectangular road loop around the town
      const path = [
        [-36, -10], [36, -10], [36, 14], [-36, 14]
      ];
      const segLen = 1 / path.length;
      const seg = Math.floor(v.t / segLen) % path.length;
      const local = (v.t - seg * segLen) / segLen;
      const a = path[seg], b = path[(seg + 1) % path.length];
      v.x = a[0] + (b[0] - a[0]) * local;
      v.z = a[1] + (b[1] - a[1]) * local;
      v.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      if (v.rider) {
        const rider = state.agents.find(a => a.id === v.rider);
        if (rider && rider.action === 'drive') {
          rider.target = [v.x, v.z];
          rider.place = 'road';
        } else {
          v.rider = '';
        }
      }
    });
  }

  function tickAgents(state, minutes = 1) {
    if (state.paused) return;
    for (let n = 0; n < minutes * (state.speed || 1); n++) {
      state.minute = (state.minute + 1) % 1440;
      if (state.minute === 0) {
        state.day++;
        state.events.unshift({ time: clock(state.minute), text: `Dag ${state.day} börjar i Kvarter 07.` });
      }
      state.agents.forEach(agent => {
        const spec = actions[agent.action] || actions.socialise;
        Object.keys(agent.needs).forEach(k => { agent.needs[k] = clamp(agent.needs[k] + (k === 'sleep' ? 0.07 : 0.045)); });
        agent.needs[spec.need] = clamp(agent.needs[spec.need] - (agent.action === 'sleep' ? 0.85 : 0.42));
        agent.progress += 1 / spec.duration;
        const hour = hourOf(state.minute);
        const reconsider = agent.progress >= 1
          || (agent.needs.sleep > 84 && agent.action !== 'sleep')
          || (agent.needs.hunger > 82 && agent.action !== 'eat' && agent.action !== 'shop')
          || ((hour >= 23 || hour < 5.5) && agent.action !== 'sleep')
          || (hour >= 6 && hour <= 21.8 && agent.action === 'sleep' && agent.needs.sleep < 52);
        if (reconsider) startAction(agent, choose(agent, state), state);
        else {
          if (agent.action !== 'drive') agent.target = slotOf(agent, agent.place);
          if (state.minute % 9 === (agent._index || 0)) agent.thought = localThought(agent, state);
        }
      });
      tickVehicles(state);
      socialTick(state);
      state.agents.forEach(a => { a.mood = moodOf(a, state); });
      if (state.minute % 47 === 0) {
        const voters = state.agents.filter(a => a.place === 'hall');
        const law = (state.laws || []).find(l => l.status === 'pågående');
        if (voters.length >= 2 && law) {
          const yes = voters.filter(a => (a.stance || {})[law.id]).length;
          law.yes = Math.max(law.yes || 0, yes);
          law.no = Math.max(law.no || 0, voters.length - yes);
          if (law.yes >= 4) law.status = 'antagen';
          state.events.unshift({ time: clock(state.minute), text: `${voters[0].name} tar upp «${law.title}» i rådhuset.` });
        }
      }
      if (state.minute % 53 === 0) {
        const atZoo = state.agents.filter(a => a.place === 'zoo');
        if (atZoo.length) {
          state.events.unshift({ time: clock(state.minute), text: `${atZoo[0].name} stannar vid hägnen i djurparken.` });
        }
      }
      state.events = state.events.slice(0, 20);
      state.social_log = (state.social_log || []).slice(0, 18);
      state.scene = sceneStory(state);
    }
  }

  function applyRemote(state, remote) {
    if (!remote?.agents || remote.agents.length !== 5) return state;
    state.mode = remote.mode || 'live';
    state.minute = remote.minute ?? state.minute;
    state.day = remote.day ?? state.day;
    state.weather = remote.weather || state.weather;
    if (remote.laws?.length) state.laws = remote.laws;
    if (remote.events) state.events = remote.events;
    if (remote.social_log) state.social_log = remote.social_log;
    if (remote.scene) state.scene = remote.scene;
    if (remote.vehicles) state.vehicles = remote.vehicles;
    remote.agents.forEach((src, i) => {
      const dst = state.agents[i];
      const keep = { color: dst.color, home: dst.home, homeLabel: dst.homeLabel, preferred: dst.preferred, stance: dst.stance, _index: dst._index, role: dst.role || src.role, knowledge: dst.knowledge };
      Object.assign(dst, src, keep);
      dst.relationship = src.relationships || src.relationship || dst.relationship;
      dst.relationships = dst.relationship;
      dst.actionLabel = src.actionLabel || (actions[dst.action] || actions.socialise).label;
      dst.place = src.place || (actions[dst.action] || actions.socialise).place;
      dst.pose = src.pose || (actions[dst.action] || actions.socialise).pose || 'walk';
      dst.using = src.using || dst.using || '';
      dst.target = Array.isArray(src.target) ? src.target : slotOf(dst, dst.place);
      dst.mood = src.mood || dst.mood;
    });
    return state;
  }

  async function askQwen() { return null; }

  window.CityAgents = {
    actions, profiles, places, laws, PLACE_SV, HOME_X, HOME_Z, HOME_LOTS, OBJECTS,
    createSimulationState, tickAgents, askQwen, clock, startAction, choose,
    slotOf, sceneStory, applyRemote, phaseOf, hourOf, homeOf, tickVehicles
  };
})();
