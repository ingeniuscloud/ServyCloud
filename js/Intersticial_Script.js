/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Intersticial_Script.html
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Intersticial de apertura (estilo App Open Ad de
                 Mercado Libre/Yummy/Cashea, casero). Al cargar la
                 app —sin esperar el catálogo— lee
                 SISTEMA.promo.intersticial y si HOY toca, monta la
                 capa sobre la app mientras termina de cargar:
                 creativo 9:16 al ~90% con la app atenuada detrás,
                 X de cierre INMEDIATA y botón "Saber más" que
                 abre el WhatsApp del admin.
                 Reglas del dueño que gobiernan TODO:
                 · activo + imagen + ventana vigente (reloj del
                   teléfono via ventanaVigente de Global_Script:
                   inicia con hora = ventana horaria; termina con
                   fecha sola = todo el día).
                 · Sin imagen válida, sin ventana o imagen rota /
                   lenta (más de 6s) → NO se muestra y la app carga
                   normal (nunca bloquea el boot).
                 · La imagen viaja de Drive a lh3 directo (misma
                   conversión de SeccionImagen): no pasa por la
                   cuota de GAS.
                 · X cierra al instante; "Saber más" abre WhatsApp
                   (admin.whatsapp de ROOTJSON) con mensaje de la
                   BD (intersticial.mensaje → admin.mensajeWhatsapp).
                 · Se muestra en cada arranque mientras la campaña
                   esté en ventana (igual que un App Open Ad).
                 · Página de GitHub Pages: SISTEMA no viaja
                   inyectado, llega POR DATOS (abrirSesion). Si al
                   arrancar aún no está, el módulo espera la sesión
                   y se re-intenta UNA sola vez (misma promesa que
                   ya comparte Core). En la página de GAS SISTEMA
                   ya viaja en el HTML y el reintento no corre.
VERSIÓN:         1.0.0
CAMBIOS:         R98: primera entrega. GA4: intersticial_view al
                 mostrarse e intersticial_click en "Saber más".
DEPENDENCIAS:    Index.html (SISTEMA), Global_Script.html
                 (ventanaVigente, abrirWhatsapp),
                 Seccion_Imagen_Script.html (urlImagenDirecta),
                 Intersticial_CSS.html, Iconos.html no requiere
════════════════════════════════════════════════════════════════════*/

  window.Intersticial = (function () {

    var MAX_ESPERA_IMG = 6000;  /* ms: imagen lenta → no molesta */

    /* ============================================================
       DATOS · SISTEMA.promo.intersticial
       ============================================================ */
    function datos() {
      var promo = (window.SISTEMA && window.SISTEMA.promo) || {};
      var it = promo.intersticial;
      if (!it || typeof it !== 'object') return null;
      if (it.activo === false) return null;

      var imagen = String(it.imagen || '').trim();
      if (!imagen) return null;

      var ventanas = Array.isArray(it.ventanas) ? it.ventanas : [];
      var enVentana = ventanas.some(function (v) {
        if (!v) return false;
        return typeof window.ventanaVigente === 'function'
          ? window.ventanaVigente(v.inicia, v.termina)
          : true;
      });
      if (ventanas.length && !enVentana) return null;

      return it;
    }

    /* ============================================================
       MENSAJE DEL BOTÓN · WhatsApp del admin (campos de la BD)
       ============================================================ */
    function admin() {
      try {
        return ((window.SISTEMA && window.SISTEMA.root) || {}).admin || {};
      } catch (_) { return {}; }
    }

    /* ============================================================
       CONSTRUCCIÓN · la capa se monta ya (no espera catálogo)
       ============================================================ */
    function montar(it, urlImagen) {
      var capa = document.createElement('div');
      capa.className = 'intersticial';
      capa.id = 'intersticial';
      capa.setAttribute('role', 'dialog');
      capa.setAttribute('aria-modal', 'true');
      capa.setAttribute('aria-label', 'Promoción');
      capa.hidden = true;

      var textoBoton = String(it.textoBoton || '').trim();
      var numero     = String(admin().whatsapp || '').trim();
      var mensaje    = String(it.mensaje || '').trim() ||
                       String(admin().mensajeWhatsapp || '').trim();

      capa.innerHTML =
        '<figure class="intersticial-creativo">' +
          '<img class="intersticial-img" alt="" draggable="false">' +
          '<button type="button" class="intersticial-cerrar" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</figure>' +
        ((textoBoton && numero)
          ? '<button type="button" class="intersticial-boton"></button>'
          : '');

      capa.querySelector('.intersticial-img').src = urlImagen;

      var btn = capa.querySelector('.intersticial-boton');
      if (btn) btn.textContent = textoBoton;

      function cerrar() {
        capa.classList.remove('intersticial-visible');
        document.body.classList.remove('intersticial-abierto');
        document.removeEventListener('keydown', alTeclear);
        setTimeout(function () {
          if (capa.parentNode) capa.parentNode.removeChild(capa);
        }, 220);
      }

      function alTeclear(e) {
        if (e && e.key === 'Escape') cerrar();
      }

      capa.querySelector('.intersticial-cerrar')
          .addEventListener('click', cerrar);
      document.addEventListener('keydown', alTeclear);

      if (btn) {
        btn.addEventListener('click', function () {
          if (window.Analitica) {
            window.Analitica.enviar('intersticial_click', {});
          }
          if (typeof window.abrirWhatsapp === 'function') {
            window.abrirWhatsapp(numero, mensaje);
          }
        });
      }

      document.body.appendChild(capa);
      document.body.classList.add('intersticial-abierto');

      /* El fade necesita un frame para que la transición corra */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          capa.hidden = false;
          capa.classList.add('intersticial-visible');
          if (window.Analitica) {
            window.Analitica.enviar('intersticial_view', {});
          }
        });
      });
    }

    /* ============================================================
       ARRANQUE · precarga con guardia: la imagen manda, el boot
       de la app NUNCA espera.
       ============================================================ */
    var esperaSesion = false;   /* reintento único (páginas GitHub) */

    function iniciar() {
      try {
        /* GitHub Pages: SISTEMA llega POR DATOS. Sin SISTEMA.promo
           todavía, se espera la sesión (una sola vez) y se
           re-intenta; sin sesión posible, el intersticial no
           molesta y la app carga normal. */
        if (!(window.SISTEMA && window.SISTEMA.promo)) {
          if (esperaSesion) return;
          esperaSesion = true;
          if (typeof window.asegurarSesion === 'function') {
            window.asegurarSesion().then(
              function () { iniciar(); },
              function () {}
            );
          }
          return;
        }

        var it = datos();
        if (!it) return;

        /* Drive → lh3 directo (misma conversión de la app) */
        var url = String(it.imagen || '').trim();
        if (window.SeccionImagen &&
            typeof window.SeccionImagen.urlImagenDirecta === 'function') {
          url = window.SeccionImagen.urlImagenDirecta(url);
        }
        if (!url) return;

        var lista = new Image();
        var listo = false;

        var guardia = setTimeout(function () {
          if (!listo) { listo = true; }  /* lenta: se descarta */
        }, MAX_ESPERA_IMG);

        lista.onload = function () {
          if (listo) return;
          listo = true;
          clearTimeout(guardia);
          montar(it, url);
        };
        lista.onerror = function () {
          if (listo) return;
          listo = true;
          clearTimeout(guardia);
        };
        lista.src = url;
      } catch (err) {
        /* Cualquier fallo del intersticial NUNCA tumba la app */
        try { console.warn('[Intersticial] ' + (err && err.message)); } catch (_) {}
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', iniciar);
    } else {
      iniciar();
    }

    return { iniciar: iniciar };

  })();