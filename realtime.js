(() => {
  const button = document.getElementById('realtime-toggle');
  const status = document.getElementById('realtime-status');
  if (!button || !status) return;

  const API = 'https://titan-server.tailfbfb1a.ts.net:9443/control-api';
  let pc = null, stream = null, audio = null, channel = null;
  let activeSessionId = null, startedAt = 0, stopping = false, pendingMira = false;

  const sessionId = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const setStatus = (text) => { status.textContent = text; };
  const postLog = (event, data = {}) => fetch(`${API}/realtime/events`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, keepalive: true,
    body: JSON.stringify({session_id: activeSessionId, event, at: new Date().toISOString(), data})
  }).catch(() => {});
  const logUsage = (usage) => postLog('usage', {
    duration_s: Math.max(0, (Date.now() - startedAt) / 1000), usage: usage || {}
  });

  function sendFunctionOutput(callId, answer) {
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify({type: 'conversation.item.create', item: {
      type: 'function_call_output', call_id: callId,
      output: JSON.stringify({answer})
    }}));
    channel.send(JSON.stringify({type: 'response.create'}));
  }

  async function start() {
    stopping = false; pendingMira = false;
    activeSessionId = sessionId(); startedAt = Date.now();
    postLog('session_start', {user_agent: navigator.userAgent});
    button.disabled = true; setStatus('Ansluter…');
    const tokenResponse = await fetch(`${API}/realtime/session`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, cache: 'no-store'
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.client_secret) throw new Error(tokenData.error || 'Token kunde inte hämtas');

    stream = await navigator.mediaDevices.getUserMedia({audio: {
      echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      channelCount: 1
    }});
    postLog('microphone_ready', {tracks: stream.getAudioTracks().length});
    pc = new RTCPeerConnection();
    audio = document.createElement('audio');
    audio.autoplay = true; audio.setAttribute('aria-hidden', 'true');
    audio.volume = 1;
    pc.ontrack = (event) => { audio.srcObject = event.streams[0]; postLog('remote_audio_track'); };
    pc.addTrack(stream.getAudioTracks()[0], stream);
    pc.onconnectionstatechange = () => {
      const state = pc?.connectionState;
      postLog('connection_state', {state});
      if (state === 'connected') setStatus('Aktiv · prata fritt');
      if (['failed','disconnected','closed'].includes(state)) setStatus('Anslutningen bröts');
    };
    channel = pc.createDataChannel('oai-events');
    channel.onopen = () => postLog('data_channel_open');
    channel.onerror = () => postLog('data_channel_error');
    channel.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      const safe = {};
      for (const key of ['type','event_id','call_id','name','item_id','response_id']) if (data[key] != null) safe[key] = data[key];
      if (data.type === 'conversation.item.input_audio_transcription.completed') safe.transcript = String(data.transcript || '').slice(0, 4000);
      if (data.type === 'response.audio_transcript.done') safe.transcript = String(data.transcript || '').slice(0, 4000);
      if (data.type === 'error') safe.error = data.error || {};
      postLog('realtime_event', safe);

      if (data.type === 'input_audio_buffer.speech_started') setStatus('Lyssnar…');
      if (data.type === 'response.audio.delta') setStatus('Svarar…');
      if (data.type === 'response.function_call_arguments.done' && data.name === 'ask_mira') {
        if (pendingMira) { postLog('duplicate_function_call_ignored', {call_id: data.call_id}); return; }
        pendingMira = true; setStatus('Frågar Mira…');
        let args = {};
        try { args = JSON.parse(data.arguments || '{}'); } catch (_) {}
        const question = String(args.question || '').slice(0, 1200);
        postLog('mira_question', {question});
        fetch(`${API}/ask-mira`, {method: 'POST', headers: {'Content-Type': 'application/json'}, cache: 'no-store',
          body: JSON.stringify({question})})
          .then(r => r.json().then(result => ({ok: r.ok, result})))
          .then(({ok, result}) => {
            const answer = ok ? (result.answer || 'Mira kunde inte svara just nu.') : 'Mira-bryggan är tillfälligt otillgänglig.';
            postLog('mira_answer', {answer: String(answer).slice(0, 8000), ok});
            sendFunctionOutput(data.call_id, answer);
          })
          .catch(() => { postLog('mira_error'); sendFunctionOutput(data.call_id, 'Mira-bryggan är tillfälligt otillgänglig.'); })
          .finally(() => { pendingMira = false; });
      }
      if (data.type === 'response.done') {
        if (data.response?.usage) logUsage(data.response.usage);
        setStatus('Aktiv · prata fritt');
      }
    };

    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const answer = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST', headers: {Authorization: `Bearer ${tokenData.client_secret}`, 'Content-Type': 'application/sdp'}, body: offer.sdp
    });
    if (!answer.ok) { postLog('sdp_rejected', {status: answer.status}); throw new Error('Realtime-anslutningen avvisades'); }
    await pc.setRemoteDescription({type: 'answer', sdp: await answer.text()});
    button.textContent = 'Stoppa handsfree'; button.setAttribute('aria-pressed', 'true'); button.disabled = false;
    postLog('session_connected');
  }

  function stop() {
    if (stopping) return; stopping = true;
    if (activeSessionId) logUsage({session_closed: 1});
    postLog('session_stop');
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    pc?.close(); pc = null; channel = null; audio?.remove(); audio = null;
    activeSessionId = null; startedAt = 0;
    button.textContent = 'Starta handsfree'; button.setAttribute('aria-pressed', 'false'); setStatus('Avstängd'); button.disabled = false;
  }

  button.addEventListener('click', async () => {
    if (pc) { stop(); return; }
    try { await start(); } catch (error) { postLog('start_error', {message: String(error.message || error)}); stop(); setStatus('Kunde inte starta: ' + error.message); }
  });
})();
