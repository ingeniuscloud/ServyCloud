/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Opend_Ad_Script.html
ESPEJO GITHUB:   github/js/Opend_Ad_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Intersticial de apertura (estilo App Open Ad de
                 Mercado Libre/Yummy/Cashea, casero). Al cargar la
                 app —sin esperar el catálogo— lee
                 SISTEMA.promo.openAd y si HOY toca (dentro de una
                 ventana vigente), monta la capa sobre la app:
                 creativo 9:16 protagonista, X de cierre INMEDIATA
                 dentro de la imagen y botón "Saber más" DENTRO del
                 creativo que abre el WhatsApp del admin.
                 HORARIO ESTRICTO (R108): sin ventanas, ventanas
                 vacías o ventana sin extremos válidos → NO se
                 muestra (ventanaVigente de Global_Script, reloj
                 del teléfono; "2026-10-24 15:00" → "23:00" con
                 hora en ambos extremos; fecha sola = día
                 completo). La imagen viaja de Drive a lh3 directo
                 y si tarda más de 6s no molesta: la app carga
                 normal. En GitHub Pages SISTEMA llega POR DATOS:
                 espera la sesión y re-intenta UNA sola vez.
VERSIÓN:         1.4.0
CAMBIOS:         R109: GEMELO SINCRONIZADO byte-idéntico al GAS.
                 Entra PROMOJSON.openAd (con respaldo en
                 intersticial) y el HORARIO ESTRICTO R108 que
                 este gemelo nunca recibió (mostraba el ad fuera
                 de las ventanas).
                 R102: CTA con fondo blanco, flechita oscura.
                 R101: botón "Saber más" dentro del creativo.
DEPENDENCIAS:    Index (SISTEMA), Global_Script.js (ventanaVigente,
                 abrirWhatsapp), Seccion_Imagen_Script.js
                 (urlImagenDirecta), Opend_Ad_CSS.css
════════════════════════════════════════════════════════════════════*/
  window.Intersticial = (function () {

    var MAX_ESPERA_IMG = 6000;  /* ms: imagen lenta → no molesta */

    /* ============================================================
       DATOS · SISTEMA.promo.openAd
     R109 · se lee PROMOJSON.openAd con respaldo en intersticial.
       R108 · HORARIO ESTRICTO: la decisión de mostrar exige
       ventana vigente. Sin ventanas declaradas NO se muestra
       (antes: sin ventanas se mostraba siempre que hubiera
       imagen). Sin ventanaVigente disponible NO se muestra.
       ============================================================ */
    function datos() {
      var promo = (window.SISTEMA && window.SISTEMA.promo) || {};
      var it = promo.openAd || promo.intersticial;
      if (!it || typeof it !== 'object') return null;
      if (it.activo === false) return null;

      var imagen = String(it.imagen || '').trim();
      if (!imagen) return null;

      var ventanas = Array.isArray(it.ventanas) ? it.ventanas : [];
      if (!ventanas.length) return null;   /* R108: sin horario no hay ad */

      var enVentana = ventanas.some(function (v) {
        if (!v) return false;
        if (typeof window.ventanaVigente !== 'function') return false;
        return window.ventanaVigente(v.inicia, v.termina) === true;
      });
      if (!enVentana) return null;         /* R108: fuera de horario no hay ad */

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

      /* R101: la X y el CTA viven DENTRO del creativo. El CTA
         lleva su flechita a la derecha (misma geometría del
         glifo "flecha" del CTA del post). R102: trazo OSCURO
         (#1f1b16) — el botón volvió al fondo blanco del plan
         original. El texto va en un span para que quede
         centrado con la flecha anclada a la derecha. */
      capa.innerHTML =
        '<figure class="intersticial-creativo">' +
          '<img class="intersticial-img" alt="" draggable="false">' +
          '<button type="button" class="intersticial-cerrar" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '</svg>' +
          '</button>' +
          ((textoBoton && numero)
            ? '<button type="button" class="intersticial-boton">' +
                '<span class="intersticial-boton-texto"></span>' +
                '<svg class="cta-flecha" viewBox="0 0 24 24" fill="none"' +
                     ' stroke="#1f1b16" stroke-width="2.5"' +
                     ' stroke-linecap="round" stroke-linejoin="round"' +
                     ' aria-hidden="true">' +
                  '<path d="M4 12h15"/>' +
                  '<path d="m13 6 6 6-6 6"/>' +
                '</svg>' +
              '</button>'
            : '') +
        '</figure>';

      capa.querySelector('.intersticial-img').src = urlImagen;

      var btn = capa.querySelector('.intersticial-boton');
      if (btn) {
        capa.querySelector('.intersticial-boton-texto').textContent = textoBoton;
      }

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
