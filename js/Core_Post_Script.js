/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Core_Post_Script.html
ESPEJO GITHUB:   github/js/Core_Post_Script.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniousCloud | ServyCloud
RESPONSABILIDAD: window.CorePost — la vida del POST ABIERTO.
                 El post activo (último de 'post:change'), su estado
                 y TODO lo que vive en la pantalla con él:
                 · pintarAreaConPost — el fondo del área con los
                 colores del post (meta.color[2] claro en el tramo
                 15%-24% del degradado, --post-color oficial) y el
                 degradado neutro cuando no hay post.
                 · actualizarTextoCTA — el botón grande: PRONTO
                 (inactivo con meta.ctaInactivo), modo whatsapp
                 (meta.mensajeCta), cupos en cero (planJson sumado)
                 o meta.cta — un solo pintado inactivo con la regla
                 general de :disabled del Core_CSS.
                 · actualizarDuda — el botón de la duda (meta.duda +
                 meta.mensajeDuda) con {tituloPost} resuelto; la
                 fila CTA se segmenta cuando hay duda.
                 · intentarWhatsapp — el CTA en modo whatsapp abre
                 la conversación con el partner del post.
                 · avisarCTATelegram — cada click VÁLIDO del CTA
                 dispara postBackend('avisoCTA') fire-and-forget
                 (dedupe y aviso al bot los hace el backend) — cubre
                 AMBOS modos, antes del corte de WhatsApp.
                 · El pintado inicial (área neutra + CTA) corre con
                 el evento 'app-lista', al inyectarse el lienzo.
VERSIÓN:         1.0
ENCABEZADOS:     Solo describen lo que funciona HOY. El historial
                 de rondas vive en la bitácora y en versiones/.
DEPENDENCIAS:    Global_Script.html (postBackend, abrirWhatsapp),
                 Index.html (TABLAS), Core_CSS.html,
                 Iconos.html (pintarGlifos no se usa aquí)
════════════════════════════════════════════════════════════════════*/

  window.CorePost = (function () {
    var postActivoGlobal = null;

    /* VIDA DEL POST en el teléfono (la ventana meta.expira la
       filtra el núcleo al cargar tablas; aquí solo importa el
       post ya vivo). Modo whatsapp por meta.mensajeCta. */
    function esModoWhatsapp(post) {
      if (!post) return false;
      var pj = post.postJson || {};
      var meta = pj.meta || {};
      return String(meta.mensajeCta || '').trim().length > 0;
    }

    /* Título del post para los placeholders · la MISMA fuente que
       la duda ya usaba: descripcion.tituloPost del postJson, con
       post.titulo de miga. */
    function tituloDelPost(post) {
      var pj = (post && post.postJson) || {};
      var desc = pj.descripcion || {};
      return String(desc.tituloPost || (post && post.titulo) || '').trim();
    }

    function buscarPartner(idPartner) {
      if (!idPartner) return null;
      var partners = (window.TABLAS && window.TABLAS.partners) || [];
      for (var i = 0; i < partners.length; i++) {
        if (partners[i].id === idPartner) return partners[i];
      }
      return null;
    }

    function intentarWhatsapp() {
      if (!postActivoGlobal) return false;
      if (!esModoWhatsapp(postActivoGlobal)) return false;

      var pj = postActivoGlobal.postJson || {};
      var meta = pj.meta || {};
      var mensaje = String(meta.mensajeCta || '').trim();

      /* {tituloPost} → el título del post. Sin título, el mensaje
         viaja tal cual (nunca tumba el envío). */
      var titulo = tituloDelPost(postActivoGlobal);
      if (titulo) mensaje = mensaje.split('{tituloPost}').join(titulo);

      var partner = buscarPartner(postActivoGlobal.idPartner);
      var numero = partner && partner.partnerJson
        ? partner.partnerJson.whatsapp
        : '';

      return abrirWhatsapp(numero, mensaje);
    }

    /* Fondo del área · colores del post
       meta.color[2] = claro · meta.color[0] = oficial. */
    function pintarAreaConPost(post) {
      var area = document.querySelector('.area-contenido');
      if (!area) return;

      if (!post) {
        area.style.background =
          'linear-gradient(180deg, ' +
            '#ffffff 0%, ' +
            '#ffffff 5%, ' +
            '#fdf3ec 15%, ' +
            '#fdf3ec 24%, ' +
            '#ffffff 36%, ' +
            '#ffffff 100%)';
        area.style.removeProperty('--post-color');
        return;
      }

      var pj = post.postJson || {};
      var meta = pj.meta || {};
      var colores = Array.isArray(meta.color) ? meta.color : [];
      var colorClaro   = colores[2] || '#f4f6fc';
      var colorOficial = colores[0] || '';

      /* Mismo formato del lienzo principal — blanco al inicio,
         color del post clarito en el mismo tramo (15%-24%) y de
         vuelta al blanco. */
      area.style.background =
        'linear-gradient(180deg, ' +
          '#ffffff 0%, ' +
          '#ffffff 5%, ' +
          colorClaro + ' 15%, ' +
          colorClaro + ' 24%, ' +
          '#ffffff 36%, ' +
          '#ffffff 100%)';

      if (colorOficial) {
        area.style.setProperty('--post-color', colorOficial);
      } else {
        area.style.removeProperty('--post-color');
      }
    }

    /* PLANJSON: array directo [{dias, horario, cupo}]. Suma los
       cupos disponibles del post (null si no hay plan: posts sin
       horarios no se bloquean por esta vía). */
    function calcularTotalCupos(post) {
      if (!post || !Array.isArray(post.planJson)) return null;
      if (post.planJson.length === 0) return null;
      var total = 0;
      post.planJson.forEach(function (p) {
        total += Number(p.cupo || 0);
      });
      return total;
    }

    function actualizarTextoCTA() {
      var btn  = document.querySelector('.cta-reservar');
      var span = document.querySelector('.cta-reservar .cta-reservar-texto');

      if (btn && span) {
        if (!postActivoGlobal) {
          btn.disabled = true;
          span.textContent = 'Quiero reservar mi cupo';
        } else {
          /* DOS TEXTOS y un solo pintado inactivo. Vivo habla con
             meta.cta; pronto o cupos en cero hablan con
             meta.ctaInactivo (si el post no lo trae, cae al texto
             normal). El tenue lo pinta UNA regla general de
             Core_CSS sobre :disabled — nada de looks por caso. */
          var pj = postActivoGlobal.postJson || {};
          var meta = pj.meta || {};
          var estado = postActivoGlobal.estado || 'activo';

          if (estado === 'pronto') {
            /* PRONTO: sin acción y con su texto de inactivo. */
            btn.disabled = true;
            span.textContent = meta.ctaInactivo || meta.cta || 'Quiero reservar mi cupo';
          } else if (esModoWhatsapp(postActivoGlobal)) {
            btn.disabled = false;
            span.textContent = meta.cta || 'Quiero reservar mi cupo';
          } else {
            var totalCupos = calcularTotalCupos(postActivoGlobal);
            var inactivo = (totalCupos === 0);
            btn.disabled = inactivo;
            span.textContent = inactivo
              ? (meta.ctaInactivo || meta.cta || 'Quiero reservar mi cupo')
              : (meta.cta || 'Quiero reservar mi cupo');
          }
        }
      }

      actualizarDuda();
    }

    /* DUDA DEL POST · meta.duda. El resto igual. */
    function actualizarDuda() {
      var btn = document.querySelector('.cta-duda');
      if (!btn) return;

      var texto = '';
      if (postActivoGlobal) {
        var pj = postActivoGlobal.postJson || {};
        var meta = pj.meta || {};
        texto = String(meta.duda || '').trim();
        if (esModoWhatsapp(postActivoGlobal)) texto = '';
      }

      if (texto) {
        btn.textContent = texto;
        btn.hidden = false;
      } else {
        btn.hidden = true;
      }

      var fila = btn.closest('.cta-fila');
      if (fila) fila.classList.toggle('segmentada', !!texto);
    }

    /* Click de la duda · meta.duda + meta.mensajeDuda. */
    document.addEventListener('click', function (e) {
      var objetivo = e.target;
      if (!objetivo || !objetivo.closest) return;

      var btn = objetivo.closest('.cta-duda');
      if (!btn || btn.hidden) return;

      var post = postActivoGlobal;
      if (!post) return;

      var pj = post.postJson || {};
      var meta = pj.meta || {};

      var mensaje = String(meta.mensajeDuda || '').trim();
      if (!mensaje) return;

      var titulo = tituloDelPost(post);
      if (titulo) {
        /* {tituloPost} placeholder explícito; el viejo {titulo}
           sigue funcionando para posts que aún lo traigan. */
        mensaje = mensaje.split('{tituloPost}').join(titulo);
        mensaje = mensaje.split('{titulo}').join(titulo);
      }

      var partner = buscarPartner(post.idPartner);
      var numero = partner && partner.partnerJson
        ? partner.partnerJson.whatsapp
        : '';
      if (!numero) return;

      if (typeof window.abrirWhatsapp === 'function') {
        window.abrirWhatsapp(numero, mensaje);

        if (window.Analitica) {
          window.Analitica.enviar('whatsapp_click', {
            post_id:    post.id || '',
            partner_id: post.idPartner || '',
            tipo:       'duda'
          });
        }
      }
    }, true);

    /* AVISO TELEGRAM · CTA DEL POST: cada click VÁLIDO del botón
       CTA dispara postBackend('avisoCTA') — FIRE-AND-FORGET: si
       algo falla, la acción del usuario ya corrió y nada se
       rompe; sin postBackend disponible se omite en silencio.
       Vive AQUÍ —antes del corte de WhatsApp por captura— para
       cubrir el CTA en AMBOS modos (reserva y whatsapp). */
    function avisarCTATelegram() {
      try {
        if (!postActivoGlobal || !postActivoGlobal.id) return;
        if (typeof window.postBackend !== 'function') return;
        var r = window.postBackend('avisoCTA', { idPost: postActivoGlobal.id });
        if (r && typeof r.catch === 'function') r.catch(function () {});
      } catch (_) {}
    }

    document.addEventListener('click', function (e) {
      var objetivo = e.target;
      if (!objetivo || !objetivo.closest) return;

      var btn = objetivo.closest('.cta-reservar');
      if (!btn) return;
      if (btn.disabled) return;

      /* el aviso viaja SIEMPRE que el click es válido (botón
         habilitado y post activo), sin importar el modo. */
      avisarCTATelegram();

      if (intentarWhatsapp()) {
        if (window.Analitica && postActivoGlobal) {
          window.Analitica.enviar('whatsapp_click', {
            post_id:    postActivoGlobal.id || '',
            partner_id: postActivoGlobal.idPartner || ''
          });
        }
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    /* post:change · ESTADO del post activo + pantalla:
       área con sus colores y CTA con su texto. La analítica y el
       viaje del detalle corren por sus propios receptores. */
    document.addEventListener('post:change', function (e) {
      postActivoGlobal = e.detail ? (e.detail.post || null) : null;
      pintarAreaConPost(postActivoGlobal);
      actualizarTextoCTA();
    });

    /* Pintado inicial del área y del CTA, al inyectarse el
       lienzo (mismo evento que avisa a la ventana contenedora). */
    document.addEventListener('app-lista', function () {
      pintarAreaConPost(null);
      actualizarTextoCTA();
    });

    return {
      pintarAreaConPost:  pintarAreaConPost,
      actualizarTextoCTA: actualizarTextoCTA
    };
  })();
