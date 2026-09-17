/* Society brain: goal chains, relationships, place use — a town that feels alive. */
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
    stroll: { label: 'promenerar i parken', place: 'park', duration: 28, need: 'social', pose: 'walk' },
    wait: { label: 'väntar i kön', place: 'plaza', duration: 10, need: 'purpose', pose: 'queue' }
  };

  const places = {
    plaza: [0, 0], cafe: [0, 10.5], library: [-18, -22], workshop: [18, -22],
    school: [-18, -4], garden: [22, -8], hall: [0, -22], shop: [18, 4],
    zoo: [-32, 2], park: [-14, 8], road: [0, -8], home: [0, 22]
  };

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

  const PLACE_CAP = {
    cafe: 3, shop: 2, library: 3, workshop: 3, school: 3, hall: 4,
    zoo: 3, park: 4, garden: 3, plaza: 5, home: 1, road: 2
  };

  // Where agents stand while waiting for a full place
  const QUEUE_STAGE = {
    cafe: 'plaza', shop: 'plaza', library: 'plaza', workshop: 'plaza',
    school: 'park', hall: 'plaza', zoo: 'park', garden: 'plaza',
    park: 'plaza', home: 'plaza', road: 'plaza', plaza: 'park'
  };

  // Emergent town pulses visitors can notice
  const PULSES = [
    { id: 'market', title: 'Torgmarknad', copy: 'Stånden öppnar — bröd, sylt och lyktor.', after: 9, before: 12, draw: ['shop', 'socialise', 'eat'], weather: null },
    { id: 'concert', title: 'Kvällskonsert', copy: 'Noor spelar och kvarteret samlas vid fontänen.', after: 17, before: 20, draw: ['perform', 'socialise', 'sit'], weather: null },
    { id: 'feeding', title: 'Utfodring', copy: 'Djurparken ringer i klockan. Maten väntar.', after: 14, before: 16, draw: ['feed', 'visit_zoo'], weather: null },
    { id: 'repair', title: 'Gemensam lagning', copy: 'En lampa flimrar — verkstaden behöver fler händer.', after: 10, before: 13, draw: ['repair', 'work'], weather: null },
    { id: 'shelter', title: 'Regnskydd', copy: 'Takdropp. Caféet och biblioteket fylls.', after: 0, before: 24, draw: ['sit', 'read', 'eat'], weather: 'rain' },
    { id: 'snowhush', title: 'Snötystnad', copy: 'Steg dämpas. Någon föreslår ett tyst samtal.', after: 0, before: 24, draw: ['stroll', 'read', 'sit'], weather: 'snow' },
    { id: 'dawn', title: 'Gryningssträcka', copy: 'Första ljuset. Någon går redan mot lotten.', after: 6, before: 8, draw: ['garden', 'stroll', 'eat'], weather: null },
    { id: 'debate', title: 'Lagdebatt', copy: 'Rådhuset fylls — en pågående lag ska avgöras.', after: 15, before: 18, draw: ['vote', 'debate'], weather: null }
  ];

  const THREADS = {
    talk: [
      ['Vad händer sedan?', 'Vi tar det steg för steg — jag är kvar.'],
      ['Jag tänker på det du sa.', 'Bra. Då är vi redan två som bär det.'],
      ['Ska vi berätta för de andra?', 'Ja, men lugnt. Ryktet springer fort nog.']
    ],
    coop: [
      ['Jag tar nästa bit om du håller här.', 'Klart. Räkna högt så synkar vi.'],
      ['Det här går lättare tillsammans.', 'Just därför stannar jag.'],
      ['När vi är klara tar vi kaffe.', 'Avtalat. Jag bjuder.']
    ],
    conflict: [
      ['Jag hör dig — men jag håller inte med.', 'Då tar vi det i rådhuset, inte här.'],
      ['Vi kan vara oense utan att tappa kvarteret.', 'Det är min gräns också.'],
      ['Låt oss pausa innan det blir hårt.', 'Paus. Sedan en mening var.']
    ]
  };

  const GOSSIP = [
    'Hörde du? Marknaden drog fler än igår.',
    'Någon säger att lyktan vid skolan flimrar igen.',
    'Det sägs att lotten behöver vatten före kvällen.',
    'Ryktet går att konserten blir längre i kväll.',
    'Biblioteket ska kanske öppna sent — igen.'
  ];

  const profiles = [
    { id: 'mira', name: 'Mira', role: 'Bibliotekarie', trait: 'nyfiken · varm · undersökande', color: '#76d6c6', preferred: ['read', 'visit_zoo', 'vote'], stance: { trees: 1, 'late-library': 1, 'shared-garden': 1, 'zoo-hours': 1 }, bonds: ['liv', 'noor'] },
    { id: 'elias', name: 'Elias', role: 'Stadsplanerare', trait: 'metodisk · ansvarstagande · lugn', color: '#f1bc78', preferred: ['work', 'drive', 'garden'], stance: { trees: 1, 'late-library': 0, 'shared-garden': 1, 'zoo-hours': 1 }, bonds: ['august', 'mira'] },
    { id: 'noor', name: 'Noor', role: 'Kulturproducent', trait: 'social · kreativ · spontan', color: '#ec8fa0', preferred: ['socialise', 'perform', 'shop'], stance: { trees: 1, 'late-library': 1, 'shared-garden': 1, 'zoo-hours': 1 }, bonds: ['mira', 'liv'] },
    { id: 'liv', name: 'Liv', role: 'Lärare', trait: 'skeptisk · empatisk · principfast', color: '#a99be8', preferred: ['study', 'teach', 'stroll'], stance: { trees: 1, 'late-library': 0, 'shared-garden': 1, 'zoo-hours': 0 }, bonds: ['mira', 'august'] },
    { id: 'august', name: 'August', role: 'Reparatör', trait: 'uppfinningsrik · tävlingsinriktad · modig', color: '#8eb7ed', preferred: ['work', 'feed', 'repair'], stance: { trees: 0, 'late-library': 0, 'shared-garden': 1, 'zoo-hours': 1 }, bonds: ['elias', 'liv'] }
  ];

  // Multi-step day agendas visitors can follow as a chain
  const AGENDAS = {
    mira: [
      { after: 6, before: 8, steps: ['eat', 'read'] },
      { after: 8, before: 12, steps: ['read', 'visit_zoo'] },
      { after: 12, before: 14, steps: ['eat', 'sit'] },
      { after: 14, before: 17, steps: ['visit_zoo', 'vote', 'read'] },
      { after: 17, before: 20, steps: ['sit', 'socialise'] },
      { after: 20, before: 22.5, steps: ['read', 'stroll'] }
    ],
    elias: [
      { after: 6, before: 8, steps: ['garden', 'eat'] },
      { after: 8, before: 12, steps: ['work', 'drive'] },
      { after: 12, before: 14, steps: ['eat', 'sit'] },
      { after: 14, before: 17, steps: ['work', 'drive', 'vote'] },
      { after: 17, before: 20, steps: ['drive', 'socialise'] },
      { after: 20, before: 22.5, steps: ['shop', 'garden'] }
    ],
    noor: [
      { after: 6, before: 8, steps: ['shop', 'eat'] },
      { after: 8, before: 12, steps: ['socialise', 'perform'] },
      { after: 12, before: 14, steps: ['eat', 'sit'] },
      { after: 14, before: 17, steps: ['shop', 'perform', 'socialise'] },
      { after: 17, before: 20, steps: ['perform', 'socialise'] },
      { after: 20, before: 22.5, steps: ['socialise', 'sit'] }
    ],
    liv: [
      { after: 6, before: 8, steps: ['eat', 'stroll'] },
      { after: 8, before: 12, steps: ['study', 'teach'] },
      { after: 12, before: 14, steps: ['eat', 'stroll'] },
      { after: 14, before: 17, steps: ['stroll', 'vote', 'teach'] },
      { after: 17, before: 20, steps: ['stroll', 'socialise'] },
      { after: 20, before: 22.5, steps: ['stroll', 'read'] }
    ],
    august: [
      { after: 6, before: 8, steps: ['garden', 'eat'] },
      { after: 8, before: 12, steps: ['work', 'feed'] },
      { after: 12, before: 14, steps: ['eat', 'sit'] },
      { after: 14, before: 17, steps: ['feed', 'repair', 'work'] },
      { after: 17, before: 20, steps: ['repair', 'socialise'] },
      { after: 20, before: 22.5, steps: ['garden', 'feed'] }
    ]
  };

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
    stroll: ['Parken andas mellan träden.', 'Jag går utan mål och det räcker.'],
    wait: ['Kön rör sig långsamt. Jag väntar.', 'Någon före mig. Jag tar det lugnt.']
  };

  const DIALOG = {
    plaza: [
      ['Se hur lyktorna tänder kvarteret.', 'Ja. Torget känns som att det andas.'],
      ['Ska vi ta upp det i rådhuset i kväll?', 'Bara om vi tar med fler röster.'],
      ['Jag hörde att lotten behöver vatten.', 'Då hämtar vi August innan skymningen.']
    ],
    cafe: [
      ['Koppen värmer mer än lamporna.', 'Sitt kvar. Jag vill höra slutet.'],
      ['Regn eller inte — caféet samlar oss.', 'Det är därför jag kommer hit när jag tvekar.'],
      ['Tar du kanel eller vanilj i dag?', 'Kanel. Det luktar som höst på torget.']
    ],
    library: [
      ['Den här boken beskriver just vårt torg.', 'Läs högt. Jag minns bättre då.'],
      ['Om vi öppnar sent vinner nyfikenheten.', 'Eller så förlorar de som måste sova.']
    ],
    workshop: [
      ['Håll här. Skruven släpper om vi drar snett.', 'Jag håller. Du räknar varven.'],
      ['Lampan vid skolan flimrar igen.', 'Då tar vi den före mörkret.']
    ],
    school: [
      ['De förstår träden, men inte röstsedeln.', 'Då börjar vi med varför någon röstar nej.'],
      ['Kan du gästa lektionen i morgon?', 'Om jag får ta med en riktig ritning.']
    ],
    garden: [
      ['Jorden är torr mot mitten.', 'Jag hämtar kannan, du tar de gula bladen.'],
      ['Lotten är vår tystaste lag.', 'Och den enda som växer medan vi sover.']
    ],
    hall: [
      ['Fler träd, ja — men inte om vi skymmer lyktorna.', 'Då planterar vi mellan stolparna.'],
      ['Midnatt i biblioteket är vackert och oroligt.', 'Vi kan prova två kvällar och mäta.']
    ],
    home: [
      ['Vilken dag det blev.', 'Vila. Staden tar oss tillbaka i gryningen.'],
      ['Ditt hus luktar kaffe.', 'Kom in. Vi tar resten i morgon.']
    ],
    shop: [
      ['Har ni färskt bröd kvar?', 'Ja — och den nya sylten från lotten.'],
      ['Jag tar två liter mjölk och en lykta.', 'Lyktan är Augusts. Säg att den flimrar.']
    ],
    zoo: [
      ['Titta, renarna står i skuggan.', 'De vet mer om väder än vi gör.'],
      ['Ska vi mata änder innan stängning?', 'Bara om Liv säger att det är okej.'],
      ['Räven tittar som om den känner igen oss.', 'Kanske gör den det. Vi kommer ju ofta.']
    ],
    park: [
      ['Här är det tystare än på torget.', 'Just därför kommer jag hit.'],
      ['Ska vi sitta en stund under eken?', 'Ja. Sedan går vi till butiken.']
    ],
    road: [
      ['Kör sakta förbi skolan.', 'Jag gör det. Barnen springer ibland.'],
      ['Huvudgatan är fri just nu.', 'Bra — då hinner vi till verkstaden.']
    ]
  };
  const CONFLICT = [
    ['Du skyndar fram lagar.', 'Och du väntar tills ingenting händer.'],
    ['Jag hör principen. Jag ser också de som blir utan.', 'Principen är till för just dem.'],
    ['Det här går för fort för kvarteret.', 'Eller så går resten av världen förbi oss.']
  ];
  const COOP = [
    ['Om vi gör det tillsammans hinner vi före skymningen.', 'Jag tar vänster sida, du tar höger.'],
    ['Räkna med mig.', 'Då är vi redan två mer än igår.'],
    ['Säg till när du behöver en hand.', 'Nu. Och tack — det betyder mer än du tror.']
  ];

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
      const lane = [[-20, -8], [-8, -8], [0, -8], [10, -8], [20, -8]];
      return lane[i % lane.length];
    }
    const p = places[key] || places.plaza;
    const r = key === 'plaza' ? 3.2 : key === 'zoo' ? 4.2 : key === 'park' ? 2.8 : 1.35;
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const stretch = key === 'zoo' ? 0.85 : 0.72;
    // Slight per-agent jitter so bodies don't stack on the same point
    const jig = ((i * 17) % 7) * 0.08;
    return [p[0] + Math.cos(a) * (r + jig), p[1] + Math.sin(a) * (r + jig) * stretch];
  }

  function occupancy(state, place, exceptId) {
    return state.agents.filter(a => a.place === place && a.id !== exceptId && a.action !== 'sleep').length;
  }

  function placeOpen(action, state) {
    const place = (actions[action] || actions.socialise).place;
    const cap = PLACE_CAP[place] ?? 4;
    return occupancy(state, place) < cap;
  }

  function bestFriend(agent, state) {
    const rel = agent.relationships || agent.relationship || {};
    let best = null, score = -999;
    state.agents.forEach(o => {
      if (o.id === agent.id || o.action === 'sleep' || o.action === 'drive') return;
      const s = Number(rel[o.id] || 0) + ((agent.bonds || []).includes(o.id) ? 12 : 0);
      if (s > score) { score = s; best = o; }
    });
    return best;
  }

  function agendaStep(agent, state) {
    const hour = hourOf(state.minute);
    const blocks = AGENDAS[agent.id] || [];
    const block = blocks.find(b => hour >= b.after && hour < b.before);
    if (!block) return null;
    const plan = agent.plan || [];
    // Continue unfinished plan if still in window
    if (plan.length) {
      const next = plan[0];
      if (block.steps.includes(next) || plan.length > 1) return next;
    }
    // Fresh chain from this block, skipping full places
    const chain = block.steps.filter(step => placeOpen(step, state) || step === agent.action);
    if (!chain.length) return block.steps[0];
    // Pick start based on strongest unmet need among chain needs
    let best = chain[0], bestScore = -1;
    chain.forEach(step => {
      const need = actions[step]?.need;
      const score = need ? (agent.needs[need] || 0) : 20;
      const pref = (agent.preferred || []).includes(step) ? 18 : 0;
      const friend = bestFriend(agent, state);
      const socialBoost = (need === 'social' && friend && friend.place === actions[step].place) ? 14 : 0;
      const total = score + pref + socialBoost + Math.random() * 8;
      if (total > bestScore) { bestScore = total; best = step; }
    });
    // Store remaining chain so visitors see the arc
    const idx = chain.indexOf(best);
    agent.plan = chain.slice(idx);
    agent.planLabel = chain.map(s => actions[s]?.label || s).join(' → ');
    return best;
  }

  function localThought(agent, state) {
    const lines = THOUGHTS[agent.action] || THOUGHTS.socialise;
    const seed = Math.floor(state.minute / 9) + (agent._index || 0) * 3;
    const other = state.agents.find(x => x.id === agent.talking_with);
    let thought = lines[seed % lines.length];
    if (agent.plan?.length > 1 && seed % 4 === 0) {
      const nxt = actions[agent.plan[1]];
      if (nxt) thought = `${thought} Sedan ${nxt.label}.`;
    }
    if (agent.using) {
      const obj = OBJECTS[agent.using];
      if (obj && seed % 3 === 0) thought = `Jag använder ${obj.label}. ${thought}`;
    }
    if (other) {
      const rel = Number((agent.relationships || {})[other.id] || 0);
      thought += rel > 20 ? ` ${other.name} får mig att stanna.` : ` ${other.name} är här.`;
    }
    if (seed % 5 === 0) thought = ({ clear: 'Luften är klar. ', rain: 'Regnet sätter tempot. ', snow: 'Snön dämpar rösterna. ' })[state.weather] + thought;
    const openLaw = (state.laws || []).find(l => l.status === 'pågående');
    if (openLaw && agent.place === 'hall' && seed % 2 === 0) thought = `«${openLaw.title}» ligger framför oss. ${thought}`;
    if (agent.action === 'wait' && agent.waitingFor) {
      const where = PLACE_SV[(actions[agent.waitingFor] || {}).place] || agent.waitingFor;
      thought = `Jag väntar på plats vid ${where}. ${thought}`;
    }
    if (state.pulse && seed % 3 === 1) thought = `${state.pulse.title}: ${thought}`;
    if (agent.lastGossip && seed % 7 === 0) thought = `${agent.lastGossip} ${thought}`;
    return thought;
  }

  function createAgent(profile, i) {
    const rel = {};
    profiles.forEach((p, k) => { if (p.id !== profile.id) rel[p.id] = 8 - Math.abs(i - k) + ((profile.bonds || []).includes(p.id) ? 10 : 0); });
    const home = homeOf({ _index: i, id: profile.id });
    return {
      ...profile, _index: i, home, homeLabel: HOME_LOTS[i].label,
      needs: { sleep: 28 + i * 6, hunger: 34 + i * 4, social: 42 - i * 3, curiosity: 38 + i * 3, purpose: 45 },
      relationship: rel, relationships: rel, knowledge: ['Staden har fem egna hus, en butik, en djurpark och en huvudgata.'],
      action: 'socialise', actionLabel: actions.socialise.label, place: 'plaza', progress: 0,
      pose: 'talk', using: '',
      target: slotOf({ _index: i, id: profile.id }, 'plaza'), thought: 'Jag undrar vad som händer idag.',
      dialog: '', talking_with: '', mood: 'nyfiken', memory: ['En ny kväll börjar på torget.'],
      plan: [], planLabel: '',
      waitingFor: '', threadTurn: 0, lastGossip: '',
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
      pulse: null,
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


  function activePulse(state) {
    const hour = hourOf(state.minute);
    const weather = state.weather || 'clear';
    // Keep sticky pulse for the current 25-minute block
    const block = Math.floor(state.minute / 25);
    if (state.pulse && state.pulse.block === block) {
      return state.pulse;
    }
    // Deterministic pick from eligible pulses
    const eligible = PULSES.filter(p => {
      if (p.weather) return p.weather === weather && hour >= p.after && hour < p.before;
      if ((weather === 'rain' || weather === 'snow') && (p.id === 'concert' || p.id === 'market' || p.id === 'feeding')) return false;
      return hour >= p.after && hour < p.before;
    });
    if (!eligible.length) { state.pulse = null; return null; }
    const seed = state.day * 17 + Math.floor(state.minute / 25);
    const pick = eligible[seed % eligible.length];
    const next = { id: pick.id, title: pick.title, copy: pick.copy, draw: pick.draw.slice(), block, until: (block * 25 + 25) % 1440 };
    const changed = !state.pulse || state.pulse.id !== next.id;
    state.pulse = next;
    if (changed) {
      state.events.unshift({ time: clock(state.minute), text: `Stadspuls: ${next.title}. ${next.copy}` });
      state.events = state.events.slice(0, 20);
    }
    return state.pulse;
  }

  function queueSlot(agent, intendedPlace) {
    const stage = QUEUE_STAGE[intendedPlace] || 'plaza';
    const base = slotOf(agent, stage);
    // Stand just outside intended place, facing toward it
    const dest = places[intendedPlace] || places.plaza;
    const dx = dest[0] - base[0], dz = dest[1] - base[1];
    const len = Math.hypot(dx, dz) || 1;
    const i = agent._index ?? 0;
    return [
      dest[0] - (dx / len) * (2.4 + i * 0.35),
      dest[1] - (dz / len) * (2.4 + i * 0.35) * 0.85
    ];
  }

  function choose(agent, state) {
    const n = agent.needs, hour = hourOf(state.minute);
    const pulse = activePulse(state);
    // Resume after queue if intended place opened
    if (agent.waitingFor && placeOpen(agent.waitingFor, state)) {
      const resume = agent.waitingFor;
      agent.waitingFor = '';
      return resume;
    }
    // Hard needs first
    if (n.sleep > 82 || ((hour >= 22.5 || hour < 6) && n.sleep > 38)) return 'sleep';
    if (hour >= 22.5 || hour < 6) return 'sleep';
    if (n.hunger > 76) {
      const food = hour % 2 < 1 ? 'eat' : 'shop';
      if (placeOpen(food, state)) return food;
      const alt = food === 'eat' ? 'shop' : 'eat';
      if (placeOpen(alt, state)) return alt;
      agent.waitingFor = food;
      return 'wait';
    }
    // Town pulse draws people (emergent gathering)
    if (pulse && pulse.draw?.length && (hourOf(state.minute) % 1 < 0.55 || n.social > 55 || n.curiosity > 55)) {
      const pull = pulse.draw.find(a => placeOpen(a, state) || a === agent.action);
      if (pull && ((agent.preferred || []).includes(pull) || Math.random() < 0.55 || pulse.id === 'concert' || pulse.id === 'market')) {
        if (placeOpen(pull, state) || pull === agent.action) return pull;
        agent.waitingFor = pull;
        return 'wait';
      }
    }
    // Seek companion when lonely
    if (n.social > 72) {
      const friend = bestFriend(agent, state);
      if (friend && friend.place !== 'home' && friend.place !== 'road') {
        const meet = Object.keys(actions).find(k => actions[k].place === friend.place && actions[k].need === 'social' && k !== 'wait');
        if (meet && placeOpen(meet, state)) return meet;
        if (placeOpen('socialise', state)) return 'socialise';
      }
    }
    // Agenda chain (visible plan)
    const fromAgenda = agendaStep(agent, state);
    if (fromAgenda) {
      if (placeOpen(fromAgenda, state) || fromAgenda === agent.action) return fromAgenda;
      const blocks = AGENDAS[agent.id] || [];
      const block = blocks.find(b => hour >= b.after && hour < b.before);
      const alt = (block?.steps || []).find(s => placeOpen(s, state));
      if (alt) return alt;
      agent.waitingFor = fromAgenda;
      return 'wait';
    }
    // Weather-aware soft fallback
    if (state.weather === 'rain' && placeOpen('sit', state)) return 'sit';
    if (state.weather === 'snow' && placeOpen('read', state)) return 'read';
    const pref = agent.preferred[0] || 'socialise';
    if (placeOpen(pref, state)) return pref;
    agent.waitingFor = pref;
    return 'wait';
  }

  function startAction(agent, action, state) {
    const spec = actions[action] || actions.socialise;
    // Advance plan pointer
    if (agent.plan?.length && agent.plan[0] === action) {
      agent.plan = agent.plan.slice(1);
      agent.planLabel = agent.plan.map(s => actions[s]?.label || s).join(' → ');
    } else if (!agent.plan?.length || agent.plan[0] !== action) {
      // Starting something off-plan — keep a short hint of what's next from agenda
      const hour = state ? hourOf(state.minute) : 12;
      const block = (AGENDAS[agent.id] || []).find(b => hour >= b.after && hour < b.before);
      if (block) {
        const idx = block.steps.indexOf(action);
        agent.plan = idx >= 0 ? block.steps.slice(idx) : [action, ...block.steps.filter(s => s !== action).slice(0, 2)];
        agent.planLabel = agent.plan.map(s => actions[s]?.label || s).join(' → ');
      } else {
        agent.plan = [action];
        agent.planLabel = spec.label;
      }
    }
    agent.action = action;
    agent.actionLabel = spec.label;
    agent.place = spec.place;
    agent.pose = spec.pose || 'walk';
    agent.using = objectFor(action, spec.place);
    agent.progress = 0;
    agent.action_started = state ? state.minute : agent.action_started;
    agent.talking_with = '';
    agent.dialog = '';
    agent.threadTurn = 0;
    if (action === 'wait' && agent.waitingFor) {
      const intended = (actions[agent.waitingFor] || {}).place || agent.waitingFor;
      agent.place = QUEUE_STAGE[intended] || 'plaza';
      agent.actionLabel = `väntar till ${PLACE_SV[intended] || intended}`;
      agent.pose = 'queue';
      agent.target = queueSlot(agent, intended);
    } else {
      if (action !== 'wait') agent.waitingFor = '';
      agent.target = slotOf(agent, agent.place);
    }
    if (state) {
      agent.thought = localThought(agent, state);
      (state.vehicles || []).forEach(v => { if (v.rider === agent.id) v.rider = ''; });
      if (action === 'drive' && state.vehicles?.length) {
        const free = state.vehicles.find(v => !v.rider) || state.vehicles[agent._index % state.vehicles.length];
        free.rider = agent.id;
        agent.using = free.id;
        agent.actionLabel = `kör ${free.label}`;
      }
      if (agent.plan?.length > 1) {
        state.events.unshift({
          time: clock(state.minute),
          text: `${agent.name} tar sig an: ${agent.planLabel}.`
        });
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
    if ((a.bonds || []).includes(b.id) && score >= 0) return 'coop';
    if (score < 0) return 'conflict';
    if (score > 18) return 'coop';
    return 'talk';
  }

  function dialogPair(a, b, state) {
    const kind = relationKind(a, b);
    const seed = Math.floor(state.minute / 11) + (a._index || 0) + (b._index || 0);
    const turn = Math.max(a.threadTurn || 0, b.threadTurn || 0);
    let pack = kind === 'conflict' ? CONFLICT : kind === 'coop' ? COOP : (DIALOG[a.place] || DIALOG.plaza);
    // Continuing thread: follow-up beats instead of a fresh opener
    if (turn >= 1 && a.talking_with === b.id) {
      const thread = THREADS[kind] || THREADS.talk;
      pack = thread;
    }
    const weatherBit = state.weather === 'rain'
      ? [['Regnet tränger in under takfoten.', 'Bra. Då stannar vi en stund till.']]
      : state.weather === 'snow'
        ? [['Snön lägger sig på bänkarna.', 'Då tar vi det lugnare i dag.']]
        : null;
    const law = (state.laws || []).find(l => l.status === 'pågående');
    const lawBit = law && a.place === 'hall'
      ? [[`Om «${law.title}» — hur röstar du?`, 'Jag har sett kvarteret. Jag står fast.']]
      : null;
    const planBit = a.plan?.[1]
      ? [[`Efter det här tänker jag ${(actions[a.plan[1]] || {}).label || 'vidare'}.`, `Då korsar vi varandra snart igen.`]]
      : null;
    const pulse = state.pulse;
    const pulseBit = pulse
      ? [[`Känner du pulsen? ${pulse.title}.`, `Ja — ${pulse.copy}`]]
      : null;
    if (turn === 0 && kind === 'talk' && weatherBit && seed % 5 === 0) pack = weatherBit;
    if (turn === 0 && kind !== 'conflict' && lawBit && seed % 4 === 1) pack = lawBit;
    if (turn === 0 && kind === 'talk' && planBit && seed % 3 === 2) pack = planBit;
    if (turn === 0 && pulseBit && seed % 4 === 0) pack = pulseBit;
    const pair = pack[seed % pack.length];
    let lineA = pair[0], lineB = pair[1];
    if (seed % 6 === 0) lineA = `${b.name}, ${lineA.charAt(0).toLowerCase()}${lineA.slice(1)}`;
    if (seed % 7 === 0) lineB = `${a.name} — ${lineB}`;
    return { kind, a: lineA, b: lineB };
  }

  function moodOf(agent, state) {
    if (agent.action === 'sleep') return 'sömnig';
    if (agent.talking_with) {
      const other = state.agents.find(x => x.id === agent.talking_with);
      if (other && relationKind(agent, other) === 'conflict') return 'oense';
      if (other && relationKind(agent, other) === 'coop') return 'samarbetar';
      return 'samtal';
    }
    if (agent.action === 'wait') return 'i kö';
    if (agent.needs.hunger > 70) return 'hungrig';
    if (agent.needs.social > 70) return 'söker sällskap';
    if (agent.plan?.length > 1) return 'på väg';
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
    const queued = state.agents.filter(a => a.action === 'wait');
    const planner = state.agents.find(a => (a.plan || []).length > 1);
    const pulse = state.pulse;
    if (sleeping.length >= 4 && (phase === 'natt' || phase === 'morgon')) {
      return { title: 'Staden sover', copy: 'Fem hus är tysta. I gryningen börjar de om.', phase };
    }
    if (pulse && pulse.title) {
      const drawn = state.agents.filter(a => (pulse.draw || []).includes(a.action));
      if (drawn.length >= 2 || hourOf(state.minute) % 1 < 0.4) {
        return { title: pulse.title, copy: pulse.copy + (drawn.length ? ` · ${drawn.map(a => a.name).join(', ')}` : ''), phase };
      }
    }
    if (queued.length >= 2) {
      return { title: 'Kö utanför dörren', copy: `${queued.map(a => a.name).join(' & ')} väntar på plats.`, phase };
    }
    if (atZoo.length >= 2) {
      return { title: 'Besök i djurparken', copy: `${atZoo.map(a => a.name).join(' & ')} vid hägnen.`, phase };
    }
    if (driving) {
      return { title: `${driving.name} kör genom stan`, copy: driving.thought || 'Huvudgatan lever.', phase };
    }
    if (talking.length) {
      const a = talking[0], other = state.agents.find(x => x.id === a.talking_with);
      if (other) {
        const beat = (a.threadTurn || 0) >= 1 ? 'Samtalet fördjupas' : `${a.name} och ${other.name}`;
        return { title: beat, copy: a.dialog || `De möts vid ${PLACE_SV[a.place]}.`, phase };
      }
    }
    if (planner) {
      return { title: `${planner.name} följer sin dag`, copy: planner.planLabel || planner.thought, phase };
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
      // Prefer bonding pairs / high relationship when pairing
      const unused = new Set(group.map(a => a.id));
      const pairs = [];
      const ranked = [...group].sort((a, b) => {
        const ra = Math.max(...group.filter(o => o.id !== a.id).map(o => Number((a.relationships || {})[o.id] || 0)));
        const rb = Math.max(...group.filter(o => o.id !== b.id).map(o => Number((b.relationships || {})[o.id] || 0)));
        return rb - ra;
      });
      ranked.forEach(a => {
        if (!unused.has(a.id)) return;
        let partner = null, best = -999;
        group.forEach(b => {
          if (b.id === a.id || !unused.has(b.id)) return;
          let s = Number((a.relationships || {})[b.id] || 0);
          if ((a.bonds || []).includes(b.id)) s += 15;
          if (a.talking_with === b.id) s += 20;
          if (s > best) { best = s; partner = b; }
        });
        if (partner) {
          unused.delete(a.id); unused.delete(partner.id);
          pairs.push([a, partner]);
        }
      });
      pairs.forEach(([a, b]) => {
        const elapsed = (state.minute - (a.dialog_started ?? -20) + 1440) % 1440;
        const samePair = a.talking_with === b.id && b.talking_with === a.id;
        // Sticky opener ~12 min, then advance thread every ~9 min up to 3 beats
        const sticky = samePair && elapsed < 12;
        const advance = samePair && !sticky && elapsed >= 12 && (a.threadTurn || 0) < 3;
        if (!sticky) {
          if (advance) a.threadTurn = (a.threadTurn || 0) + 1;
          else if (!samePair) a.threadTurn = 0;
          b.threadTurn = a.threadTurn;
          const pair = dialogPair(a, b, state);
          a.dialog = pair.a; b.dialog = pair.b;
          a.talking_with = b.id; b.talking_with = a.id;
          a.dialog_started = b.dialog_started = state.minute;
          const delta = pair.kind === 'coop' ? 3 : pair.kind === 'conflict' ? -2 : 1;
          a.relationship[b.id] = clamp((a.relationship[b.id] || 0) + delta, -100, 100);
          b.relationship[a.id] = clamp((b.relationship[a.id] || 0) + delta, -100, 100);
          a.relationships = a.relationship; b.relationships = b.relationship;
          a.needs.social = clamp(a.needs.social - 8);
          b.needs.social = clamp(b.needs.social - 8);
          if (window.CityMemory) {
            window.CityMemory.rememberConversation(a, b.name, pair.a, pair.kind === 'conflict' ? 'tense' : 'warm');
            window.CityMemory.rememberConversation(b, a.name, pair.b, pair.kind === 'conflict' ? 'tense' : 'warm');
          }
          const verb = (a.threadTurn || 0) >= 1
            ? 'fördjupar samtalet'
            : { coop: 'samarbetar', conflict: 'är oense', talk: 'pratar' }[pair.kind];
          state.events.unshift({ time: clock(state.minute), text: `${a.name} och ${b.name} ${verb} vid ${PLACE_SV[place]}.` });
          (state.social_log ||= []).unshift({ time: clock(state.minute), from: a.name, to: b.name, text: `${a.name} → ${b.name}: ${pair.a}` });
          // Gossip: after a thread beat, a bystander elsewhere may overhear the news
          if ((a.threadTurn || 0) >= 1 && state.minute % 13 === 0) {
            const outsider = state.agents.find(o => o.id !== a.id && o.id !== b.id && o.action !== 'sleep' && o.place !== place);
            if (outsider) {
              const g = GOSSIP[(state.minute + (outsider._index || 0)) % GOSSIP.length];
              outsider.lastGossip = g;
              outsider.thought = `${g} (${a.name} & ${b.name}.)`;
              outsider.knowledge = [...(outsider.knowledge || []).slice(-4), g];
              state.events.unshift({ time: clock(state.minute), text: `${outsider.name} hör ryktet: ${g}` });
            }
          }
        }
      });
      unused.forEach(id => {
        const loner = group.find(a => a.id === id);
        if (loner) { loner.talking_with = ''; loner.dialog = ''; }
      });
    });
  }

  function tickVehicles(state) {
    (state.vehicles || []).forEach((v, i) => {
      const speed = (v.rider ? 0.0052 : 0.0036) + i * 0.0008;
      v.t = ((v.t || 0) + speed) % 1;
      const path = [[-36, -10], [36, -10], [36, 14], [-36, 14]];
      const segLen = 1 / path.length;
      const seg = Math.floor(v.t / segLen) % path.length;
      const raw = (v.t - seg * segLen) / segLen;
      const local = raw * raw * (3 - 2 * raw);
      const a = path[seg], b = path[(seg + 1) % path.length];
      v.x = a[0] + (b[0] - a[0]) * local;
      v.z = a[1] + (b[1] - a[1]) * local;
      v.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      if (v.rider) {
        const rider = state.agents.find(ag => ag.id === v.rider);
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
        state.agents.forEach(a => { a.plan = []; a.planLabel = ''; a.waitingFor = ''; a.threadTurn = 0; });
        state.pulse = null;
      }
      activePulse(state);
      state.agents.forEach(agent => {
        const spec = actions[agent.action] || actions.socialise;
        Object.keys(agent.needs).forEach(k => {
          let drift = k === 'sleep' ? 0.07 : 0.045;
          if (k === 'social' && !agent.talking_with) drift += 0.02;
          if (k === 'purpose' && ['work', 'repair', 'garden', 'feed', 'teach'].includes(agent.action)) drift *= 0.4;
          agent.needs[k] = clamp(agent.needs[k] + drift);
        });
        agent.needs[spec.need] = clamp(agent.needs[spec.need] - (agent.action === 'sleep' ? 0.85 : 0.42));
        agent.progress += 1 / spec.duration;
        const hour = hourOf(state.minute);
        const queueReady = agent.action === 'wait' && agent.waitingFor && placeOpen(agent.waitingFor, state);
        const reconsider = agent.progress >= 1
          || queueReady
          || (agent.needs.sleep > 84 && agent.action !== 'sleep')
          || (agent.needs.hunger > 82 && agent.action !== 'eat' && agent.action !== 'shop' && agent.action !== 'wait')
          || (agent.needs.social > 88 && !['socialise', 'sit', 'perform', 'stroll', 'wait'].includes(agent.action))
          || ((hour >= 23 || hour < 5.5) && agent.action !== 'sleep')
          || (hour >= 6 && hour <= 21.8 && agent.action === 'sleep' && agent.needs.sleep < 52);
        if (reconsider) startAction(agent, choose(agent, state), state);
        else {
          if (agent.action === 'wait' && agent.waitingFor) {
            const intended = (actions[agent.waitingFor] || {}).place || agent.waitingFor;
            agent.target = queueSlot(agent, intended);
          } else if (agent.action !== 'drive') {
            agent.target = slotOf(agent, agent.place);
          }
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
    if (remote.pulse !== undefined) state.pulse = remote.pulse;
    remote.agents.forEach((src, i) => {
      const dst = state.agents[i];
      const keep = { color: dst.color, home: dst.home, homeLabel: dst.homeLabel, preferred: dst.preferred, stance: dst.stance, bonds: dst.bonds, _index: dst._index, role: dst.role || src.role, knowledge: dst.knowledge };
      Object.assign(dst, src, keep);
      dst.relationship = src.relationships || src.relationship || dst.relationship;
      dst.relationships = dst.relationship;
      dst.actionLabel = src.actionLabel || (actions[dst.action] || actions.socialise).label;
      dst.place = src.place || (actions[dst.action] || actions.socialise).place;
      dst.pose = src.pose || (actions[dst.action] || actions.socialise).pose || 'walk';
      dst.using = src.using || dst.using || '';
      dst.plan = Array.isArray(src.plan) ? src.plan : (dst.plan || []);
      dst.planLabel = src.planLabel || dst.planLabel || '';
      dst.waitingFor = src.waitingFor || '';
      dst.threadTurn = src.threadTurn || 0;
      dst.target = Array.isArray(src.target) ? src.target : slotOf(dst, dst.place);
      dst.mood = src.mood || dst.mood;
    });
    return state;
  }

  async function askQwen() { return null; }

  window.CityAgents = {
    actions, profiles, places, laws, PLACE_SV, HOME_X, HOME_Z, HOME_LOTS, OBJECTS, AGENDAS, PULSES,
    createSimulationState, tickAgents, askQwen, clock, startAction, choose,
    slotOf, sceneStory, applyRemote, phaseOf, hourOf, homeOf, tickVehicles, activePulse
  };
})();
