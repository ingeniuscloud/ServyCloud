/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Iconos.html
ESPEJO GITHUB:   js/Iconos.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Depósito de glifos SVG inline. Expone IMAGENES
                 (data URLs) y la función global pintarGlifos(root)
                 que inyecta el SVG en la raíz recibida —si ella
                 misma porta [data-glifo]— y en todo descendiente
                 con [data-glifo="clave"]. Al cargar el DOM, pinta
                 todos los data-glifo del documento automáticamente.

                 Catálogo: 27 glifos EN USO confirmado.
VERSIÓN:         1.9
CAMBIOS:         R64: FUERA campana (su consumidor, la campanita
                 de la promo card, murió en R62 — nadie la llama);
                 verificado cambió de consumidor: ahora viste el
                 banner "app ya instalada" de la ayuda de
                 instalación (el check verde del item de la lista
                 se retiró en esta ronda) y download acompaña al
                 botón manual "Instalar la app" del mismo módulo.
                 building se RESERVA (consumible declarado por la
                 hoja en beneficios; no hay consumidor fijo en
                 código).
                 R63: entran android y apple (las pestañas de la
                 ayuda de instalación del menú global — el dueño
                 pidió la guía en sus 2 versiones).
                 R62: entran servicio y cursos (iconos de los
                 chips de la vidriera) y filtro (el botón de
                 filtros: 3 líneas verticales con su deslizador,
                 diseño del dueño; #btnFiltro lo llama con
                 data-glifo — fuera el svg hardcodeado de Index).
                 Salen vistaLista y vistaMiniatura (la fila
                 "Explorar" y sus tipos de vista se eliminaron en
                 esa ronda) y flechaAcordeon (su último consumidor
                 era el chevron del botón ciudad, retirado
                 también en R62).
                 R58: glifo verificado — círculo relleno en
                 currentColor con palomita blanca.
                 R55: glifos estrella (métrica pasiva de
                 validación del item de la lista) y flechaVer
                 (flecha derecha del texto "Ver publicación",
                 trazo fino en currentColor).
DEPENDENCIAS:    Ninguna (window.pintarGlifos es consumido por
                 Global_Script.html, Social_Script.html,
                 Reserva_Script.html y Comenta_* vía DOM)
════════════════════════════════════════════════════════════════════*/

