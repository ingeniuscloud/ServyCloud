/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Global_Menu_Script.html
ESPEJO GITHUB:   js/Global_Menu_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
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
VERSIÓN:         1.4
CAMBIOS:         R64: tocar "Instalar la app" SIEMPRE abre la
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

