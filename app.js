(() => {
  const menu = document.querySelector('.menu');
  const links = document.querySelector('.navlinks');
  menu?.addEventListener('click', () => links?.classList.toggle('open'));
  const theme = document.querySelector('.theme');
  theme?.addEventListener('click', () => document.documentElement.classList.toggle('light'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('visible')), {threshold:.12});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  const form = document.querySelector('.console-input');
  const terminal = document.querySelector('.terminal');
  const activity = document.querySelector('.activity-feed');
  const activityLines = [
    '↳ mapping dependencies in ornith/agent.swift',
    '↳ testing memory boundary against 12 scenarios',
    '↳ refining Corefall world-state transitions',
    '↳ Eon: comparing recall, context and intent',
    '↳ checkpoint saved · continuing workspace pass',
    '↳ reviewing interface rhythm and copy',
  ];
  let activityIndex = 0;
  if (activity) setInterval(() => {
    activity.textContent = activityLines[activityIndex++ % activityLines.length];
    activity.classList.remove('pulse');
    void activity.offsetWidth;
    activity.classList.add('pulse');
  }, 2600);
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const value = input.value.trim();
    if (!value || !terminal) return;
    terminal.insertAdjacentHTML('beforeend', `<div><b>ted@workspace:~$</b> ${value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div><div>↳ Reading context… found 3 related project threads.</div><div>↳ Next action queued: clarify, build, test.</div>`);
    input.value = '';
    terminal.scrollTop = terminal.scrollHeight;
  });
})();
