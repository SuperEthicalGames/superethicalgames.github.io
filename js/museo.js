/* Escenario del museo: abre el juego (Unity WebGL) dentro de la página, a pantalla completa, solo cuando el visitante lo pide.
   Los nombres de los archivos (llevan hash) salen de museo/manifest.json, que escribe Herramientas/publicar_museo.ps1.
   API: Museo.configDesdeManifest(manifest, base?), Museo.abrir(opciones?), Museo.cerrar(), Museo.enviar(metodo, valor), Museo.estado(), Museo.configurar(dep). */
(function () {
  const BASE = 'museo/';
  const porDefecto = {
    cargarManifest: () => fetch(BASE + 'manifest.json', { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error('manifest ' + r.status);
      return r.json();
    }),
    cargarScript: (url) => new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = url; s.onload = ok; s.onerror = () => mal(new Error('no se pudo cargar ' + url));
      document.body.appendChild(s);
    }),
    crearInstancia: (canvas, config, progreso) => window.createUnityInstance(canvas, config, progreso)
  };

  let dep = porDefecto;
  const estado = { abierto: false, cargando: false, panelAbierto: false };
  let instancia = null, canvas = null, token = null, disparador = null, scriptCargado = false;

  const el = (id) => document.getElementById(id);

  function configDesdeManifest(manifest, base) {
    const raiz = base === undefined ? BASE : base;
    return {
      loaderUrl: raiz + 'Build/' + manifest.loader,
      config: {
        dataUrl: raiz + 'Build/' + manifest.data,
        frameworkUrl: raiz + 'Build/' + manifest.framework,
        codeUrl: raiz + 'Build/' + manifest.code,
        streamingAssetsUrl: raiz + (manifest.streamingAssets || 'StreamingAssets'),
        companyName: 'Sebastián Segovia Medina',
        productName: 'Museo-Portafolio',
        productVersion: '1.0',
        showBanner: (mensaje, tipo) => { if (tipo === 'error') console.error('[museo] ' + mensaje); }
      }
    };
  }

  function pausarLiquido(pausa) {
    const c = window.Liquido && window.Liquido.controlador;
    if (c && c.pausar) c.pausar(pausa);
  }

  function mostrarCarga() {
    el('escenario-carga').hidden = false;
    el('escenario-error').hidden = true;
    el('escenario-barra').style.width = '0%';
  }
  function mostrarError(causa) {
    console.warn('[museo] no se pudo abrir:', causa && causa.message ? causa.message : causa);
    el('escenario-carga').hidden = true;
    el('escenario-error').hidden = false;
    const boton = el('escenario-reintentar');
    if (boton) boton.focus();
  }

  async function cargar(mi) {
    mostrarCarga();
    let lienzoCanvas = null;
    try {
      const manifest = await dep.cargarManifest();
      if (mi.cancelado) return;
      const { loaderUrl, config } = configDesdeManifest(manifest);
      if (!scriptCargado) { await dep.cargarScript(loaderUrl); scriptCargado = true; }
      if (mi.cancelado) return;
      lienzoCanvas = document.createElement('canvas');
      lienzoCanvas.id = 'unity-canvas';
      lienzoCanvas.tabIndex = -1;
      el('escenario-lienzo').appendChild(lienzoCanvas);
      mi.canvas = lienzoCanvas;
      const nueva = await dep.crearInstancia(lienzoCanvas, config, (p) => { el('escenario-barra').style.width = Math.round(p * 100) + '%'; });
      if (mi.cancelado) {
        try { await nueva.Quit(); } catch (e) { /* ya cerrada */ }
        lienzoCanvas.remove();
        return;
      }
      instancia = nueva; canvas = lienzoCanvas;
      estado.cargando = false;
      el('escenario-carga').hidden = true;
      canvas.focus();
      // El 'listo' que el juego emite en Start sale antes de que exista la instancia: el saludo lo repite ahora.
      enviar('Saludar', '');
    } catch (causa) {
      if (lienzoCanvas) lienzoCanvas.remove();
      if (mi.cancelado) return;
      estado.cargando = false;
      mostrarError(causa);
    }
  }

  async function abrir(opciones) {
    if (estado.abierto) {
      // Ya abierto: solo se lleva al jugador a la obra pedida (o se deja pendiente hasta que el juego diga listo).
      if (opciones && opciones.obra && token) {
        token.opciones.obra = opciones.obra;
        token.irHecho = false;
        if (instancia) irAObraPendiente();
      }
      return;
    }
    disparador = document.activeElement;
    estado.abierto = true; estado.cargando = true; estado.panelAbierto = false;
    el('escenario').hidden = false;
    document.documentElement.classList.add('museo-abierto');
    pausarLiquido(true);
    el('escenario-salir').focus();
    token = { cancelado: false, canvas: null, opciones: opciones || {} };
    await cargar(token);
  }

  async function reintentar() {
    if (!estado.abierto) return;
    if (token) token.cancelado = true;
    token = { cancelado: false, canvas: null, opciones: token ? token.opciones : {} };
    estado.cargando = true;
    await cargar(token);
  }

  function cerrar() {
    if (!estado.abierto) return;
    if (token) { token.cancelado = true; if (token.canvas) token.canvas.remove(); }
    const vieja = instancia;
    instancia = null;
    if (canvas) { canvas.remove(); canvas = null; }
    if (vieja) {
      try { const r = vieja.Quit(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ya cerrada */ }
    }
    estado.abierto = false; estado.cargando = false; estado.panelAbierto = false;
    el('escenario').hidden = true;
    document.documentElement.classList.remove('museo-abierto');
    pausarLiquido(false);
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    if (disparador && disparador.focus) disparador.focus();
  }

  function enviar(metodo, valor) {
    if (instancia) instancia.SendMessage('MuseoPuente', metodo, valor);
  }

  /** Manda IrAObra una sola vez por apertura (el juego avisa 'listo' cada vez que se le saluda). */
  function irAObraPendiente() {
    if (!token || token.irHecho || !token.opciones.obra) return;
    token.irHecho = true;
    enviar('IrAObra', token.opciones.obra);
  }

  let idiomaDelJuego = null;

  function alAviso(e) {
    const d = e.detail || {};
    if (d.nombre === 'panel') estado.panelAbierto = d.dato === '1';
    else if (d.nombre === 'listo') {
      if (!instancia) return;   // el de Start llega antes de tener la instancia; se espera el saludo
      if (window.Idioma) enviar('PonerIdioma', window.Idioma.actual());
      irAObraPendiente();
    } else if (d.nombre === 'idioma' && window.Idioma && (d.dato === 'es' || d.dato === 'en')) {
      idiomaDelJuego = d.dato;   // evita devolverle al juego lo que él mismo acaba de avisar
      try { if (window.Idioma.actual() !== d.dato) window.Idioma.poner(d.dato); } finally { idiomaDelJuego = null; }
    }
  }

  function configurar(nuevas) {
    dep = nuevas ? Object.assign({}, porDefecto, nuevas) : porDefecto;
  }

  window.Museo = { configDesdeManifest, abrir, cerrar, enviar, configurar, estado: () => Object.assign({}, estado) };

  function ligar() {
    document.querySelectorAll('[data-abrir-museo]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); abrir(); }));
    const salir = el('escenario-salir'), reint = el('escenario-reintentar');
    if (salir) salir.addEventListener('click', cerrar);
    if (reint) reint.addEventListener('click', reintentar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && estado.abierto && !document.pointerLockElement && !estado.panelAbierto) cerrar();
    });
    window.addEventListener('museo', alAviso);
    document.querySelectorAll('a[data-obra]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      abrir({ obra: a.dataset.obra });
    }));
    if (window.Idioma) {
      window.Idioma.alCambiar((codigo) => { if (codigo !== idiomaDelJuego) enviar('PonerIdioma', codigo); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();
})();
