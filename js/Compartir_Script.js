/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Compartir_Script.html
ESPEJO GITHUB:   js/Compartir_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Compartir por enlace. Dos emisores:
                 (1) POST — Social pide Compartir.urlDePost(post) y
                 su mensaje de WhatsApp lleva el enlace profundo;
                 (2) LISTA FILTRADA — el TEXTO "Compartir lista
                 filtrada" sobre la lista (R64: vive en el respiro
                 entre filtros y items; Lista_Script decide su
                 visibilidad con los items) comparte el filtro
                 visible: término de búsqueda O chip activo, más
                 la ciudad.
                 El enlace viaja en UN parámetro corto ?s= con el
                 payload compacto y OFUSCADO (XOR con clave
                 embebida + base64url): el ID del post o el
                 término NUNCA van planos en la URL. Los enlaces
                 antiguos ?d= (AES-256-GCM) siguen abriendo.
                 Receptor: Core llama
                 Compartir.recibir() cuando TABLAS cargó y el lienzo
                 está inyectado; se aplica ciudad + contenido y la
                 app entra en MODO COMPARTIDO: ciudad VISTA pero
                 BLOQUEADA, campo de búsqueda fijado SIN foco y la
                 X del campo libera la vista (sin menú global ni
                 compartir). El header del detalle lo decide el
                 TIPO de enlace (esta ronda marca el body): con UN
                 post la fila sustituye al par volver/título del
                 modo detalle y la salida es la X; con
                 una LISTA cada post abre con volver/título normales
                 para recorrer los demás posts del filtro, y
                 la X queda en la lista. Al limpiar
                 vuelve todo el catálogo (la ciudad del enlace queda
                 como la del receptor). Aviso amable si el contenido
                 compartido ya no existe. La instalación de la PWA
                 NO cambia: se hace desde la app con el enlace
                 principal (menú / píldora), nunca desde el enlace
                 compartido.
VERSIÓN:         2.1
CAMBIOS:         R64: la visibilidad del botón la lleva
                 Lista_Script (lo enciende con items en la
                 lista) — FUERA los listeners 'buscar:estado' y
                 'buscar:resultados'; el enlace de LISTA admite
                 compartir por CHIP sin término (payload
                 'l·ciudad·q·chip' con '-' como término vacío;
                 los de 2 partes antiguos siguen abriendo): si el
                 enlace trae término se filtra como siempre, y si
                 trae chip se selecciona el chip en el receptor.
                 La X del campo libera la vista (el trabajo que
                 hacía CANCELAR).
                 R61: el emisor de LISTA FILTRADA es el TEXTO
                 "Compartir lista filtrada" (el estilo lo viste
                 Chips_CSS). El modo compartido lo retira con
                 body.modo-compartido.
                 R43: lista compartida — activarModo marca el body
                 con compartido-lista / compartido-post y limpiar
                 los retira; con eso Chips_CSS devuelve el par
                 volver/título dentro de cada post de una lista
                 compartida (el receptor puede verlos todos y
                 regresar). El post compartido solitario queda
                 exactamente igual: la fila con la X es su
                 salida. Enlace corto ?s=, receptor legacy ?d= y
                 línea de confianza intactos.
DEPENDENCIAS:    Index.html (estructura .filtros-wrap, SISTEMA,
                 TABLAS), Lista_Script.html (TABLAS.posts,
                 visibilidad de #btnCompartir),
                 Ciudad_Sheet_Script.html (getActual, getLista,
                 aplicarGuardada), Chips_Script.html (chips:change,
                 getChipActivo, seleccionar),
                 Seccion_Script.html (irAPost público),
                 Core_Script.html (llama pintar/recibir),
                 Social_Script.html (urlDePost), Chips_CSS.html
                 (.btn-compartir / .compartida)
════════════════════════════════════════════════════════════════════*/

