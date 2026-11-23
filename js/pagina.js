/* Interacciones de la página: barra que se vuelve sólida al bajar, filtros de proyectos y comprobación de si el visitante puede recorrer el museo.
   API: Pagina.puedeJugar(entorno?), Pagina.esTactil(entorno?), Pagina.marcarBarra(y), Pagina.filtrar(categoria), Pagina.iniciar(entorno?). */
(function () {
  let ligado = false;

  function entornoReal() {
    return {
      matchMedia: (q) => window.matchMedia(q),
      crearCanvas: () => document.createElement('canvas')
    };
  }

  /** El museo necesita WebGL2. Con ratón y teclado se maneja como siempre; en el celular, con los controles táctiles de js/tactil.js (en horizontal). */
  function puedeJugar(entorno) {
    const e = entorno || entornoReal();
    try {
      const lienzo = e.crearCanvas();
      return !!(lienzo && lienzo.getContext && lienzo.getContext('webgl2'));
    } catch (err) {
      return false;
    }
  }

  /** Puntero grueso (dedo): el museo se maneja con los controles táctiles. */
  function esTactil(entorno) {
    try {
      return !!(entorno || entornoReal()).matchMedia('(pointer: coarse)').matches;
    } catch (err) {
      return false;
    }
  }

  function marcarBarra(y) {
    const barra = document.querySelector('.nav');
    if (barra) barra.classList.toggle('solida', y > 40);
  }

  function filtrar(categoria) {
    document.querySelectorAll('[data-filtro]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filtro === categoria ? 'true' : 'false'));
    document.querySelectorAll('#proyectos [data-categoria]').forEach((t) => {
      t.hidden = categoria !== 'todos' && t.dataset.categoria !== categoria;
    });
  }

  function mostrarEntrada(puede) {
    document.querySelectorAll('[data-abrir-museo]').forEach((b) => { b.hidden = !puede; });
    document.querySelectorAll('.solo-movil').forEach((a) => { a.hidden = puede; });
    // "Verlo en el museo" y la fila de obras solo tienen sentido si el visitante puede recorrer el museo
    document.querySelectorAll('[data-obra], .mas-obras').forEach((a) => { a.hidden = !puede; });
  }

  function iniciar(entorno) {
    mostrarEntrada(puedeJugar(entorno));
    if (ligado) return;
    ligado = true;
    document.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => filtrar(b.dataset.filtro)));
    window.addEventListener('scroll', () => marcarBarra(window.scrollY), { passive: true });
    marcarBarra(window.scrollY);
  }

  window.Pagina = { puedeJugar, esTactil, marcarBarra, filtrar, iniciar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => iniciar());
  else iniciar();
})();
