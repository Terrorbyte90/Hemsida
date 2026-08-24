/* The city brain: deterministic utility AI first, local Qwen second. */
(() => {
  const actions = {
    sleep: { label: 'sover hemma', place: 'home', duration: 90, need: 'sleep' },
    eat: { label: 'äter middag', place: 'cafe', duration: 35, need: 'hunger' },
    socialise: { label: 'pratar med någon', place: 'plaza', duration: 28, need: 'social' },
    read: { label: 'läser och forskar', place: 'library', duration: 55, need: 'curiosity' },
    work: { label: 'arbetar', place: 'workshop', duration: 70, need: 'purpose' },
    study: { label: 'pluggar', place: 'school', duration: 60, need: 'curiosity' },
    garden: { label: 'sköter stadens trädgård', place: 'garden', duration: 45, need: 'purpose' },
    vote: { label: 'röstar i rådhuset', place: 'hall', duration: 22, need: 'purpose' }
  };
  const profiles = [
    { id:'mira', name:'Mira', role:'Bibliotekarie', trait:'nyfiken · varm · undersökande', color:'#76d6c6', home:[-8,5], preferred:['read','socialise','vote'] },
    { id:'elias', name:'Elias', role:'Stadsplanerare', trait:'metodisk · ansvarstagande · lugn', color:'#f1bc78', home:[-3,5], preferred:['work','vote','garden'] },
    { id:'noor', name:'Noor', role:'Kulturproducent', trait:'social · kreativ · spontan', color:'#ec8fa0', home:[3,5], preferred:['socialise','read','eat'] },
    { id:'liv', name:'Liv', role:'Lärare', trait:'skeptisk · empatisk · principfast', color:'#a99be8', home:[8,5], preferred:['study','socialise','vote'] },
    { id:'august', name:'August', role:'Reparatör', trait:'uppfinningsrik · tävlingsinriktad · modig', color:'#8eb7ed', home:[0,8], preferred:['work','garden','eat'] }
  ];
  const laws = [
    { id:'trees', title:'Fler träd längs huvudgatan', author:'Elias', yes:3, no:1, status:'pågående' },
    { id:'late-library', title:'Biblioteket öppet efter midnatt', author:'Mira', yes:2, no:2, status:'pågående' },
    { id:'shared-garden', title:'Gemensam odlingslott på torget', author:'August', yes:4, no:0, status:'antagen' }
  ];
  const clamp = (v,min=0,max=100) => Math.max(min, Math.min(max, v));
  const createAgent = (profile, i) => ({ ...profile, needs:{sleep:28+i*7, hunger:34+i*4, social:42-i*3, curiosity:38+i*3, purpose:45}, relationship:{mira:0,elias:0,noor:0,liv:0,august:0}, action:'socialise', actionLabel:'vaknar i staden', place:'home', progress:0, target:[profile.home[0], profile.home[1]], thought:'Jag undrar vad som händer idag.', memory:['En ny dag börjar i staden.'], online:false });
  function createSimulationState() { const saved=localStorage.getItem('city-qwen-endpoint'); const endpoint=saved&& !saved.includes(':11434/') ? saved : 'http://localhost:8092/v1/chat/completions'; return { minute: 19*60+12, day:12, weather:'clear', paused:false, speed:1, agents:profiles.map(createAgent), laws:laws.map(l=>({...l})), events:[{time:'19:12', text:'Stadens fem invånare vaknar till kvällslivet.'}], selected:'mira', qwenEndpoint:endpoint, lastQwen:0 }; }
  function choose(agent, state) {
    const n=agent.needs, hour=(state.minute%1440)/60;
    if (n.sleep>78 || (hour>23 || hour<6) && n.sleep>45) return 'sleep';
    if (n.hunger>72) return 'eat';
    if (n.social>76) return 'socialise';
    if (n.curiosity>70) return agent.id==='liv'?'study':'read';
    if (n.purpose>72) return agent.preferred.find(a=>['work','garden','vote'].includes(a))||'work';
    return agent.preferred[Math.floor((state.minute/30+agent.id.length)%agent.preferred.length)]||'socialise';
  }
  function startAction(agent, action) { const spec=actions[action]||actions.socialise; agent.action=action; agent.actionLabel=spec.label; agent.place=spec.place; agent.progress=0; agent.target=({home:agent.home, plaza:[0,0], library:[-7,-5], workshop:[7,-5], school:[-7,0], garden:[7,0], hall:[0,-5], cafe:[0,3]})[spec.place]||[0,0]; }
  function tickAgents(state, minutes=1) {
    if(state.paused) return;
    state.minute=(state.minute+minutes*state.speed)%1440; if(state.minute<minutes*state.speed) state.day++;
    state.agents.forEach(agent=>{ Object.keys(agent.needs).forEach(k=>agent.needs[k]=clamp(agent.needs[k]+(k==='sleep'?0.025:0.012)*minutes)); agent.progress+=minutes/(actions[agent.action]?.duration||35); if(agent.progress>=1){ const spec=actions[agent.action]||actions.socialise; agent.needs[spec.need]=clamp(agent.needs[spec.need]-28); agent.memory.unshift(`${spec.label} vid ${String(Math.floor(state.minute/60)).padStart(2,'0')}:${String(state.minute%60).padStart(2,'0')}.`); agent.memory=agent.memory.slice(0,5); startAction(agent,choose(agent,state)); } });
    if(Math.floor(state.minute/10)!==Math.floor((state.minute-minutes)/10)) { const a=state.agents[Math.floor(state.minute/10)%5]; state.events.unshift({time:clock(state.minute),text:`${a.name} ${a.actionLabel}.`}); state.events=state.events.slice(0,12); }
  }
  const clock = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`;
  async function askQwen(agent, context, endpoint) { try { const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),20000); const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:ctl.signal,body:JSON.stringify({model:'Qwen3.8-27B-Fable-Distill',temperature:.7,max_tokens:180,messages:[{role:'system',content:`Du är ${agent.name}, ${agent.trait}. Välj en aktivitet i JSON: {"action":"sleep|eat|socialise|read|work|study|garden|vote","thought":"kort tanke på svenska"}.`},{role:'user',content:JSON.stringify(context)}]})}); clearTimeout(timer); if(!response.ok)return null; const data=await response.json(); const message=data.choices?.[0]?.message||{}; const raw=message.content||message.reasoning_content||''; const parsed=JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]||raw); if(!actions[parsed.action]||typeof parsed.thought!=='string')return null; return parsed; } catch(e){ return null; } }
  window.CityAgents={actions,profiles,createSimulationState,tickAgents,askQwen,clock,startAction};
})();
