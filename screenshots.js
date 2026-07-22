/* Ted Svärd — draggable project screenshots (projekt.html).
   Each .shot starts at a slight rotation (--r custom prop) and can be
   dragged freely with mouse or touch. Dragging brings it to front. */
(() => {
  'use strict';
  if (window.matchMedia('(max-width:760px)').matches) return;

  document.querySelectorAll('.shot-cluster .shot').forEach(shot => {
    const rot = shot.style.getPropertyValue('--r') || '0deg';
    let dx = 0, dy = 0;
    shot.style.transform = `translate(0px,0px) rotate(${rot})`;

    let startX = 0, startY = 0, dragging = false;

    function pointerDown(x, y) {
      dragging = true;
      startX = x - dx;
      startY = y - dy;
      shot.classList.add('dragging');
      shot.parentElement.appendChild(shot);
    }
    function pointerMove(x, y) {
      if (!dragging) return;
      dx = x - startX;
      dy = y - startY;
      shot.style.transform = `translate(${dx}px,${dy}px) rotate(${rot})`;
    }
    function pointerUp() {
      dragging = false;
      shot.classList.remove('dragging');
    }

    shot.addEventListener('mousedown', e => { e.preventDefault(); pointerDown(e.clientX, e.clientY); });
    window.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', pointerUp);

    shot.addEventListener('touchstart', e => {
      const t = e.touches[0];
      pointerDown(t.clientX, t.clientY);
    }, { passive: true });
    shot.addEventListener('touchmove', e => {
      const t = e.touches[0];
      pointerMove(t.clientX, t.clientY);
    }, { passive: true });
    shot.addEventListener('touchend', pointerUp);
  });
})();
