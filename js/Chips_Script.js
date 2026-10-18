/*════════════════════════════════════════════════════════════════════
ARCHIVO:         Chips_Script.html
ESPEJO GITHUB:   js/Chips_Script.js (subir a GitHub Pages; editar en GAS y pagar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Lógica del menú de chips. Genera los chips desde
                 window.SISTEMA.chips ({ idChip, titulo, estado })
                 como BOTONES INDEPENDIENTES, cada uno con su
                 icono (glifos servicio/cursos de Iconos,
                 resueltos por el titulo/idChip). Filtra los que
                 tengan estado === false. Al arrancar restaura el
                 chip guardado en localStorage (app_vista) o cae a
                 default (chip 1). Al cambiar de chip emite
                 'chips:change' con { idChip } para que Lista
                 reaccione. La ciudad vive fuera de los chips, en
                 Ciudad_Sheet_Script. R63: resetearVista() — cada
                 cambio de ciudad cae al chip de SERVICIOS por
                 defecto (orden del dueño: Irapa sin cursos no
                 puede dejar la lista vacía).
VERSIÓN:         1.4
CAMBIOS:         R64: FUERA los números de items (orden del
                 dueño): mueren contarItems(),
                 actualizarContadores() y su listener de
                 'ciudad:change' — los chips quedan solo con su
                 icono y su texto.
                 R63: entra resetearVista() (y chipServicio(),
                 que resuelve el id del chip servicio por su
                 texto/idChip, sin hardcodear ids): escribe la
                 vista guardada con el chip servicio para que la
                 restauración no reviva el chip anterior; si los
                 botones ya están pintados, activa y emite
                 chips:change. Core_Script lo llama en
                 'ciudad:change'.
                 R62: cada chip lleva ICONO — glifoDeChip()
                 resuelve el glifo (servicio / cursos) por el
                 titulo y el idChip (sin svg hardcodeado: los
                 glifos viven en Iconos).
                 R37: encabezado simplificado — solo queda lo
                 vigente en el código (política del dueño: lo
                 eliminado ya no se menciona).
DEPENDENCIAS:    Index.html (inyección window.SISTEMA vía 00 DoGet.gs)
════════════════════════════════════════════════════════════════════*/

