/* Pruebas del sitio, sin dependencias. Abrir tests/pruebas.html servido por HTTP:
   el resultado queda en document.title como "PRUEBAS n/m" y el detalle en #salida.
   Cada prueba recibe { doc, win, marco } de la página cargada en el iframe. */
(function () {
  const registro = [];
  window.prueba = (nombre, fn) => registro.push([nombre, fn]);
  window.afirmar = (cond, mensaje) => { if (!cond) throw new Error(mensaje || 'afirmación falsa'); };
  window.esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  const ID_OBRAS = ['seam-amazonas', 'seam-eje-cafetero', 'seam-cartagena', 'uso-inmobiliario', 'guardian-ai', 'seam-middleware',
    'guardian-correo', 'seam-suite-vr', 'seam-operaciones', 'app-excel', 'agentes-ia-local', 'meta-venus', 'rolimate', 'office-tour', 'its-boom'];

  // ---- Tarea 2: estructura de la página
  prueba('esquema_una_sola_h1', ({ doc }) => {
    const n = doc.querySelectorAll('h1').length;
    afirmar(n === 1, 'debe haber exactamente un h1 y hay ' + n);
  });
  prueba('esquema_imagenes_con_alt', ({ doc }) => {
    const sin = [...doc.images].filter((i) => !i.hasAttribute('alt') || (i.alt.trim() === '' && !i.closest('[aria-hidden="true"]')));
    afirmar(sin.length === 0, 'imágenes sin alt: ' + sin.map((i) => i.src.split('/').pop()).join(', '));
  });
  prueba('esquema_obras_con_id_valido', ({ doc }) => {
    const enlaces = [...doc.querySelectorAll('[data-obra]')];
    afirmar(enlaces.length >= 10, 'esperaba al menos 10 enlaces data-obra y hay ' + enlaces.length);
    const malos = enlaces.map((a) => a.dataset.obra).filter((id) => !ID_OBRAS.includes(id));
    afirmar(malos.length === 0, 'ids de obra desconocidos: ' + malos.join(', '));
    const faltan = ID_OBRAS.filter((id) => !enlaces.some((a) => a.dataset.obra === id));
    afirmar(faltan.length === 0, 'obras sin enlace en la página: ' + faltan.join(', '));
  });
  prueba('esquema_claves_i18n_no_vacias', ({ doc }) => {
    const malos = [...doc.querySelectorAll('[data-i18n]')].filter((e) => !e.dataset.i18n.trim() || !e.textContent.trim());
    afirmar(malos.length === 0, 'elementos data-i18n vacíos: ' + malos.length);
  });
  prueba('esquema_ids_para_el_museo', ({ doc }) => {
    const ids = ['escenario', 'escenario-lienzo', 'escenario-carga', 'escenario-barra', 'escenario-error', 'escenario-reintentar', 'escenario-salir',
      'inicio', 'museo-seccion', 'proyectos', 'experiencia', 'contacto'];
    const faltan = ids.filter((id) => !doc.getElementById(id));
    afirmar(faltan.length === 0, 'faltan ids: ' + faltan.join(', '));
    afirmar(doc.querySelectorAll('[data-abrir-museo]').length >= 2, 'faltan botones [data-abrir-museo]');
    afirmar(doc.querySelectorAll('[data-filtro]').length === 4, 'faltan los 4 filtros');
  });
  prueba('esquema_imagenes_cargadas', async ({ doc }) => {
    // las imágenes diferidas (loading="lazy") no se piden hasta que se ven; aquí se fuerza la carga para comprobar que existen
    [...doc.images].forEach((i) => { i.loading = 'eager'; });
    await esperar(3500);
    const rotas = [...doc.images].filter((i) => !(i.complete && i.naturalWidth > 0));
    afirmar(rotas.length === 0, 'imágenes sin cargar: ' + rotas.map((i) => i.src.split('/').pop()).join(', '));
  });
  prueba('esquema_sin_desborde_horizontal_a_390_768_1440', async ({ doc, marco }) => {
    const malos = [];
    for (const ancho of [390, 768, 1440]) {
      marco.style.width = ancho + 'px';
      await esperar(400);
      if (doc.documentElement.scrollWidth > ancho) malos.push(ancho + ' (' + doc.documentElement.scrollWidth + ')');
    }
    marco.style.width = '1280px';
    afirmar(malos.length === 0, 'desborde horizontal a: ' + malos.join(', '));
  });

  // ---- Tarea 3: idioma
  const textosOriginales = async () => {
    const html = await (await fetch('../index.html?t=' + Date.now())).text();
    return new DOMParser().parseFromString(html, 'text/html');
  };
  const limpiarIdioma = ({ win }) => { try { win.localStorage.removeItem('idioma'); } catch (e) { /* sin almacenamiento */ } win.Idioma.poner('es'); };

  prueba('idioma_existe_el_objeto_Idioma', ({ win }) => {
    afirmar(win.Idioma && typeof win.Idioma.poner === 'function', 'no existe window.Idioma con poner()');
    afirmar(win.TEXTOS_EN && typeof win.TEXTOS_EN === 'object', 'no existe window.TEXTOS_EN');
  });
  prueba('idioma_detecta_es_co_como_es', ({ win }) => {
    afirmar(win.Idioma.detectar('es-CO') === 'es', 'es-CO debía dar es');
    afirmar(win.Idioma.detectar('ES') === 'es', 'ES debía dar es');
  });
  prueba('idioma_detecta_en_us_y_fr_como_en', ({ win }) => {
    afirmar(win.Idioma.detectar('en-US') === 'en', 'en-US debía dar en');
    afirmar(win.Idioma.detectar('fr') === 'en', 'fr debía dar en');
    afirmar(win.Idioma.detectar('') === 'en' && win.Idioma.detectar(undefined) === 'en', 'vacío o indefinido debía dar en');
  });
  prueba('idioma_aplica_en_cambia_texto_y_html_lang', ({ doc, win }) => {
    win.Idioma.poner('en');
    const el = doc.querySelector('[data-i18n="hero.titulo"]');
    afirmar(el.textContent === win.TEXTOS_EN['hero.titulo'], 'hero.titulo no se tradujo: ' + el.textContent);
    afirmar(doc.documentElement.lang === 'en', 'html[lang] debía ser en');
    afirmar(doc.title === win.TEXTOS_EN['meta.titulo'], 'el título del documento no se tradujo');
    limpiarIdioma({ win });
  });
  prueba('idioma_vuelve_a_es_con_el_texto_original', async ({ doc, win }) => {
    const original = await textosOriginales();
    win.Idioma.poner('en'); win.Idioma.poner('es');
    const malos = [...doc.querySelectorAll('[data-i18n]')].filter((e) => {
      const o = original.querySelector('[data-i18n="' + e.dataset.i18n + '"]');
      return o && e.textContent.trim() !== o.textContent.trim();
    });
    afirmar(malos.length === 0, 'no volvieron al español: ' + malos.map((e) => e.dataset.i18n).slice(0, 5).join(', '));
    afirmar(doc.documentElement.lang === 'es', 'html[lang] debía volver a es');
    limpiarIdioma({ win });
  });
  prueba('idioma_clave_sin_traduccion_conserva_el_espanol_nunca_undefined', ({ doc, win }) => {
    const copia = win.TEXTOS_EN['hero.pastilla'];
    delete win.TEXTOS_EN['hero.pastilla'];
    win.Idioma.poner('en');
    const t = doc.querySelector('[data-i18n="hero.pastilla"]').textContent;
    win.TEXTOS_EN['hero.pastilla'] = copia;
    afirmar(t !== 'undefined' && t.trim() !== '', 'quedó vacío o undefined: ' + t);
    afirmar(t === 'Abierto a oportunidades en Colombia y remoto', 'debía conservar el español: ' + t);
    limpiarIdioma({ win });
  });
  prueba('idioma_localStorage_bloqueado_no_rompe', ({ win }) => {
    const original = win.Storage.prototype.setItem;
    win.Storage.prototype.setItem = () => { throw new Error('bloqueado'); };
    try {
      win.Idioma.poner('en');
      afirmar(win.Idioma.actual() === 'en', 'el idioma debía cambiar aunque no se pueda guardar');
    } finally { win.Storage.prototype.setItem = original; }
    limpiarIdioma({ win });
  });
  prueba('idioma_emite_alCambiar', ({ win }) => {
    const recibidos = [];
    win.Idioma.poner('es'); // punto de partida conocido
    win.Idioma.alCambiar((c) => recibidos.push(c));
    win.Idioma.poner('en'); win.Idioma.poner('en'); win.Idioma.poner('es');
    afirmar(recibidos.join(',') === 'en,es', 'esperaba en,es y llegó: ' + recibidos.join(','));
    limpiarIdioma({ win });
  });
  prueba('idioma_botones_cambian_idioma_y_aria_pressed', ({ doc, win }) => {
    const botonEn = doc.querySelector('.nav .idioma button[data-idioma="en"]');
    botonEn.click();
    afirmar(win.Idioma.actual() === 'en', 'el botón EN no cambió el idioma');
    afirmar(botonEn.getAttribute('aria-pressed') === 'true', 'el botón EN debía quedar presionado');
    afirmar(doc.querySelector('.nav .idioma button[data-idioma="es"]').getAttribute('aria-pressed') === 'false', 'el botón ES debía quedar sin presionar');
    limpiarIdioma({ win });
  });
  prueba('textos_en_cubre_todas_las_claves_del_html', ({ doc, win }) => {
    const faltan = [...new Set([...doc.querySelectorAll('[data-i18n]')].map((e) => e.dataset.i18n))].filter((k) => !(k in win.TEXTOS_EN));
    afirmar(faltan.length === 0, 'claves sin traducción al inglés: ' + faltan.join(', '));
    afirmar('meta.titulo' in win.TEXTOS_EN && 'meta.descripcion' in win.TEXTOS_EN, 'faltan meta.titulo o meta.descripcion');
  });

  // ---- Tarea 4: interacciones de la página
  const entornoSimulado = (tactil, webgl2) => ({
    matchMedia: (q) => ({ matches: q.includes('coarse') ? tactil : false }),
    crearCanvas: () => ({ getContext: (tipo) => (tipo === 'webgl2' && webgl2 ? {} : null) })
  });
  const restaurarPagina = ({ win }) => { win.Pagina.filtrar('todos'); win.Pagina.iniciar(entornoSimulado(false, true)); };

  prueba('puedeJugar_depende_de_webgl2_y_tambien_vale_en_celular', ({ win }) => {
    afirmar(win.Pagina && typeof win.Pagina.puedeJugar === 'function', 'no existe window.Pagina.puedeJugar');
    afirmar(win.Pagina.puedeJugar(entornoSimulado(true, true)) === true, 'un celular con webgl2 debía poder jugar (controles táctiles)');
    afirmar(win.Pagina.puedeJugar(entornoSimulado(false, true)) === true, 'con ratón y webgl2 debía ser true');
    afirmar(win.Pagina.puedeJugar(entornoSimulado(false, false)) === false, 'sin webgl2 debía ser false');
    afirmar(win.Pagina.puedeJugar(entornoSimulado(true, false)) === false, 'celular sin webgl2 debía ser false');
    afirmar(win.Pagina.puedeJugar({ matchMedia: () => { throw new Error('x'); }, crearCanvas: () => { throw new Error('x'); } }) === false, 'si el entorno falla debía ser false');
  });
  prueba('esTactil_detecta_el_puntero_grueso', ({ win }) => {
    afirmar(typeof win.Pagina.esTactil === 'function', 'no existe window.Pagina.esTactil');
    afirmar(win.Pagina.esTactil(entornoSimulado(true, true)) === true, 'con puntero grueso debía ser true');
    afirmar(win.Pagina.esTactil(entornoSimulado(false, true)) === false, 'con ratón debía ser false');
    afirmar(win.Pagina.esTactil({ matchMedia: () => { throw new Error('x'); } }) === false, 'si el entorno falla debía ser false');
  });
  prueba('filtro_vr_oculta_las_tarjetas_de_otras_categorias', ({ doc, win }) => {
    win.Pagina.filtrar('vr');
    const tarjetas = [...doc.querySelectorAll('#proyectos [data-categoria]')];
    afirmar(tarjetas.length >= 5, 'esperaba al menos 5 tarjetas con categoría');
    afirmar(tarjetas.filter((t) => t.dataset.categoria === 'vr').every((t) => !t.hidden), 'las tarjetas vr debían verse');
    afirmar(tarjetas.filter((t) => t.dataset.categoria !== 'vr').every((t) => t.hidden), 'las demás debían ocultarse');
    afirmar(!doc.querySelector('#proyectos .tarjeta-oscura').hidden, 'la tarjeta del museo debía seguir visible');
    afirmar(doc.querySelector('[data-filtro="vr"]').getAttribute('aria-pressed') === 'true', 'el botón vr debía quedar presionado');
    restaurarPagina({ win });
  });
  prueba('filtro_todos_muestra_todas', ({ doc, win }) => {
    win.Pagina.filtrar('ia'); win.Pagina.filtrar('todos');
    afirmar([...doc.querySelectorAll('#proyectos [data-categoria]')].every((t) => !t.hidden), 'todas debían verse');
    restaurarPagina({ win });
  });
  prueba('filtro_con_clic_en_el_boton', ({ doc, win }) => {
    win.Pagina.iniciar(entornoSimulado(false, true));
    doc.querySelector('[data-filtro="backend"]').click();
    const visibles = [...doc.querySelectorAll('#proyectos [data-categoria]')].filter((t) => !t.hidden).map((t) => t.dataset.categoria);
    afirmar(visibles.length >= 1 && visibles.every((c) => c === 'backend'), 'solo debía verse backend y se ve: ' + visibles.join(','));
    restaurarPagina({ win });
  });
  prueba('iniciar_sin_puedeJugar_oculta_botones_de_entrada_y_muestra_aviso', ({ doc, win }) => {
    win.Pagina.iniciar(entornoSimulado(false, false));   // sin WebGL2 no se puede abrir el museo
    const botones = [...doc.querySelectorAll('[data-abrir-museo]')];
    afirmar(botones.length >= 2 && botones.every((b) => b.hidden), 'los botones de entrada debían ocultarse');
    const aviso = doc.querySelector('.solo-movil');
    afirmar(!aviso.hidden && win.getComputedStyle(aviso).display !== 'none', 'el aviso debía verse');
    const enlacesObra = [...doc.querySelectorAll('[data-obra]')];
    afirmar(enlacesObra.length >= 10 && enlacesObra.every((a) => a.hidden), 'los enlaces "Verlo en el museo" no deben verse si no se puede jugar');
    afirmar(doc.querySelector('.mas-obras').hidden, 'la fila "Más obras en el museo" tampoco');
    win.Pagina.iniciar(entornoSimulado(false, true));
    afirmar(botones.every((b) => !b.hidden) && aviso.hidden, 'con ratón y webgl2 debía revertirse');
    afirmar(enlacesObra.every((a) => !a.hidden) && !doc.querySelector('.mas-obras').hidden, 'los enlaces a obras debían volver a verse');
  });
  prueba('marcarBarra_pasa_a_solida_al_bajar', ({ doc, win }) => {
    win.Pagina.marcarBarra(120);
    afirmar(doc.querySelector('.nav').classList.contains('solida'), 'la barra debía quedar sólida a 120 px');
    win.Pagina.marcarBarra(0);
    afirmar(!doc.querySelector('.nav').classList.contains('solida'), 'la barra debía volver a transparente arriba');
  });

  // ---- Tarea 4b: logos
  prueba('logos_url_usa_el_color_del_texto', ({ win }) => {
    afirmar(win.Logos && typeof win.Logos.url === 'function', 'no existe window.Logos.url');
    afirmar(win.Logos.url('unity', 'rgb(255, 255, 255)') === 'https://cdn.simpleicons.org/unity/ffffff', 'rgb → ' + win.Logos.url('unity', 'rgb(255, 255, 255)'));
    afirmar(win.Logos.url('react', '#51607A') === 'https://cdn.simpleicons.org/react/51607a', '#hex → ' + win.Logos.url('react', '#51607A'));
  });
  prueba('logos_cada_data_logo_recibe_un_icono_que_carga', async ({ doc, win }) => {
    const elementos = [...doc.querySelectorAll('[data-logo]')];
    afirmar(elementos.length >= 20, 'esperaba al menos 20 elementos con data-logo y hay ' + elementos.length);
    win.Logos.iniciar(); win.Logos.iniciar(); // idempotente
    await esperar(4500);
    const dobles = elementos.filter((e) => e.querySelectorAll('img.logo-icono').length > 1);
    afirmar(dobles.length === 0, 'iconos duplicados en: ' + dobles.map((e) => e.dataset.logo).join(', '));
    const sin = elementos.filter((e) => { const i = e.querySelector('img.logo-icono'); return !i || !(i.complete && i.naturalWidth > 0); });
    afirmar(sin.length === 0, 'sin icono cargado: ' + sin.map((e) => e.dataset.logo + ':' + e.textContent.trim()).join(', '));
  });
  prueba('logos_si_falla_la_carga_se_quita_el_icono_y_el_texto_sigue', ({ doc, win }) => {
    const caja = doc.createElement('div');
    caja.innerHTML = '<span data-logo="unity">Unity de prueba</span>';
    doc.body.appendChild(caja);
    win.Logos.iniciar(caja);
    const icono = caja.querySelector('img.logo-icono');
    afirmar(icono, 'no se creó el icono');
    icono.dispatchEvent(new win.Event('error'));
    const sigue = !caja.querySelector('img') && caja.textContent === 'Unity de prueba';
    caja.remove();
    afirmar(sigue, 'el icono debía quitarse y el texto quedar igual');
  });
  prueba('esquema_logo_de_super_ethical_games_con_alt', ({ doc }) => {
    const img = doc.querySelector('img[src*="github.com/SuperEthicalGames"]');
    afirmar(img, 'falta el logo de Super Ethical Games');
    afirmar(/Super Ethical Games/i.test(img.alt), 'el logo necesita alt con el nombre');
  });

  prueba('esquema_logo_vigente_del_sena_en_el_puesto_de_instructor', async ({ doc }) => {
    const img = doc.querySelector('.puesto img[src$="img/sena.svg"]');
    afirmar(img, 'falta el logo del SENA (img/sena.svg) en el puesto del SENA');
    afirmar(/SENA/.test(img.alt), 'el logo del SENA necesita alt con el nombre');
    img.loading = 'eager';
    await esperar(1000);
    afirmar(img.complete && img.naturalWidth > 0, 'el logo del SENA no carga');
    const svg = await (await fetch('../img/sena.svg?t=' + Date.now())).text();
    afirmar(/#39a900/i.test(svg), 'el logo debe usar el verde oficial vigente #39A900');
    afirmar(!/<script|\son\w+=|<image|<foreignObject/i.test(svg), 'el SVG no debe llevar scripts ni imágenes incrustadas');
  });

  // ---- Tarjetas que orbitan el logo de la portada
  const nuevaOrbita = (doc, ancho, alto) => {
    const caja = doc.createElement('div');
    caja.style.cssText = 'position:fixed;left:40px;top:40px;width:' + ancho + 'px;height:' + alto + 'px;opacity:0;pointer-events:none';
    const a = doc.createElement('div'), b = doc.createElement('div');
    [a, b].forEach((t) => { t.style.cssText = 'position:absolute;width:200px;height:70px'; caja.appendChild(t); });
    doc.body.appendChild(caja);
    return { caja, a, b };
  };
  const centroDe = (caja, t) => {
    const c = caja.getBoundingClientRect(), r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
  };
  const cerca = (v, esperado) => Math.abs(v - esperado) <= 1.5;
  // Caja de 400 x 400, tarjetas de 200 x 70 y holgura de 22 px: los centros de las esquinas son (78|322, 13|387)
  const EN_ESQUINA = (c, x, y) => cerca(c.x, x) && cerca(c.y, y);
  const fmt = (c) => '(' + c.x.toFixed(1) + ', ' + c.y.toFixed(1) + ')';
  const entornoOrbita = (reducido, estrecho) => ({ matchMedia: (q) => ({ matches: q.includes('reduce') ? reducido : q.includes('max-width') ? estrecho : false }) });

  prueba('orbita_las_tarjetas_parten_en_esquinas_opuestas', ({ doc, win }) => {
    afirmar(win.Orbita && typeof win.Orbita.iniciar === 'function', 'no existe window.Orbita.iniciar');
    const { caja, a, b } = nuevaOrbita(doc, 400, 400);
    const o = win.Orbita.iniciar(caja, [{ el: a, inicio: 3 }, { el: b, inicio: 1 }], { manual: true });
    afirmar(o, 'Orbita.iniciar devolvió null');
    const ca = centroDe(caja, a), cb = centroDe(caja, b);
    o.parar(); caja.remove();
    afirmar(EN_ESQUINA(ca, 78, 387), 'la tarjeta A debía partir abajo a la izquierda (78, 387) y está en ' + fmt(ca));
    afirmar(EN_ESQUINA(cb, 322, 13), 'la tarjeta B debía partir arriba a la derecha (322, 13) y está en ' + fmt(cb));
  });
  prueba('orbita_cada_2_s_pasan_a_la_esquina_siguiente_en_sentido_horario', ({ doc, win }) => {
    const { caja, a, b } = nuevaOrbita(doc, 400, 400);
    const o = win.Orbita.iniciar(caja, [{ el: a, inicio: 3 }, { el: b, inicio: 1 }], { manual: true });
    afirmar(o, 'Orbita.iniciar devolvió null');
    o.paso(2000);
    const a1 = centroDe(caja, a), b1 = centroDe(caja, b);
    o.paso(2000);
    const a2 = centroDe(caja, a), b2 = centroDe(caja, b);
    o.parar(); caja.remove();
    afirmar(EN_ESQUINA(a1, 78, 13) && EN_ESQUINA(b1, 322, 387), 'a los 2 s A debía estar arriba-izq. y B abajo-der.: A ' + fmt(a1) + ', B ' + fmt(b1));
    afirmar(EN_ESQUINA(a2, 322, 13) && EN_ESQUINA(b2, 78, 387), 'a los 4 s A debía estar arriba-der. y B abajo-izq.: A ' + fmt(a2) + ', B ' + fmt(b2));
  });
  prueba('orbita_la_velocidad_sube_1_s_baja_1_s_y_termina_en_reposo', ({ doc, win }) => {
    const { caja, a, b } = nuevaOrbita(doc, 400, 400);
    const o = win.Orbita.iniciar(caja, [{ el: a, inicio: 3 }, { el: b, inicio: 1 }], { manual: true });
    afirmar(o, 'Orbita.iniciar devolvió null');
    const v = [];
    let previo = centroDe(caja, b);
    for (let i = 0; i < 20; i++) {
      o.paso(100);
      const c = centroDe(caja, b);
      v.push(Math.hypot(c.x - previo.x, c.y - previo.y));
      previo = c;
    }
    const final = previo;
    o.parar(); caja.remove();
    const pico = Math.max(...v), iPico = v.indexOf(pico), lista = v.map((x) => x.toFixed(1)).join(' ');
    afirmar(iPico === 9 || iPico === 10, 'el pico de velocidad debía estar a mitad del ciclo (1 s) y está en la ventana ' + iPico + ': ' + lista);
    for (let i = 1; i <= 9; i++) afirmar(v[i] > v[i - 1], 'la velocidad debía subir durante el primer segundo: ' + lista);
    for (let i = 11; i < 20; i++) afirmar(v[i] < v[i - 1], 'la velocidad debía bajar durante el segundo siguiente: ' + lista);
    afirmar(v[0] < pico * 0.1 && v[19] < pico * 0.1, 'debía arrancar y terminar casi en reposo: ' + lista);
    afirmar(EN_ESQUINA(final, 322, 387), 'tras 2 s B debía llegar abajo a la derecha (322, 387) y está en ' + fmt(final));
  });
  prueba('orbita_las_tarjetas_no_se_salen_del_contenedor_mas_de_la_holgura', ({ doc, win }) => {
    const { caja, a, b } = nuevaOrbita(doc, 400, 400);
    const o = win.Orbita.iniciar(caja, [{ el: a, inicio: 3 }, { el: b, inicio: 1 }], { manual: true });
    afirmar(o, 'Orbita.iniciar devolvió null');
    const fuera = [];
    for (let i = 0; i < 80; i++) {
      o.paso(137);
      const c = caja.getBoundingClientRect();
      [a, b].forEach((t, k) => {
        const r = t.getBoundingClientRect();
        if (r.left < c.left - 23 || r.right > c.right + 23 || r.top < c.top - 23 || r.bottom > c.bottom + 23) fuera.push('tarjeta ' + 'AB'[k] + ' en el paso ' + i);
      });
    }
    o.parar(); caja.remove();
    afirmar(fuera.length === 0, 'tarjetas fuera de la holgura: ' + fuera.slice(0, 3).join(', '));
  });
  prueba('orbita_no_se_activa_con_movimiento_reducido_ni_en_pantalla_estrecha', ({ doc, win }) => {
    const { caja, a, b } = nuevaOrbita(doc, 400, 400);
    const t = [{ el: a, inicio: 3 }, { el: b, inicio: 1 }];
    const reducido = win.Orbita.iniciar(caja, t, { entorno: entornoOrbita(true, false), manual: true });
    const estrecho = win.Orbita.iniciar(caja, t, { entorno: entornoOrbita(false, true), manual: true });
    const tocadas = a.style.transform !== '' || b.style.transform !== '';
    caja.remove();
    afirmar(reducido === null, 'con movimiento reducido debía devolver null');
    afirmar(estrecho === null, 'en pantalla estrecha (celular) debía devolver null');
    afirmar(!tocadas, 'sin animación no debía tocar las tarjetas');
  });
  prueba('orbita_parar_devuelve_las_tarjetas_a_su_sitio', ({ doc, win }) => {
    const { caja, a, b } = nuevaOrbita(doc, 400, 400);
    a.style.cssText += ';left:-5%;bottom:-7%';
    const antesA = a.style.cssText, antesB = b.style.cssText;
    const o = win.Orbita.iniciar(caja, [{ el: a, inicio: 3 }, { el: b, inicio: 1 }], { manual: true });
    afirmar(o, 'Orbita.iniciar devolvió null');
    o.paso(700);
    const movida = a.style.transform !== '';
    o.parar();
    const despuesA = a.style.cssText, despuesB = b.style.cssText;
    caja.remove();
    afirmar(movida, 'al avanzar la tarjeta debía tener transform');
    afirmar(despuesA === antesA && despuesB === antesB, 'parar() debía devolver el estilo original: "' + antesA + '" → "' + despuesA + '"');
  });
  prueba('esquema_hero_las_tarjetas_orbitan_el_logo', async ({ doc, win }) => {
    const a = doc.querySelector('.retrato .chip-a'), b = doc.querySelector('.retrato .chip-b');
    afirmar(a && b, 'faltan las tarjetas del logo en la portada');
    afirmar(win.Orbita && win.Orbita.controlador, 'la órbita debía arrancar en pantalla ancha');
    const inicial = a.getBoundingClientRect();
    let movida = false;
    for (let i = 0; i < 50 && !movida; i++) {
      await esperar(100);
      const r = a.getBoundingClientRect();
      movida = Math.abs(r.left - inicial.left) + Math.abs(r.top - inicial.top) > 1.5;
    }
    afirmar(movida, 'la tarjeta "Actualmente" debía moverse alrededor del logo');
  });

  // ---- Tarea 4c: efecto de líquido
  const entornoLiquido = (reducido, webgl2, extension) => ({
    matchMedia: (q) => ({ matches: q.includes('reduce') ? reducido : false }),
    crearCanvas: () => ({ getContext: (t) => (t === 'webgl2' && webgl2 ? { getExtension: (n) => (n === 'EXT_color_buffer_float' && extension ? {} : null) } : null) })
  });
  const nuevoLienzo = (doc, ancho, alto) => {
    const caja = doc.createElement('div');
    caja.style.cssText = 'position:fixed;left:0;top:0;width:' + ancho + 'px;height:' + alto + 'px;opacity:0;pointer-events:none';
    const lienzo = doc.createElement('canvas');
    lienzo.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    caja.appendChild(lienzo); doc.body.appendChild(caja);
    return { caja, lienzo };
  };
  const OR = [1, 0.79, 0.35];

  prueba('liquido_disponible_false_con_movimiento_reducido', ({ win }) => {
    afirmar(win.Liquido && typeof win.Liquido.disponible === 'function', 'no existe window.Liquido.disponible');
    afirmar(win.Liquido.disponible(entornoLiquido(true, true, true)) === false, 'con movimiento reducido debía ser false');
  });
  prueba('liquido_disponible_false_sin_webgl2_o_sin_extension', ({ win }) => {
    afirmar(win.Liquido.disponible(entornoLiquido(false, false, true)) === false, 'sin webgl2 debía ser false');
    afirmar(win.Liquido.disponible(entornoLiquido(false, true, false)) === false, 'sin EXT_color_buffer_float debía ser false');
    afirmar(win.Liquido.disponible(entornoLiquido(false, true, true)) === true, 'con todo debía ser true');
  });
  prueba('liquido_iniciar_devuelve_null_si_no_esta_disponible', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 200, 120);
    const c = win.Liquido.iniciar(lienzo, { entorno: entornoLiquido(true, true, true) });
    caja.remove();
    afirmar(c === null, 'debía devolver null con movimiento reducido');
  });
  prueba('liquido_sin_salpicar_no_hay_tinta', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 256, 144);
    const c = win.Liquido.iniciar(lienzo, { ambiente: false });
    afirmar(c, 'no se pudo iniciar el fluido en este navegador');
    c.paso(1 / 60);
    const t = c.tinta();
    c.parar(); caja.remove();
    afirmar(t === 0, 'sin salpicar la tinta debía ser 0 y es ' + t);
  });
  prueba('liquido_salpicar_deja_tinta', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 256, 144);
    const c = win.Liquido.iniciar(lienzo, { ambiente: false });
    afirmar(c, 'no se pudo iniciar el fluido en este navegador');
    c.salpicar(0.5, 0.5, 300, 100, OR);
    for (let i = 0; i < 4; i++) c.paso(1 / 60);
    const t = c.tinta();
    c.parar(); caja.remove();
    afirmar(t > 0.0005, 'después de salpicar debía haber tinta y hay ' + t);
  });
  prueba('liquido_la_tinta_se_desvanece_con_el_tiempo', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 256, 144);
    const c = win.Liquido.iniciar(lienzo, { ambiente: false });
    c.salpicar(0.5, 0.5, 0, 0, OR);
    c.paso(1 / 60);
    const inicial = c.tinta();
    for (let i = 0; i < 400; i++) c.paso(1 / 60);
    const final = c.tinta();
    c.parar(); caja.remove();
    afirmar(inicial > 0 && final < inicial * 0.5, 'la tinta debía desvanecerse: ' + inicial + ' → ' + final);
  });
  prueba('liquido_el_puntero_dibuja_en_el_contenedor', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 400, 240);
    const c = win.Liquido.iniciar(lienzo, { contenedor: caja, ambiente: false });
    afirmar(c, 'no se pudo iniciar el fluido en este navegador');
    const mover = (x, y) => caja.dispatchEvent(new win.PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }));
    mover(100, 100); mover(160, 120); mover(220, 140);
    for (let i = 0; i < 3; i++) c.paso(1 / 60);
    const t = c.tinta();
    c.parar(); caja.remove();
    afirmar(t > 0.0005, 'el movimiento del puntero debía dejar tinta y hay ' + t);
  });
  prueba('liquido_parar_detiene_el_ciclo', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 200, 120);
    const c = win.Liquido.iniciar(lienzo, { ambiente: false });
    afirmar(c && c.activo() === true, 'debía estar activo tras iniciar');
    c.parar();
    caja.remove();
    afirmar(c.activo() === false, 'debía quedar inactivo tras parar');
  });
  // Una ventana que aún no tiene tamaño (pestaña en segundo plano, panel recién abierto) dejaba el líquido apagado para siempre:
  // con un lienzo casi sin ancho se pedían texturas de decenas de miles de píxeles, WebGL las rechazaba y iniciar() devolvía null.
  prueba('liquido_arranca_aunque_el_lienzo_no_tenga_tamano_al_cargar', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 1, 700);
    let c = null, error = null;
    try { c = win.Liquido.iniciar(lienzo, { ambiente: false }); } catch (e) { error = e; }
    const devolvio = !!c;
    if (c) c.parar();
    caja.remove();
    afirmar(!error, 'iniciar lanzó una excepción con el lienzo sin tamaño: ' + (error && error.message));
    afirmar(devolvio, 'con un lienzo de 1 x 700 px debía devolver el controlador y devolvió null');
  });
  prueba('liquido_empieza_a_dibujar_cuando_el_lienzo_recibe_tamano', async ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 1, 700);
    const c = win.Liquido.iniciar(lienzo, { ambiente: false });
    afirmar(c, 'no devolvió el controlador con el lienzo sin tamaño');
    c.salpicar(0.5, 0.5, 300, 100, OR); c.paso(1 / 60);   // sin tamaño útil no debe lanzar ni dejar tinta
    const antes = c.tinta();
    caja.style.width = '400px'; caja.style.height = '240px';
    // el observador de tamaño avisa en el siguiente cuadro de la página (en un panel oculto puede tardar ~1 s): se espera la condición, no un tiempo fijo
    let despues = 0;
    for (let i = 0; i < 30 && !(despues > 0.0005); i++) {
      await esperar(100);
      c.salpicar(0.5, 0.5, 300, 100, OR);
      for (let k = 0; k < 4; k++) c.paso(1 / 60);
      despues = c.tinta();
    }
    c.parar(); caja.remove();
    afirmar(antes === 0, 'sin tamaño útil la tinta debía ser 0 y es ' + antes);
    afirmar(despues > 0.0005, 'al recibir tamaño debía empezar a dibujar y la tinta es ' + despues);
  });
  prueba('liquido_arranca_con_un_lienzo_muy_largo_y_angosto', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 20, 1500);
    const c = win.Liquido.iniciar(lienzo, { ambiente: false });
    afirmar(c, 'con un lienzo de 20 x 1500 px debía devolver el controlador y devolvió null');
    c.salpicar(0.5, 0.5, 300, 100, OR);
    for (let i = 0; i < 4; i++) c.paso(1 / 60);
    const t = c.tinta();
    c.parar(); caja.remove();
    afirmar(t > 0.0005, 'en un lienzo largo y angosto el líquido debía dibujar y la tinta es ' + t);
  });
  prueba('esquema_canvas_liquido_no_bloquea_clics', ({ doc, win }) => {
    const lienzo = doc.querySelector('.hero #liquido');
    afirmar(lienzo && lienzo.tagName === 'CANVAS', 'falta <canvas id="liquido"> dentro de .hero');
    afirmar(lienzo.getAttribute('aria-hidden') === 'true', 'el canvas decorativo necesita aria-hidden="true"');
    afirmar(win.getComputedStyle(lienzo).pointerEvents === 'none', 'el canvas no debe capturar clics');
    afirmar(lienzo === doc.querySelector('.hero').firstElementChild, 'el canvas debe ser el primer hijo de .hero (queda detrás del texto)');
  });
  prueba('esquema_canvas_liquido_cubre_toda_la_portada_aunque_se_baje', async ({ doc, win, marco }) => {
    // Con una ventana más baja que la portada y la página desplazada, el lienzo debe seguir ocupando la portada entera
    // (si se ancla a la primera pantalla, su borde inferior sube con el scroll y corta el líquido).
    const altoPrevio = marco.style.height;
    try {
      marco.style.height = '500px';
      await esperar(300);
      const portada = doc.querySelector('.hero'), lienzo = doc.getElementById('liquido');
      afirmar(portada.offsetHeight > 700, 'la portada debía ser más alta que la ventana de 500 px y mide ' + portada.offsetHeight);
      const fallos = [];
      for (const y of [0, 200, 600]) {
        win.scrollTo(0, y);
        await esperar(150);
        const p = portada.getBoundingClientRect(), l = lienzo.getBoundingClientRect();
        if (Math.abs(l.top - p.top) > 1 || Math.abs(l.bottom - p.bottom) > 1 || Math.abs(l.width - p.width) > 1) {
          fallos.push(`scroll ${Math.round(win.scrollY)}: portada ${Math.round(p.top)}..${Math.round(p.bottom)}, lienzo ${Math.round(l.top)}..${Math.round(l.bottom)}`);
        }
      }
      afirmar(fallos.length === 0, 'el lienzo no cubre la portada: ' + fallos.join(' | '));
    } finally {
      win.scrollTo(0, 0);
      marco.style.height = altoPrevio;
    }
  });

  // ---- Tarea 6: escenario del museo
  const MANIFEST = { loader: 'a.loader.js', data: 'b.data.unityweb', framework: 'c.framework.js.unityweb', code: 'd.wasm.unityweb', streamingAssets: 'StreamingAssets' };
  const instanciaFalsa = () => {
    const f = { quits: 0, enviados: [] };
    f.Quit = () => { f.quits++; return Promise.resolve(); };
    f.SendMessage = (...a) => { f.enviados.push(a); };
    return f;
  };
  const dependenciasOk = (win, instancia, progresos) => ({
    cargarManifest: () => Promise.resolve(MANIFEST),
    cargarScript: () => Promise.resolve(),
    crearInstancia: (canvas, config, progreso) => { (progresos || []).forEach((p) => progreso(p)); return Promise.resolve(instancia || instanciaFalsa()); }
  });
  const limpiarMuseo = ({ win }) => { win.Museo.cerrar(); win.Museo.configurar(null); };

  prueba('museo_config_desde_manifest_arma_las_urls', ({ win }) => {
    afirmar(win.Museo && typeof win.Museo.configDesdeManifest === 'function', 'no existe window.Museo.configDesdeManifest');
    const r = win.Museo.configDesdeManifest(MANIFEST);
    afirmar(r.loaderUrl === 'museo/Build/a.loader.js', 'loaderUrl → ' + r.loaderUrl);
    afirmar(r.config.dataUrl === 'museo/Build/b.data.unityweb', 'dataUrl → ' + r.config.dataUrl);
    afirmar(r.config.frameworkUrl === 'museo/Build/c.framework.js.unityweb', 'frameworkUrl → ' + r.config.frameworkUrl);
    afirmar(r.config.codeUrl === 'museo/Build/d.wasm.unityweb', 'codeUrl → ' + r.config.codeUrl);
    afirmar(r.config.streamingAssetsUrl === 'museo/StreamingAssets', 'streamingAssetsUrl → ' + r.config.streamingAssetsUrl);
    afirmar(r.config.productName === 'Museo-Portafolio' && typeof r.config.productVersion === 'string', 'faltan productName o productVersion');
    const otra = win.Museo.configDesdeManifest(MANIFEST, 'x/');
    afirmar(otra.loaderUrl === 'x/Build/a.loader.js', 'la base debía cambiar la ruta: ' + otra.loaderUrl);
  });
  prueba('museo_no_descarga_nada_al_cargar_la_pagina', ({ win }) => {
    const pedidos = win.performance.getEntriesByType('resource').filter((r) => r.name.includes('/museo/'));
    afirmar(pedidos.length === 0, 'la página pidió archivos del museo al cargar: ' + pedidos.map((r) => r.name).join(', '));
  });
  prueba('museo_abrir_muestra_aviso_de_peso_antes_de_descargar', async ({ doc, win }) => {
    let manifestPedido = 0, instancias = 0;
    win.Museo.configurar({ cargarManifest: () => { manifestPedido++; return new Promise(() => {}); }, crearInstancia: () => { instancias++; return new Promise(() => {}); } });
    win.Museo.abrir();
    await esperar(30);
    const visible = !doc.getElementById('escenario').hidden;
    const aviso = doc.getElementById('escenario-carga-texto').textContent;
    limpiarMuseo({ win });
    afirmar(visible, 'el escenario debía abrirse');
    afirmar(/38/.test(aviso), 'el aviso debía mencionar los 38 MB (datos 27,3 + wasm 10,6 del último build): ' + aviso);
    afirmar(manifestPedido === 1 && instancias === 0, 'debía pedir el manifest una vez y no crear la instancia aún');
  });
  prueba('museo_abrir_pide_manifest_y_crea_instancia_con_progreso', async ({ doc, win }) => {
    win.Museo.configurar(dependenciasOk(win, null, [0.5]));
    await win.Museo.abrir();
    const lienzo = doc.getElementById('escenario-lienzo');
    const hay = !!lienzo.querySelector('canvas');
    const barra = doc.getElementById('escenario-barra').style.width;
    const cargaOculta = doc.getElementById('escenario-carga').hidden;
    limpiarMuseo({ win });
    afirmar(hay, 'debía haber un canvas dentro del lienzo');
    afirmar(barra === '50%', 'la barra debía quedar en 50% y quedó en ' + barra);
    afirmar(cargaOculta, 'al terminar la carga el aviso debía ocultarse');
  });
  prueba('museo_cerrar_llama_a_Quit_y_quita_el_canvas', async ({ doc, win }) => {
    const inst = instanciaFalsa();
    win.Museo.configurar(dependenciasOk(win, inst));
    await win.Museo.abrir();
    win.Museo.cerrar();
    await esperar(30);
    const canvas = doc.getElementById('escenario-lienzo').querySelector('canvas');
    const oculto = doc.getElementById('escenario').hidden;
    win.Museo.configurar(null);
    afirmar(inst.quits === 1, 'Quit debía llamarse una vez y se llamó ' + inst.quits);
    afirmar(canvas === null && oculto, 'el canvas debía quitarse y el escenario ocultarse');
  });
  prueba('museo_cerrar_durante_la_carga_no_deja_canvas_y_permite_reabrir', async ({ doc, win }) => {
    const inst = instanciaFalsa();
    let resolver;
    win.Museo.configurar({ cargarManifest: () => Promise.resolve(MANIFEST), cargarScript: () => Promise.resolve(), crearInstancia: () => new Promise((r) => { resolver = r; }) });
    const apertura = win.Museo.abrir();
    await esperar(30);
    win.Museo.cerrar();
    resolver(inst);
    await apertura;
    await esperar(30);
    const lienzo = doc.getElementById('escenario-lienzo');
    afirmar(inst.quits === 1, 'la instancia que llegó tarde debía cerrarse con Quit; Quit se llamó ' + inst.quits);
    afirmar(lienzo.querySelector('canvas') === null, 'no debía quedar canvas huérfano');
    afirmar(doc.getElementById('escenario').hidden, 'el escenario debía seguir cerrado');
    win.Museo.configurar(dependenciasOk(win));
    await win.Museo.abrir();
    const reabierto = !!lienzo.querySelector('canvas') && !doc.getElementById('escenario').hidden;
    limpiarMuseo({ win });
    afirmar(reabierto, 'debía poder reabrirse con un canvas nuevo');
  });
  prueba('museo_manifest_404_muestra_error_con_reintento', async ({ doc, win }) => {
    win.Museo.configurar({ cargarManifest: () => Promise.reject(new Error('manifest 404')), cargarScript: () => Promise.resolve(), crearInstancia: () => Promise.resolve(instanciaFalsa()) });
    await win.Museo.abrir();
    const error = doc.getElementById('escenario-error'), carga = doc.getElementById('escenario-carga');
    afirmar(!error.hidden && carga.hidden, 'debía verse el error y ocultarse la carga');
    afirmar(doc.getElementById('escenario-reintentar'), 'falta el botón Reintentar');
    win.Museo.configurar(dependenciasOk(win));
    doc.getElementById('escenario-reintentar').click();
    await esperar(60);
    const logrado = doc.getElementById('escenario-error').hidden && !!doc.getElementById('escenario-lienzo').querySelector('canvas');
    limpiarMuseo({ win });
    afirmar(logrado, 'tras Reintentar con red debía cargarse el museo');
  });
  // ---- Ratón anclado al juego: el clic lo ancla, Esc lo suelta (lo hace el navegador) y el juego se entera
  const anclarFalso = (doc, canvas) => Object.defineProperty(doc, 'pointerLockElement', { get: () => canvas, configurable: true });
  const panelAviso = (win, abierto) => win.dispatchEvent(new win.CustomEvent('museo', { detail: { nombre: 'panel', dato: abierto ? '1' : '0' } }));

  prueba('museo_esc_con_el_juego_en_marcha_solo_suelta_el_raton_y_durante_la_carga_sale', async ({ doc, win }) => {
    const tecla = () => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    win.Museo.configurar(dependenciasOk(win));
    await win.Museo.abrir();
    tecla();
    const siguioAbierto = !doc.getElementById('escenario').hidden;   // en marcha, Esc suelta el ratón (lo hace el navegador) y el museo sigue
    win.Museo.cerrar();
    win.Museo.configurar({ cargarManifest: () => new Promise(() => {}) });
    win.Museo.abrir();
    await esperar(30);
    tecla();
    const salioCargando = doc.getElementById('escenario').hidden;     // sin juego al que soltarle el ratón, Esc sale
    limpiarMuseo({ win });
    afirmar(siguioAbierto, 'con el juego en marcha Esc no debía cerrar el museo');
    afirmar(salioCargando, 'durante la carga Esc debía cerrar el museo');
  });
  prueba('museo_el_clic_en_el_juego_ancla_el_raton_salvo_con_panel_abierto_o_ya_anclado', async ({ doc, win }) => {
    win.Museo.configurar(dependenciasOk(win));
    await win.Museo.abrir();
    const canvas = doc.getElementById('escenario-lienzo').querySelector('canvas');
    let pedidos = 0;
    canvas.requestPointerLock = () => { pedidos++; };
    const clic = () => canvas.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    clic(); const conRatonLibre = pedidos;
    panelAviso(win, true); clic(); const conPanel = pedidos;
    panelAviso(win, false);
    anclarFalso(doc, canvas); clic(); const yaAnclado = pedidos;
    delete doc.pointerLockElement;
    limpiarMuseo({ win });
    afirmar(conRatonLibre === 1, 'el clic con el ratón libre debía pedir el bloqueo y pidió ' + conRatonLibre + ' vez/veces');
    afirmar(conPanel === 1, 'con un panel abierto el clic no debía pedir el bloqueo (hace falta el cursor libre)');
    afirmar(yaAnclado === 1, 'con el ratón ya anclado no debía volver a pedirlo');
  });
  prueba('museo_avisa_al_juego_cuando_el_raton_se_ancla_o_se_suelta', async ({ doc, win }) => {
    const inst = instanciaFalsa();
    win.Museo.configurar(dependenciasOk(win, inst));
    await win.Museo.abrir();
    const canvas = doc.getElementById('escenario-lienzo').querySelector('canvas');
    const avisos = () => inst.enviados.filter((a) => a[0] === 'MuseoPuente' && a[1] === 'RatonAnclado').map((a) => a[2]);
    const alAbrir = avisos().join();
    anclarFalso(doc, canvas); doc.dispatchEvent(new win.Event('pointerlockchange'));
    delete doc.pointerLockElement; doc.dispatchEvent(new win.Event('pointerlockchange'));
    const todos = avisos().join();
    limpiarMuseo({ win });
    afirmar(alAbrir === '0', 'al abrir el ratón está libre: debía avisar RatonAnclado(0) y avisó "' + alAbrir + '"');
    afirmar(todos === '0,1,0', 'debía avisar 0 → 1 (anclado) → 0 (suelto) y avisó "' + todos + '"');
  });
  prueba('museo_la_pista_de_anclar_el_raton_se_ve_solo_con_el_juego_en_marcha_y_el_raton_libre', async ({ doc, win }) => {
    const pista = () => doc.getElementById('escenario-pista');
    afirmar(pista(), 'falta #escenario-pista');
    win.Museo.configurar({ cargarManifest: () => new Promise(() => {}) });
    win.Museo.abrir();
    await esperar(30);
    const durantelaCarga = pista().hidden;
    win.Museo.cerrar();
    win.Museo.configurar(dependenciasOk(win));
    await win.Museo.abrir();
    const canvas = doc.getElementById('escenario-lienzo').querySelector('canvas');
    const libre = !pista().hidden;
    anclarFalso(doc, canvas); doc.dispatchEvent(new win.Event('pointerlockchange'));
    const anclado = pista().hidden;
    delete doc.pointerLockElement; doc.dispatchEvent(new win.Event('pointerlockchange'));
    const suelto = !pista().hidden;
    panelAviso(win, true);
    const conPanel = pista().hidden;
    panelAviso(win, false);
    win.Museo.cerrar();
    const cerrado = pista().hidden;
    limpiarMuseo({ win });
    afirmar(durantelaCarga, 'durante la carga no debía verse la pista');
    afirmar(libre, 'con el juego en marcha y el ratón libre debía verse la pista');
    afirmar(anclado, 'con el ratón anclado la pista debía ocultarse');
    afirmar(suelto, 'al soltar el ratón (Esc) la pista debía volver');
    afirmar(conPanel, 'con un panel abierto la pista no debía verse');
    afirmar(cerrado, 'al cerrar el museo la pista debía ocultarse');
  });
  prueba('museo_el_boton_de_entrada_abre_y_salir_cierra', async ({ doc, win }) => {
    win.Museo.configurar(dependenciasOk(win));
    doc.querySelector('[data-abrir-museo]').click();
    await esperar(60);
    const abierto = !doc.getElementById('escenario').hidden;
    doc.getElementById('escenario-salir').click();
    await esperar(30);
    const cerrado = doc.getElementById('escenario').hidden;
    limpiarMuseo({ win });
    afirmar(abierto, 'el botón de entrada debía abrir el museo');
    afirmar(cerrado, 'Salir debía cerrar el museo');
  });

  // ---- Controles táctiles del museo (celular en horizontal)
  const conEscenarioVisible = async (doc, fn) => {
    const e = doc.getElementById('escenario'), antes = e.hidden;
    e.hidden = false;
    try { return await fn(); } finally { e.hidden = antes; }
  };
  const nuevoTactil = (win, extra) => {
    const enviados = [];
    const c = win.Tactil.iniciar(Object.assign({ enviar: (m, v) => enviados.push([m, v]), entorno: entornoSimulado(true, true), manual: true }, extra || {}));
    return { c, enviados };
  };
  const toque = (win, tipo, x, y, id) => new win.PointerEvent(tipo, { pointerId: id || 1, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' });
  const ultimoEnvio = (enviados, metodo) => { const e = enviados.filter((a) => a[0] === metodo).pop(); return e ? e[1] : null; };
  const numeros = (s) => String(s).split(',').map(Number);

  prueba('tactil_no_arranca_si_el_dispositivo_no_es_tactil', ({ win }) => {
    afirmar(win.Tactil && typeof win.Tactil.iniciar === 'function', 'no existe window.Tactil.iniciar');
    afirmar(win.Tactil.iniciar({ enviar: () => {}, entorno: entornoSimulado(false, true), manual: true }) === null, 'con ratón debía devolver null');
  });
  prueba('tactil_activar_muestra_los_controles_y_avisa_al_juego', async ({ doc, win }) => {
    await conEscenarioVisible(doc, async () => {
      const { c, enviados } = nuevoTactil(win);
      afirmar(c, 'Tactil.iniciar devolvió null en un dispositivo táctil');
      const caja = doc.getElementById('tactil');
      afirmar(caja && caja.hidden, 'los controles táctiles debían empezar ocultos');
      c.activar(true);
      const visible = !caja.hidden;
      c.activar(false);
      const oculto = caja.hidden;
      c.parar();
      afirmar(visible, 'activar(true) debía mostrar los controles');
      afirmar(oculto, 'activar(false) debía ocultarlos');
      afirmar(enviados[0] && enviados[0][0] === 'TactilActivo' && enviados[0][1] === 1, 'debía avisar TactilActivo(1): ' + JSON.stringify(enviados));
      afirmar(enviados[enviados.length - 1][0] === 'TactilActivo' && enviados[enviados.length - 1][1] === 0, 'al desactivar debía avisar TactilActivo(0)');
    });
  });
  prueba('tactil_el_joystick_manda_el_movimiento_recortado_y_se_detiene_al_soltar', async ({ doc, win }) => {
    await conEscenarioVisible(doc, async () => {
      const { c, enviados } = nuevoTactil(win);
      c.activar(true);
      const base = doc.getElementById('tactil-joystick'), r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
      base.dispatchEvent(toque(win, 'pointerdown', cx, cy));
      base.dispatchEvent(toque(win, 'pointermove', cx + 3 * R, cy));        // muy a la derecha: se recorta a 1
      const derecha = numeros(ultimoEnvio(enviados, 'TactilMover'));
      base.dispatchEvent(toque(win, 'pointermove', cx, cy - R));            // arriba = adelante (y positivo)
      const arriba = numeros(ultimoEnvio(enviados, 'TactilMover'));
      base.dispatchEvent(toque(win, 'pointermove', cx + 0.02 * R, cy));     // dentro de la zona muerta
      const quieto = numeros(ultimoEnvio(enviados, 'TactilMover'));
      base.dispatchEvent(toque(win, 'pointerup', cx, cy));
      const suelto = ultimoEnvio(enviados, 'TactilMover');
      c.parar();
      afirmar(R > 20, 'el joystick debía tener tamaño y su radio es ' + R);
      afirmar(Math.abs(derecha[0] - 1) < 0.01 && Math.abs(derecha[1]) < 0.01, 'a la derecha debía ser (1, 0) y fue ' + derecha);
      afirmar(Math.abs(arriba[0]) < 0.01 && Math.abs(arriba[1] - 1) < 0.01, 'arriba debía ser adelante (0, 1) y fue ' + arriba);
      afirmar(quieto[0] === 0 && quieto[1] === 0, 'dentro de la zona muerta debía ser (0, 0) y fue ' + quieto);
      afirmar(suelto === '0.000,0.000', 'al soltar debía mandar 0.000,0.000 y mandó ' + suelto);
    });
  });
  prueba('tactil_arrastrar_para_mirar_manda_el_giro_acumulado_con_la_sensibilidad', async ({ doc, win }) => {
    await conEscenarioVisible(doc, async () => {
      const { c, enviados } = nuevoTactil(win);
      c.activar(true);
      const area = doc.getElementById('tactil-mirar');
      area.dispatchEvent(toque(win, 'pointerdown', 100, 100, 7));
      area.dispatchEvent(toque(win, 'pointermove', 150, 80, 7));
      area.dispatchEvent(toque(win, 'pointermove', 160, 80, 7));
      c.vaciar();
      const giro = numeros(ultimoEnvio(enviados, 'TactilMirar'));
      area.dispatchEvent(toque(win, 'pointerup', 160, 80, 7));
      c.vaciar();
      const mandados = enviados.filter((a) => a[0] === 'TactilMirar').length;
      const s = c.sensibilidad;
      c.parar();
      afirmar(s > 0, 'debía exponer la sensibilidad');
      afirmar(Math.abs(giro[0] - 60 * s) < 0.01 && Math.abs(giro[1] + 20 * s) < 0.01, 'el giro debía ser (60, -20) × ' + s + ' y fue ' + giro);
      afirmar(mandados === 1, 'sin movimiento nuevo no debía mandar más giros y mandó ' + mandados);
    });
  });
  prueba('tactil_los_botones_mandan_su_accion_y_correr_alterna', async ({ doc, win }) => {
    await conEscenarioVisible(doc, async () => {
      const { c, enviados } = nuevoTactil(win);
      c.activar(true);
      const acciones = ['interactuar', 'carrito', 'creditos', 'musica', 'idioma', 'cerrar'];
      acciones.forEach((n) => {
        const b = doc.querySelector('#tactil [data-accion="' + n + '"]');
        afirmar(b, 'falta el botón de la acción ' + n);
        b.dispatchEvent(toque(win, 'pointerdown', 0, 0));
      });
      const correr = doc.querySelector('#tactil [data-accion="correr"]');
      afirmar(correr, 'falta el botón de correr');
      correr.dispatchEvent(toque(win, 'pointerdown', 0, 0));
      const activado = correr.getAttribute('aria-pressed');
      correr.dispatchEvent(toque(win, 'pointerdown', 0, 0));
      const desactivado = correr.getAttribute('aria-pressed');
      const mandadas = enviados.filter((a) => a[0] === 'TactilAccion').map((a) => a[1]);
      c.parar();
      afirmar(mandadas.join() === acciones.concat(['correr:1', 'correr:0']).join(), 'acciones mandadas: ' + mandadas.join());
      afirmar(activado === 'true' && desactivado === 'false', 'correr debía alternar aria-pressed: ' + activado + ' → ' + desactivado);
    });
  });
  prueba('tactil_con_un_panel_abierto_solo_queda_el_boton_cerrar_y_se_suelta_el_joystick', async ({ doc, win }) => {
    await conEscenarioVisible(doc, async () => {
      const { c, enviados } = nuevoTactil(win);
      c.activar(true);
      const joystick = doc.getElementById('tactil-joystick'), mirar = doc.getElementById('tactil-mirar'), cerrar = doc.querySelector('#tactil [data-accion="cerrar"]');
      const normal = !joystick.hidden && !mirar.hidden && cerrar.hidden;
      c.panel(true);
      const conPanel = joystick.hidden && mirar.hidden && !cerrar.hidden;
      const soltado = ultimoEnvio(enviados, 'TactilMover');
      c.panel(false);
      const sinPanel = !joystick.hidden && !mirar.hidden && cerrar.hidden;
      c.parar();
      afirmar(normal, 'sin panel debían verse joystick y área de mirar, y no el botón cerrar');
      afirmar(conPanel, 'con un panel abierto debían ocultarse joystick y área de mirar (dejan pasar los toques al juego) y verse cerrar');
      afirmar(soltado === '0.000,0.000', 'al abrir un panel el joystick debía soltarse: ' + soltado);
      afirmar(sinPanel, 'al cerrar el panel debía volver a lo normal');
    });
  });
  prueba('tactil_hay_aviso_para_girar_el_celular_en_horizontal', ({ doc }) => {
    const aviso = doc.getElementById('tactil-girar');
    afirmar(aviso && aviso.dataset.i18n && aviso.textContent.trim(), 'falta el aviso #tactil-girar con texto traducible');
  });

  prueba('liquido_pausar_y_reanudar', ({ doc, win }) => {
    const { caja, lienzo } = nuevoLienzo(doc, 200, 120);
    const c = win.Liquido.iniciar(lienzo, { ambiente: false });
    afirmar(c && typeof c.pausar === 'function' && typeof c.pausado === 'function', 'faltan pausar() y pausado()');
    afirmar(c.pausado() === false, 'al iniciar no debía estar pausado');
    c.pausar(true); const pausado = c.pausado();
    c.pausar(false); const reanudado = !c.pausado();
    c.parar(); caja.remove();
    afirmar(pausado && reanudado, 'pausar(true) debía pausar y pausar(false) reanudar');
  });
  prueba('museo_abrir_pausa_el_liquido_y_cerrar_lo_reanuda', async ({ win }) => {
    const c = win.Liquido && win.Liquido.controlador;
    if (!c) return; // sin WebGL2 no hay líquido que pausar
    win.Museo.configurar(dependenciasOk(win));
    await win.Museo.abrir();
    const pausadoAbierto = c.pausado();
    win.Museo.cerrar();
    const pausadoCerrado = c.pausado();
    limpiarMuseo({ win });
    afirmar(pausadoAbierto === true, 'con el museo abierto el líquido debía estar pausado');
    afirmar(pausadoCerrado === false, 'al cerrar el museo el líquido debía reanudarse');
  });

  // ---- Tarea 8: integración página ↔ juego
  const aviso = (win, nombre, dato) => win.dispatchEvent(new win.CustomEvent('museo', { detail: { nombre, dato: dato === undefined ? '' : dato } }));
  const ordenes = (inst, metodo) => inst.enviados.filter((e) => e[0] === 'MuseoPuente' && e[1] === metodo).map((e) => e[2]);

  prueba('integracion_enlace_data_obra_abre_el_museo_y_espera_listo_antes_de_IrAObra', async ({ doc, win }) => {
    const inst = instanciaFalsa();
    win.Idioma.poner('es');
    win.Museo.configurar(dependenciasOk(win, inst));
    doc.querySelector('a[data-obra="seam-amazonas"]').click();
    await esperar(80);
    afirmar(!doc.getElementById('escenario').hidden, 'el enlace debía abrir el museo');
    afirmar(ordenes(inst, 'Saludar').length === 1, 'al tener la instancia debía saludar una vez al juego');
    afirmar(ordenes(inst, 'IrAObra').length === 0, 'no debía mandar IrAObra antes de que el juego diga listo');
    aviso(win, 'listo');
    afirmar(ordenes(inst, 'IrAObra').join() === 'seam-amazonas', 'tras listo debía mandar IrAObra("seam-amazonas") y mandó: ' + ordenes(inst, 'IrAObra').join());
    afirmar(ordenes(inst, 'PonerIdioma').join() === 'es', 'tras listo debía mandar el idioma actual (es)');
    aviso(win, 'listo');
    afirmar(ordenes(inst, 'IrAObra').length === 1, 'un segundo listo no debe repetir IrAObra');
    limpiarMuseo({ win });
  });
  prueba('integracion_abrir_con_obra_desconocida_abre_igual_sin_excepcion', async ({ doc, win }) => {
    const inst = instanciaFalsa();
    win.Museo.configurar(dependenciasOk(win, inst));
    let error = null;
    try { await win.Museo.abrir({ obra: 'no-existe' }); aviso(win, 'listo'); } catch (e) { error = e; }
    const abierto = win.Museo.estado().abierto && !doc.getElementById('escenario').hidden;
    const mando = ordenes(inst, 'IrAObra').join();
    limpiarMuseo({ win });
    afirmar(error === null, 'no debía lanzar: ' + error);
    afirmar(abierto, 'el museo debía abrirse igual con una obra desconocida');
    afirmar(mando === 'no-existe', 'la página manda el id tal cual y el juego lo ignora; mandó: ' + mando);
  });
  prueba('integracion_idioma_de_la_pagina_se_envia_al_juego', async ({ win }) => {
    const inst = instanciaFalsa();
    win.Idioma.poner('es');
    win.Museo.configurar(dependenciasOk(win, inst));
    await win.Museo.abrir();
    win.Idioma.poner('en');
    const enviados = ordenes(inst, 'PonerIdioma').join();
    win.Idioma.poner('es');
    limpiarMuseo({ win });
    afirmar(enviados === 'en', 'al cambiar la página a en debía mandar PonerIdioma("en") y mandó: ' + enviados);
  });
  prueba('integracion_idioma_del_juego_cambia_la_pagina_sin_eco', async ({ doc, win }) => {
    const inst = instanciaFalsa();
    win.Idioma.poner('es');
    win.Museo.configurar(dependenciasOk(win, inst));
    await win.Museo.abrir();
    const antes = ordenes(inst, 'PonerIdioma').length;
    aviso(win, 'idioma', 'en');
    const cambio = win.Idioma.actual() === 'en' && doc.documentElement.lang === 'en';
    const eco = ordenes(inst, 'PonerIdioma').length - antes;
    win.Idioma.poner('es');
    limpiarMuseo({ win });
    afirmar(cambio, 'el aviso idioma=en del juego debía cambiar la página a inglés');
    afirmar(eco === 0, 'la página no debe devolverle al juego el idioma que el juego acaba de avisar (eco: ' + eco + ')');
  });
  prueba('integracion_evento_panel_se_refleja_en_el_estado', async ({ win }) => {
    win.Museo.configurar(dependenciasOk(win));
    await win.Museo.abrir();
    aviso(win, 'panel', '1');
    const abierto = win.Museo.estado().panelAbierto;
    aviso(win, 'panel', '0');
    const cerrado = !win.Museo.estado().panelAbierto;
    limpiarMuseo({ win });
    afirmar(abierto && cerrado, 'el estado panelAbierto debía seguir los avisos panel 1 y 0');
  });
  prueba('integracion_abrir_con_el_museo_ya_abierto_envia_IrAObra_sin_crear_otra_instancia', async ({ win }) => {
    const inst = instanciaFalsa();
    let creadas = 0;
    win.Museo.configurar({ cargarManifest: () => Promise.resolve(MANIFEST), cargarScript: () => Promise.resolve(), crearInstancia: () => { creadas++; return Promise.resolve(inst); } });
    await win.Museo.abrir();
    aviso(win, 'listo');
    await win.Museo.abrir({ obra: 'guardian-ai' });
    const manda = ordenes(inst, 'IrAObra').join();
    limpiarMuseo({ win });
    afirmar(creadas === 1, 'no debía crear otra instancia: ' + creadas);
    afirmar(manda === 'guardian-ai', 'debía mandar IrAObra("guardian-ai") y mandó: ' + manda);
  });

  // las pruebas de las demás tareas se agregan en este mismo archivo
  window.PRUEBAS_REGISTRO = registro;

  async function ejecutar() {
    const marco = document.getElementById('pagina');
    const salida = document.getElementById('salida');
    if (marco.contentDocument.readyState !== 'complete') await new Promise((r) => marco.addEventListener('load', r, { once: true }));
    let bien = 0;
    const lineas = [];
    for (const [nombre, fn] of registro) {
      try {
        await fn({ doc: marco.contentDocument, win: marco.contentWindow, marco });
        bien++; lineas.push('<span class="ok">OK</span>   ' + nombre);
      } catch (e) {
        lineas.push('<span class="mal">FALLA</span> ' + nombre + ' — ' + String(e.message).replace(/</g, '&lt;'));
      }
    }
    salida.innerHTML = lineas.join('\n');
    document.title = 'PRUEBAS ' + bien + '/' + registro.length;
  }
  window.addEventListener('load', ejecutar);
})();
