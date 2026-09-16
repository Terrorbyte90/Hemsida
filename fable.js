/* Fable lab — live status + curated demo streams. */
(() => {
  'use strict';

  const STATUS_URL = 'https://5.175.249.12.nip.io/fable-status/api/status';

  const DEMOS = [
    {
      user: 'Berätta en kort fabel om en server som vägrar skicka hemligheter ut på nätet.',
      answer:
        'Det var en gång en server som hette Hemlabbet. Varje natt kom besökare och bad om nycklar, loggar och adresser. Hemlabbet svarade alltid med samma sak: “Jag kan berätta att jag är vaken — men inte var jag bor.” En dag byggde ägaren en liten lykta utanför dörren. Lyktan blinkade grönt när Hemlabbet tänkte, och rött när det vilade. Folk stannade till, nickade, och gick vidare. Moral: ljus får synas. Hemligheter ska stanna inne.'
    },
    {
      user: 'Vad skiljer en dens modell som Fable från en MoE som Ornith?',
      answer:
        'En dens modell aktiverar i praktiken hela nätet för varje token — förutsägbart, jämnt och enkelt att trimma på CPU. En Mixture-of-Experts (som Ornith-35B) har många “experter” och en router som bara väcker några per token. Det kan ge fler parametrar per disk-GB, men också mer komplex last och mer att felsöka. Fable är medvetet dens: 27 miljarder parametrar, Q4_K_M, stort kontextfönster, lokal llama.cpp — mindre teater, mer kontroll.'
    },
    {
      user: 'Skriv en kort systemprompt för en svensk labb-assistent som kör lokalt.',
      answer:
        'Du är Fable, en lokal labb-assistent hos Ted. Svara på klar svenska. Var konkret, ärlig om osäkerhet och hitta aldrig på sökvägar, IP-adresser eller nycklar. Föredra korta stycken. Om frågan kräver privata serverdetaljer: säg att du kan hjälpa med idén, men att driftuppgifter stannar i hemlabbet.'
    }
  ];

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const fmtCtx = n => {
    if (n == null) return '–';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  };

  function renderStatus(data) {
    const dot = document.querySelector('[data-fable-dot]');
    const status = document.querySelector('[data-fable-status]');
    const model = document.querySelector('[data-fable-model]');
    const state = document.querySelector('[data-fable-state]');
    const alias = document.querySelector('[data-fable-alias]');
    const facts = document.querySelector('[data-fable-facts]');
    const updated = document.querySelector('[data-fable-updated]');
    const params = document.querySelector('[data-fable-params]');
    const quant = document.querySelector('[data-fable-quant]');
    const ctx = document.querySelector('[data-fable-ctx]');
    const size = document.querySelector('[data-fable-size]');

    if (!data || !data.alive) {
      if (dot) dot.classList.add('off');
      if (status) status.textContent = 'Fable är tillfälligt otillgänglig';
      if (state) {
        state.style.display = '';
        state.textContent = 'offline';
      }
      if (facts) {
        facts.innerHTML = '<li class="activity-item"><span class="d"></span><span class="txt">Statusendpointen svarar inte just nu. Modellkortet nedan gäller fortfarande.</span><span class="tag">offline</span></li>';
      }
      return;
    }

    if (dot) dot.classList.remove('off');
    if (status) status.textContent = 'Fable är vaken · lokal inferens';
    if (model) model.textContent = data.model || 'Qwen3.8-27B-Fable Distill';
    if (state) {
      state.style.display = '';
      state.textContent = data.state === 'ready' ? '◈ redo' : String(data.state || 'online');
    }
    if (alias) alias.textContent = data.alias ? 'Alias · ' + data.alias : '';
    if (params) params.textContent = data.parameters || '27B';
    if (quant) quant.textContent = data.quantization || 'Q4_K_M';
    if (ctx) ctx.textContent = fmtCtx(data.context);
    if (size) size.textContent = data.size_gb != null ? '~' + data.size_gb + '\u00a0GB' : '~17\u00a0GB';
    if (updated && data.updated_at) {
      try {
        const d = new Date(data.updated_at);
        updated.textContent = 'uppdaterad ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch (_) {
        updated.textContent = '';
      }
    }
    if (facts) {
      const rows = [
        ['Arkitektur', data.architecture || 'dense transformer'],
        ['Runtime', data.runtime || 'llama.cpp'],
        ['Hosting', data.hosting || 'self-hosted'],
        ['Signal', 'Publik status · ingen rå chat']
      ];
      facts.innerHTML = rows.map(([k, v]) =>
        `<li class="activity-item"><span class="d"></span><span class="txt"><strong>${escapeHTML(k)}:</strong> ${escapeHTML(v)}</span><span class="tag">ok</span></li>`
      ).join('');
    }
  }

  async function pollStatus() {
    try {
      const res = await fetch(STATUS_URL, { cache: 'no-store', mode: 'cors' });
      if (!res.ok) throw new Error('bad status');
      renderStatus(await res.json());
    } catch (_) {
      renderStatus(null);
    }
  }

  if (document.querySelector('[data-fable-status]')) {
    pollStatus();
    setInterval(pollStatus, 8000);
  }

  /* ---------- curated demo typewriter ---------- */
  const userEl = document.querySelector('[data-demo-user]');
  const asstEl = document.querySelector('[data-demo-assistant]');
  const buttons = [...document.querySelectorAll('[data-demo]')];
  if (!userEl || !asstEl || !buttons.length) return;

  let token = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function playDemo(idx) {
    const my = ++token;
    const demo = DEMOS[idx] || DEMOS[0];
    buttons.forEach((b, i) => {
      const on = i === idx;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    userEl.textContent = demo.user;
    asstEl.innerHTML = '<span class="cursor"></span>';
    let acc = '';
    for (const ch of demo.answer) {
      if (my !== token) return;
      acc += ch;
      asstEl.innerHTML = escapeHTML(acc) + '<span class="cursor"></span>';
      await sleep(ch === ' ' ? 12 : 16 + Math.random() * 18);
    }
    if (my === token) asstEl.innerHTML = escapeHTML(acc);
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => playDemo(Number(btn.dataset.demo) || 0));
  });
  playDemo(0);
})();
