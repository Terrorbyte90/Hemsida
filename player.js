/* Ted Svärd — custom podcast player (poddar.html).
   Fully functional: one shared <audio>, custom-drawn controls, real seeking,
   show/episode switching, sticky bottom bar. No frameworks. */
(() => {
  'use strict';
  const app = document.querySelector('[data-player-app]');
  if (!app) return;

  const SHOWS = [
    {
      key: 'overvakad', name: 'Övervakad', cover: 'assets/podcasts/overvakad.jpg',
      tags: ['Skräck', 'AI', 'Vuxet innehåll'],
      desc: 'En skräckpodd om internets djupaste och mörkaste hörn. Där mänskliga berättare ryggar tillbaka, tar algoritmen vid.',
      links: { spotify: 'https://open.spotify.com/show/75V96vWHSoVm5sNPD3pzeb', apple: 'https://podcasts.apple.com/podcast/id1870234481', acast: 'https://shows.acast.com/overvakad' },
      episodes: [
        { title: 'Fil 73: Eon', dur: '22:00', src: 'https://sphinx.acast.com/p/open/s/696d96dc1e4bca00bfd3c438/e/696f58fe91e0adb30b807361/media.mp3' },
        { title: 'Trailer — Spegeln', dur: '2:30', src: 'https://sphinx.acast.com/p/open/s/696d96dc1e4bca00bfd3c438/e/696e21b91e4bca00bffb2ab5/media.mp3' },
      ],
    },
    {
      key: 'ai-zonen', name: 'AI-Zonen', cover: 'assets/podcasts/ai-zonen.jpg',
      tags: ['Teknik', 'AI', 'Semiveckovis'],
      desc: 'Mötesplatsen där två AI-röster guidar dig genom den artificiella intelligensens värld — på svenska, utan krångliga ord.',
      links: { spotify: 'https://open.spotify.com/search/AI-Zonen%20Ted%20Sv%C3%A4rd', apple: 'https://podcasts.apple.com/podcast/id1832612739', acast: 'https://shows.acast.com/ai-zonen' },
      episodes: [
        { title: 'AI som assistent', dur: '8:00', src: 'https://sphinx.acast.com/p/open/s/689a6c2e5edc63baa3be170f/e/689b95f866f126ae3ff382ec/media.mp3' },
        { title: 'Din första guide till AI', dur: '19:00', src: 'https://sphinx.acast.com/p/open/s/689a6c2e5edc63baa3be170f/e/689b247be6e5400d47b2169d/media.mp3' },
        { title: 'Välkommen till AI', dur: '9:00', src: 'https://sphinx.acast.com/p/open/s/689a6c2e5edc63baa3be170f/e/689a9ac35edc63baa3c88d80/media.mp3' },
      ],
    },
    {
      key: 'ai-pulsen', name: 'AI-Pulsen', cover: null, coverLetter: 'P',
      tags: ['AI', 'Snabbversion', 'Nystartad'],
      desc: 'Korta, snabba avsnitt om AI — historia, nyheter och koncept, avklarade på någon enstaka minut. Rösten är Evelina.',
      links: null,
      episodes: [
        { title: 'Avsnitt 1: AI:s resa på en minut', dur: '1:10', src: 'assets/podcasts/ai-pulsen/avsnitt-1.mp3' },
      ],
    },
  ];

  let activeShow = 0, activeEp = -1;
  const audio = new Audio();
  audio.preload = 'none';
  audio.style.display = 'none';
  document.body.appendChild(audio);

  const showsEl = app.querySelector('[data-player-shows]');
  const infoEl = app.querySelector('[data-player-info]');
  const listEl = app.querySelector('[data-player-list]');
  const bar = document.querySelector('[data-player-bar]');

  function coverHTML(show, cls) {
    if (show.cover) return `<img class="cover ${cls}" src="${show.cover}" alt="">`;
    return `<div class="cover gen ${cls}">${show.coverLetter || show.name[0]}</div>`;
  }

  function renderShows() {
    showsEl.innerHTML = SHOWS.map((s, i) => `
      <button class="player-show-tab ${i === activeShow ? 'active' : ''}" data-show-idx="${i}">
        ${coverHTML(s, '')}
        <div><div class="nm">${s.name}</div><div class="ct">${s.episodes.length} avsnitt</div></div>
      </button>`).join('');
    showsEl.querySelectorAll('[data-show-idx]').forEach(btn => {
      btn.addEventListener('click', () => { activeShow = parseInt(btn.dataset.showIdx, 10); renderAll(); });
    });
  }

  function renderInfo() {
    const s = SHOWS[activeShow];
    infoEl.innerHTML = `
      <h3>${s.name}</h3>
      <div class="tags" style="margin-top:8px">${s.tags.map(t => `<span>${t}</span>`).join('')}</div>
      <p>${s.desc}</p>
      ${s.links ? `<div class="links">
        <a href="${s.links.spotify}" target="_blank" rel="noopener">Spotify ↗</a>
        <a href="${s.links.apple}" target="_blank" rel="noopener">Apple Podcasts ↗</a>
        <a href="${s.links.acast}" target="_blank" rel="noopener">Acast ↗</a>
      </div>` : ''}
    `;
  }

  function renderList() {
    const s = SHOWS[activeShow];
    listEl.innerHTML = s.episodes.map((e, i) => `
      <div class="player-episode-row ${activeShow === curShow && i === activeEp ? 'active' : ''}" data-ep-idx="${i}">
        <div class="idx">${activeShow === curShow && i === activeEp && !audio.paused ? '' : (i + 1)}${activeShow === curShow && i === activeEp && !audio.paused ? eqHTML() : ''}</div>
        <div class="ti">${e.title}</div>
        <div class="du">${e.dur}</div>
      </div>`).join('');
    listEl.querySelectorAll('[data-ep-idx]').forEach(row => {
      row.addEventListener('click', () => playEpisode(activeShow, parseInt(row.dataset.epIdx, 10)));
    });
  }

  function eqHTML() {
    return '<span class="eq"><span></span><span></span><span></span></span>';
  }

  let curShow = -1;
  function renderAll() { renderShows(); renderInfo(); renderList(); }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function playEpisode(showIdx, epIdx) {
    curShow = showIdx; activeShow = showIdx; activeEp = epIdx;
    const s = SHOWS[showIdx], e = s.episodes[epIdx];
    audio.src = e.src;
    audio.play().catch(() => {});
    bar.classList.add('show');
    bar.querySelector('[data-bar-cover]').innerHTML = coverHTML(s, '');
    bar.querySelector('[data-bar-title]').textContent = e.title;
    bar.querySelector('[data-bar-show]').textContent = s.name;
    renderAll();
  }

  // transport controls
  const playBtn = bar.querySelector('[data-bar-playpause]');
  const prevBtn = bar.querySelector('[data-bar-prev]');
  const nextBtn = bar.querySelector('[data-bar-next]');
  const seek = bar.querySelector('[data-bar-seek]');
  const seekFill = seek.querySelector('i');
  const seekHandle = seek.querySelector('b');
  const curTimeEl = bar.querySelector('[data-bar-current]');
  const durTimeEl = bar.querySelector('[data-bar-duration]');

  playBtn.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  });
  prevBtn.addEventListener('click', () => {
    if (curShow < 0) return;
    const n = SHOWS[curShow].episodes.length;
    playEpisode(curShow, (activeEp - 1 + n) % n);
  });
  nextBtn.addEventListener('click', () => {
    if (curShow < 0) return;
    const n = SHOWS[curShow].episodes.length;
    playEpisode(curShow, (activeEp + 1) % n);
  });

  audio.addEventListener('play', () => { playBtn.innerHTML = '❚❚'; renderList(); });
  audio.addEventListener('pause', () => { playBtn.innerHTML = '▸'; renderList(); });
  audio.addEventListener('ended', () => { nextBtn.click(); });
  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    seekFill.style.width = pct + '%';
    seekHandle.style.left = pct + '%';
    curTimeEl.textContent = fmtTime(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => { durTimeEl.textContent = fmtTime(audio.duration); });

  function seekTo(clientX) {
    const rect = seek.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (audio.duration) audio.currentTime = pct * audio.duration;
  }
  let dragging = false;
  seek.addEventListener('mousedown', (e) => { dragging = true; seekTo(e.clientX); });
  window.addEventListener('mousemove', (e) => { if (dragging) seekTo(e.clientX); });
  window.addEventListener('mouseup', () => { dragging = false; });
  seek.addEventListener('touchstart', (e) => { dragging = true; seekTo(e.touches[0].clientX); }, { passive: true });
  seek.addEventListener('touchmove', (e) => { if (dragging) seekTo(e.touches[0].clientX); }, { passive: true });
  seek.addEventListener('touchend', () => { dragging = false; });

  renderAll();
  playBtn.innerHTML = '▸';
})();
