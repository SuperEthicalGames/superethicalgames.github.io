/* Idioma español / inglés.
   El español vive en el HTML (atributo data-i18n = clave); el inglés, en window.TEXTOS_EN (js/textos.js).
   API: Idioma.detectar(lang), Idioma.aplicar(codigo, raiz?), Idioma.poner(codigo), Idioma.actual(), Idioma.alCambiar(cb). */
(function () {
  const CLAVE = 'idioma';
  const oyentes = [];
  let actual = 'es';
  let tituloEs = null;
  let descripcionEs = null;

  function detectar(lang) {
    return typeof lang === 'string' && /^es(?:[-_]|$)/i.test(lang.trim()) ? 'es' : 'en';
  }

  function leerGuardado() {
    try { const v = window.localStorage.getItem(CLAVE); return v === 'es' || v === 'en' ? v : null; } catch (e) { return null; }
  }

  function guardar(codigo) {
    try { window.localStorage.setItem(CLAVE, codigo); } catch (e) { /* ventana privada o almacenamiento bloqueado: el idioma sigue funcionando */ }
  }

  function aplicar(codigo, raiz) {
    const en = codigo === 'en';
    const diccionario = window.TEXTOS_EN || {};
    (raiz || document).querySelectorAll('[data-i18n]').forEach((el) => {
      if (!el.hasAttribute('data-es')) el.setAttribute('data-es', el.textContent);
      const traduccion = en ? diccionario[el.dataset.i18n] : undefined;
      el.textContent = en && typeof traduccion === 'string' && traduccion !== '' ? traduccion : el.getAttribute('data-es');
    });

    const meta = document.querySelector('meta[name="description"]');
    if (tituloEs === null) { tituloEs = document.title; descripcionEs = meta ? meta.content : ''; }
    document.title = en && diccionario['meta.titulo'] ? diccionario['meta.titulo'] : tituloEs;
    if (meta) meta.content = en && diccionario['meta.descripcion'] ? diccionario['meta.descripcion'] : descripcionEs;

    document.documentElement.lang = en ? 'en' : 'es';
    document.querySelectorAll('[data-idioma]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.idioma === (en ? 'en' : 'es') ? 'true' : 'false'));
  }

  function poner(codigo) {
    const nuevo = codigo === 'en' ? 'en' : 'es';
    const cambio = nuevo !== actual;
    actual = nuevo;
    aplicar(nuevo);
    guardar(nuevo);
    if (cambio) oyentes.slice().forEach((cb) => cb(nuevo));
  }

  function iniciar() {
    actual = leerGuardado() || detectar(window.navigator.language);
    aplicar(actual);
    document.querySelectorAll('[data-idioma]').forEach((b) => b.addEventListener('click', () => poner(b.dataset.idioma)));
  }

  window.Idioma = { detectar, aplicar, poner, actual: () => actual, alCambiar: (cb) => { oyentes.push(cb); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
