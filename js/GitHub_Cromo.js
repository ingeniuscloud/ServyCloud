/*
════════════════════════════════════════════════════════════════════
ARCHIVO:         GitHub_Cromo.js
ESPEJO GITHUB:   js/GitHub_Cromo.js (SOLO-GitHub: no existe en GAS)
PROYECTO:        ServyCloud | App en GitHub Pages
RESPONSABILIDAD: Cromo de la página estática: preloader orbital
                 (R63: en ESCRITORIO vive DENTRO del marco del
                 teléfono — .lienzo —; en MÓVIL cubre TODA la
                 pantalla y mientras carga viste las franjas del
                 sistema de NARANJA con el theme-color dinámico,
                 al retirarse vuelven a su color de siempre),
                 puente local (mismas claves de storage del
                 envoltorio), sesión→ciudad (wrap de asegurarSesion),
                 píldora "Instalar app" (Android) y registro del
                 service worker. Nació con el envoltorio (R26); el
                 dueño no necesita tocarlo.
VERSIÓN:         1.4
CAMBIOS:         R68: la franja superior VUELVE AL CLARITO al
                 retirarse el preloader: theme-color pasa a
                 #fdf3ec (el clarito del lienzo R67) y NO al
                 #f8fafc casi blanco que traía de R63 — ese
                 remanente pintaba la franja de BLANCO apenas
                 cargaba la app, en Safari y en la PWA (el dueño
                 lo capturó). Durante la carga sigue el naranja
                 claro del preloader (#fb923c). Misma línea
                 reversible del experimento R67.
                 R63: THEME-COLOR DINÁMICO mientras carga: meta
                 theme-color pasa a naranja claro (#fb923c, el del
                 preloader) y al retirarse vuelve a su color de
                 reposo — las franjas superior e inferior del
                 teléfono acompañan cada fase. El preloader se
                 ancla DENTRO de #lienzo en PC; en móvil el
                 overlay es FIXED (css) y cubre todo (index.html
                 porta viewport-fit=cover).
                 R33: el boleto de instalación se comparte en
                 window.__servyBoleto para que el ítem "Instalar la
                 app" del menú (Global_Sheet_Script) pueda abrir el
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

          // R63 · THEME-COLOR dinámico: durante la carga las
          // franjas del sistema (superior/inferior) visten el
          // naranja claro del preloader. R68 · al retirarse ya NO
          // vuelve al #f8fafc casi blanco (remanente de R63 que
          // pintaba la franja de blanco con la app ya cargada):
          // queda el CLARITO #fdf3ec del lienzo (R67) — la franja
          // superior se funde con el degradado en Safari, Chrome
          // y la PWA. Sin meta (imprevisto), no-op.
          (function () {
              try {
                  var meta = document.querySelector('meta[name="theme-color"]');
                  if (!meta) return;
                  meta.setAttribute('content', '#fb923c');
                  document.addEventListener('preloader-retirado', function () {
                      meta.setAttribute('content', '#fdf3ec');
                  });
              } catch (err) {}
          })();

          const preloader = crearPreloader('Servy', 'Cargando catálogo');
          // R62 · DENTRO del marco en PC: el lienzo del teléfono
          // es el ancla (position absolute del overlay); en móvil
          // el overlay es FIXED (css/GitHub_Cromo.css) y cubre la
          // pantalla completa del teléfono. Sin lienzo
          // (imprevisto), body como antes.
          (document.getElementById('lienzo') || document.body).appendChild(preloader);

          function retirarPreloader() {
              if (preloaderRetirado) return;
              preloaderRetirado = true;
              if (timerFallback) { clearTimeout(timerFallback); timerFallback = null; }

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
          // Idéntica a la del envoltorio: solo Android + página
          // instalable + no instalada + preloader retirado + 2ª visita.
          (function () {
              const zonaInstalar = document.getElementById('zona-instalar');
              if (!zonaInstalar) return;

              let eventoInstalacion = null;
              let preloaderCerro = false;
              const esAndroid = /android/i.test(navigator.userAgent);
              let yaInstalada = window.matchMedia('(display-mode: standalone)').matches;

              const visitas = parseInt(localStorage.getItem('ingc_visitas') || '0', 10) + 1;
              try { localStorage.setItem('ingc_visitas', String(visitas)); } catch (_) {}

              const descarte = parseInt(localStorage.getItem('ingc_descarte') || '0', 10);
              const descartadoReciente = descarte && (Date.now() - descarte) < 3 * 24 * 60 * 60 * 1000;

              function decidirSiMostrar() {
                  if (yaInstalada || !esAndroid || !eventoInstalacion || !preloaderCerro) return;
                  if (descartadoReciente || visitas < 2) return;
                  zonaInstalar.hidden = false;
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

              document.getElementById('btn-instalar').addEventListener('click', function () {
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
                  try { localStorage.setItem('ingc_descarte', String(Date.now())); } catch (_) {}
              });

              window.addEventListener('appinstalled', function () {
                  zonaInstalar.hidden = true;
                  yaInstalada = true;
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
