/* Ted Svärd — portfolio interactions.
   No frameworks. Progressive enhancement: everything works without JS except
   Leia's live status (which falls back to a static line in the markup). */
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

  /* ---------- keyboard skip link ---------- */
  const main = document.querySelector('main');
  if (main) {
    main.id ||= 'main-content';
    if (!document.querySelector('.skip-link')) {
      const skip = document.createElement('a');
      skip.className = 'skip-link';
      skip.href = `#${main.id}`;
      skip.textContent = 'Hoppa till innehåll';
      document.body.prepend(skip);
    }
  }

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    const menuId = links.id || 'site-menu';
    links.id = menuId;
    toggle.setAttribute('aria-controls', menuId);
    toggle.setAttribute('aria-expanded', 'false');
  }
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
  const closeMenu = () => {
    links?.classList.remove('open');
    document.body.classList.remove('menu-open');
    toggle?.setAttribute('aria-expanded', 'false');
  };
  toggle?.addEventListener('click', () => {
    links?.classList.toggle('open');
    document.body.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(links?.classList.contains('open')));
  });
  links?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    closeMenu();
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
  document.addEventListener('click', event => {
    if (links?.classList.contains('open') && !links.contains(event.target) && !toggle?.contains(event.target)) closeMenu();
  });

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
     LEIA STATUS
     Leia (local model) writes a short public status every 20 min.
     It is filtered server-side and pushed out to the `status` branch;
     the server itself accepts no inbound connections for this.
     ====================================================== */
  const LEIA_STATUS = 'https://raw.githubusercontent.com/Terrorbyte90/Hemsida/status/leia.json';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sedan = iso => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return min < 2 ? 'nyss' : min < 60 ? `${min} min sedan` : `${Math.round(min / 60)} h sedan`;
  };

  async function loadLeia() {
    const card = document.querySelector('[data-leia-teaser]');
    const panel = document.querySelector('[data-leia-panel]');
    if (!card && !panel) return;
    let d = null;
    try {
      const res = await fetch(LEIA_STATUS, { cache: 'no-store' });
      if (res.ok) d = await res.json();
    } catch (_) { /* offline fallback below */ }
    const stale = !d || (Date.now() - new Date(d.uppdaterad).getTime()) > 3 * 3600 * 1000;
    if (card) {
      const line = card.querySelector('.line');
      const dot = card.querySelector('.pulse');
      if (line) line.textContent = d && !stale ? d.nu : 'Leia vilar just nu.';
      if (dot && stale) dot.style.background = 'var(--muted-on-ink)';
    }
    if (panel) {
      const q = s => panel.querySelector(s);
      q('[data-leia-now]').textContent = d ? d.nu : 'Leia går inte att nå just nu.';
      q('[data-leia-updated]').textContent = d ? (stale ? 'senast ' : '') + sedan(d.uppdaterad) : '';
      q('[data-leia-recent]').innerHTML = (d && d.senaste || []).map(t =>
        `<li class="activity-item"><span class="d"></span><span class="txt">${esc(t)}</span><span class="tag"></span></li>`).join('');
      q('[data-leia-thought]').textContent = d && d.tanke ? d.tanke : '–';
      q('[data-leia-news]').textContent = d ? d.ai_nyheter_idag : '–';
      q('[data-leia-uptime]').textContent = d ? `${d.driftdagar} dagar` : '–';
    }
  }
  loadLeia();
  setInterval(loadLeia, 5 * 60 * 1000);

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
      'Leia har läst nattens AI-nyheter — tre nya modeller värda att testa i morgonrapporten.',
      'Voicy mixar nästa avsnitt av Dystopia AI: röster klara, musiken duckas under dialogen.',
      'Servervakten ser att disken växer — räknar ut när den blir full innan det blir ett problem.',
      'Beroendevakten hittade en säkerhetsbrist i ett repo. Föreslår en uppdatering på egen branch.',
      'Luna granskar en pull request medan Sofia svarar på en snabb fråga via iMessage.',
      'Sammanställer veckans AI-forskning till ett kort underlag för nästa poddavsnitt.',
      'Väntar på godkännande innan något skickas ut — vissa beslut ska alltid vara mänskliga.',
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
