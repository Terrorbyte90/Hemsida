/* Ted Svärd — portfolio interactions.
   No frameworks. Progressive enhancement: everything works without JS except
   the live Ornith feed (which has a static "offline" fallback in the markup). */
(() => {
  'use strict';

  /* ---------- ambient gradient mesh + grain overlay ---------- */
  if (!document.querySelector('.mesh')) {
    const m = document.createElement('div');
    m.className = 'mesh';
    m.setAttribute('aria-hidden', 'true');
    document.body.prepend(m);
  }
  if (!document.querySelector('.grain')) {
    const g = document.createElement('div');
    g.className = 'grain';
    g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g);
  }

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  // On mobile, .nav-links becomes position:fixed — but its ancestor .row has
  // backdrop-filter, which makes IT the containing block instead of the
  // viewport, breaking the fixed offsets. Fix: only while mobile, move
  // .nav-links to be a direct child of <body> (true viewport positioning);
  // move it back into its original spot for desktop's inline flex layout.
  if (links) {
    const originalParent = links.parentElement;
    const originalNext = links.nextSibling;
    const mq = window.matchMedia('(max-width: 760px)');
    const place = () => {
      if (mq.matches) {
        if (links.parentElement !== document.body) document.body.appendChild(links);
      } else {
        if (links.parentElement !== originalParent) {
          originalNext ? originalParent.insertBefore(links, originalNext) : originalParent.appendChild(links);
        }
      }
    };
    place();
    mq.addEventListener('change', place);
  }
  toggle?.addEventListener('click', () => {
    links?.classList.toggle('open');
    document.body.classList.toggle('menu-open');
  });
  links?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    document.body.classList.remove('menu-open');
  }));

  /* ---------- reveal-on-scroll fallback (only runs if scroll-timeline unsupported) ---------- */
  const supportsScrollTimeline = CSS?.supports?.('animation-timeline: view()');
  if (!supportsScrollTimeline) {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('js-in')),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  }

  /* ---------- hero headline: one-time word stagger on load ---------- */
  document.querySelectorAll('[data-stagger]').forEach(el => {
    const text = el.textContent;
    el.innerHTML = text.split(/(\s+)/).map(chunk =>
      chunk.trim() ? `<span class="word">${chunk}</span>` : chunk
    ).join('');
    el.querySelectorAll('.word').forEach((w, i) => {
      w.style.opacity = '0';
      w.style.transform = 'translateY(0.5em)';
      w.style.transition = `opacity .7s cubic-bezier(0.16,1,0.3,1) ${i * 45}ms, transform .7s cubic-bezier(0.16,1,0.3,1) ${i * 45}ms`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        w.style.opacity = '1';
        w.style.transform = 'none';
      }));
    });
  });

  /* ======================================================
     ORNITH LIVE FEED
     Reads the redacted public feed served from Titan via Caddy.
     Used by: hero "signal card" teaser + the full /ornith.html monitor.
     Degrades gracefully to a static "offline" state if unreachable —
     never shows an error to the visitor, just goes quiet.
     ====================================================== */
  const FEED_BASE = 'https://169.58.43.27.nip.io/ornith-feed';
  // Control is never advertised publicly. The link is injected only after a
  // successful request to the Tailscale-only endpoint on Titan.
  const CONTROL_HEALTH = 'https://ryzen-ted.tailfbfb1a.ts.net:9443/control-api/health';

  const escapeHTML = value => String(value ?? '').replace(/[&<>\"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
  }[ch]));

  async function enablePrivateControl() {
    try {
      const res = await fetch(CONTROL_HEALTH, { cache: 'no-store', mode: 'cors' });
      if (!res.ok) throw new Error('private endpoint unavailable');
      const data = await res.json();
      if (!data.ok) throw new Error('private endpoint rejected');
      const nav = document.querySelector('.nav-links');
      if (nav && !nav.querySelector('[data-control-link]')) {
        const link = document.createElement('a');
        link.href = 'control.html';
        link.textContent = 'Control';
        link.dataset.controlLink = 'true';
        nav.appendChild(link);
      }
      const state = document.querySelector('[data-control-state]');
      const detail = document.querySelector('[data-control-detail]');
      if (state) state.textContent = 'Ansluten till Titan via Tailscale';
      if (detail) detail.textContent = data.message || 'Privat anslutning verifierad.';
      document.body.dataset.controlVerified = 'true';
    } catch (_) {
      // Fail closed: no nav link and no server details for public visitors.
      const state = document.querySelector('[data-control-state]');
      const detail = document.querySelector('[data-control-detail]');
      if (state) state.textContent = 'Control är privat';
      if (detail) detail.textContent = 'Anslut till Teds Tailscale-nätverk för att fortsätta.';
    }
  }
  enablePrivateControl();

  function timeAgo(s) {
    if (s == null) return '';
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    return Math.floor(s / 3600) + 'h';
  }

  function renderSignalCard(data) {
    const card = document.querySelector('[data-ornith-teaser]');
    if (!card) return;
    const dot = card.querySelector('.pulse');
    const line = card.querySelector('.line');
    if (!data || !data.alive) {
      if (dot) dot.style.background = 'var(--muted-on-ink)';
      if (line) line.innerHTML = 'Ornith vilar just nu.';
      return;
    }
    if (data.current) {
      line.innerHTML = `<em>${escapeHTML(data.current.narration)}</em>`;
    } else {
      line.innerHTML = `<em>Ornith väntar på nästa uppgift.</em>`;
    }
  }

  const PHASE_ICON = {
    'läser systemkontext': '◎', 'tänker': '◈', 'sammanställer en rapport': '✎',
    'kör ett kommando': '▸', 'läser en fil': '◎', 'skriver en fil': '✎',
    'sammanställer resultatet': '◆',
  };

  function renderMonitor(data) {
    const nowEl = document.querySelector('[data-now-task]');
    const nowPhase = document.querySelector('[data-now-phase]');
    const nowElapsed = document.querySelector('[data-now-elapsed]');
    const activityEl = document.querySelector('[data-activity]');
    const pendingCount = document.querySelector('[data-pending-count]');
    const queueEl = document.querySelector('[data-queue]');
    const statusDot = document.querySelector('[data-status-dot]');
    const statusText = document.querySelector('[data-status-text]');
    if (!nowEl && !activityEl) return; // not on the monitor page

    if (!data || !data.alive) {
      if (statusDot) statusDot.classList.add('off');
      if (statusText) statusText.textContent = 'Signalen är tillfälligt otillgänglig';
      return;
    }
    if (statusDot) statusDot.classList.remove('off');
    if (statusText) statusText.textContent = data.state === 'running' ? 'Vaken och arbetar' : 'Vaken, väntar på nästa uppgift';

    if (nowEl) {
      nowEl.textContent = data.current ? data.current.narration : 'Ornith väntar på nästa uppgift.';
    }
    if (nowPhase) {
      const ph = data.current && data.current.phase;
      nowPhase.textContent = ph ? (PHASE_ICON[ph] || '·') + ' ' + ph : '';
      nowPhase.style.display = ph ? '' : 'none';
    }
    if (nowElapsed && data.current) {
      nowElapsed.textContent = 'Pågått i ' + timeAgo(data.current.elapsed_s);
    } else if (nowElapsed) {
      nowElapsed.textContent = '';
    }

    if (activityEl && Array.isArray(data.recent)) {
      activityEl.innerHTML = data.recent.map(r => `
        <li class="activity-item">
          <span class="d"></span>
          <span class="txt">${escapeHTML(r.narration)}</span>
          <span class="tag">klart</span>
        </li>`).join('');
    }

    if (pendingCount && data.queue) pendingCount.textContent = data.queue.pending ?? '–';
    if (queueEl && Array.isArray(data.upcoming)) {
      queueEl.innerHTML = data.upcoming.map(t => `
        <li class="queue-item"><span>${escapeHTML(t.title)}</span><span class="cat">${escapeHTML(t.category)}</span></li>
      `).join('') || '<li class="queue-item"><span>Kön är tom just nu.</span></li>';
    }
  }

  async function pollFeed() {
    try {
      const res = await fetch(FEED_BASE + '/api/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();
      renderSignalCard(data);
      renderMonitor(data);
    } catch (e) {
      renderSignalCard(null);
      renderMonitor(null);
    }
  }

  if (document.querySelector('[data-ornith-teaser]') || document.querySelector('[data-now-task]')) {
    pollFeed();
    setInterval(pollFeed, 6000);
  }

  /* ======================================================
     PODCASTS: click an episode row to play it inline
     ====================================================== */
  document.querySelectorAll('[data-episode-list]').forEach(list => {
    const key = list.dataset.episodeList;
    const player = document.querySelector(`[data-player="${key}"]`);
    if (!player) return;
    const items = list.querySelectorAll('.ep[data-src]');
    const playEp = (ep) => {
      items.forEach(i => i.classList.remove('playing'));
      ep.classList.add('playing');
      player.src = ep.dataset.src;
      player.play().catch(() => {});
    };
    items.forEach(ep => {
      ep.addEventListener('click', () => playEp(ep));
      ep.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playEp(ep); }
      });
    });
  });

  /* ======================================================
     COURSE PAGE: scroll-spy TOC + reading progress + quizzes
     ====================================================== */
  const chapters = document.querySelectorAll('.chapter');
  const tocLinks = document.querySelectorAll('.kurs-toc a');
  if (chapters.length && tocLinks.length) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          tocLinks.forEach(l => l.classList.remove('active'));
          const link = document.querySelector(`.kurs-toc a[href="#${e.target.id}"]`);
          link?.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    chapters.forEach(c => spy.observe(c));

    const progressBar = document.querySelector('.kurs-toc .progress i');
    if (progressBar) {
      window.addEventListener('scroll', () => {
        const h = document.documentElement;
        const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
        progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
      }, { passive: true });
    }
  }

  /* ---------- COURSE PROGRESS: local, resumable learning flow ---------- */
  const courseKey = document.body.dataset.course;
  const progressStore = 'ted-course-progress-v1';
  const readProgress = () => {
    try { return JSON.parse(localStorage.getItem(progressStore) || '{}'); }
    catch (_) { return {}; }
  };
  const writeProgress = data => {
    try { localStorage.setItem(progressStore, JSON.stringify(data)); }
    catch (_) { /* Private browsing may disable storage; the course still works. */ }
  };
  const courseState = (data, key) => {
    const state = data[key] || { done: [] };
    state.done = Array.isArray(state.done) ? state.done : [];
    return state;
  };

  if (courseKey && chapters.length) {
    const data = readProgress();
    const state = courseState(data, courseKey);
    const toc = document.querySelector('.kurs-toc');
    const status = document.createElement('div');
    status.className = 'course-status';
    status.setAttribute('aria-live', 'polite');
    status.innerHTML = '<strong data-course-count></strong><span data-course-label></span><button type="button" data-course-reset>Återställ</button>';
    toc?.appendChild(status);
    const countEl = status.querySelector('[data-course-count]');
    const labelEl = status.querySelector('[data-course-label]');
    const resetButton = status.querySelector('[data-course-reset]');
    const update = () => {
      const done = state.done.length;
      if (countEl) countEl.textContent = `${done}/${chapters.length}`;
      if (labelEl) labelEl.textContent = done === chapters.length ? ' Kurs klar' : ' kapitel klara';
      chapters.forEach(chapter => {
        const complete = state.done.includes(chapter.id);
        chapter.classList.toggle('is-complete', complete);
        const link = document.querySelector(`.kurs-toc a[href="#${chapter.id}"]`);
        link?.classList.toggle('is-complete', complete);
        const button = chapter.querySelector('[data-chapter-toggle]');
        if (button) {
          button.textContent = complete ? '✓ Kapitel klart — markera som ej klart' : 'Markera kapitlet som klart';
          button.setAttribute('aria-pressed', String(complete));
        }
      });
    };
    chapters.forEach(chapter => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter-complete';
      button.dataset.chapterToggle = 'true';
      button.addEventListener('click', () => {
        const index = state.done.indexOf(chapter.id);
        if (index === -1) state.done.push(chapter.id);
        else state.done.splice(index, 1);
        data[courseKey] = state;
        writeProgress(data);
        update();
      });
      chapter.appendChild(button);
    });
    resetButton?.addEventListener('click', () => {
      state.done = [];
      data[courseKey] = state;
      writeProgress(data);
      update();
    });
    update();
  }

  /* Course hub: show a real, persistent status instead of a static chapter count. */
  document.querySelectorAll('.kurs-row[data-course]').forEach(row => {
    const key = row.dataset.course;
    const total = Number(row.querySelector('.meta')?.textContent.match(/\d+/)?.[0] || 0);
    const done = courseState(readProgress(), key).done.length;
    const meta = row.querySelector('.meta');
    if (meta && total) meta.textContent = done ? `${done}/${total} kapitel klara` : `${total} kapitel · ej påbörjad`;
    row.classList.toggle('is-started', done > 0);
    row.classList.toggle('is-complete', total > 0 && done === total);
  });

  document.querySelectorAll('.quiz').forEach(quiz => {
    const opts = quiz.querySelectorAll('.opt');
    const fb = quiz.querySelector('.fb');
    let retry;
    const reset = () => {
      delete quiz.dataset.answered;
      opts.forEach(o => o.classList.remove('correct', 'wrong'));
      if (fb) { fb.textContent = ''; fb.classList.remove('show'); }
      retry?.remove();
    };
    opts.forEach(opt => {
      opt.addEventListener('click', () => {
        if (quiz.dataset.answered) return;
        quiz.dataset.answered = '1';
        opts.forEach(o => o.classList.add(o.dataset.correct === '1' ? 'correct' : (o === opt ? 'wrong' : '')));
        if (fb) { fb.textContent = opt.dataset.correct === '1' ? '✓ Rätt — ' + (fb.dataset.right || '') : '✗ ' + (fb.dataset.wrong || 'Inte riktigt — se den gröna raden.'); fb.classList.add('show'); }
        retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'quiz-retry';
        retry.textContent = 'Försök igen';
        retry.addEventListener('click', reset);
        quiz.appendChild(retry);
      });
    });
  });

  const draftEl = document.querySelector('[data-draft-text]');
  if (draftEl) {
    const LINES = [
      'Testar en ny idé för hur Ornith ska prioritera bakgrundsjobb när kön blir lång.',
      'Mira flaggade en avvikelse i minneskurvan — kollar om det är brus eller ett mönster.',
      'Skissar på en snabbare inläsning för Röst-labbets sökfeed.',
      'Ett utkast till hur nästa agent-loop ska logga sina beslut, steg för steg.',
      'Funderar på en enklare vy för att jämföra två körningar av Ornith mot varandra.',
      'Provar en ny formulering för statuskortet — kortare, tydligare, mindre teknisk.',
      'Ritar upp hur en framtida "Forskning"-sida kan strömma live-resultat från servern.',
    ];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    let last = -1;
    (async function loop() {
      while (true) {
        let idx = rndInt(0, LINES.length - 1);
        if (idx === last) idx = (idx + 1) % LINES.length;
        last = idx;
        const text = LINES[idx];
        let acc = '';
        for (const ch of text) {
          acc += ch;
          draftEl.innerHTML = acc.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<span class="cursor"></span>';
          await sleep(rndInt(14, 34));
        }
        await sleep(3200);
        for (let n = acc.length; n >= 0; n -= 3) {
          draftEl.innerHTML = acc.slice(0, n).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<span class="cursor"></span>';
          await sleep(8);
        }
        draftEl.innerHTML = '<span class="cursor"></span>';
        await sleep(500);
      }
    })();
  }
})();
