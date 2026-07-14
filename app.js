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
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const value = input.value.trim();
    if (!value || !terminal) return;
    terminal.insertAdjacentHTML('beforeend', `<div><b>local@ted:~$</b> ${value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div><div>↳ Simulerad vy: projektkontext laddad lokalt. Inga externa anrop görs.</div>`);
    input.value = '';
    terminal.scrollTop = terminal.scrollHeight;
  });
})();
