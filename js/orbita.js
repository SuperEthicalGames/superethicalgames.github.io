/* Tarjetas que orbitan el borde del logo de la portada. Cada 2 s pasan a la esquina siguiente (sentido horario): la velocidad
   sube durante 1 s y baja durante el siguiente, así que salen y llegan a cada esquina en reposo.
   API: Orbita.iniciar(contenedor, tarjetas, opciones?) → { paso, pausar, parar, activo } o null.
   tarjetas: [{ el, inicio }] con inicio = esquina de partida (0 arriba-izq., 1 arriba-der., 2 abajo-der., 3 abajo-izq.).
   opciones: { manual: true } no usa requestAnimationFrame (las pruebas llaman a paso(ms)); { entorno } para inyectar matchMedia. */
(function () {
  const AJUSTES = {
    cicloMs: 2000,   // 1 s de velocidad creciente + 1 s de velocidad decreciente por cada lado
    holgura: 22,     // cuánto asoma la tarjeta por fuera del borde del logo (px)
    maxPasoMs: 100   // tope por cuadro: al volver a una pestaña oculta no salta
  };

  function entornoReal() {
    return { matchMedia: (q) => window.matchMedia(q) };
  }

  /** Sin movimiento reducido y en pantalla ancha: en el celular las tarjetas quedan fijas bajo el logo. */
  function disponible(entorno) {
    const e = entorno || entornoReal();
    try {
      if (e.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      if (e.matchMedia('(max-width: 640px)').matches) return false;
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Avance 0..1 durante un lado. Su velocidad es 1 − cos(2πu): parte de cero, llega al máximo a mitad del ciclo (u = 0,5) y vuelve a cero. */
  function avance(u) {
    return u - Math.sin(2 * Math.PI * u) / (2 * Math.PI);
  }

  function iniciar(contenedor, tarjetas, opciones) {
    const op = opciones || {};
    if (!contenedor || !tarjetas || !tarjetas.length || tarjetas.some((t) => !t || !t.el)) return null;
    if (!disponible(op.entorno)) return null;

    const lista = tarjetas.map((t) => ({ el: t.el, inicio: t.inicio || 0, previo: t.el.style.cssText, esquinas: null }));
    let t = 0, ultimo = null, cuadro = 0, activo = true, pausado = false, visible = true;

    /** Centros de las cuatro esquinas del recorrido: la tarjeta asoma `holgura` px por fuera del borde y nunca sale del contenedor más que eso. */
    function medir() {
      const W = contenedor.clientWidth, H = contenedor.clientHeight, o = AJUSTES.holgura;
      lista.forEach((tj) => {
        const w = tj.el.offsetWidth, h = tj.el.offsetHeight;
        const izq = Math.min(w / 2 - o, W / 2), der = Math.max(W - w / 2 + o, W / 2);
        const arr = Math.min(h / 2 - o, H / 2), aba = Math.max(H - h / 2 + o, H / 2);
        tj.esquinas = [[izq, arr], [der, arr], [der, aba], [izq, aba]];
        tj.w = w; tj.h = h;
      });
    }

    function aplicar() {
      const n = Math.floor(t / AJUSTES.cicloMs), u = (t % AJUSTES.cicloMs) / AJUSTES.cicloMs, f = avance(u);
      lista.forEach((tj) => {
        const de = tj.esquinas[(tj.inicio + n) % 4], a = tj.esquinas[(tj.inicio + n + 1) % 4];
        const x = de[0] + (a[0] - de[0]) * f - tj.w / 2, y = de[1] + (a[1] - de[1]) * f - tj.h / 2;
        tj.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      });
    }

    lista.forEach((tj) => {
      const s = tj.el.style;
      s.left = '0'; s.top = '0'; s.right = 'auto'; s.bottom = 'auto'; s.margin = '0'; s.willChange = 'transform';
    });
    medir();
    aplicar();

    function paso(ms) {
      if (!activo) return;
      t += ms;
      aplicar();
    }

    function ciclo(ahora) {
      if (!activo) return;
      if (ultimo !== null && !pausado && visible && !document.hidden) paso(Math.min(ahora - ultimo, AJUSTES.maxPasoMs));
      ultimo = ahora;
      cuadro = requestAnimationFrame(ciclo);
    }

    let observador = null, reajuste = null;
    if (op.manual !== true) {
      if ('IntersectionObserver' in window) {
        observador = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; });
        observador.observe(contenedor);
      }
      if ('ResizeObserver' in window) {
        reajuste = new ResizeObserver(() => { medir(); aplicar(); });
        reajuste.observe(contenedor);
      }
      cuadro = requestAnimationFrame(ciclo);
    }

    function pausar(valor) { pausado = !!valor; }

    function parar() {
      if (!activo) return;
      activo = false;
      cancelAnimationFrame(cuadro);
      if (observador) observador.disconnect();
      if (reajuste) reajuste.disconnect();
      lista.forEach((tj) => { tj.el.style.cssText = tj.previo; });
    }

    return { paso, pausar, parar, activo: () => activo };
  }

  window.Orbita = { disponible, iniciar, controlador: null };

  function arrancar() {
    const retrato = document.querySelector('.retrato');
    const a = retrato && retrato.querySelector('.chip-a'), b = retrato && retrato.querySelector('.chip-b');
    if (!a || !b) return;
    const evaluar = () => {
      if (window.Orbita.controlador) window.Orbita.controlador.parar();
      window.Orbita.controlador = iniciar(retrato, [{ el: a, inicio: 3 }, { el: b, inicio: 1 }]);
    };
    evaluar();
    // si el visitante cambia el tamaño de la ventana o la preferencia de movimiento, se reevalúa
    ['(prefers-reduced-motion: reduce)', '(max-width: 640px)'].forEach((q) => {
      const m = window.matchMedia(q);
      if (m.addEventListener) m.addEventListener('change', evaluar); else if (m.addListener) m.addListener(evaluar);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
