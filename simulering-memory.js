(() => {
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const clean = value => String(value || '').trim().slice(0, 420);

  function remember(agent, item) {
    if (!agent.memory) agent.memory = [];
    const memory = {
      id: item.id || `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: item.kind || 'event',
      with: item.with || '',
      text: clean(item.text),
      importance: clamp(Number(item.importance ?? .5)),
      feeling: item.feeling || 'neutral',
      at: item.at || Date.now(),
      recalled: Number(item.recalled || 0)
    };
    if (!memory.text) return null;
    agent.memory = [memory, ...agent.memory.filter(old => !(old.kind === memory.kind && old.with === memory.with && old.text === memory.text))].slice(0, 32);
    return memory;
  }

  function recall(agent, query = '', limit = 5) {
    const needle = String(query).toLowerCase();
    return (agent.memory || []).map(raw => {
      const memory = typeof raw === 'string' ? { text: raw, kind: 'event', with: '', importance: .45, at: Date.now(), recalled: 0 } : raw;
      const haystack = `${memory.with} ${memory.text} ${memory.kind}`.toLowerCase();
      const lexical = needle ? (haystack.includes(needle) ? 1 : 0) : 0;
      const age = Math.max(0, (Date.now() - Number(memory.at || Date.now())) / 86400000);
      const score = memory.importance * .65 + lexical * .3 + Math.max(0, 1 - age / 30) * .05;
      return { ...memory, score };
    }).sort((a, b) => b.score - a.score).slice(0, limit).map(memory => {
      memory.recalled = Number(memory.recalled || 0) + 1;
      return memory;
    });
  }

  function context(agent, query = '') {
    return recall(agent, query, 4).map(memory => `${memory.with ? `${memory.with}: ` : ''}${memory.text}`).join(' | ');
  }

  function rememberConversation(agent, other, text, feeling = 'neutral') {
    return remember(agent, { kind: 'conversation', with: other, text, feeling, importance: .82 });
  }

  function recoverIfStuck(agent, state = {}) {
    if (Number(agent.stuck || 0) < 3) return null;
    const hour = Number(state.hour ?? 12);
    const action = hour >= 23 || hour < 6 ? 'sleep' : agent.needs?.hunger > 75 ? 'eat' : 'socialise';
    agent.stuck = 0;
    agent.progress = 0;
    agent.action = action;
    agent.reason = 'stuck-recovery';
    agent.thought = action === 'sleep' ? 'Jag har fastnat i mina rutiner. Jag går hem och börjar om.' : 'Jag behöver byta miljö och träffa någon annan.';
    return agent;
  }

  window.CityMemory = { remember, recall, context, rememberConversation, recoverIfStuck };
})();
