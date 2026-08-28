(() => {
  const button = document.getElementById('realtime-toggle');
  const status = document.getElementById('realtime-status');
  if (!button || !status) return;
  // Public Caddy endpoint: works on phones without an active Tailscale VPN.
  const endpoint = 'wss://5.175.249.12.nip.io:9443/control-api/voice';
  let socket, stream, input, processor, sink, ctx;
  let playing = [], pcmQueue = [], playingNow = false;
  const setStatus = value => { status.textContent = value; };
  const stopAudio = () => { playing.forEach(source => { try { source.stop(); } catch (_) {} }); playing = []; pcmQueue = []; playingNow = false; };
  const downsample = (input, from, to) => { if (from === to) return input; const ratio = from / to, out = new Int16Array(Math.round(input.length / ratio)); for (let i=0;i<out.length;i++){let sum=0,count=0;const start=Math.floor(i*ratio),end=Math.min(Math.floor((i+1)*ratio),input.length);for(let j=start;j<end;j++){sum+=input[j];count++;}out[i]=Math.max(-1,Math.min(1,sum/(count||1)))*0x7fff;} return out; };
  const playNext = () => { if (playingNow || !pcmQueue.length || !ctx) return; playingNow=true; const bytes=pcmQueue.shift(), samples=new Int16Array(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/2)), buffer=ctx.createBuffer(1,samples.length,24000), channel=buffer.getChannelData(0); for(let i=0;i<samples.length;i++) channel[i]=samples[i]/32768; const source=ctx.createBufferSource(); source.buffer=buffer; source.connect(ctx.destination); playing.push(source); source.onended=()=>{playing=playing.filter(x=>x!==source);playingNow=false;playNext();}; source.start(); };
  const close = () => { stopAudio(); processor?.disconnect(); sink?.disconnect(); input?.disconnect(); stream?.getTracks().forEach(track=>track.stop()); socket?.close(); processor=sink=input=stream=socket=null; button.setAttribute('aria-pressed','false'); button.textContent='Starta Sofia'; button.disabled=false; setStatus('Redo – tryck för att starta'); };
  const start = async () => {
    button.disabled=true; setStatus('Ansluter till Sofia…');
    try {
      socket=new WebSocket(endpoint); socket.binaryType='arraybuffer';
      socket.onmessage=event=>{if(typeof event.data==='string'){const data=JSON.parse(event.data);if(data.type==='speech_started')setStatus('Lyssnar…');if(data.type==='transcript')setStatus('Sofia tänker…');if(data.type==='sofia_started'||data.type==='sofia_text')setStatus('Sofia svarar…');if(data.type==='interrupted'){stopAudio();setStatus('Lyssnar…');}if(data.type==='turn_complete')setStatus('Sofia lyssnar…');if(data.type==='error')setStatus(`Voicefel: ${data.error||'serverfel'}`);}else{pcmQueue.push(new Int16Array(event.data));playNext();}};
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('servern svarade inte inom 15 sekunder')),15000);socket.onopen=()=>{clearTimeout(timer);resolve();};socket.onerror=()=>{clearTimeout(timer);reject(new Error('WebSocket kunde inte ansluta'));};});
      setStatus('Tillåter mikrofon…');
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      ctx=new AudioContext(); await ctx.resume(); input=ctx.createMediaStreamSource(stream); processor=ctx.createScriptProcessor(2048,1,1); sink=ctx.createGain(); sink.gain.value=0; input.connect(processor); processor.connect(sink); sink.connect(ctx.destination);
      processor.onaudioprocess=event=>{if(socket?.readyState===WebSocket.OPEN)socket.send(downsample(event.inputBuffer.getChannelData(0),ctx.sampleRate,16000));};
      button.disabled=false; button.setAttribute('aria-pressed','true'); button.textContent='Stoppa Sofia'; setStatus('Sofia lyssnar…');
    } catch(error) { setStatus(`Kunde inte starta: ${error.message}`); close(); }
  };
  button.addEventListener('click',()=>button.getAttribute('aria-pressed')==='true'?close():start());
})();
