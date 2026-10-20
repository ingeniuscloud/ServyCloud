/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Telefono.html
ESPEJO GITHUB:   github/js/Telefono.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Shell visual del iPhone 11 con reloj dinámico en la
                 barra de estado (formato 12h, se actualiza cada
                 segundo). Barras superior e inferior en blanco
                 #ffffff (igual que el menú tabs). NO define colores
                 del área de trabajo.
VERSIÓN:         1.2
CAMBIOS:         R53: entra la shell del dueño TAL CUAL (Regla de
                 Oro): cuerpo a 242.39 mm para más aire vertical del
                 lienzo, carcasa sin sombra, barra de estado con la
                 pila tipográfica del sistema, barra de Safari en
                 blanco con bordes finos #e5e5ea (botones y cápsula),
                 iconos grises #8e8e93 de trazo fino, icono de tres
                 puntos a la derecha, URL real del proyecto en la
                 cápsula y reloj dinámico 12h (#reloj-estado).
                 Encabezado actualizado (solo info vigente).
DEPENDENCIAS:    Ninguna (shell visual; #lienzo es consumido por
                 Core_Script.html y estilizado en modo móvil por
                 Core_CSS.html). El reloj solo escribe en
                 #reloj-estado.
════════════════════════════════════════════════════════════════════*/

  (function() {
    function actualizarHora() {
      var ahora = new Date();
      var horas = ahora.getHours();
      var minutos = ahora.getMinutes();

      // Convertir a formato de 12 horas (1 a 12)
      horas = horas % 12;
      horas = horas ? horas : 12; // Si es 0 (medianoche), mostrar 12

      // Formatear a 2 dígitos (ej. 9:05 -> 09:05)
      horas = horas < 10 ? '0' + horas : horas;
      minutos = minutos < 10 ? '0' + minutos : minutos;

      var reloj = document.getElementById('reloj-estado');
      if (reloj) {
        reloj.textContent = horas + ':' + minutos;
      }
    }

    // Ejecutar al cargar
    actualizarHora();

    // Actualizar cada segundo para mantener la precisión
    setInterval(actualizarHora, 1000);
  })();