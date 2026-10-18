/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Core_Script.html
ESPEJO GITHUB:   js/Core_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Núcleo de la página. El CTA decide entre abrir
                 WhatsApp o el sheet de reserva.
                 CacheL2: persistencia del catálogo y de los
                 detalles en localStorage del dispositivo. La
                 reapertura de la app pinta AL INSTANTE desde disco
                 y la red valida por detrás (stale-while-revalidate:
                 las mismas peticiones que antes, 0 cuotas nuevas).
                 Arranque en orden original:
                   1. cargarTablas() (POST · todos los posts)
                   2. Cuando llega → inyectarLienzo() →
                      arrancarComponentes() con datos ya cargados
                 Primer arranque sin ciudad:
                   · POST arranca en paralelo con el sheet.
                   · Cuando el usuario elige, repintar SINCRÓNICO
                     si los datos ya llegaron. Si NO llegaron,
                     mostrar skeleton de lista y esperar.
                 Cambio de ciudad posterior:
                   · Repintar sincrónico. Instantáneo.
VERSIÓN:         1.19
CAMBIOS:         R64: el skeleton de lista replica la anatomía
                 LIMPIA del item (título + partner + estrella —
                 sin la fila del subtítulo ni la divisoria
                 interna, muertas con el item viejo).
                 R63: (1) 'ciudad:change' cae al chip de SERVICIOS
                 por defecto (Chips.resetearVista — orden del
                 dueño: Irapa sin cursos no puede dejar la lista
                 vacía, y el retorno a Güiria ya no aterriza en
                 cursos); (2) pintarTituloHeader() acepta el
                 VECTOR aunque la hoja lo guarde como TEXTO con
                 formato JSON (parse defensivo): la frase al azar
                 de cada carga ya no depende de cómo lo guarde el
                 Setup (el dueño lo veía repetido).
                 R61: el PLACEHOLDER del buscador se pinta desde
                 la BD real (SISTEMA.root →
                 app.placeholderBuscar; si la BD no lo trae queda
                 el fijo de la app) — se deja de hardcodear el
                 texto en el markup.
                 R58: pantalla principal refactorizada — el
                 TÍTULO INICIAL grande se pinta desde la BD real
                 (SISTEMA.root → app.tituloHeader). El fondo del
                 lienzo #fdf3ec (R57) queda EXACTO.
DEPENDENCIAS:    Global_Script.html (postBackend), Index.html
                 (#canvas-content, #tituloHeader, SISTEMA, TABLAS,
                 TOKEN, URL_EXEC),
                 Telefono.html (#lienzo), Ciudad_Sheet_Script.html,
                 Chips_Script.html, Buscar_Script.html,
                 Promo_Script.html, Social_Script.html,
                 Global_Menu_Script.html (window.Global), Lista_Script.html,
                 Seccion_Script.html, Comenta_Script.html,
                 Compartir_Script.html (recibir/pintar)
════════════════════════════════════════════════════════════════════*/

