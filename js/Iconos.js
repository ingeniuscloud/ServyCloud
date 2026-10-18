/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Iconos.html
ESPEJO GITHUB:   js/Iconos.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Depósito de glifos SVG inline. Expone IMAGENES
                 (data URLs) y la función global pintarGlifos(root)
                 que inyecta el SVG en la raíz recibida —si ella
                 misma porta [data-glifo]— y en todo descendiente
                 con [data-glifo="clave"]. Al cargar el DOM, pinta
                 todos los data-glifo del documento automáticamente.

                 Catálogo: 26 glifos EN USO confirmado.
VERSIÓN:         1.7
CAMBIOS:         R62: entran servicio y cursos (iconos de los
                 chips de la vidriera) y filtro (el botón de
                 filtros de la fila: 3 líneas verticales con su
                 deslizador, diseño del dueño; #btnFiltro lo
                 llama con data-glifo — fuera el svg hardcodeado
                 de Index). Salen vistaLista y vistaMiniatura
                 (la fila "Explorar" y sus tipos de vista se
                 eliminaron en esta misma ronda) y flechaAcordeon
                 (su último consumidor era el chevron del botón
                 ciudad, retirado también en R62).
                 R58: glifo verificado — círculo relleno en
                 currentColor con palomita blanca; vive junto al
                 nombre del partner en el item de la lista
                 (Lista_Script lo llama con data-glifo).
                 R55: glifos estrella (métrica pasiva de
                 validación del item de la lista, gris) y
                 flechaVer (flecha derecha del texto "Ver
                 detalles", trazo fino en currentColor).
DEPENDENCIAS:    Ninguna (window.pintarGlifos es consumido por
                 Global_Script.html, Social_Script.html,
                 Reserva_Script.html y Comenta_* vía DOM)
════════════════════════════════════════════════════════════════════
*/
  const IMAGENES = {

    /* ============================================================
       ICONOS EN USO CONFIRMADO (26)
       ============================================================ */

    /* ---------- Navegación ---------- */
    flecha:         "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23FFFFFF%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2012h15%22%2F%3E%3Cpath%20d%3D%22m13%206%206%206-6%206%22%2F%3E%3C%2Fsvg%3E",
    flechaVer:      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2012h15%22%2F%3E%3Cpath%20d%3D%22m13%206%206%206-6%206%22%2F%3E%3C%2Fsvg%3E",

    /* ---------- Chips de la vidriera y filtros (R62) ---------- */
    servicio:       "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M14.7%206.3a1%201%200%200%200%200%201.4l1.6%201.6a1%201%200%200%200%201.4%200l3.77-3.77a6%206%200%200%201-7.94%207.94l-6.91%206.91a2.12%202.12%200%200%201-3-3l6.91-6.91a6%206%200%200%201%207.94-7.94l-3.76%203.76z%22%2F%3E%3C%2Fsvg%3E",
    cursos:         "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M2%203h6a4%204%200%200%201%204%204v14a3%203%200%200%200-3-3H2z%22%2F%3E%3Cpath%20d%3D%22M22%203h-6a4%204%200%200%200-4%204v14a3%203%200%200%201%203-3h7z%22%2F%3E%3C%2Fsvg%3E",
    filtro:         "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cline%20x1%3D%224%22%20y1%3D%2221%22%20x2%3D%224%22%20y2%3D%2214%22%2F%3E%3Cline%20x1%3D%224%22%20y1%3D%2210%22%20x2%3D%224%22%20y2%3D%223%22%2F%3E%3Ccircle%20cx%3D%224%22%20cy%3D%2212%22%20r%3D%222%22%20fill%3D%22currentColor%22%20stroke%3D%22none%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%2221%22%20x2%3D%2212%22%20y2%3D%2212%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%228%22%20x2%3D%2212%22%20y2%3D%223%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2210%22%20r%3D%222%22%20fill%3D%22currentColor%22%20stroke%3D%22none%22%2F%3E%3Cline%20x1%3D%2220%22%20y1%3D%2221%22%20x2%3D%2220%22%20y2%3D%2216%22%2F%3E%3Cline%20x1%3D%2220%22%20y1%3D%2212%22%20x2%3D%2220%22%20y2%3D%223%22%2F%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2214%22%20r%3D%222%22%20fill%3D%22currentColor%22%20stroke%3D%22none%22%2F%3E%3C%2Fsvg%3E",

    /* ---------- Contacto y redes ---------- */
    whatsapp:       "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M17.472%2014.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94%201.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198%200-.52.074-.792.372-.272.297-1.04%201.016-1.04%202.479%200%201.462%201.065%202.875%201.213%203.074.149.198%202.096%203.2%205.077%204.487.709.306%201.262.489%201.694.625.712.227%201.36.195%201.871.118.571-.085%201.758-.719%202.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421%207.403h-.004a9.87%209.87%200%2001-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86%209.86%200%2001-1.51-5.26c.001-5.45%204.436-9.884%209.888-9.884%202.64%200%205.122%201.03%206.988%202.898a9.825%209.825%200%20012.893%206.994c-.003%205.45-4.437%209.884-9.885%209.884m8.413-18.297A11.815%2011.815%200%200012.05%200C5.495%200%20.16%205.335.157%2011.892c0%202.096.547%204.142%201.588%205.945L.057%2024l6.305-1.654a11.882%2011.882%200%20005.683%201.448h.005c6.554%200%2011.89-5.335%2011.893-11.893a11.821%2011.821%200%2000-3.48-8.413z%22/%3E%3C/svg%3E",
    ubicacion:      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2022s8-7%208-13a8%208%200%200%200-16%200c0%206%208%2013%208%2013z%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%229%22%20r%3D%223%22%2F%3E%3C%2Fsvg%3E",
    userPlus:       "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M16%2021v-2a4%204%200%200%200-4-4H6a4%204%200%200%200-4%204v2%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%227%22%20r%3D%224%22%2F%3E%3Cline%20x1%3D%2220%22%20y1%3D%228%22%20x2%3D%2220%22%20y2%3D%2214%22%2F%3E%3Cline%20x1%3D%2223%22%20y1%3D%2211%22%20x2%3D%2217%22%20y2%3D%2211%22%2F%3E%3C%2Fsvg%3E",

    /* ---------- Cursos y secciones ---------- */
    reloj:          "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%2F%3E%3Cpolyline%20points%3D%2212%206%2012%2012%2016%2014%22%2F%3E%3C%2Fsvg%3E",
    calendario:     "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%224%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Cpath%20d%3D%22M16%202v4%22%2F%3E%3Cpath%20d%3D%22M8%202v4%22%2F%3E%3Cpath%20d%3D%22M3%2010h18%22%2F%3E%3C%2Fsvg%3E",

    /* ---------- Beneficios (íconos default + In Company) ---------- */
    code:           "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%2216%2018%2022%2012%2016%206%22%2F%3E%3Cpolyline%20points%3D%228%206%202%2012%208%2018%22%2F%3E%3C%2Fsvg%3E",
    user:           "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%2021v-2a4%204%200%200%200-4-4H8a4%204%200%200%200-4%204v2%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%227%22%20r%3D%224%22%2F%3E%3C%2Fsvg%3E",
    monitor:        "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%222%22%20y%3D%223%22%20width%3D%2220%22%20height%3D%2214%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Cline%20x1%3D%228%22%20y1%3D%2221%22%20x2%3D%2216%22%20y2%3D%2221%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%2217%22%20x2%3D%2212%22%20y2%3D%2221%22%2F%3E%3C%2Fsvg%3E",
    badgeCheck:     "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.85%208.62a4%204%200%200%201%204.78-4.77%204%204%200%200%201%206.74%200%204%204%200%200%201%204.78%204.78%204%204%200%200%201%200%206.74%204%204%200%200%201-4.77%204.78%204%204%200%200%201-6.75%200%204%204%200%200%201-4.78-4.77%204%204%200%200%201%200-6.76Z%22%2F%3E%3Cpath%20d%3D%22m9%2012%202%202%204-4%22%2F%3E%3C%2Fsvg%3E",
    book:           "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2019.5A2.5%202.5%200%200%201%206.5%2017H20%22%2F%3E%3Cpath%20d%3D%22M4%204.5A2.5%202.5%200%200%201%206.5%202H20v20H6.5A2.5%202.5%200%200%201%204%2019.5v-15z%22%2F%3E%3C%2Fsvg%3E",
    building:       "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%2022V4a2%202%200%200%201%202-2h8a2%202%200%200%201%202%202v18%22%2F%3E%3Cpath%20d%3D%22M2%2022h20%22%2F%3E%3Cpath%20d%3D%22M10%206h4%22%2F%3E%3Cpath%20d%3D%22M10%2010h4%22%2F%3E%3Cpath%20d%3D%22M10%2014h4%22%2F%3E%3Cpath%20d%3D%22M10%2018h4%22%2F%3E%3C%2Fsvg%3E",

    /* ---------- Menú global, legal y promo ---------- */
    cookie:         "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%202a10%2010%200%201%200%2010%2010%209%209%200%200%201-9-9%2010%2010%200%200%200-1-1z%22%2F%3E%3Ccircle%20cx%3D%228%22%20cy%3D%2214%22%20r%3D%221%22%20fill%3D%22currentColor%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2217%22%20r%3D%221%22%20fill%3D%22currentColor%22%2F%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2213%22%20r%3D%221%22%20fill%3D%22currentColor%22%2F%3E%3C%2Fsvg%3E",
    download:       "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M21%2015v4a2%202%200%200%201-2%202H5a2%202%200%200%201-2-2v-4%22%2F%3E%3Cpolyline%20points%3D%227%2010%2012%2015%2017%2010%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%2215%22%20x2%3D%2212%22%20y2%3D%223%22%2F%3E%3C%2Fsvg%3E",
    info:           "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%2F%3E%3Cpath%20d%3D%22M12%2016v-4%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%228%22%20r%3D%220.6%22%20fill%3D%22currentColor%22%2F%3E%3C%2Fsvg%3E",
    candado:        "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20width%3D%2218%22%20height%3D%2211%22%20x%3D%223%22%20y%3D%2211%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Cpath%20d%3D%22M7%2011V7a5%205%200%200%201%2010%200v4%22%2F%3E%3C%2Fsvg%3E",
    campana:        "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%208a6%206%200%200%201%2012%200c0%207%203%209%203%209H3s3-2%203-9%22%2F%3E%3Cpath%20d%3D%22M10.3%2021a1.94%201.94%200%200%200%203.4%200%22%2F%3E%3C%2Fsvg%3E",

    /* ---------- Social (like / estrella / comment / share) ---------- */
    estrella:       "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M12%2017.27%2018.18%2021l-1.64-7.03L22%209.24l-7.19-.61L12%202%209.19%208.63%202%209.24l5.46%204.73L5.82%2021z%22/%3E%3C/svg%3E",
    verificado:     "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20fill%3D%22currentColor%22%2F%3E%3Cpath%20d%3D%22m8.4%2012.3%202.3%202.3%204.9-5%22%20fill%3D%22none%22%20stroke%3D%22%23FFFFFF%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C/svg%3E",
    like:           "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M20.84%204.61a5.5%205.5%200%200%200-7.78%200L12%205.67l-1.06-1.06a5.5%205.5%200%200%200-7.78%207.78l1.06%201.06L12%2021.23l7.78-7.78%201.06-1.06a5.5%205.5%200%200%200%200-7.78z%22%2F%3E%3C%2Fsvg%3E",
    comment:        "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M21%2011.5a8.38%208.38%200%200%201-.9%203.8%208.5%208.5%200%200%201-7.6%204.7%208.38%208.38%200%200%201-3.8-.9L3%2021l1.9-5.7a8.38%208.38%200%200%201-.9-3.8%208.5%208.5%200%200%201%204.7-7.6%208.38%208.38%200%200%201%203.8-.9h.5a8.48%208.48%200%200%201%208%208v.5z%22%2F%3E%3C%2Fsvg%3E",
    share:          "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%2032%2032%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M%2030%2014%20L%2017%202%20L%2017%208%20C%207%208%202%2015%202%2029%20C%207%2020%2012%2018%2017%2018%20L%2017%2025%20Z%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E"

  };

  /* ============================================================
     PINTAR GLIFOS
     ============================================================ */
  function pintarUno(el) {
    if (el.dataset.glifoPintado === '1') return;

    var clave = el.getAttribute('data-glifo');
    var valor = IMAGENES[clave];
    if (!valor) return;

    var svgString = valor;
    if (valor.indexOf('data:image/svg+xml,') === 0) {
      try {
        svgString = decodeURIComponent(valor.substring(19));
      } catch (err) {
        svgString = '';
      }
    }

    if (svgString) {
      el.innerHTML = svgString;
      el.dataset.glifoPintado = '1';
    }
  }

  function pintarGlifos(root) {
    root = root || document;

    /* La raíz también puede ser la portadora del glifo
       (querySelectorAll solo mira descendientes). */
    if (root.nodeType === 1 && root.hasAttribute('data-glifo')) {
      pintarUno(root);
    }

    var nodos = root.querySelectorAll('[data-glifo]');
    for (var i = 0; i < nodos.length; i++) {
      pintarUno(nodos[i]);
    }
  }

  window.pintarGlifos = pintarGlifos;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      pintarGlifos();
    });
  } else {
    pintarGlifos();
  }
