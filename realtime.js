(() => {
  const button = document.getElementById('realtime-toggle');
  const status = document.getElementById('realtime-status');
  if (!button || !status) return;
  let pc = null, stream = null, audio = null;
  const setStatus = (text) => { status.textContent = text; };

  async function start() {
    button.disabled = true; setStatus('Ansluter…');
    const tokenResponse = await fetch('https://titan-server.tailfbfb1a.ts.net:9443/control-api/realtime/session', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, cache: 'no-store'
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.client_secret) throw new Error(tokenData.error || 'Token kunde inte hämtas');

    stream = await navigator.mediaDevices.getUserMedia({audio: true});
    pc = new RTCPeerConnection();
    audio = document.createElement('audio'); audio.autoplay = true; audio.setAttribute('aria-hidden', 'true');
    pc.ontrack = (event) => { audio.srcObject = event.streams[0]; };
    pc.addTrack(stream.getAudioTracks()[0], stream);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('Aktiv · prata fritt');
      if (['failed','disconnected'].includes(pc.connectionState)) setStatus('Anslutningen bröts');
    };
    const channel = pc.createDataChannel('oai-events');
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'input_audio_buffer.speech_started') setStatus('Lyssnar…');
        if (data.type === 'response.audio.delta') setStatus('Svarar…');
        if (data.type === 'response.done') setStatus('Aktiv · prata fritt');
      } catch (_) {}
    };
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const answer = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST', headers: {Authorization: `Bearer ${tokenData.client_secret}`, 'Content-Type': 'application/sdp'}, body: offer.sdp
    });
    if (!answer.ok) throw new Error('Realtime-anslutningen avvisades');
    await pc.setRemoteDescription({type: 'answer', sdp: await answer.text()});
    button.textContent = 'Stoppa handsfree'; button.setAttribute('aria-pressed', 'true'); button.disabled = false;
  }

  function stop() {
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    pc?.close(); pc = null; audio?.remove(); audio = null;
    button.textContent = 'Starta handsfree'; button.setAttribute('aria-pressed', 'false'); setStatus('Avstängd'); button.disabled = false;
  }

  button.addEventListener('click', async () => {
    if (pc) { stop(); return; }
    try { await start(); } catch (error) { stop(); setStatus('Kunde inte starta: ' + error.message); }
  });
})();
