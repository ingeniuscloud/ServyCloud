/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Lista_Script.html
ESPEJO GITHUB:   js/Lista_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Menú lista. Pinta los posts filtrados por
                 ciudad activa + chip activo, sobre TABLAS.posts
                 cargada una sola vez. Emite 'post:change'.
                 Escucha 'chips:change', 'buscar:change' y
                 'ciudad:change'. Item de la vidriera (R64 ·
                 LIMPIO): fila del título (título + estrella
                 métrica) y fila del partner: avatar circular
                 con la INICIAL de la marca (fondo colorClaro
                 del post, letra colorOficial) + nombre, a la
                 derecha "Ver publicación" (glifo flechaVer,
                 naranja oficial, sin bold) — sin subtítulo y
                 sin check verde (R64: la segunda fila y el
                 check murieron). Estrella métrica PASIVA con
                 el contador de likes (oculta en 0; glifo de
                 Iconos); al volver del detalle se re-sincroniza
                 con TABLAS para que el número sea siempre el
                 mismo que dejó el corazón. DECIDE el TEXTÓN
                 "Compartir lista filtrada": lo muestra cuando
                 la lista pinta items y lo oculta cuando no
                 (Compartir_Script lleva el envío).
                 La lista es PLANA (R58): el orden es el de la
                 hoja. Modo lista ↔ detalle con fade y botón
                 volver. Skeleton del detalle mientras carga la
                 primera vez un post (PostFull). Precarga del
                 primer post de la lista filtrada para que el
                 primer tap sea instantáneo. Los posts que están
                 activos como promo siguen apareciendo en la
                 lista (no se excluyen).
VERSIÓN:         2.3
CAMBIOS:         R64: montarItem LIMPIO — fuera la segunda fila
                 (tagline), la divisoria interna y el check
                 verificado del partner (murieron con su CSS);
                 entra actualizarCompartir(): el botón compartir
                 vive con items en la lista y se esconde con la
                 lista vacía (Lista_Script decide, no el
                 buscador); FUERA actualizarContador() y el
                 envío de 'buscar:resultados' (los números de
                 items se retiraron y el botón ya no depende del
                 buscador).
                 R63: respirarScroll() — cada repintado de la
                 lista recoloca el contenedor arriba y re-evalúa
                 su scroll (cura el "se queda pegado" del
                 teléfono al regresar a Güiria tras cambiar de
                 ciudad; la restauración del detalle no pasa por
                 aquí).
                 R60: el selector del estado abierto de la
                 búsqueda usa .filtros-fila (la cápsula vive en
                 la sección de filtros).
                 R58: avatar del partner (--post-claro +
                 inicial); título/subtítulo en color normal;
                 "Ver detalles" pasa a "Ver publicación"; la
                 lista se pinta PLANA.
                 R55: fuera el cuadrado avatar, el badge y el
                 chevron; estrella métrica pasiva (glifo estrella
                 de Iconos, oculta en 0);
                 sincronizarEstrellas() actualiza los contadores
                 al cerrar el detalle.
DEPENDENCIAS:    Index.html (TABLAS, SISTEMA), Ciudad_Sheet_Script.html
                 (getActual, hayPendiente), Chips_Script.html
                 (getChipActivo, seleccionar), Core_Script.html
                 (window.PostFull.obtener), Iconos.html
                 (window.pintarGlifos), Lista_CSS.html,
                 Compartir_Script.html (#btnCompartir)
════════════════════════════════════════════════════════════════════*/

