/* Líquido interactivo para la portada: simulación de fluido en la GPU (Navier-Stokes "estable": advección, vorticidad,
   divergencia, presión por Jacobi y resta del gradiente) con WebGL2. El ratón agita el fluido y deja tinta en oro y azul.
   API: Liquido.disponible(entorno?), Liquido.iniciar(canvas, opciones?) → { salpicar, paso, tinta, parar, activo } o null. */
(function () {
  const COLOR_ORO = [1.0, 0.79, 0.35];
  const COLOR_AZUL = [0.55, 0.76, 1.0];
  const AJUSTES = {
    resSimulacion: 128, resTinta: 512, escalaLienzo: 0.5,
    disipacionVelocidad: 0.35, disipacionTinta: 1.15, presion: 0.8, iteracionesPresion: 20, vorticidad: 24,
    radio: 0.0032, fuerza: 5200, intensidad: 0.2
  };

  function entornoReal() {
    return { matchMedia: (q) => window.matchMedia(q), crearCanvas: () => document.createElement('canvas') };
  }

  /** Necesita WebGL2 con texturas de coma flotante renderizables y que el visitante no haya pedido menos movimiento. */
  function disponible(entorno) {
    const e = entorno || entornoReal();
    try {
      if (e.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      const gl = e.crearCanvas().getContext('webgl2');
      return !!(gl && gl.getExtension('EXT_color_buffer_float'));
    } catch (err) {
      return false;
    }
  }

  // ---------------------------------------------------------------- shaders
  const VERT = `#version 300 es
precision highp float;
in vec2 aPosicion;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texel;
void main() {
  vUv = aPosicion * 0.5 + 0.5;
  vL = vUv - vec2(texel.x, 0.0); vR = vUv + vec2(texel.x, 0.0);
  vT = vUv + vec2(0.0, texel.y); vB = vUv - vec2(0.0, texel.y);
  gl_Position = vec4(aPosicion, 0.0, 1.0);
}`;
  const CAB = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nin vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;\nout vec4 salida;\n';
  const FRAG = {
    salpicar: CAB + `uniform sampler2D uObjetivo; uniform float aspecto; uniform vec3 color; uniform vec2 punto; uniform float radio;
void main() {
  vec2 p = vUv - punto; p.x *= aspecto;
  vec3 s = exp(-dot(p, p) / radio) * color;
  salida = vec4(texture(uObjetivo, vUv).xyz + s, 1.0);
}`,
    adveccion: CAB + `uniform sampler2D uVelocidad; uniform sampler2D uFuente; uniform vec2 texel; uniform float dt; uniform float disipacion;
void main() {
  vec2 coord = vUv - dt * texture(uVelocidad, vUv).xy * texel;
  salida = texture(uFuente, coord) / (1.0 + disipacion * dt);
}`,
    divergencia: CAB + `uniform sampler2D uVelocidad;
void main() {
  float L = texture(uVelocidad, vL).x; float R = texture(uVelocidad, vR).x;
  float T = texture(uVelocidad, vT).y; float B = texture(uVelocidad, vB).y;
  vec2 C = texture(uVelocidad, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  salida = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
    rotacional: CAB + `uniform sampler2D uVelocidad;
void main() {
  float L = texture(uVelocidad, vL).y; float R = texture(uVelocidad, vR).y;
  float T = texture(uVelocidad, vT).x; float B = texture(uVelocidad, vB).x;
  salida = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
    vorticidad: CAB + `uniform sampler2D uVelocidad; uniform sampler2D uRotacional; uniform float curva; uniform float dt;
void main() {
  float L = texture(uRotacional, vL).x; float R = texture(uRotacional, vR).x;
  float T = texture(uRotacional, vT).x; float B = texture(uRotacional, vB).x;
  float C = texture(uRotacional, vUv).x;
  vec2 fuerza = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  fuerza /= length(fuerza) + 0.0001; fuerza *= curva * C; fuerza.y *= -1.0;
  vec2 v = texture(uVelocidad, vUv).xy + fuerza * dt;
  salida = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
    presion: CAB + `uniform sampler2D uPresion; uniform sampler2D uDivergencia;
void main() {
  float L = texture(uPresion, vL).x; float R = texture(uPresion, vR).x;
  float T = texture(uPresion, vT).x; float B = texture(uPresion, vB).x;
  float d = texture(uDivergencia, vUv).x;
  salida = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}`,
    gradiente: CAB + `uniform sampler2D uPresion; uniform sampler2D uVelocidad;
void main() {
  float L = texture(uPresion, vL).x; float R = texture(uPresion, vR).x;
  float T = texture(uPresion, vT).x; float B = texture(uPresion, vB).x;
  vec2 v = texture(uVelocidad, vUv).xy - vec2(R - L, T - B);
  salida = vec4(v, 0.0, 1.0);
}`,
    limpiar: CAB + `uniform sampler2D uTextura; uniform float valor;
void main() { salida = valor * texture(uTextura, vUv); }`,
    mostrar: CAB + `uniform sampler2D uTextura;
void main() {
  vec3 c = texture(uTextura, vUv).rgb;
  c = 1.0 - exp(-c * 1.7);                       // curva suave: la tinta nunca se quema
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0) * 0.92;
  salida = vec4(c * 0.92, a);                    // alfa premultiplicado: el degradado de la portada se ve debajo
}`
  };

  // ---------------------------------------------------------------- GL auxiliar
  function compilar(gl, tipo, fuente) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fuente); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function programa(gl, fuenteFrag) {
    const p = gl.createProgram();
    gl.attachShader(p, compilar(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compilar(gl, gl.FRAGMENT_SHADER, fuenteFrag));
    gl.bindAttribLocation(p, 0, 'aPosicion');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nombre = gl.getActiveUniform(p, i).name; u[nombre] = gl.getUniformLocation(p, nombre); }
    return { p, u };
  }
  const MIN_LADO = 16;       // por debajo de esto el lienzo aún no tiene un tamaño útil (pestaña en segundo plano, ventana recién abierta)
  const MAX_PROPORCION = 4;  // las texturas no se estiran más que esto: con un lienzo largo y angosto superarían el máximo de WebGL
  function resolucion(base, aspecto) {
    const a = Math.min(MAX_PROPORCION, Math.max(1 / MAX_PROPORCION, aspecto));
    const menor = Math.round(base), mayor = Math.round(base * (a < 1 ? 1 / a : a));
    return a > 1 ? { w: mayor, h: menor } : { w: menor, h: mayor };
  }

  function iniciar(lienzo, opciones) {
    const op = opciones || {};
    if (!disponible(op.entorno)) return null;
    let gl;
    try {
      gl = lienzo.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
      return crear(gl, lienzo, op);
    } catch (err) {
      return null;
    }
  }

  function crear(gl, lienzo, op) {
    const contenedor = op.contenedor || lienzo.parentElement || lienzo;
    const ambiente = op.ambiente !== false;
    const P = {};
    Object.keys(FRAG).forEach((k) => { P[k] = programa(gl, FRAG[k]); });

    // un cuadrado que cubre todo el recorte
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
    gl.disable(gl.BLEND);

    function crearFBO(w, h, interno, formato, filtro) {
      const textura = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, textura);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, interno, w, h, 0, formato, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textura, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incompleto');
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return { textura, fbo, w, h, texel: [1 / w, 1 / h] };
    }
    function doble(w, h, interno, formato, filtro) {
      let a = crearFBO(w, h, interno, formato, filtro), b = crearFBO(w, h, interno, formato, filtro);
      return { get leer() { return a; }, get escribir() { return b; }, cambiar() { const t = a; a = b; b = t; }, w, h, texel: [1 / w, 1 / h] };
    }

    let aspecto = 1, sim, tinta, velocidad, presion, divergencia, rotacional, listo = false;
    /** Crea las texturas para el tamaño actual del lienzo. Con un lienzo sin tamaño útil no hace nada (queda `listo` en false) y lo reintenta el observador de tamaño. */
    function construir() {
      const ancho = lienzo.clientWidth, alto = lienzo.clientHeight;
      if (ancho < MIN_LADO || alto < MIN_LADO) { listo = false; return false; }
      const w = Math.max(2, Math.round(ancho * AJUSTES.escalaLienzo)), h = Math.max(2, Math.round(alto * AJUSTES.escalaLienzo));
      lienzo.width = w; lienzo.height = h;
      aspecto = w / h;
      sim = resolucion(AJUSTES.resSimulacion, aspecto); tinta = resolucion(AJUSTES.resTinta, aspecto);
      velocidad = doble(sim.w, sim.h, gl.RG16F, gl.RG, gl.LINEAR);
      presion = doble(sim.w, sim.h, gl.R16F, gl.RED, gl.NEAREST);
      divergencia = crearFBO(sim.w, sim.h, gl.R16F, gl.RED, gl.NEAREST);
      rotacional = crearFBO(sim.w, sim.h, gl.R16F, gl.RED, gl.NEAREST);
      tintaFBO = doble(tinta.w, tinta.h, gl.RGBA16F, gl.RGBA, gl.LINEAR);
      listo = true;
      return true;
    }
    let tintaFBO;
    construir();

    function usar(prog, texturas) {
      gl.useProgram(prog.p);
      return prog;
    }
    function ligar(unidad, tex) { gl.activeTexture(gl.TEXTURE0 + unidad); gl.bindTexture(gl.TEXTURE_2D, tex); return unidad; }
    function dibujar(destino) {
      if (destino) { gl.bindFramebuffer(gl.FRAMEBUFFER, destino.fbo); gl.viewport(0, 0, destino.w, destino.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, lienzo.width, lienzo.height); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function salpicar(x, y, dx, dy, color) {
      if (!listo) return;
      let pr = usar(P.salpicar);
      gl.uniform1f(pr.u.aspecto, aspecto); gl.uniform2f(pr.u.punto, x, y); gl.uniform1f(pr.u.radio, AJUSTES.radio * (aspecto > 1 ? aspecto : 1));
      gl.uniform2fv(pr.u.texel, velocidad.texel);
      gl.uniform1i(pr.u.uObjetivo, ligar(0, velocidad.leer.textura)); gl.uniform3f(pr.u.color, dx, dy, 0);
      dibujar(velocidad.escribir); velocidad.cambiar();
      gl.uniform2fv(pr.u.texel, tintaFBO.texel);
      gl.uniform1i(pr.u.uObjetivo, ligar(0, tintaFBO.leer.textura)); gl.uniform3f(pr.u.color, color[0], color[1], color[2]);
      dibujar(tintaFBO.escribir); tintaFBO.cambiar();
    }

    function paso(dt) {
      if (!listo) return;
      let pr = usar(P.rotacional);
      gl.uniform2fv(pr.u.texel, velocidad.texel); gl.uniform1i(pr.u.uVelocidad, ligar(0, velocidad.leer.textura)); dibujar(rotacional);

      pr = usar(P.vorticidad);
      gl.uniform2fv(pr.u.texel, velocidad.texel); gl.uniform1i(pr.u.uVelocidad, ligar(0, velocidad.leer.textura));
      gl.uniform1i(pr.u.uRotacional, ligar(1, rotacional.textura)); gl.uniform1f(pr.u.curva, AJUSTES.vorticidad); gl.uniform1f(pr.u.dt, dt);
      dibujar(velocidad.escribir); velocidad.cambiar();

      pr = usar(P.divergencia);
      gl.uniform2fv(pr.u.texel, velocidad.texel); gl.uniform1i(pr.u.uVelocidad, ligar(0, velocidad.leer.textura)); dibujar(divergencia);

      pr = usar(P.limpiar);
      gl.uniform1i(pr.u.uTextura, ligar(0, presion.leer.textura)); gl.uniform1f(pr.u.valor, AJUSTES.presion);
      dibujar(presion.escribir); presion.cambiar();

      pr = usar(P.presion);
      gl.uniform2fv(pr.u.texel, velocidad.texel); gl.uniform1i(pr.u.uDivergencia, ligar(0, divergencia.textura));
      for (let i = 0; i < AJUSTES.iteracionesPresion; i++) {
        gl.uniform1i(pr.u.uPresion, ligar(1, presion.leer.textura)); dibujar(presion.escribir); presion.cambiar();
      }

      pr = usar(P.gradiente);
      gl.uniform2fv(pr.u.texel, velocidad.texel); gl.uniform1i(pr.u.uPresion, ligar(0, presion.leer.textura));
      gl.uniform1i(pr.u.uVelocidad, ligar(1, velocidad.leer.textura)); dibujar(velocidad.escribir); velocidad.cambiar();

      pr = usar(P.adveccion);
      gl.uniform2fv(pr.u.texel, velocidad.texel); gl.uniform1f(pr.u.dt, dt);
      gl.uniform1i(pr.u.uVelocidad, ligar(0, velocidad.leer.textura)); gl.uniform1i(pr.u.uFuente, ligar(1, velocidad.leer.textura));
      gl.uniform1f(pr.u.disipacion, AJUSTES.disipacionVelocidad); dibujar(velocidad.escribir); velocidad.cambiar();
      gl.uniform1i(pr.u.uVelocidad, ligar(0, velocidad.leer.textura)); gl.uniform1i(pr.u.uFuente, ligar(1, tintaFBO.leer.textura));
      gl.uniform1f(pr.u.disipacion, AJUSTES.disipacionTinta); dibujar(tintaFBO.escribir); tintaFBO.cambiar();
    }

    function pintar() {
      if (!listo) return;
      const pr = usar(P.mostrar);
      gl.uniform2fv(pr.u.texel, tintaFBO.texel); gl.uniform1i(pr.u.uTextura, ligar(0, tintaFBO.leer.textura));
      gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, lienzo.width, lienzo.height); gl.clear(gl.COLOR_BUFFER_BIT);
      dibujar(null);
    }

    /** Promedio del canal más fuerte de la tinta en toda la textura (para pruebas y para saber si queda algo que animar). */
    function medirTinta() {
      if (!listo) return 0;
      const n = tintaFBO.leer.w * tintaFBO.leer.h * 4;
      const datos = new Float32Array(n);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tintaFBO.leer.fbo);
      gl.readPixels(0, 0, tintaFBO.leer.w, tintaFBO.leer.h, gl.RGBA, gl.FLOAT, datos);
      let suma = 0;
      for (let i = 0; i < n; i += 4) suma += Math.max(datos[i], datos[i + 1], datos[i + 2]);
      return suma / (n / 4);
    }

    // ------------------------------------------------------------ puntero, ambiente y ciclo
    let anterior = null, ultimoColor = 0, activo = true, visible = true, cuadro = 0, previoMs = 0, proximaAmbiental = 0, rastreo = true;
    const mezcla = (t) => [0, 1, 2].map((i) => COLOR_ORO[i] * (1 - t) + COLOR_AZUL[i] * t);

    function alMover(e) {
      if (!activo || (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
      const r = lienzo.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      if (anterior) {
        let dx = x - anterior.x, dy = y - anterior.y;
        if (aspecto < 1) dx *= aspecto; if (aspecto > 1) dy /= aspecto;
        const rapidez = Math.min(1, Math.hypot(dx, dy) * 40);
        if (rapidez > 0.002) {
          ultimoColor = 0.5 + 0.5 * Math.sin(performance.now() / 1800);
          const c = mezcla(ultimoColor).map((v) => v * AJUSTES.intensidad * (0.35 + 0.65 * rapidez));
          salpicar(x, y, dx * AJUSTES.fuerza, dy * AJUSTES.fuerza, c);
        }
      }
      anterior = { x, y };
    }
    function alSalir() { anterior = null; }
    contenedor.addEventListener('pointermove', alMover);
    contenedor.addEventListener('pointerleave', alSalir);

    function ciclo(ahora) {
      if (!activo) return;
      cuadro = 0;
      if (visible && !document.hidden && !pausado) {
        const dt = Math.min((ahora - (previoMs || ahora)) / 1000, 0.033) || 1 / 60;
        if (ambiente && ahora > proximaAmbiental) {
          const t = Math.random();
          salpicar(0.15 + Math.random() * 0.7, 0.2 + Math.random() * 0.6, (Math.random() - 0.5) * 900, (Math.random() - 0.5) * 900, mezcla(t).map((v) => v * AJUSTES.intensidad * 0.8));
          proximaAmbiental = ahora + 3500 + Math.random() * 4500;
        }
        paso(dt); pintar();
      }
      previoMs = ahora;
      cuadro = requestAnimationFrame(ciclo);
    }

    let observador = null;
    if ('IntersectionObserver' in window) {
      observador = new IntersectionObserver((entradas) => { visible = entradas[entradas.length - 1].isIntersecting; if (visible) previoMs = 0; });
      observador.observe(lienzo);
    }
    let reajuste = null;
    if ('ResizeObserver' in window) {
      let ultimoAncho = lienzo.clientWidth, ultimoAlto = lienzo.clientHeight;
      reajuste = new ResizeObserver(() => {
        const cambio = Math.abs(lienzo.clientWidth - ultimoAncho) > 40 || Math.abs(lienzo.clientHeight - ultimoAlto) > 40;
        if (!listo || cambio) {
          ultimoAncho = lienzo.clientWidth; ultimoAlto = lienzo.clientHeight; construir();
        }
      });
      reajuste.observe(lienzo);
    }
    if (op.manual !== true) cuadro = requestAnimationFrame(ciclo);

    function parar() {
      if (!activo) return;
      activo = false;
      cancelAnimationFrame(cuadro);
      contenedor.removeEventListener('pointermove', alMover);
      contenedor.removeEventListener('pointerleave', alSalir);
      if (observador) observador.disconnect();
      if (reajuste) reajuste.disconnect();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }

    let pausado = false;
    function pausar(valor) { pausado = !!valor; if (!pausado) previoMs = 0; }

    return { salpicar, paso, tinta: medirTinta, parar, activo: () => activo, pausar, pausado: () => pausado };
  }

  window.Liquido = { disponible, iniciar };

  function arrancar() {
    const lienzo = document.getElementById('liquido');
    const portada = document.querySelector('.hero');
    if (lienzo && portada) window.Liquido.controlador = iniciar(lienzo, { contenedor: portada });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
