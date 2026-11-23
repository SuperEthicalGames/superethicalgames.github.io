/* Logos de tecnologías: antepone a cada elemento con data-logo="<slug>" un icono de Simple Icons (licencia CC0; las marcas son de sus dueños)
   del mismo color que el texto. Si el icono no carga, se quita y el texto queda igual.
   API: Logos.url(slug, color), Logos.iniciar(raiz?). */
(function () {
  const BASE = 'https://cdn.simpleicons.org/';

  function aHex(color) {
    const c = String(color || '').trim().toLowerCase();
    let m = c.match(/^#([0-9a-f]{6})$/);
    if (m) return m[1];
    m = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
    if (m) return m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0')).join('');
    return '8c9ab5';
  }

  function url(slug, color) {
    return BASE + encodeURIComponent(slug) + '/' + aHex(color);
  }

  function iniciar(raiz) {
    (raiz || document).querySelectorAll('[data-logo]').forEach((el) => {
      if (el.querySelector('img.logo-icono')) return;
      const icono = document.createElement('img');
      icono.className = 'logo-icono';
      icono.alt = '';
      icono.setAttribute('aria-hidden', 'true');
      icono.decoding = 'async';
      icono.addEventListener('error', () => icono.remove());
      icono.src = url(el.dataset.logo, window.getComputedStyle(el).color);
      el.insertBefore(icono, el.firstChild);
    });
  }

  window.Logos = { url, iniciar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => iniciar());
  else iniciar();
})();
