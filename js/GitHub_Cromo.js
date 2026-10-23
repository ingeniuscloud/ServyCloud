/*
════════════════════════════════════════════════════════════════════
ARCHIVO:         GitHub_Cromo.js
ESPEJO GITHUB:   js/GitHub_Cromo.js (SOLO-GitHub: no existe en GAS)
PROYECTO:        ServyCloud | App en GitHub Pages
RESPONSABILIDAD: Cromo de la página estática: preloader orbital,
                 puente local (mismas claves de storage del
                 envoltorio), sesión→ciudad (wrap de asegurarSesion),
                 píldora "Instalar app" (Android) y registro del
                 service worker. Nació con el envoltorio (R26); el
                 dueño no necesita tocarlo.
VERSIÓN:         1.3
CAMBIOS:         R101 (falla del dueño en el teléfono): mientras el
                 preloader vive se pone la clase
                 html.preloader-activo y al retirarse se quita — el
                 CSS pinta con ella el fondo del documento con el
                 mismo degradado naranja y la franja del estado del
                 teléfono deja de verse blanca (detalle en
                 GitHub_Cromo.css). Nada más cambia.
                 R86: MODO MANUAL de instalación: en Androids Go/
                 básicos (Redmi A3x y compañía) Chrome NO dispara
                 beforeinstallprompt (no crea WebAPK) y el menú
                 ni siquiera muestra "Instalar aplicación": la
                 píldora aparece TAMBIÉN sin el boleto, en modo
                 "¿Cómo instalar?", y enseña el camino a mano
                 (⋮ → Añadir a pantalla de inicio) en un panel de
                 3 pasos. Si el boleto llega tarde, la píldora
                 vuelve sola al modo nativo. El index no cambia:
                 el panel lo crea este archivo y lo viste
                 GitHub_Cromo.css.
                 R33: el boleto de instalación se comparte en
                 window.__servyBoleto para que el ítem "Instalar la
                 app" del menú (Global_Menu_Script) pueda abrir el
                 diálogo nativo sin capturarlo de nuevo; la píldora
                 consume con try/catch porque el menú puede canjear
                 el boleto primero.
                 R29: extraído del monolito v4.1 byte a byte.
DEPENDENCIAS:    Global_Script.js (asegurarSesion) · Ciudad_Sheet_
                 Script.js (reinicializar) · css/GitHub_Cromo.css ·
                 sw.js · manifest.json. Debe cargarse ÚLTIMO.
════════════════════════════════════════════════════════════════════
*/
      // ═══════════════════════════════════════════════════════════
      // R26 · CHROME DEL ENVOLTORIO (página estática de GitHub
      // Pages). La app vive en ESTA página; la sesión llega POR
      // DATOS (abrirSesion). Aquí vive lo que antes era la página
      // envoltorio con iframe: preloader orbital, GA4 Capa 1,
      // puente local (mismas claves de storage) y píldora de
      // instalación. Sin iframe, sin escapatorias.
      // ═══════════════════════════════════════════════════════════
      (function () {

          // ═══ 1 · PRELOADER ORBITAL ═══
          // Se retira con la MISMA señal de siempre (app-lista),
          // que Core_Script 1.8 emite ahora también como evento
          // DOM porque no hay padre al que postMessage.
          let preloaderRetirado = false;
          let timerFallback = null;

          function crearPreloader(textoCentralTxt, textoEstado) {
              var wrap = document.createElement('div');
              wrap.className = 'preloader-overlay';
              wrap.innerHTML =
                  '<div class="carga-preloader" role="status" aria-live="polite">' +
                      '<div class="carga-loader">' +
                          '<div class="carga-orbital carga-orbital-1"></div>' +
                          '<div class="carga-orbital carga-orbital-2"></div>' +
                          '<div class="carga-core"><span></span></div>' +
                      '</div>' +
                      '<div class="carga-brand">' +
                          '<span class="carga-brand-in">IN</span>' +
                          '<span class="carga-brand-genius">Genius</span>' +
                          '<span class="carga-brand-cloud">Cloud</span>' +
                      '</div>' +
                      '<div class="carga-status">' +
                          '<span class="carga-status-texto"></span>' +
                          '<span class="carga-puntos"><span></span><span></span><span></span></span>' +
                      '</div>' +
                  '</div>';

              wrap.querySelector('.carga-core span').textContent = textoCentralTxt || 'Servy';
              wrap.querySelector('.carga-status-texto').textContent = textoEstado || 'Cargando';

              return wrap;
          }

          const preloader = crearPreloader('Servy', 'Cargando catálogo');
          document.body.appendChild(preloader);

          /* R101 · FRANJA DEL TELÉFONO: con la clase activa, el
             fondo del DOCUMENTO (lo que iOS pinta detrás de la
             hora/señal) viste el mismo degradado naranja del
             preloader — la punta de la pantalla queda naranja,
             sin la franja blanca. Al retirarse la capa, la clase
             se quita y el degradado crema de la app vuelve solo. */
          document.documentElement.classList.add('preloader-activo');

          function retirarPreloader() {
              if (preloaderRetirado) return;
              preloaderRetirado = true;
              if (timerFallback) { clearTimeout(timerFallback); timerFallback = null; }

              // R101: la lona vuelve al crema de la app; la capa
              // sigue de izquierda en su fade y tapa el cambio.
              document.documentElement.classList.remove('preloader-activo');

              // Aviso para el botón "Instalar app": aquí arranca su
              // cuenta de 2.5 seg antes de evaluarse.
              document.dispatchEvent(new Event('preloader-retirado'));

              preloader.classList.add('saliendo');
              setTimeout(function () {
                  if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
              }, 340);
          }

          document.addEventListener('app-lista', retirarPreloader);

          // Red de seguridad (12 s): si la app no avisó (error de
          // JS interno, por ejemplo), el preloader se retira igual.
          // Las pantallas de error viven por encima de este overlay.
          timerFallback = setTimeout(retirarPreloader, 12000);

          // ═══ 2 · PUENTE LOCAL (R26) ═══
          // La app conserva su módulo Puente intacto; en página
          // estática no hay padre, así que aquí se le conectan los
          // caminos locales. Mismo protocolo y MISMAS claves de
          // storage que el envoltorio iframe (ingc_estado_v1):
          // ciudad, vista y deviceid de cada usuario sobreviven.
          var CLAVE_ESTADO = 'ingc_estado_v1';

          var GA4_EVENTOS_OK = {
              'app_ready': 1, 'city_change': 1, 'chip_change': 1,
              'post_open': 1, 'post_close': 1, 'search': 1,
              'like': 1, 'whatsapp_click': 1,
              'promo_click': 1, 'promo_swipe': 1,
              'reserva_start': 1, 'otp_request': 1
          };
          var GA4_CLAVES_PROHIBIDAS = {
              'user_id': 1, 'client_id': 1, 'session_id': 1,
              'engagement_time_msec': 1, 'firebase_id': 1
          };

          function gaValorSeguro(v) {
              if (typeof v === 'number' && isFinite(v)) return v;
              if (typeof v === 'boolean') return v ? 1 : 0;
              if (typeof v === 'string') return v.slice(0, 64);
              return null;
          }

          function gaReenviar(datos) {
              if (!window.gtag) return;
              var nombre = typeof datos.evento === 'string'
                  ? datos.evento.slice(0, 40) : '';
              if (!GA4_EVENTOS_OK[nombre]) return;

              var params = {};
              var crudos = (datos.params && typeof datos.params === 'object') ? datos.params : {};
              var n = 0;
              for (var k in crudos) {
                  if (!Object.prototype.hasOwnProperty.call(crudos, k)) continue;
                  if (!k || k.length > 40 || GA4_CLAVES_PROHIBIDAS[k]) continue;
                  var v = gaValorSeguro(crudos[k]);
                  if (v !== null && n < 10) { params[k] = v; n++; }
              }
              try { window.gtag('event', nombre, params); } catch (_) {}
          }

          function estadoValido(bruto) {
              if (!bruto || typeof bruto !== 'object') return null;
              var limpio = {};
              if (typeof bruto.ciudad === 'string' && bruto.ciudad.length <= 64 &&
                  !/[<>"'&]/.test(bruto.ciudad)) limpio.ciudad = bruto.ciudad;
              if (typeof bruto.vista === 'string' && bruto.vista.length <= 64 &&
                  !/[<>"'&]/.test(bruto.vista)) limpio.vista = bruto.vista;
              return (limpio.ciudad || limpio.vista) ? limpio : null;
          }

          function leerEstado() {
              try {
                  var raw = localStorage.getItem(CLAVE_ESTADO);
                  if (!raw) return null;
                  return estadoValido(JSON.parse(raw));
              } catch (_) { return null; }
          }

          function guardarEstado() {
              // Réplica del estado-guardar del envoltorio: mismo
              // contenido, misma fusión, misma clave.
              var actualCiudad = null;
              if (window.Ciudad && typeof window.Ciudad.getActual === 'function') {
                  var ca = window.Ciudad.getActual();
                  if (ca && ca.idCiudad) actualCiudad = ca.idCiudad;
              }

              var vista = null;
              if (window.Chips && typeof window.Chips.getChipActivo === 'function') {
                  vista = window.Chips.getChipActivo();
              }

              if (!vista) {
                  try {
                      var v = JSON.parse(localStorage.getItem('app_vista') || 'null');
                      if (v && v.idChip) vista = v.idChip;
                  } catch (_) {}
              }

              var nuevo = estadoValido({ ciudad: actualCiudad, vista: vista });
              if (nuevo) {
                  var fusion = Object.assign({}, leerEstado() || {}, nuevo);
                  try { localStorage.setItem(CLAVE_ESTADO, JSON.stringify(fusion)); } catch (_) {}
              }
          }

          if (window.Puente) {
              window.Puente.hayPuente      = function () { return true; };
              window.Puente.getDispositivo = function () { return window.__ga_device || null; };
              window.Puente.retransmitir   = function (msg) { gaReenviar(msg || {}); };
              window.Puente.guardar        = guardarEstado;
              window.Puente.pedirEstado    = function () {
                  return Promise.resolve(leerEstado());
              };
          }

          // ═══ 3 · SESIÓN → CIUDAD (R26) ═══
          // Los módulos cargan antes de que SISTEMA llegue por
          // datos. En cuanto llega (asegurarSesion), Ciudad
          // reconstruye su lista y restaura la ciudad guardada por
          // el MISMO camino de siempre. En la página de GAS este
          // envoltorio no existe y nada de esto corre.
          (function () {
              var original = window.asegurarSesion;
              if (typeof original !== 'function') return;
              window.asegurarSesion = function () {
                  return original().then(function (data) {
                      try {
                          if (window.Ciudad &&
                              typeof window.Ciudad.reinicializar === 'function') {
                              window.Ciudad.reinicializar();
                          }
                      } catch (_) {}
                      return data;
                  });
              };
          })();

          // ═══ 4 · PÍLDORA "INSTALAR APP" (PWA · SOLO ANDROID) ═══
          // Solo Android + no instalada + preloader retirado + 2ª
          // visita. R86: si Chrome NUNCA manda el boleto
          // (beforeinstallprompt — Androids Go/básicos sin WebAPK),
          // la píldora entra en MODO MANUAL: "¿Cómo instalar?" abre
          // un panel con los 3 pasos del menú de Chrome.
          (function () {
              const zonaInstalar = document.getElementById('zona-instalar');
              if (!zonaInstalar) return;

              const btnPrincipal = document.getElementById('btn-instalar');
              const btnTexto = btnPrincipal ? btnPrincipal.querySelector('span') : null;

              let eventoInstalacion = null;
              let preloaderCerro = false;
              let modoManual = false;
              let graciaManual = null;
              const esAndroid = /android/i.test(navigator.userAgent);
              let yaInstalada = window.matchMedia('(display-mode: standalone)').matches;

              const visitas = parseInt(localStorage.getItem('ingc_visitas') || '0', 10) + 1;
              try { localStorage.setItem('ingc_visitas', String(visitas)); } catch (_) {}

              const descarte = parseInt(localStorage.getItem('ingc_descarte') || '0', 10);
              const descartadoReciente = descarte && (Date.now() - descarte) < 3 * 24 * 60 * 60 * 1000;

              const TXT_NATIVO = 'Instalar app';
              const TXT_MANUAL = '¿Cómo instalar?';

              /* R86: panel de pasos del modo manual (nace aquí; el
                 index queda intacto) */
              let panel = null;
              function panelPasos() {
                  if (panel) return panel;
                  panel = document.createElement('div');
                  panel.id = 'zona-instalar-pasos';
                  panel.hidden = true;
                  panel.setAttribute('role', 'dialog');
                  panel.setAttribute('aria-label', 'Cómo instalar la aplicación');
                  panel.innerHTML =
                      '<p class="zona-pasos-titulo">Instala la app en 3 pasos</p>' +
                      '<ol class="zona-pasos-lista">' +
                          '<li>Abre el menú de Chrome (⋮ arriba a la derecha).</li>' +
                          '<li>Toca <b>Añadir a pantalla de inicio</b>.</li>' +
                          '<li>Confirma con <b>Añadir</b> o <b>Instalar</b>.</li>' +
                      '</ol>';
                  document.body.appendChild(panel);
                  return panel;
              }
              function mostrarPanel(mostrar) {
                  panelPasos().hidden = !mostrar;
                  if (btnPrincipal) btnPrincipal.setAttribute('aria-expanded', String(mostrar));
              }

              function activarModoManual() {
                  if (modoManual || yaInstalada || eventoInstalacion) return;
                  modoManual = true;
                  if (btnTexto) btnTexto.textContent = TXT_MANUAL;
                  zonaInstalar.hidden = false;
              }
              function desactivarModoManual() {
                  if (!modoManual) return;
                  modoManual = false;
                  mostrarPanel(false);
                  if (btnTexto) btnTexto.textContent = TXT_NATIVO;
              }

              function decidirSiMostrar() {
                  if (yaInstalada || !esAndroid || !preloaderCerro) return;
                  if (descartadoReciente || visitas < 2) return;
                  if (eventoInstalacion) {
                      desactivarModoManual();
                      zonaInstalar.hidden = false;
                      return;
                  }
                  /* R86: sin boleto no hay diálogo nativo; tras una
                     espera de gracia (por si el service worker tarda
                     en habilitar la instalación) entra el manual. */
                  if (modoManual) { zonaInstalar.hidden = false; return; }
                  if (graciaManual) return;
                  graciaManual = setTimeout(function () {
                      graciaManual = null;
                      if (!eventoInstalacion && !yaInstalada) activarModoManual();
                  }, 4000);
              }

              window.addEventListener('beforeinstallprompt', function (e) {
                  e.preventDefault();
                  eventoInstalacion = e;
                  window.__servyBoleto = e;   // R33: compartido con el menú
                  decidirSiMostrar();
              });

              document.addEventListener('preloader-retirado', function () {
                  preloaderCerro = true;
                  setTimeout(decidirSiMostrar, 2500);
              });

              btnPrincipal.addEventListener('click', function () {
                  /* R86: modo manual — el panel de pasos manda */
                  if (modoManual) { mostrarPanel(panel === null || panel.hidden); return; }
                  if (!eventoInstalacion) return;
                  zonaInstalar.hidden = true;
                  window.__servyBoleto = null;   // R33: consumido
                  try {
                      eventoInstalacion.prompt();
                      eventoInstalacion.userChoice.then(function () { eventoInstalacion = null; });
                  } catch (err) {
                      eventoInstalacion = null;  // R33: boleto ya canjeado por el menú
                  }
              });

              document.getElementById('btn-instalar-cerrar').addEventListener('click', function () {
                  zonaInstalar.hidden = true;
                  mostrarPanel(false);
                  try { localStorage.setItem('ingc_descarte', String(Date.now())); } catch (_) {}
              });

              window.addEventListener('appinstalled', function () {
                  zonaInstalar.hidden = true;
                  yaInstalada = true;
                  desactivarModoManual();
                  window.__servyBoleto = null;   // R33: ya no hay nada que canjear
              });

              // Service worker de paso puro (instalabilidad; sin caché).
              if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function () {
                      navigator.serviceWorker.register('./sw.js').catch(function () {});
                  });
              }
          })();

      })();
