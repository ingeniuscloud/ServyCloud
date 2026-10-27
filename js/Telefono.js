/*════════════════════════════════════════════════════════════════════

ARCHIVO:         Telefono.html
ESPEJO GITHUB:   github/js/Telefono.js (subir a GitHub Pages; editar en GAS y pegar el contenido)
PROYECTO:        INGeniusCloud | ServyCloud
RESPONSABILIDAD: Shell visual del iPhone 11 con reloj dinámico en la
                 barra de estado (formato 12h, se actualiza cada
                 segundo). Barras superior e inferior en blanco
                 #ffffff (igual que el menú tabs). NO define colores
                 del área de trabajo.
VERSIÓN:         1.3
CAMBIOS:         R131: sin cambios de código — solo simplificación del encabezado (el historial de rondas previas vive en la bitácora y en versiones/).
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
