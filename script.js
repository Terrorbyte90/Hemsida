'use strict';

// ===== PARTICLE SYSTEM =====
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: null, y: null };

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

class Particle {
  constructor() { this.reset(true); }
  reset(init = false) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : canvas.height + 10;
    this.size = Math.random() * 1.5 + 0.3;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = -(Math.random() * 0.4 + 0.1);
    this.opacity = Math.random() * 0.5 + 0.1;
    this.color = Math.random() > 0.5 ? '168,85,247' : '6,182,212';
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (mouse.x) {
      const dx = this.x - mouse.x, dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) { this.x += dx / dist * 0.5; this.y += dy / dist * 0.5; }
    }
    if (this.y < -10) this.reset();
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  const count = Math.min(120, Math.floor(canvas.width * canvas.height / 12000));
  for (let i = 0; i < count; i++) particles.push(new Particle());
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const alpha = (1 - dist / 120) * 0.12;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(168,85,247,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawConnections();
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}

resizeCanvas();
initParticles();
animateParticles();

window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

// ===== NAVBAR SCROLL =====
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
  // Auto-scrolled on inner pages
  if (!document.querySelector('.hero')) navbar.classList.add('scrolled');
}

// ===== TYPEWRITER (home only) =====
const typeEl = document.getElementById('typewriter');
if (typeEl) {
  const words = ['Ted Svärd', 'AI Architect', 'Innovatör', 'Problemlösaren'];
  let wordIdx = 0, charIdx = 0, deleting = false;
  function typeWriter() {
    const word = words[wordIdx];
    if (!deleting) {
      typeEl.textContent = word.slice(0, ++charIdx);
      if (charIdx === word.length) { deleting = true; setTimeout(typeWriter, 2200); return; }
    } else {
      typeEl.textContent = word.slice(0, --charIdx);
      if (charIdx === 0) { deleting = false; wordIdx = (wordIdx + 1) % words.length; }
    }
    setTimeout(typeWriter, deleting ? 60 : 100);
  }
  typeWriter();
}

// ===== COUNTER ANIMATION =====
function animateCounter(el) {
  const target = +el.dataset.target;
  const step = target / (2000 / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current);
    if (current >= target) { el.textContent = target; clearInterval(timer); }
  }, 16);
}
const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { heroStats.querySelectorAll('.stat-number').forEach(animateCounter); obs.unobserve(heroStats); } });
  }, { threshold: 0.5 });
  obs.observe(heroStats);
}

// ===== EXPERTISE CARDS ANIMATION =====
const cardObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      setTimeout(() => el.classList.add('visible'), +(el.dataset.delay || 0));
      cardObserver.unobserve(el);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.expertise-card').forEach(c => cardObserver.observe(c));

// ===== 3D HOVER EFFECT =====
document.querySelectorAll('.project-card, .expertise-card, .preview-card, .offer-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(1000px) rotateY(${x*7}deg) rotateX(${-y*7}deg) translateY(-4px)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transition = 'transform 0.4s ease'; card.style.transform = ''; });
  card.addEventListener('mouseenter', () => { card.style.transition = 'transform 0.1s ease'; });
});

// ===== HAMBURGER MENU =====
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
if (hamburger) {
  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    if (navLinks) {
      navLinks.style.cssText = open
        ? 'display:flex;flex-direction:column;position:fixed;top:70px;left:0;right:0;background:rgba(5,5,8,0.98);padding:24px;gap:20px;border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);z-index:99;'
        : '';
    }
  });
}

// ===== CONTACT FORM =====
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.textContent = '✓ Skickat!';
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.disabled = false; form.reset(); }, 3000);
  });
}
