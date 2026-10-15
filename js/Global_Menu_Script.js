/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Global_Menu_Script.html
ESPEJO GITHUB:   js/Global_Menu_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Módulo window.Global: menú bottom sheet con
                 jerarquía (marca de la app protagonista arriba,
                 crédito de INGeniusCloud abajo) y subvistas
                 "Acerca de", "Términos y condiciones", "Privacidad"
                 y "Cookies" interpolando datos de ROOTJSON
                 (marcaApp, marcaEmpresa, correo, whatsapp), más la
                 guía PWA y el drag de cierre.
VERSIÓN:         1.2
CAMBIOS:         R37: encabezado simplificado — solo queda lo
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
       PWA · botón inteligente (R33)
       El boleto de instalación (beforeinstallprompt) lo captura
       GitHub_Cromo.js en la página estática y lo deja compartido
       en window.__servyBoleto. Aquí NO se captura de nuevo: se
       consume el compartido. Dentro del envoltorio (iframe) el
       boleto vive en la página de arriba y se pide por el puente
       pwa-instalar / pwa-respuesta. El aviso "ya instalada" usa
       estilos inline para no tocar ningún CSS.
       ============================================================ */
    var avisoPwaTimer = null;

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
       no contesta en 1.2 seg), se abre la guía con los pasos. */
    function pedirBoletoAlPadre() {
      var resuelto = false;

      function abrirGuia() {
        if (resuelto) return;
        resuelto = true;
        window.removeEventListener('message', receptor);
        navegar('pwa');
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
        abrirGuia();
      }

      window.addEventListener('message', receptor);
      try {
        window.parent.postMessage({ tipo: 'pwa-instalar' }, '*');
      } catch (err) {
        abrirGuia();
        return;
      }
      setTimeout(abrirGuia, 1200);
    }

    function instalarPwa() {
      /* 1 · Ya instalada: aviso y fuera. */
      if (pwaYaInstalada()) {
        avisoPwa(pwaTextoAviso());
        return;
      }

      /* 2 · iPhone/iPad: Apple no da boleto de instalación por
         código; la guía manual (R30) es el único camino. */
      if (getPlataformaUsuario() === 'ios') {
        navegar('pwa');
        return;
      }

      /* 3 · Página estática: boleto compartido por GitHub_Cromo. */
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

      /* 4 · Envoltorio (iframe): pedir el boleto a la página de arriba. */
      if (hayPadreParaPwa()) {
        pedirBoletoAlPadre();
        return;
      }

      /* 5 · Sin boleto y sin envoltorio: guía con los pasos. */
      navegar('pwa');
    }

    function getPWAHTML() {
      var cfg = window.SISTEMA && window.SISTEMA.pwa;
      if (!cfg) return '<h2 class="sheet-titulo">Próximamente</h2>';

      var plataforma = getPlataformaUsuario();
      var data = cfg[plataforma] || cfg.otro;
      if (!data) return '<h2 class="sheet-titulo">Próximamente</h2>';

      var html = '<div class="sheet-pwa">';

      html += '<div class="sheet-titulo-con-icono">';
      if (cfg.icono) {
        html += '<span class="icono"><span data-glifo="' + cfg.icono + '"></span></span>';
      }
      html += '<span>' + (cfg.titulo || 'Instalar la app') + '</span>';
      html += '</div>';

      if (cfg.subtitulo) {
        html += '<p class="pwa-sub">' + cfg.subtitulo + '</p>';
      }

      if (data.plataforma) {
        html += '<span class="pwa-plataforma">' + data.plataforma + '</span>';
      }

      var pasos = data.pasos || [];
      if (pasos.length > 0) {
        html += '<ol class="pwa-pasos">';
        pasos.forEach(function (p) {
          html += '<li>';
          html += '<span class="pwa-paso-titulo">' + p.titulo + '</span>';
          if (p.detalle) html += '<span class="pwa-paso-detalle">' + p.detalle + '</span>';
          html += '</li>';
        });
        html += '</ol>';
      }

      if (data.nota) {
        html += '<p class="pwa-nota">' + data.nota + '</p>';
      }

      html += '</div>';
      return html;
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
        instalarPwa();
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
