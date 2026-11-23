/* Controles táctiles del museo (celular en horizontal): joystick a la izquierda, arrastrar a la derecha para mirar y botones de acción.
   Hablan con el juego por Museo.enviar: TactilActivo(0|1), TactilMover("x,y"), TactilMirar("dx,dy"), TactilAccion(nombre).
   API: Tactil.esTactil(entorno?), Tactil.iniciar({ enviar, entorno?, manual? }) → { activar, panel, vaciar, parar, sensibilidad } o null,
        Tactil.pantallaCompleta(elemento), Tactil.salirPantallaCompleta(). El controlador de la página queda en Tactil.controlador. */
(function () {
  const SENSIBILIDAD = 0.12;   // unidades de giro de cámara por píxel arrastrado (en el juego la rueda del ratón equivale a ~0,05 por píxel)
  const ZONA_MUERTA = 0.15;    // fracción del radio del joystick que se ignora
  const CERO = '0.000,0.000';

  function entornoReal() {
    return { matchMedia: (q) => window.matchMedia(q) };
  }

  function esTactil(entorno) {
    try {
      return !!(entorno || entornoReal()).matchMedia('(pointer: coarse)').matches;
    } catch (err) {
      return false;
    }
  }

  function iniciar(opciones) {
    const op = opciones || {};
    if (!esTactil(op.entorno)) return null;
    const caja = document.getElementById('tactil');
    const base = document.getElementById('tactil-joystick');
    const area = document.getElementById('tactil-mirar');
    if (!caja || !base || !area) return null;
    const enviar = op.enviar || (() => {});
    const palanca = base.querySelector('i');
    const botones = [...caja.querySelectorAll('[data-accion]')];
    const cerrar = caja.querySelector('[data-accion="cerrar"]');
    const ctl = new AbortController();
    const escucha = { signal: ctl.signal };

    let activo = false, idJoystick = null, idMirar = null, ultimoX = 0, ultimoY = 0, acumX = 0, acumY = 0, cuadro = 0;

    // ------------------------------------------------------------ joystick (movimiento)
    function mover(e) {
      const r = base.getBoundingClientRect(), radio = Math.max(r.width / 2, 1);
      let x = (e.clientX - (r.left + r.width / 2)) / radio, y = (e.clientY - (r.top + r.height / 2)) / radio;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      if (palanca) palanca.style.transform = 'translate(' + (x * 69).toFixed(1) + '%,' + (y * 69).toFixed(1) + '%)';
      enviar('TactilMover', m < ZONA_MUERTA ? CERO : x.toFixed(3) + ',' + (-y).toFixed(3));   // arriba en pantalla = adelante
    }
    function soltarJoystick() {
      idJoystick = null;
      if (palanca) palanca.style.transform = '';
      enviar('TactilMover', CERO);
    }
    base.addEventListener('pointerdown', (e) => {
      if (idJoystick !== null) return;
      idJoystick = e.pointerId;
      try { base.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético */ }
      e.preventDefault();
      mover(e);
    }, escucha);
    base.addEventListener('pointermove', (e) => { if (e.pointerId === idJoystick) mover(e); }, escucha);
    ['pointerup', 'pointercancel'].forEach((t) => base.addEventListener(t, (e) => { if (e.pointerId === idJoystick) soltarJoystick(); }, escucha));

    // ------------------------------------------------------------ arrastrar para mirar
    function vaciar() {
      if (acumX === 0 && acumY === 0) return;
      enviar('TactilMirar', acumX.toFixed(3) + ',' + acumY.toFixed(3));
      acumX = 0; acumY = 0;
    }
    function programar() {
      if (op.manual || cuadro) return;
      cuadro = requestAnimationFrame(() => { cuadro = 0; vaciar(); });
    }
    area.addEventListener('pointerdown', (e) => {
      if (idMirar !== null) return;
      idMirar = e.pointerId; ultimoX = e.clientX; ultimoY = e.clientY;
      try { area.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético */ }
      e.preventDefault();
    }, escucha);
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId !== idMirar) return;
      acumX += (e.clientX - ultimoX) * SENSIBILIDAD;
      acumY += (e.clientY - ultimoY) * SENSIBILIDAD;
      ultimoX = e.clientX; ultimoY = e.clientY;
      programar();
    }, escucha);
    ['pointerup', 'pointercancel'].forEach((t) => area.addEventListener(t, (e) => {
      if (e.pointerId !== idMirar) return;
      idMirar = null;
      vaciar();
    }, escucha));

    // ------------------------------------------------------------ botones
    botones.forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const accion = b.dataset.accion;
      if (accion === 'correr') {
        const encendido = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', encendido ? 'true' : 'false');
        enviar('TactilAccion', 'correr:' + (encendido ? 1 : 0));
      } else {
        enviar('TactilAccion', accion);
      }
    }, escucha));

    // ------------------------------------------------------------ estado
    function soltarTodo() {
      if (idJoystick !== null || (palanca && palanca.style.transform)) soltarJoystick(); else enviar('TactilMover', CERO);
      idMirar = null;
      acumX = 0; acumY = 0;
    }

    /** Muestra u oculta los controles y le avisa al juego si debe leer la entrada táctil. */
    function activar(valor) {
      activo = !!valor;
      if (!activo) soltarTodo();
      caja.hidden = !activo;
      enviar('TactilActivo', activo ? 1 : 0);
    }

    /** Con un panel abierto el juego necesita los toques para leer y pulsar: solo queda el botón Cerrar. */
    function panel(abierto) {
      base.hidden = !!abierto;
      area.hidden = !!abierto;
      if (cerrar) cerrar.hidden = !abierto;
      if (abierto) soltarTodo();
    }

    function parar() {
      ctl.abort();
      cancelAnimationFrame(cuadro);
      caja.hidden = true;
      base.hidden = false; area.hidden = false;
      if (cerrar) cerrar.hidden = true;
      if (palanca) palanca.style.transform = '';
    }

    return { activar, panel, vaciar, parar, activo: () => activo, sensibilidad: SENSIBILIDAD };
  }

  /** Pantalla completa y horizontal: solo se puede pedir desde un gesto del visitante (el clic que abre el museo). */
  async function pantallaCompleta(elemento) {
    try { if (elemento && elemento.requestFullscreen && !document.fullscreenElement) await elemento.requestFullscreen({ navigationUI: 'hide' }); } catch (err) { /* no disponible */ }
    try { if (window.screen.orientation && window.screen.orientation.lock) await window.screen.orientation.lock('landscape'); } catch (err) { /* iOS y otros no lo permiten: queda el aviso de girar */ }
  }
  function salirPantallaCompleta() {
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (err) { /* ya salió */ }
    try { if (window.screen.orientation && window.screen.orientation.unlock) window.screen.orientation.unlock(); } catch (err) { /* sin bloqueo */ }
  }

  window.Tactil = { esTactil, iniciar, pantallaCompleta, salirPantallaCompleta, controlador: null };

  function arrancar() {
    window.Tactil.controlador = iniciar({ enviar: (metodo, valor) => { if (window.Museo) window.Museo.enviar(metodo, valor); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
