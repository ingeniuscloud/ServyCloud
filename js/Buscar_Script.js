/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Buscar_Script.html
ESPEJO GITHUB:   js/Buscar_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Campo de búsqueda (R64): vive EXPANDIDO de una
                 vez en la FILA 1 de la sección de filtros (sin
                 estados de apertura — la lupa-botón, la cápsula
                 que se desplegaba y el texto CANCELAR murieron).
                 Al escribir emite 'buscar:change' con el término
                 y el flag de límite alcanzado, y enciende la X
                 circular naranja (.con-texto en la cápsula) que
                 limpia el campo: en búsqueda normal borra y
                 re-pinta la lista del chip (si hay un post activo
                 de cross-sell, restaura SU chip como siempre);
                 en modo compartido delega en Compartir.limpiar()
                 (el trabajo que hacía CANCELAR — libera la
                 vista). Límite: 40 chars.
VERSIÓN:         2.0
CAMBIOS:         R64: el campo NO se abre ni se cierra (siempre
                 visible) — fuera abrir()/cerrar()/abrir capsula,
                 la lupa-botón (#btnBuscar) y el texto CANCELAR
                 (#btnCancelarBusqueda) con el evento
                 'buscar:estado' (nadie lo consume ya); entra la
                 X (#btnLimpiarCampo): aparece al escribir y
                 limpia el campo — en modo compartido libera la
                 vista (mismo trabajo de siempre).
                 R61: el placeholder lo pinta Core_Script desde
                 app.placeholderBuscar.
                 R60: la lupa volvía como botón y abría la
                 cápsula.
                 R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (estructura .filtros-fila),
                 Chips_Script.html (window.Chips), Lista_Script.html
                 (window.Lista.getPostActivo),
                 Compartir_Script.html (estaCompartido/limpiar)
════════════════════════════════════════════════════════════════════*/

