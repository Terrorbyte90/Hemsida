/* Society brain: local utility AI that looks like a small civilization. */
(() => {
  const actions = {
    sleep: { label: 'sover på verandan', place: 'home', duration: 80, need: 'sleep' },
    eat: { label: 'äter på caféet', place: 'cafe', duration: 28, need: 'hunger' },
    socialise: { label: 'pratar på torget', place: 'plaza', duration: 22, need: 'social' },
    read: { label: 'läser i biblioteket', place: 'library', duration: 48, need: 'curiosity' },
    work: { label: 'arbetar i verkstaden', place: 'workshop', duration: 55, need: 'purpose' },
    study: { label: 'pluggar i skolan', place: 'school', duration: 50, need: 'curiosity' },
    garden: { label: 'odlar i trädgården', place: 'garden', duration: 40, need: 'purpose' },
    vote: { label: 'röstar i rådhuset', place: 'hall', duration: 20, need: 'purpose' },
    debate: { label: 'debatterar en lag', place: 'hall', duration: 18, need: 'purpose' },
    repair: { label: 'lagar något tillsammans', place: 'workshop', duration: 32, need: 'purpose' },
    teach: { label: 'håller lektion', place: 'school', duration: 36, need: 'curiosity' },
    perform: { label: 'spelar på torget', place: 'plaza', duration: 24, need: 'social' }
  };
  const places = {
    plaza: [0, 0.55], cafe: [0, 3.15], library: [-7.4, -6.25], workshop: [7.4, -6.25],
    school: [-7.4, -0.25], garden: [7.5, 0.9], hall: [0, -6.45], home: [0, 5.55]
  };
  const HOME_X = [-8, -4, 0, 4, 8];
  const PLACE_SV = {
    plaza: 'torget', cafe: 'caféet', library: 'biblioteket', workshop: 'verkstaden',
    school: 'skolan', garden: 'trädgården', hall: 'rådhuset', home: 'hemmet'
  };
  const profiles = [
    { id: 'mira', name: 'Mira', role: 'Bibliotekarie', trait: 'nyfiken · varm · undersökande', color: '#76d6c6', preferred: ['read', 'socialise', 'vote'], stance: { trees: 1, 'late-library': 1, 'shared-garden': 1 } },
    { id: 'elias', name: 'Elias', role: 'Stadsplanerare', trait: 'metodisk · ansvarstagande · lugn', color: '#f1bc78', preferred: ['work', 'vote', 'garden'], stance: { trees: 1, 'late-library': 0, 'shared-garden': 1 } },
    { id: 'noor', name: 'Noor', role: 'Kulturproducent', trait: 'social · kreativ · spontan', color: '#ec8fa0', preferred: ['socialise', 'perform', 'eat'], stance: { trees: 1, 'late-library': 1, 'shared-garden': 1 } },
    { id: 'liv', name: 'Liv', role: 'Lärare', trait: 'skeptisk · empatisk · principfast', color: '#a99be8', preferred: ['study', 'teach', 'vote'], stance: { trees: 1, 'late-library': 0, 'shared-garden': 1 } },
    { id: 'august', name: 'August', role: 'Reparatör', trait: 'uppfinningsrik · tävlingsinriktad · modig', color: '#8eb7ed', preferred: ['work', 'garden', 'repair'], stance: { trees: 0, 'late-library': 0, 'shared-garden': 1 } }
  ];
  const laws = [
    { id: 'trees', title: 'Fler träd längs huvudgatan', author: 'Elias', yes: 3, no: 1, status: 'pågående' },
    { id: 'late-library', title: 'Biblioteket öppet efter midnatt', author: 'Mira', yes: 2, no: 2, status: 'pågående' },
    { id: 'shared-garden', title: 'Gemensam odlingslott på torget', author: 'August', yes: 4, no: 0, status: 'antagen' }
  ];
  const THOUGHTS = {
    sleep: ['Kroppen sjunker. I morgon tar vi om det här.', 'Verandan är sval. Jag släpper dagen.'],
    eat: ['Ångan från koppen luktar som att någon väntar.', 'Jag äter långsamt och lyssnar på staden.'],
    socialise: ['Torget rymmer fler samtal än lagar.', 'Jag vill veta hur de andra egentligen har det.'],
    read: ['En mening i en bok kan flytta ett helt kvarter.', 'Jag stryker under det Elias skulle förneka.'],
    work: ['Om något kärvar lagar jag det innan kvällen.', 'Ritningen sitter. Nu är det händer som gäller.'],
    study: ['Eleverna förtjänar mer än färdiga svar.', 'Jag övar frågan jag ska ställa i morgon.'],
    garden: ['Jorden under naglarna är den ärligaste rapporten.', 'Om vi vattnar nu klarar lotten natten.'],
    vote: ['En lag utan samtal är bara ett papper.', 'Jag räknar rösterna mot det jag faktiskt sett.'],
    debate: ['Vi är oense — och det är så staden blir vuxen.', 'Jag backar inte, men jag lyssnar färdigt.'],
    repair: ['Två par händer, en trasig lampa, ett kvarter som ser.', 'Vi lagar det tillsammans eller inte alls.'],
    teach: ['Jag sänker rösten så att de lutar sig fram.', 'Kunskap som inte delas ruttnar i hyllan.'],
    perform: ['Om jag spelar nu samlas de av sig själva.', 'Musiken är mitt sätt att rösta.']
  };
  const DIALOG = {
    plaza: [['Se hur lyktorna tänder kvarteret.', 'Ja. Torget känns som att det andas.'], ['Ska vi ta upp det i rådhuset i kväll?', 'Bara om vi tar med fler röster.'], ['Jag hörde att lotten behöver vatten.', 'Då hämtar vi August innan skymningen.']],
    cafe: [['Koppen värmer mer än lamporna.', 'Sitt kvar. Jag vill höra slutet.'], ['Regn eller inte — caféet samlar oss.', 'Det är därför jag kommer hit när jag tvekar.']],
    library: [['Den här boken beskriver just vårt torg.', 'Läs högt. Jag minns bättre då.'], ['Om vi öppnar sent vinner nyfikenheten.', 'Eller så förlorar de som måste sova.']],
    workshop: [['Håll här. Skruven släpper om vi drar snett.', 'Jag håller. Du räknar varven.'], ['Lampan vid skolan flimrar igen.', 'Då tar vi den före mörkret.']],
    school: [['De förstår träden, men inte röstsedeln.', 'Då börjar vi med varför någon röstar nej.'], ['Kan du gästa lektionen i morgon?', 'Om jag får ta med en riktig ritning.']],
    garden: [['Jorden är torr mot mitten.', 'Jag hämtar kannan, du tar de gula bladen.'], ['Lotten är vår tystaste lag.', 'Och den enda som växer medan vi sover.']],
    hall: [['Fler träd, ja — men inte om vi skymmer lyktorna.', 'Då planterar vi mellan stolparna.'], ['Midnatt i biblioteket är vackert och oroligt.', 'Vi kan prova två kvällar och mäta.']],
    home: [['Vilken dag det blev.', 'Vila. Staden tar oss tillbaka i gryningen.']]
  };
  const CONFLICT = [['Du skyndar fram lagar.', 'Och du väntar tills ingenting händer.'], ['Jag hör principen. Jag ser också de som blir utan.', 'Principen är till för just dem.']];
  const COOP = [['Om vi gör det tillsammans hinner vi före skymningen.', 'Jag tar vänster sida, du tar höger.'], ['Räkna med mig.', 'Då är vi redan två mer än igår.']];
  const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
  const clock = m => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  const hourOf = m => (m % 1440) / 60;
  const phaseOf = m => { const h = hourOf(m); return h >= 22 || h < 5 ? 'natt' : h < 8 ? 'morgon' : h < 17 ? 'dag' : h < 20 ? 'kväll' : 'skymning'; };
  const indexOf = id => Math.max(0, profiles.findIndex(p => p.id === id));

  function slotOf(agent, place) {
    const i = agent._index ?? indexOf(agent.id);
    const key = place || agent.place || 'plaza';
    if (key === 'home') return [HOME_X[i], 5.55];
    const p = places[key] || places.plaza;
    const r = key === 'plaza' ? 1.7 : 1.08;
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.72];
  }

  function localThought(agent, state) {
    const lines = THOUGHTS[agent.action] || THOUGHTS.socialise;
    const seed = Math.floor(state.minute / 9) + (agent._index || 0) * 3;
    const other = state.agents.find(x => x.id === agent.talking_with);
    let thought = lines[seed % lines.length];
    if (other) thought += ` ${other.name} är här.`;
    if (seed % 5 === 0) thought = ({ clear: 'Luften är klar. ', rain: 'Regnet sätter tempot. ', snow: 'Snön dämpar rösterna. ' })[state.weather] + thought;
    return thought;
  }

  function createAgent(profile, i) {
    const rel = {};
    profiles.forEach((p, k) => { if (p.id !== profile.id) rel[p.id] = 8 - Math.abs(i - k); });
    return {
      ...profile, _index: i, home: [HOME_X[i], 5.55],
      needs: { sleep: 28 + i * 6, hunger: 34 + i * 4, social: 42 - i * 3, curiosity: 38 + i * 3, purpose: 45 },
      relationship: rel, relationships: rel, knowledge: ['Staden har fem verandor mot ett gemensamt torg.'],
      action: 'socialise', actionLabel: actions.socialise.label, place: 'plaza', progress: 0,
      target: slotOf({ _index: i, id: profile.id }, 'plaza'), thought: 'Jag undrar vad som händer idag.',
      dialog: '', talking_with: '', mood: 'nyfiken', memory: ['En ny kväll börjar på torget.'],
      online: false, action_started: 19 * 60 + 12, dialog_started: -20
    };
  }

  function createSimulationState() {
    const fresh = {
      minute: 19 * 60 + 12, day: 12, agents: profiles.map(createAgent),
      laws: laws.map(l => ({ ...l })), weather: 'clear', paused: false, speed: 1,
      events: [{ time: '19:12', text: 'Stadens fem invånare möts på torget.' }],
      social_log: [], selected: 'mira', qwenEndpoint: '', lastQwen: 0, mode: 'local',
      scene: { title: 'Staden andas in', copy: 'Fem liv, ett torg, inga färdiga repliker.', phase: 'kväll' }
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
    if (n.hunger > 76) return 'eat';
    if (hour >= 6.2 && hour < 8) return (agent.id === 'august' || agent.id === 'elias') ? 'garden' : 'eat';
    if (hour >= 8 && hour < 12) {
      return ({ mira: 'read', elias: 'work', noor: hour > 10 ? 'perform' : 'socialise', liv: hour > 9 ? 'teach' : 'study', august: hour > 10 ? 'repair' : 'work' })[agent.id];
    }
    if (hour >= 12 && hour < 13.6) return n.hunger > 28 ? 'eat' : 'socialise';
    if (hour >= 13.6 && hour < 17) {
      if (hour > 15.5 && (agent.id === 'elias' || agent.id === 'liv' || agent.id === 'mira')) return 'vote';
      return ({ mira: 'read', elias: 'work', noor: 'socialise', liv: 'study', august: 'work' })[agent.id];
    }
    if (hour >= 17 && hour < 20) {
      if (n.social > 45 || agent.id === 'noor' || agent.id === 'mira') return agent.id === 'noor' ? 'perform' : 'socialise';
      return n.hunger > 50 ? 'eat' : (agent.preferred[0] || 'socialise');
    }
    if (hour >= 20 && hour < 22.5) {
      if (agent.id === 'mira') return 'read';
      if (agent.id === 'august') return state.weather === 'snow' ? 'read' : 'garden';
      return 'socialise';
    }
    return agent.preferred[0] || 'socialise';
  }

  function startAction(agent, action, state) {
    const spec = actions[action] || actions.socialise;
    agent.action = action;
    agent.actionLabel = spec.label;
    agent.place = spec.place;
    agent.progress = 0;
    agent.action_started = state ? state.minute : agent.action_started;
    agent.target = slotOf(agent, spec.place);
    agent.talking_with = '';
    agent.dialog = '';
    if (state) agent.thought = localThought(agent, state);
  }

  function relationKind(a, b) {
    const score = Number((a.relationships || a.relationship || {})[b.id] || 0);
    if (a.place === 'hall') {
      const sa = a.stance || {}, sb = b.stance || {};
      if (sa['late-library'] !== sb['late-library'] || sa.trees !== sb.trees) return 'conflict';
      return 'coop';
    }
    if (a.place === 'workshop' || a.place === 'garden') return 'coop';
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
    if (['work', 'repair', 'garden'].includes(agent.action)) return 'upptagen';
    if (['read', 'study', 'teach'].includes(agent.action)) return 'koncentrerad';
    return 'närvarande';
  }

  function sceneStory(state) {
    const phase = phaseOf(state.minute);
    const sleeping = state.agents.filter(a => a.action === 'sleep');
    const talking = state.agents.filter(a => a.talking_with);
    if (sleeping.length >= 4 && (phase === 'natt' || phase === 'morgon')) {
      return { title: 'Staden sover', copy: 'Verandorna är tysta. I gryningen börjar de om.', phase };
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
      if (a.action === 'sleep') { a.talking_with = ''; a.dialog = ''; return; }
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
          if (state.minute % 8 < 2) {
            state.events.unshift({ time: clock(state.minute), text: `${a.name} och ${b.name} ${verb} vid ${PLACE_SV[place]}.` });
            (state.social_log ||= []).unshift({ time: clock(state.minute), from: a.name, to: b.name, text: `${a.name} → ${b.name}: ${pair.a}` });
          }
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
          || (agent.needs.hunger > 82 && agent.action !== 'eat')
          || ((hour >= 23 || hour < 5.5) && agent.action !== 'sleep')
          || (hour >= 7.2 && hour <= 21 && agent.action === 'sleep' && agent.needs.sleep < 46);
        if (reconsider) startAction(agent, choose(agent, state), state);
        else {
          agent.target = slotOf(agent, agent.place);
          if (state.minute % 9 === (agent._index || 0)) agent.thought = localThought(agent, state);
        }
      });
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
      state.events = state.events.slice(0, 18);
      state.social_log = (state.social_log || []).slice(0, 16);
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
    remote.agents.forEach((src, i) => {
      const dst = state.agents[i];
      const keep = { color: dst.color, home: dst.home, preferred: dst.preferred, stance: dst.stance, _index: dst._index, role: dst.role || src.role, knowledge: dst.knowledge };
      Object.assign(dst, src, keep);
      dst.relationship = src.relationships || src.relationship || dst.relationship;
      dst.relationships = dst.relationship;
      dst.actionLabel = src.actionLabel || (actions[dst.action] || actions.socialise).label;
      dst.place = src.place || (actions[dst.action] || actions.socialise).place;
      dst.target = Array.isArray(src.target) ? src.target : slotOf(dst, dst.place);
      dst.mood = src.mood || dst.mood;
    });
    return state;
  }

  async function askQwen() { return null; }

  window.CityAgents = {
    actions, profiles, places, laws, PLACE_SV, HOME_X,
    createSimulationState, tickAgents, askQwen, clock, startAction, choose,
    slotOf, sceneStory, applyRemote, phaseOf, hourOf
  };
})();
