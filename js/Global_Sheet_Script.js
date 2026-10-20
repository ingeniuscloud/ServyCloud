/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Global_Sheet_Script.html
ESPEJO GITHUB:   github/js/Global_Sheet_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Global: menú bottom sheet con
                 jerarquía (marca de la app protagonista arriba,
                 crédito de INGeniusCloud abajo) y subvistas
                 "Acerca de", "Términos y condiciones", "Privacidad"
                 y "Cookies" interpolando datos de ROOTJSON, más la
                 ayuda de instalación (R63: guía con pestañas
                 ANDROID / IPHONE y TIMELINE animado de pasos — las
                 2 versiones juntas, vistiendo el color oficial;
                 R64: SIEMPRE muestra su contenido — si la app ya
                 está instalada, el aviso vive DENTRO de la
                 pantalla como banner; Android no instalada lleva
                 botón manual de instalación) y el drag de cierre.
VERSIÓN:         1.5
CAMBIOS:         R68: RENOMBRADO por orden del dueño: Global_Menu_
                 Script pasa a Global_Sheet_Script — ya están
                 identificados Resrva_Sheet_, Orden_Sheet_,
                 Ciudad_Sheet_ y Global_Sheet_ (los 4 sheets con
                 la misma raíz de nombre). Ni una línea de lógica
                 tocada; el módulo window.Global y la base .sheet
                 (altura 90%, igual que Reserva) siguen intactos.
                 R64: tocar "Instalar la app" SIEMPRE abre la
                 ayuda (fuera el aviso-instantáneo que tapaba el
                 contenido): si la app ya está instalada el aviso
                 es un BANNER interno (.pwa-instalada-aviso) y la
                 guía sigue visible; el botón manual
                 (.pwa-instalar) sale SIEMPRE en Android (con
                 boleto lanza el diálogo nativo; sin boleto lo
                 pide al envoltorio o avisa el camino manual —
                 pedirBoletoAlPadre ya no navega: avisa)
                 instalarPwa() se volvió intentarInstalar()
                 (handler del botón).
                 R63: la subvista PWA se reconstruye — pestañas
                 Android/iPhone (glifos android/apple de Iconos)
                 con la del dispositivo activa por defecto,
                 TIMELINE de pasos (puntos numerados + línea
                 vertical, entrada escalonada — "los puntos tienen
                 vida") todo en el NARANJA oficial, nota por
                 versión. La guía ya no depende de la plataforma
                 del usuario: muestra AMBAS versiones y el dueño
                 las ve de una vez. Compatibilidad: si la BD solo
                 trae una plataforma, sale una sola pestaña; si no
                 trae pwa, "Próximamente" como siempre.
                 R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Global_Script.html (limpiarTelefono), Index.html
                 (SISTEMA), Iconos.html (window.pintarGlifos),
                 Global_CSS.html (base del sheet)
════════════════════════════════════════════════════════════════════*/

  /* ============================================================
     MÓDULO GLOBAL · Menú (bottom sheet)
     ============================================================ */
  window.Global = (function () {

    var UMBRAL_VELOCIDAD = 0.5;
    var UMBRAL_DRAG      = 6;

    var base   = 'menu';
    var abierto = false;

    var raiz       = null;
    var backdrop   = null;
    var sheet      = null;
    var handleArea = null;
    var content    = null;
    var btnClose   = null;
    var btnBack    = null;
    var titulo     = null;

    var dragActivo = false;
    var dragMoved = false;
    var dragPointerId = null;
    var dragStartY = 0;
    var dragUltimoY = 0;
    var dragUltimoT = 0;
    var dragVelocidad = 0;
    var dragDesdeHandle = false;

    /* ============================================================
       PWA · botón manual de instalación (R64)
       El boleto de instalación (beforeinstallprompt) lo captura
       GitHub_Cromo.js en la página estática y lo deja compartido
       en window.__servyBoleto. Aquí NO se captura de nuevo: se
       consume el compartido. Dentro del envoltorio (iframe) el
       boleto vive en la página de arriba y se pide por el puente
       pwa-instalar / pwa-respuesta. El aviso "ya instalada"
       dentro de la guía es un banner (Global_CSS) y los avisos
       volátiles usan el toast con estilos inline.
       ============================================================ */
    var avisoPwaTimer = null;

    /* R63 · pestaña activa de la ayuda de instalación
       ('android' | 'ios'). Arranca en la plataforma del
       dispositivo; las pestañas la cambian. */
    var pwaTab = null;

    function _renderMarcaApp(marca) {
      var s = String(marca || '');
      var idx = s.lastIndexOf('Cloud');
      if (idx > 0) {
        return '<span class="marca-prefijo">' + s.substring(0, idx) + '</span>' +
               '<span class="marca-cloud">' + s.substring(idx) + '</span>';
      }
      return s;
    }

    function _renderMarcaMain(marca) {
      var s = String(marca || '').trim();
      if (!s) return '';

      var idxGenius = s.indexOf('Genius');
      var idxCloud  = s.lastIndexOf('Cloud');

      if (idxGenius > 0 && idxCloud > idxGenius) {
        return '<span class="in">'     + s.substring(0, idxGenius)         + '</span>' +
               '<span class="genius">' + s.substring(idxGenius, idxCloud)  + '</span>' +
               '<span class="cloud">'  + s.substring(idxCloud)             + '</span>';
      }

      return s;
    }

    function _whatsappHrefAsesor() {
      var root  = (window.SISTEMA && window.SISTEMA.root)  || {};
      var admin = root.admin || {};
      var numero  = limpiarTelefono(admin.whatsapp);
      if (!numero) return '#';
      var mensaje = admin.mensajeWhatsapp || '';
      return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensaje);
    }

    function getMenuHTML() {
      var pwaTitulo = (window.SISTEMA && window.SISTEMA.pwa && window.SISTEMA.pwa.titulo) || 'Instalar la app';

      return '' +
        '<h2 class="sheet-titulo">Menú</h2>' +
        '<div class="sheet-menu-lista">' +

          '<a class="sheet-menu-item" data-accion="asesor" ' +
             'href="' + _whatsappHrefAsesor() + '" target="_top" rel="noopener">' +
            '<span class="sheet-menu-icon"><span data-glifo="userPlus"></span></span>' +
            '<span class="sheet-menu-texto">' +
              '<span class="sheet-menu-titulo">Ofrece tus servicios aquí</span>' +
              '<span class="sheet-menu-sub">Cursos, oficios, asesorías y más</span>' +
            '</span>' +
            '<span class="sheet-menu-chevron">›</span>' +
          '</a>' +

          '<div class="sheet-menu-sep"></div>' +

          '<button class="sheet-menu-item" data-accion="terminos">' +
            '<span class="sheet-menu-icon"><span data-glifo="book"></span></span>' +
            '<span class="sheet-menu-texto">Términos y condiciones</span>' +
            '<span class="sheet-menu-chevron">›</span>' +
          '</button>' +

          '<button class="sheet-menu-item" data-accion="privacidad">' +
            '<span class="sheet-menu-icon"><span data-glifo="candado"></span></span>' +
            '<span class="sheet-menu-texto">Política de privacidad</span>' +
            '<span class="sheet-menu-chevron">›</span>' +
          '</button>' +

          '<button class="sheet-menu-item" data-accion="cookies">' +
            '<span class="sheet-menu-icon"><span data-glifo="cookie"></span></span>' +
            '<span class="sheet-menu-texto">Política de cookies</span>' +
            '<span class="sheet-menu-chevron">›</span>' +
          '</button>' +

          '<button class="sheet-menu-item" data-accion="pwa">' +
            '<span class="sheet-menu-icon"><span data-glifo="download"></span></span>' +
            '<span class="sheet-menu-texto">' + pwaTitulo + '</span>' +
            '<span class="sheet-menu-chevron">›</span>' +
          '</button>' +

          '<button class="sheet-menu-item" data-accion="acerca">' +
            '<span class="sheet-menu-icon"><span data-glifo="info"></span></span>' +
            '<span class="sheet-menu-texto">Acerca de</span>' +
            '<span class="sheet-menu-chevron">›</span>' +
          '</button>' +

        '</div>';
    }

    function getAcercaHTML() {
      var root = (window.SISTEMA && window.SISTEMA.root) || {};
      var main = root.main || {};
      var app  = root.app  || {};

      var anioActual = new Date().getFullYear();

      var marcaApp    = app.marca    || '';
      var esloganApp  = app.eslogan  || '';
      var versionApp  = app.version  || '';
      var marcaMain   = main.marca   || '';
      var esloganMain = main.eslogan || '';

      return '' +
        '<div class="sheet-acerca">' +

          '<div class="sheet-acerca-app">' +
            (marcaApp
              ? '<h3 class="sheet-acerca-app-nombre">' + _renderMarcaApp(marcaApp) + '</h3>'
              : '') +
            (esloganApp
              ? '<p class="sheet-acerca-app-eslogan">' + esloganApp + '</p>'
              : '') +
            (versionApp
              ? '<span class="sheet-acerca-app-version">Versión ' + versionApp + ' · Web App</span>'
              : '') +
          '</div>' +

          '<div class="sheet-acerca-divisor"></div>' +

          '<div class="sheet-acerca-empresa">' +
            '<p class="sheet-acerca-credito">una creación de</p>' +
            (marcaMain
              ? '<div class="carga-brand">' + _renderMarcaMain(marcaMain) + '</div>'
              : '') +
            (esloganMain
              ? '<p class="sheet-acerca-empresa-eslogan">' + esloganMain + '</p>'
              : '') +
          '</div>' +

          '<p class="sheet-acerca-footer">' +
            '© ' + anioActual + ' · Todos los derechos reservados' +
          '</p>' +

        '</div>';
    }

    /* ============================================================
       getLegalHTML · interpolación de placeholders
       ============================================================ */
    function getLegalHTML(clave) {
      var contenido = window.SISTEMA &&
                      window.SISTEMA.contenidoLegal &&
                      window.SISTEMA.contenidoLegal[clave];

      if (!contenido) {
        return '<h2 class="sheet-titulo">Próximamente</h2>';
      }

      var root  = (window.SISTEMA && window.SISTEMA.root) || {};
      var app   = root.app   || {};
      var main  = root.main  || {};
      var admin = root.admin || {};

      var datos = {
        marcaApp:     String(app.marca   || 'la Aplicación').trim(),
        marcaEmpresa: String(main.marca  || '').trim() || String(app.marca || 'la aplicación').trim(),
        correo:       String(app.correo    || '').trim() || '—',
        whatsapp:     String(admin.whatsapp || '').trim() || '—'
      };

      function interpolar(texto) {
        if (texto == null) return '';
        return String(texto)
          .replace(/\{marcaApp\}/g,     datos.marcaApp)
          .replace(/\{marcaEmpresa\}/g, datos.marcaEmpresa)
          .replace(/\{correo\}/g,       datos.correo)
          .replace(/\{whatsapp\}/g,     datos.whatsapp);
      }

      var html = '<div class="sheet-privacidad">';

      html += '<div class="sheet-titulo-con-icono">';
      if (contenido.icono) {
        html += '<span class="icono"><span data-glifo="' + contenido.icono + '"></span></span>';
      }
      html += '<span>' + interpolar(contenido.titulo) + '</span>';
      html += '</div>';

      if (contenido.ultimaActualizacion) {
        html += '<p class="fecha">Última actualización · ' +
                interpolar(contenido.ultimaActualizacion) + '</p>';
      }

      var secciones = contenido.secciones || [];
      secciones.forEach(function (s) {
        html += '<h3>' + interpolar(s.titulo) + '</h3>';

        if (s.intro) {
          html += '<p>' + interpolar(s.intro) + '</p>';
        }

        if (s.parrafos && s.parrafos.length > 0) {
          s.parrafos.forEach(function (p) {
            html += '<p>' + interpolar(p) + '</p>';
          });
        }

        if (s.items && s.items.length > 0) {
          html += '<ul>';
          s.items.forEach(function (item) {
            html += '<li>' + interpolar(item) + '</li>';
          });
          html += '</ul>';
        }
      });

      html += '</div>';
      return html;
    }

    function getPlataformaUsuario() {
      var ua = navigator.userAgent || '';
      var esIOS = /iPad|iPhone|iPod/.test(ua) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (esIOS) return 'ios';
      if (/Android/i.test(ua)) return 'android';
      return 'android';
    }

    function pwaYaInstalada() {
      try {
        if (window.matchMedia &&
            window.matchMedia('(display-mode: standalone)').matches) {
          return true;
        }
        /* iOS instalada: standalone no siempre responde; Safari
           expone navigator.standalone. */
        if (window.navigator && window.navigator.standalone === true) {
          return true;
        }
      } catch (err) {}
      return false;
    }

    function pwaTextoAviso() {
      var m = window.SISTEMA && window.SISTEMA.pwa &&
              window.SISTEMA.pwa.mensajes;
      return (m && m.yaInstalada) ||
             'Ya tienes la app instalada en este dispositivo';
    }

    function avisoPwa(texto) {
      var t = document.getElementById('aviso-pwa-global');
      if (!t) {
        t = document.createElement('div');
        t.id = 'aviso-pwa-global';
        t.setAttribute('role', 'status');
        t.setAttribute('style',
          'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
          'z-index:1400;max-width:calc(100vw - 32px);background:#1f2937;' +
          'color:#ffffff;font-size:14px;font-weight:600;padding:11px 18px;' +
          'border-radius:999px;text-align:center;box-shadow:' +
          '0 10px 30px rgba(15,23,42,0.25);opacity:0;pointer-events:none;' +
          'transition:opacity .22s ease;');
        document.body.appendChild(t);
      }
      t.textContent = texto;
      t.style.opacity = '1';
      if (avisoPwaTimer) clearTimeout(avisoPwaTimer);
      avisoPwaTimer = setTimeout(function () { t.style.opacity = '0'; }, 2600);
    }

    function hayPadreParaPwa() {
      try {
        return !!(window.parent && window.parent !== window);
      } catch (err) { return false; }
    }

    /* Dentro del envoltorio: el boleto vive en la página de arriba.
       Se le pide por postMessage; si contesta que NO hay boleto (o
       no contesta en 1.2 seg), se avisa el camino manual — R64: la
       guía ya está en pantalla, navegar de nuevo no aporta nada. */
    function pedirBoletoAlPadre() {
      var resuelto = false;

      function avisoManual() {
        if (resuelto) return;
        resuelto = true;
        window.removeEventListener('message', receptor);
        avisoPwa('Abre el menú de tu navegador y elige "Añadir a pantalla de inicio"');
      }

      function receptor(e) {
        if (e.source !== window.parent) return;
        if (!e.data || e.data.tipo !== 'pwa-respuesta') return;
        if (e.data.boleto) {
          /* El envoltorio abre el diálogo nativo: aquí no hay nada
             más que hacer. */
          resuelto = true;
          window.removeEventListener('message', receptor);
          return;
        }
        avisoManual();
      }

      window.addEventListener('message', receptor);
      try {
        window.parent.postMessage({ tipo: 'pwa-instalar' }, '*');
      } catch (err) {
        avisoManual();
        return;
      }
      setTimeout(avisoManual, 1200);
    }

    /* ============================================================
       INTENTAR INSTALAR (R64) · handler del botón manual de la
       guía (Android). Con boleto real lanza el diálogo nativo;
       si no, se lo pide al envoltorio; y sin ninguno, avisa el
       camino manual (los pasos de arriba ya lo detallan).
       ============================================================ */
    function intentarInstalar() {
      if (pwaYaInstalada()) {
        avisoPwa(pwaTextoAviso());
        return;
      }

      /* Página estática: boleto compartido por GitHub_Cromo. */
      var boleto = null;
      try { boleto = window.__servyBoleto || null; } catch (err) { boleto = null; }
      if (boleto && typeof boleto.prompt === 'function') {
        window.__servyBoleto = null;
        try {
          boleto.prompt();
          if (boleto.userChoice && boleto.userChoice.then) {
            boleto.userChoice.then(function () {}, function () {});
          }
          return;
        } catch (err) { /* boleto vencido: sigue abajo */ }
      }

      /* Envoltorio (iframe): pedir el boleto a la página de arriba. */
      if (hayPadreParaPwa()) {
        pedirBoletoAlPadre();
        return;
      }

      /* Sin boleto y sin envoltorio: aviso (la guía de arriba
         ya muestra los pasos manuales). */
      avisoPwa('Abre el menú de tu navegador y elige "Añadir a pantalla de inicio"');
    }

    /* ============================================================
       AYUDA DE INSTALACIÓN (R63) · las 2 versiones del dueño
       Pestañas ANDROID / IPHONE (glifos de Iconos) + TIMELINE de
       pasos en el naranja oficial con entrada escalonada. La
       pestaña inicial es la del dispositivo. Si la BD solo trae
       una plataforma, esa sale sola (sin pestañas); si no trae
       pwa, "Próximamente" (compatibilidad de siempre).
       ============================================================ */
    function pwaPlataformas() {
      var cfg = window.SISTEMA && window.SISTEMA.pwa;
      var lista = [];
      if (cfg && cfg.android) lista.push('android');
      if (cfg && cfg.ios)     lista.push('ios');
      return lista;
    }

    function pwaDatosTab(plataforma) {
      var cfg = window.SISTEMA && window.SISTEMA.pwa;
      if (!cfg) return null;
      return cfg[plataforma] || cfg.otro || null;
    }

    function pwaCuerpoHTML(plataforma) {
      var cfg = window.SISTEMA && window.SISTEMA.pwa;
      if (!cfg) return '';

      var data = pwaDatosTab(plataforma);
      if (!data) return '';

      var html = '<ol class="pwa-timeline">';

      var pasos = data.pasos || [];
      pasos.forEach(function (p, i) {
        html +=
          '<li class="pwa-paso" style="--i:' + i + '">' +
            '<span class="pwa-paso-punto" aria-hidden="true">' + (i + 1) + '</span>' +
            '<span class="pwa-paso-contenido">' +
              '<span class="pwa-paso-titulo">' + (p.titulo || '') + '</span>' +
              (p.detalle
                ? '<span class="pwa-paso-detalle">' + p.detalle + '</span>'
                : '') +
            '</span>' +
          '</li>';
      });

      html += '</ol>';

      /* R64 · botón manual de instalación: SIEMPRE visible en
         Android (el dueño pidió un botón que invite al click, no
         un texto del título). Con boleto real abre el diálogo
         nativo; sin boleto lo pide al envoltorio o avisa el
         camino manual. En iPhone no existe el boleto: la guía ES
         el camino. */
      if (plataforma === 'android') {
        html += '<button type="button" class="pwa-instalar">' +
                '<span class="pwa-instalar-icono" data-glifo="download" aria-hidden="true"></span>' +
                'Instalar la app</button>';
      }

      if (data.nota) {
        html += '<p class="pwa-nota">' + data.nota + '</p>';
      }

      return html;
    }

    function getPWAHTML() {
      var cfg = window.SISTEMA && window.SISTEMA.pwa;
      if (!cfg) return '<h2 class="sheet-titulo">Próximamente</h2>';

      /* Pestañas: las plataformas que la BD traiga. Si ninguna,
         fallback cfg.otro con una sola guía (compatibilidad). */
      var plataformas = pwaPlataformas();
      if (!plataformas.length && cfg.otro) {
        plataformas = ['android'];
      }
      if (!plataformas.length) {
        return '<h2 class="sheet-titulo">Próximamente</h2>';
      }

      /* Pestaña inicial: la del dispositivo si está; si no, la
         primera. */
      var delEquipo = getPlataformaUsuario();
      pwaTab = (plataformas.indexOf(delEquipo) !== -1)
        ? delEquipo : plataformas[0];

      var html = '<div class="sheet-pwa">';

      html += '<div class="sheet-titulo-con-icono">';
      if (cfg.icono) {
        html += '<span class="icono"><span data-glifo="' + cfg.icono + '"></span></span>';
      }
      html += '<span>' + (cfg.titulo || 'Instalar la app') + '</span>';
      html += '</div>';

      /* R64 · ya instalada: el aviso vive DENTRO de la pantalla
         (banner con check) — la ayuda SIEMPRE queda visible:
         tocar la opción del menú nunca tapa su contenido. */
      if (pwaYaInstalada()) {
        html += '<div class="pwa-instalada-aviso" role="status">' +
                '<span class="pwa-instalada-glifo" data-glifo="verificado" aria-hidden="true"></span>' +
                '<span class="pwa-instalada-texto">' + pwaTextoAviso() + '</span>' +
                '</div>';
      }

      if (cfg.subtitulo) {
        html += '<p class="pwa-sub">' + cfg.subtitulo + '</p>';
      }

      if (plataformas.length > 1) {
        html += '<div class="pwa-tabs" role="tablist" ' +
                'aria-label="Elegir tu teléfono">';
        plataformas.forEach(function (p) {
          var esIOS = (p === 'ios');
          html +=
            '<button type="button" role="tab" ' +
              'class="pwa-tab' + (p === pwaTab ? ' activa' : '') + '" ' +
              'data-tab="' + p + '" ' +
              'aria-selected="' + (p === pwaTab ? 'true' : 'false') + '">' +
              '<span class="pwa-tab-icono" data-glifo="' +
                (esIOS ? 'apple' : 'android') + '" aria-hidden="true"></span>' +
              '<span>' + (esIOS ? 'iPhone' : 'Android') + '</span>' +
            '</button>';
        });
        html += '</div>';
      }

      html += '<div class="pwa-cuerpo">' +
              pwaCuerpoHTML(pwaTab) + '</div>';

      html += '</div>';
      return html;
    }

    /* Enganche de la subvista PWA: pestañas + botón instalar. */
    function engancharPWA() {
      if (!content) return;

      var tabs = content.querySelectorAll('.pwa-tab');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function () {
          var nueva = this.getAttribute('data-tab');
          if (!nueva || nueva === pwaTab) return;
          pwaTab = nueva;

          var activos = content.querySelectorAll('.pwa-tab');
          for (var j = 0; j < activos.length; j++) {
            var esEsta = activos[j].getAttribute('data-tab') === nueva;
            activos[j].classList.toggle('activa', esEsta);
            activos[j].setAttribute('aria-selected', esEsta ? 'true' : 'false');
          }

          var cuerpo = content.querySelector('.pwa-cuerpo');
          if (!cuerpo) return;
          cuerpo.innerHTML = pwaCuerpoHTML(nueva);
          if (typeof window.pintarGlifos === 'function') {
            window.pintarGlifos(cuerpo);
          }
          engancharInstalar();
        });
      }

      engancharInstalar();
    }

    function engancharInstalar() {
      var btn = content && content.querySelector('.pwa-instalar');
      if (!btn || btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        haptic(10);
        intentarInstalar();
      });
    }

    function getContenido(k) {
      if (k === 'menu')       return getMenuHTML();
      if (k === 'acerca')     return getAcercaHTML();
      if (k === 'terminos')   return getLegalHTML('terminos');
      if (k === 'privacidad') return getLegalHTML('privacidad');
      if (k === 'cookies')    return getLegalHTML('cookies');
      if (k === 'pwa')        return getPWAHTML();
      return '';
    }

    function actualizarGradientePrivacidad() {
      if (!sheet || !content) return;
      if (!sheet.classList.contains('con-privacidad')) {
        sheet.classList.remove('scroll-mas');
        return;
      }
      var hayMas = (content.scrollTop + content.clientHeight) < (content.scrollHeight - 8);
      sheet.classList.toggle('scroll-mas', hayMas);
    }

    function construirDOM() {
      if (raiz) return;

      var area = document.querySelector('.area-contenido');
      if (!area) return;

      raiz = document.createElement('div');
      raiz.className = 'global-sheet-root';
      raiz.innerHTML =
        '<div class="sheet-backdrop"></div>' +
        '<div class="sheet">' +
          '<div class="sheet-handle-area"><div class="sheet-handle"></div></div>' +
          '<button class="sheet-close" type="button" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
          '<button class="sheet-back" type="button" aria-label="Volver">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="15 18 9 12 15 6"/>' +
            '</svg>' +
          '</button>' +
          '<div class="sheet-back-titulo">Volver</div>' +
          '<div class="sheet-content"></div>' +
        '</div>';

      area.appendChild(raiz);

      backdrop   = raiz.querySelector('.sheet-backdrop');
      sheet      = raiz.querySelector('.sheet');
      handleArea = raiz.querySelector('.sheet-handle-area');
      content    = raiz.querySelector('.sheet-content');
      btnClose   = raiz.querySelector('.sheet-close');
      btnBack    = raiz.querySelector('.sheet-back');
      titulo     = raiz.querySelector('.sheet-back-titulo');

      backdrop.addEventListener('click', cerrar);
      btnClose.addEventListener('click', cerrar);
      btnBack.addEventListener('click', volverAlMenu);

      handleArea.addEventListener('pointerdown', onHandleDown);
      content.addEventListener('pointerdown', onContentDown);
      content.addEventListener('scroll', actualizarGradientePrivacidad);
    }

    function inyectarDirecto(k) {
      content.classList.remove('saliendo', 'entrando');
      content.innerHTML = getContenido(k);
      content.scrollTop = 0;

      if (typeof window.pintarGlifos === 'function') {
        window.pintarGlifos(content);
      }
      if (k === 'menu') engancharMenu();
      if (k === 'pwa')  engancharPWA();

      actualizarGradientePrivacidad();
    }

    function inyectarConFade(k) {
      content.classList.add('saliendo');

      setTimeout(function () {
        content.innerHTML = getContenido(k);
        content.classList.add('entrando');
        content.scrollTop = 0;

        if (typeof window.pintarGlifos === 'function') {
          window.pintarGlifos(content);
        }
        if (k === 'menu') engancharMenu();
        if (k === 'pwa')  engancharPWA();

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            content.classList.remove('saliendo', 'entrando');
            actualizarGradientePrivacidad();
          });
        });
      }, 140);
    }

    function abrir() {
      construirDOM();
      if (!raiz) return;

      haptic(10);

      base    = 'menu';
      abierto = true;

      sheet.classList.remove('con-privacidad', 'scroll-mas');

      inyectarDirecto('menu');
      sheet.classList.remove('subvista');
      titulo.textContent = 'Volver';

      sheet.classList.add('sin-transicion');
      sheet.style.transform = 'translateY(100%)';

      raiz.classList.add('abierto');
      sheet.classList.add('abierto');

      void sheet.offsetHeight;
      sheet.classList.remove('sin-transicion');

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sheet.style.transform = 'translateY(0)';
          backdrop.classList.add('visible');
        });
      });
    }

    function cerrar() {
      if (!abierto) return;

      abierto = false;
      backdrop.classList.remove('visible');
      sheet.style.transform = 'translateY(100%)';
      sheet.classList.remove('con-privacidad', 'scroll-mas');

      setTimeout(function () {
        if (!abierto) {
          sheet.classList.remove('abierto');
          raiz.classList.remove('abierto');
          if (content) content.innerHTML = '';
        }
      }, 420);
    }

    function navegar(subvista) {
      sheet.classList.add('subvista');
      titulo.textContent = 'Volver';

      if (subvista === 'privacidad' ||
          subvista === 'terminos'   ||
          subvista === 'cookies') {
        sheet.classList.add('con-privacidad');
      } else {
        sheet.classList.remove('con-privacidad', 'scroll-mas');
      }

      inyectarConFade(subvista);
    }

    function volverAlMenu() {
      if (base !== 'menu') return;

      sheet.classList.remove('subvista');
      sheet.classList.remove('con-privacidad', 'scroll-mas');
      titulo.textContent = 'Volver';

      inyectarConFade('menu');
    }

    function engancharMenu() {
      var items = content.querySelectorAll('.sheet-menu-item');
      for (var i = 0; i < items.length; i++) {
        if (items[i].dataset.bound === '1') continue;
        items[i].dataset.bound = '1';
        items[i].addEventListener('click', onItemClick);
      }
    }

    function onItemClick(e) {
      var accion = this.getAttribute('data-accion');
      if (!accion) return;

      if (accion === 'asesor') {
        haptic(10);
        setTimeout(function () { cerrar(); }, 120);
        return;
      }

      haptic(8);

      if (accion === 'terminos'    ||
          accion === 'privacidad'  ||
          accion === 'cookies'     ||
          accion === 'acerca') {
        navegar(accion);
        return;
      }

      if (accion === 'pwa') {
        /* R64: SIEMPRE abre la ayuda (nunca un aviso que tape el
           contenido — si ya está instalada, el banner vive
           dentro de la pantalla). */
        navegar('pwa');
        return;
      }

      console.log('[Global] acción pendiente:', accion);
    }

    function onHandleDown(e) { iniciarDrag(e, true); }
    function onContentDown(e) {
      if (content.scrollTop > 0) return;
      iniciarDrag(e, false);
    }

    function iniciarDrag(e, desdeHandle) {
      if (!abierto) return;
      if (e.button !== undefined && e.button !== 0) return;

      dragActivo = true;
      dragMoved = false;
      dragDesdeHandle = desdeHandle;
      dragPointerId = e.pointerId;
      dragStartY = e.clientY;
      dragUltimoY = e.clientY;
      dragUltimoT = performance.now();
      dragVelocidad = 0;

      if (desdeHandle) {
        handleArea.addEventListener('pointermove', onDragMove);
        handleArea.addEventListener('pointerup', onDragEnd);
        handleArea.addEventListener('pointercancel', onDragEnd);
      } else {
        content.addEventListener('pointermove', onDragMove);
        content.addEventListener('pointerup', onDragEnd);
        content.addEventListener('pointercancel', onDragEnd);
      }
    }

    function onDragMove(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;

      var dy = e.clientY - dragStartY;

      if (!dragMoved) {
        if (Math.abs(dy) < UMBRAL_DRAG) return;
        dragMoved = true;
        sheet.classList.add('sin-transicion');
        if (dragDesdeHandle) {
          try { handleArea.setPointerCapture(e.pointerId); } catch (err) {}
        } else {
          if (dy < 0) { cancelarDrag(); return; }
          try { content.setPointerCapture(e.pointerId); } catch (err) {}
        }
      }

      var alturaSheet = sheet.offsetHeight;
      var pct = (dy / alturaSheet) * 100;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;

      e.preventDefault();
      sheet.style.transform = 'translateY(' + pct + '%)';

      var ahora = performance.now();
      var dt = ahora - dragUltimoT;
      if (dt > 0) {
        var v = (e.clientY - dragUltimoY) / dt;
        dragVelocidad = dragVelocidad * 0.7 + v * 0.3;
        dragUltimoY = e.clientY;
        dragUltimoT = ahora;
      }
    }

    function onDragEnd(e) {
      if (!dragActivo) return;
      if (e.pointerId !== dragPointerId) return;

      dragActivo = false;
      dragPointerId = null;

      if (!dragMoved) { limpiarListenersDrag(); return; }

      dragMoved = false;
      sheet.classList.remove('sin-transicion');

      var transform = sheet.style.transform || '';
      var match = transform.match(/translateY\(([\d.]+)%\)/);
      var pct = match ? parseFloat(match[1]) : 0;

      var destino = decidirDestino(pct);
      if (destino === 'cerrado') {
        cerrar();
      } else {
        sheet.style.transform = 'translateY(0)';
      }

      limpiarListenersDrag();
    }

    function cancelarDrag() {
      dragActivo = false;
      dragMoved = false;
      dragPointerId = null;
      sheet.classList.remove('sin-transicion');
      sheet.style.transform = 'translateY(0)';
      limpiarListenersDrag();
    }

    function limpiarListenersDrag() {
      handleArea.removeEventListener('pointermove', onDragMove);
      handleArea.removeEventListener('pointerup', onDragEnd);
      handleArea.removeEventListener('pointercancel', onDragEnd);
      content.removeEventListener('pointermove', onDragMove);
      content.removeEventListener('pointerup', onDragEnd);
      content.removeEventListener('pointercancel', onDragEnd);
    }

    function decidirDestino(pct) {
      if (dragVelocidad > UMBRAL_VELOCIDAD) return 'cerrado';
      if (dragVelocidad < -UMBRAL_VELOCIDAD) return 'abierto';
      if (pct > 30) return 'cerrado';
      return 'abierto';
    }

    function haptic(ms) {
      if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (err) {}
      }
    }

    function initDelegacionMenuGlobal() {
      if (document.__globalDelegado === '1') return;
      document.__globalDelegado = '1';

      document.addEventListener('click', function (e) {
        var objetivo = e.target;
        if (!objetivo || !objetivo.closest) return;

        var btn = objetivo.closest('.menu-global');
        if (!btn) return;

        e.preventDefault();
        if (abierto) cerrar();
        else abrir();
      });
    }

    function pintar() {
      construirDOM();
      initDelegacionMenuGlobal();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pintar);
    } else {
      pintar();
    }

    return {
      pintar: pintar,
      abrir:  abrir,
      cerrar: cerrar,
      getLegalHTML: getLegalHTML
    };

  })();