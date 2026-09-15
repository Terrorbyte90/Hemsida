(() => {
  const mount = document.querySelector('#city-canvas');
  if (!mount || !window.CityAgents || !window.THREE) return;
  const A = window.CityAgents, Memory = window.CityMemory, $ = s => document.querySelector(s);
  const CITY_API = 'https://5.175.249.12.nip.io/city/api/city';
  const state = A.createSimulationState();
  A.askQwen = async () => null;
  const places = { home:[0,4], plaza:[0,0], library:[-7,-5], workshop:[7,-5], school:[-7,0], garden:[7,0], hall:[0,-5], cafe:[0,3] };
  let scene, camera, renderer, city, rain, sun, selected = state.selected, yaw = 0, dragging = false, lastX = 0, last = performance.now(), simAccum = 0;
  let meshes = [], colliders = [], lamps = [], socialLog = [], lastSocial = 0, directorIndex = 0, directorChanged = performance.now();
  const mat = (c, rough=.82) => new THREE.MeshStandardMaterial({color:c, roughness:rough, metalness:.04});
  const add = (o, p=[0,0,0], parent=city) => { o.position.set(...p); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const box = (w,h,d,c,p,parent=city) => add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c)), [p[0],p[1]+h/2,p[2]], parent);
  const cyl = (r,h,c,p,parent=city,segments=12) => add(new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat(c)), [p[0],p[1]+h/2,p[2]], parent);
  const sphere = (r,c,p,parent=city) => add(new THREE.Mesh(new THREE.SphereGeometry(r,14,10),mat(c,.9)),p,parent);
  function building(x,z,w,d,h,c,label){
    box(w,h,d,c,[x,0,z]);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.64,.72,4),mat(0x182235)); roof.rotation.y=Math.PI/4; add(roof,[x,h+.05,z]);
    for(let y=1.15;y<h-.25;y+=1.15) for(let xx=x-w/2+.8;xx<x+w/2-.3;xx+=1.25){
      const window=box(.42,.32,.035,0xe9bb69,[xx,y,z-d/2-.025]); window.userData.window=true;
    }
    const sign=box(Math.min(w-1,4),.34,.06,0x24324a,[x,h*.52,z-d/2-.08]); sign.userData.label=label;
    colliders.push({x,z,w:w+.55,d:d+.55});
  }
  function tree(x,z){
    cyl(.12,1.15,0x5c4031,[x,0,z],city,8); sphere(.62,0x285b4b,[x,1.6,z]); sphere(.42,0x3d8968,[x-.22,2.08,z+.05]);
  }
  function lamp(x,z){
    cyl(.035,2.35,0x465169,[x,0,z],city,8); const glow=sphere(.14,0xf8c96d,[x,2.5,z]); glow.material=new THREE.MeshBasicMaterial({color:0xffd887});
    const l=new THREE.PointLight(0xffc765,1.5,5); l.position.set(x,2.35,z); scene.add(l); lamps.push(l);
  }
  function limb(parent, x, y, color, side){
    const upper=new THREE.Group(); upper.position.set(x,y,0); parent.add(upper);
    const arm=box(.14,.48,.15,color,[0,-.24,0],upper); const joint=sphere(.105,0xd99572,[0,-.5,0],upper); const fore=box(.13,.38,.14,color,[0,-.69,0],upper); const hand=sphere(.085,0xd99572,[0,-.91,0],upper);
    return upper;
  }
  function makeAvatar(agent){
    const g=new THREE.Group(); g.userData.id=agent.id; const p=places[agent.place]||agent.home; g.position.set(p[0],0,p[1]);
    const skin=mat(0xd99676,.92), pants=mat(0x18243a), dark=mat(0x171b28,.96), shirt=mat(agent.color,.7);
    box(.62,.78,.38,agent.color,[0,.67,0],g); cyl(.16,.07,0xf1e6d2,[0,1.39,0],g,16); cyl(.1,.14,0xc47f62,[0,1.39,0],g,10);
    sphere(.31,0xd99676,[0,1.75,0],g);
    const hairStyle=agent.id==='mira'?'bun':agent.id==='elias'?'side':agent.id==='noor'?'curls':agent.id==='liv'?'bob':'short';
    if(hairStyle==='bun') { sphere(.29,dark,[0,1.9,0],g); sphere(.13,dark,[.22,2.05,0],g); }
    else if(hairStyle==='curls'){ for(let i=-1;i<=1;i++) sphere(.14,dark,[i*.2,1.96,0],g); }
    else { const cap=sphere(.31,dark,[0,1.91,0],g); cap.scale.set(1,.46,1); if(hairStyle==='side') sphere(.16,dark,[-.27,1.86,.02],g); if(hairStyle==='bob'){sphere(.18,dark,[-.27,1.72,0],g);sphere(.18,dark,[.27,1.72,0],g);} }
    const eye=s=>{const e=sphere(.035,0x201924,s,g);e.material=new THREE.MeshBasicMaterial({color:0x211b28});return e;}; eye([-.1,1.77,.29]);eye([.1,1.77,.29]);
    box(.09,.025,.025,dark,[-.1,1.86,.29],g).rotation.z=.12; box(.09,.025,.025,dark,[.1,1.86,.29],g).rotation.z=-.12; box(.1,.025,.02,dark,[0,1.63,.3],g);
    const la=limb(g,-.4,1.12,agent.color,-1), ra=limb(g,.4,1.12,agent.color,1); const ll=box(.2,.62,.2,pants,[-.17,.02,0],g),rl=box(.2,.62,.2,pants,[.17,.02,0],g); box(.23,.11,.34,0x0d111b,[-.17,0,.1],g);box(.23,.11,.34,0x0d111b,[.17,0,.1],g);
    const key=new THREE.PointLight(agent.color,.42,2.8);key.position.set(0,1.5,.65);g.add(key); const halo=new THREE.Mesh(new THREE.RingGeometry(.43,.46,24),new THREE.MeshBasicMaterial({color:agent.color,transparent:true,opacity:.55,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.02;g.add(halo);
    g.userData.parts={la,ra,ll,rl,phase:Math.random()*6.28}; city.add(g); return g;
  }
  function buildCity(){
    city=new THREE.Group();scene.add(city); box(32,.15,27,0x111a29,[0,0,-2]); box(3,.05,27,0x29364b,[-1.5,.16,-2]); box(32,.05,3,0x29364b,[0,.16,-2]); box(10,.04,8,0x1b3840,[0,.18,0]);
    building(-7,-8,6,3,3.8,0x2b4261,'BIBLIOTEK');building(7,-8,6,3,3.45,0x49374c,'VERKSTAD');building(-7,-2,5,3,2.8,0x315367,'SKOLA');building(7,-2,5,3,3.1,0x574047,'RÅDHUS');building(0,6,18,2.4,2.35,0x24334b,'BOSTÄDER');
    const fountain=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.7,.18,32),mat(0x253a50));add(fountain,[0,.2,-2]);const water=new THREE.Mesh(new THREE.CircleGeometry(2.2,32),new THREE.MeshStandardMaterial({color:0x3ca4ab,roughness:.12,metalness:.35}));water.rotation.x=-Math.PI/2;add(water,[0,.35,-2]);
    for(let x=-13;x<=13;x+=4.3){tree(x,9); if(x%8.6===0){lamp(x,-1);lamp(x,-9);}} for(let x=-3.6;x<=3.6;x+=1.2){box(.7,.55,.55,0xd99563,[x,.35,1.9]);box(.7,.15,.55,0x5f8b62,[x,.9,1.9]);}
    state.agents.forEach(a=>meshes.push(makeAvatar(a))); createParticles();
  }
  function createParticles(){const geo=new THREE.BufferGeometry(),pos=[];for(let i=0;i<360;i++)pos.push((Math.random()-.5)*30,Math.random()*11,(Math.random()-.5)*25-3);geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));rain=new THREE.Points(geo,new THREE.PointsMaterial({color:0xa7d5ee,size:.06,transparent:true,opacity:.72}));rain.visible=false;scene.add(rain);}
  function socialText(a,b){const lines=[`${a.name}: Du ser också lyktorna tändas.`,`${b.name}: Ja. Torget känns nästan som hemma.`,`${a.name}: Ska vi skriva ner idén till rådhuset?`,`${b.name}: Absolut — tillsammans blir den bättre.`];return lines[(Math.floor(state.minute/7)+a.name.length+b.name.length)%lines.length].replace(`${a.name}: `,'').replace(`${b.name}: `,'');}
  function addSocial(a,b){const text=socialText(a,b); socialLog.unshift({time:A.clock(state.minute),text:`${a.name} → ${b.name}: ${text}`});socialLog=socialLog.slice(0,12);Memory?.rememberConversation(a,b.name,text);Memory?.rememberConversation(b,a.name,text);a.thought=`Jag tänker vidare på det ${b.name} sa.`;b.thought=`${a.name} lyssnar faktiskt.`;renderSocial();state.events.unshift({time:A.clock(state.minute),text:`${a.name} och ${b.name} delar tankar på torget.`});}
  function renderSocial(){const el=$('#social-log');if(el)el.innerHTML=socialLog.slice(0,8).map(x=>`<div class="social-line"><time>${x.time}</time><span>${x.text}</span></div>`).join('')||'<div class="social-empty">Staden väntar på dagens första möte.</div>';}
  function bubble(agent, kind){let el=document.querySelector(`[data-bubble="${agent.id}"]`);if(!el){el=document.createElement('div');el.dataset.bubble=agent.id;el.className='city-bubble';mount.appendChild(el);}el.classList.toggle('thought-bubble',kind==='thought');el.innerHTML=kind==='thought'?`<i>· · ·</i><span>${agent.thought}</span>`:`<b>${agent.name}</b><span>${agent._dialog||agent.thought}</span>`;const m=meshes[state.agents.indexOf(agent)],v=new THREE.Vector3(m.position.x,2.65,m.position.z);v.project(camera);el.style.left=`${(v.x*.5+.5)*mount.clientWidth}px`;el.style.top=`${(-v.y*.5+.5)*mount.clientHeight}px`;el.style.display=(v.z>-1&&v.z<1)?'grid':'none';}
  function renderAgentList(){const list=$('#agent-list');list.innerHTML=state.agents.map(a=>`<button class="agent-card ${a.id===selected?'selected':''}" data-id="${a.id}" style="--agent-color:${a.color};--need:${100-a.needs.sleep}%"><span class="agent-orb"></span><strong>${a.name}</strong><small>${a.actionLabel}</small><span class="agent-status"><i></i></span></button>`).join('');list.querySelectorAll('.agent-card').forEach(x=>x.onclick=()=>{selected=x.dataset.id;renderAgentList();renderDetail();});$('#active-count').textContent=`${state.agents.filter(a=>a.needs.sleep<78).length} vakna`;}
  function renderDetail(){const a=state.agents.find(x=>x.id===selected)||state.agents[0];$('#question-name').textContent=a.name;$('#agent-detail-content').innerHTML=`<div class="agent-hero"><span class="agent-orb" style="--agent-color:${a.color}"></span><div><h2>${a.name}</h2><p>${a.role} · ${a.trait}</p></div></div><div class="thought">“${a.thought}”</div><div class="needs">${Object.entries(a.needs).map(([k,v])=>`<span class="need" style="--agent-color:${a.color};--value:${v}%"><b>${({sleep:'sömn',hunger:'mat',social:'socialt',curiosity:'nyfiken',purpose:'mening'})[k]}</b><i></i></span>`).join('')}</div><p class="panel-meta" style="margin-top:14px">${a.actionLabel} · ${a.place}</p>`;}
  function renderLaws(){ $('#law-list').innerHTML=state.laws.map(l=>`<div class="law"><div class="law-title">${l.title}</div><div class="law-meta"><span>${l.author} · ${l.status}</span><span class="law-vote" data-law="${l.id}">Ja ${l.yes} · Nej ${l.no}</span></div></div>`).join(''); }
  function renderEvents(){$('#event-list').innerHTML=state.events.slice(0,6).map(e=>`<div class="event"><time>${e.time}</time><span>${e.text}</span></div>`).join('');}
  function updateScene(now){
    state.agents.forEach((a,i)=>{const m=meshes[i],p=places[a.place]||a.home,dx=p[0]-m.position.x,dz=p[1]-m.position.z,moving=Math.hypot(dx,dz)>.12;m.position.x+=dx*.012*state.speed;m.position.z+=dz*.012*state.speed;m.position.y=Math.abs(Math.sin(now/260+i))*.045;if(moving)m.rotation.y=Math.atan2(dx,dz);const q=m.userData.parts,s=moving?Math.sin(now/150+q.phase)*.32:0;q.la.rotation.z=s;q.ra.rotation.z=-s;q.ll.rotation.x=-s*.7;q.rl.rotation.x=s*.7;bubble(a,'thought');});
    const social=state.agents.filter(a=>a.place==='plaza'&&a.action==='socialise');if(social.length>=2){social[0]._dialog=socialText(social[0],social[1]);bubble(social[0],'speech');bubble(social[1],'speech');if(now-lastSocial>6000){addSocial(social[0],social[1]);lastSocial=now;}} else document.querySelectorAll('.city-bubble:not(.thought-bubble)').forEach(x=>x.remove());
    const hour=(state.minute%1440)/60, solar=Math.max(0,Math.sin((hour-6)/12*Math.PI)),night=solar<.12;scene.background.lerp(new THREE.Color(night?0x08101d:solar<.45?0x304968:0x6d9bad),.035);scene.fog.color.copy(scene.background);sun.position.set(Math.cos((hour-12)/24*Math.PI*2)*14,3+solar*14,Math.sin((hour-12)/24*Math.PI*2)*14);sun.intensity=.28+solar*2.1;lamps.forEach(l=>l.intensity=night?1.8:.35);$('#city-time').textContent=A.clock(state.minute);$('#city-weather').textContent=({clear:'Klart · 14°',rain:'Regn · 11°',snow:'Snö · 2°'})[state.weather];$('#scene-day').textContent=`DAG ${state.day} · ${night?'NATT':solar<.45?'SKYMNING':'DAG'}`;rain.visible=state.weather!=='clear';
  }
  function syncCity(){fetch(CITY_API,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(remote=>{if(!remote?.agents||remote.agents.length!==5)return;state.mode=remote.mode||'live';state.minute=remote.minute??state.minute;state.day=remote.day??state.day;state.weather=remote.weather||state.weather;remote.agents.forEach((a,i)=>Object.assign(state.agents[i],a));state.events=remote.events||state.events;renderAgentList();renderDetail();renderEvents();$('#model-status').textContent=state.mode==='replay'?'Repris · senaste dygnet':'Stadens motor · aktiv';}).catch(()=>{});}
  function askSelected(){const input=$('#agent-question'),q=input.value.trim(),a=state.agents.find(x=>x.id===selected);if(!q||!a)return;$('#conversation-answer').textContent='Tänker…';input.value='';fetch(`${CITY_API}/conversation`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agent_id:a.id,question:q})}).then(r=>r.json()).then(result=>{const answer=result.answer||'Jag behöver lite tid att tänka.';Memory?.rememberConversation(a,'besökaren',q);Memory?.rememberConversation(a,'besökaren',answer);$('#conversation-answer').textContent=answer;socialLog.unshift({time:A.clock(state.minute),text:`Du → ${a.name}: ${q}`});renderSocial();}).catch(()=>$('#conversation-answer').textContent='Staden svarar inte just nu — prova igen om en stund.');}
  function init(){scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1729);scene.fog=new THREE.Fog(0x0b1729,18,38);camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(0,5.8,12);renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;mount.appendChild(renderer.domElement);scene.add(new THREE.HemisphereLight(0x9fc6e8,0x142317,1.15));sun=new THREE.DirectionalLight(0xffddb2,2.2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);buildCity();resize();addEventListener('resize',resize);bind();loop();}
  function resize(){const r=mount.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
  function bind(){document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>{state.speed=+b.dataset.speed;document.querySelectorAll('.speed').forEach(x=>x.classList.toggle('active',x===b));});$('#pause-btn').onclick=()=>{state.paused=!state.paused;$('#pause-btn').textContent=state.paused?'Fortsätt':'Pausa';};document.querySelectorAll('.weather').forEach(b=>b.onclick=()=>{state.weather=b.dataset.weather;document.querySelectorAll('.weather').forEach(x=>x.classList.toggle('active',x===b));});document.querySelectorAll('.time-mode').forEach(b=>b.onclick=()=>{state.minute=b.dataset.mode==='day'?720:1320;});$('#ask-agent').onclick=askSelected;$('#agent-question').onkeydown=e=>{if(e.key==='Enter')askSelected();};mount.onpointerdown=e=>{dragging=true;lastX=e.clientX;};addEventListener('pointerup',()=>dragging=false);addEventListener('pointermove',e=>{if(dragging){yaw+=(e.clientX-lastX)*.004;lastX=e.clientX;}});mount.onclick=e=>{if(dragging)return;const rect=renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(meshes,true).find(x=>x.object.parent?.userData?.id||x.object.userData?.id);if(hit){let g=hit.object;while(g&&!g.userData.id)g=g.parent;if(g){selected=g.userData.id;renderAgentList();renderDetail();}}};}
  function loop(now=performance.now()){requestAnimationFrame(loop);const dt=Math.min(100,now-last);last=now;simAccum+=dt;if(simAccum>700){if(state.mode!=='replay')A.tickAgents(state,1);simAccum=0;renderAgentList();renderDetail();renderEvents();}if(now-directorChanged>24000&&!dragging){directorIndex=(directorIndex+1)%5;directorChanged=now;}const m=meshes[directorIndex],focus=new THREE.Vector3(m.position.x,1.2,m.position.z),dist=innerWidth<680?6.2:8,desired=new THREE.Vector3(focus.x+Math.sin(yaw)*dist,focus.y+2.3,focus.z+Math.cos(yaw)*dist);camera.position.lerp(desired,.07);camera.lookAt(focus);updateScene(now);renderer.render(scene,camera);}
  renderAgentList();renderDetail();renderLaws();renderEvents();renderSocial();setInterval(syncCity,15000);syncCity();try{init();}catch(e){$('#webgl-fallback').style.display='block';$('#webgl-fallback').textContent='WebGL saknas — textläget är aktivt.';}
})();