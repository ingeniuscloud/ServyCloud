<!--
════════════════════════════════════════════════════════════════════
ARCHIVO:         README.md (repositorio GitHub Pages)
PROYECTO:        ServyCloud | App en GitHub Pages
RESPONSABILIDAD: Mapa del repositorio de producción y guía de
                 mantenimiento para el dueño.
VERSIÓN:         3.0
CAMBIOS:         R29: el repositorio pasa de 1 archivo (monolito)
                 a APP MULTI-ARCHIVO con nombres espejo de GAS
                 (css/ + js/). Iconos nuevos: "Servy" en cursiva.
                 v2.0/v1.x: envoltorio y app única (historia).
DEPENDENCIAS:    Todos los archivos de esta carpeta.
════════════════════════════════════════════════════════════════════
-->

# ServyCloud 🚀

> **La aplicación:** [Ir a la App](https://ingeniuscloud.github.io)

App **multi-archivo** en GitHub Pages (R29): la misma cocina de Apps
Script, servida como archivos independientes. **Los nombres son espejo
de GAS**: lo que pruebas en GAS se paga en el archivo gemelo de GitHub.

---

## Contenido del repositorio

**En la raíz (6):**

| Archivo         | Qué es |
|-----------------|--------|
| `index.html`    | Estructura de la página (espejo del `Index.html` de GAS) + GA4 + píldora instalar + `URL_EXEC` |
| `manifest.json` | Identidad de instalación: **ServyCloud / Servy** |
| `sw.js`         | Service worker de paso puro (instalabilidad; no guarda caché) |
| `icon-192.png`  | Icono PWA 192×192 — **"Servy" en cursiva** + Cloud + logo S sobre naranja |
| `icon-512.png`  | Icono PWA 512×512 (mismo arte) |
| `README.md`     | Este archivo |

**Carpeta `css/` (14):** los 13 estilos de GAS (Core_CSS, Chips_CSS,
Ciudad_Sheet_CSS, Seccion_CSS, Seccion_Imagen_CSS, Promo_CSS,
Social_CSS, Comenta_CSS, Global_CSS, Reserva_CSS, Reserva_Exito_CSS,
Lista_CSS, Partner_Sheet_CSS) + `GitHub_Cromo.css` (preloader y
píldora, solo-GitHub).

**Carpeta `js/` (21):** los 19 scripts de GAS (Global_Script,
Global_Menu_Script, Chips_Script, Buscar_Script, Lista_Script,
Seccion_Imagen_Script, Seccion_Script, Promo_Script, Social_Script,
Comenta_Script, Reserva_Valida_Script, Reserva_Sheet_Script,
Reserva_OTP_Script, Reserva_Dato_Script, Reserva_Exito_Script,
Reserva_Script, Partner_Sheet_Script, Ciudad_Sheet_Script,
Core_Script) + `Iconos.js` + `GitHub_Cromo.js` (puente local,
sesión→ciudad y registro del SW; solo-GitHub, cargar SIEMPRE último).

`Telefono.html` (el marco del iPhone) viaja **dentro** de `index.html`
porque es HTML del cuerpo, no un archivo css/js.

---

## Procedimiento del dueño (probar en GAS → pagar en GitHub)

1. Editas el archivo en **Apps Script** y pruebas (tu práctica de
   siempre).
2. Si queda bien, abres el **gemelo** en GitHub: `Global_CSS.html` →
   `css/Global_CSS.css` · `Core_Script.html` → `js/Core_Script.js`.
3. Pegas el **contenido interior** del fragmento (lo que está dentro
   del envoltorio de estilo o de script; el encabezado ya vive como
   comentario en el archivo de GitHub).
4. Commit. Los cambios tardan ~10 minutos en propagarse (caché de
   GitHub Pages, igual que siempre).

**Excepciones:**
- `URL_EXEC` (la URL del motor GAS) se cambia en `index.html`, una
  sola línea al inicio del cuerpo.
- `GitHub_Cromo.css` / `GitHub_Cromo.js` / `manifest.json` / `sw.js`:
  no existen en GAS; rara vez se tocan.

---

## Publicar (primera vez o migración desde el monolito)

1. Subir **TODA esta carpeta a la raíz** del repositorio (el nuevo
   `index.html` reemplaza al monolito; se añaden `css/` y `js/`).
2. Settings → Pages: *Deploy from a branch* → `main` / `(root)`.
3. Esperar ~1 minuto y abrir la URL. Listo.

Todos los enlaces son relativos: funciona igual en sitio de usuario
que en sitio de proyecto.

---

## Instalar en el teléfono (Android)

- Entrar al sitio **2 veces**; desde la 2ª, abajo a la izquierda
  aparece la píldora **"Instalar app"** (calla 3 días si se cierra).
- En iPhone no aparece: Safari no permite instalar por código
  (decisión del dueño).

### Si Google Play Protect muestra un aviso al instalar

*"Se bloqueó la app no segura…"*: lo provoca el **WebAPK** que fabrica
el navegador, no este repositorio. Es seguro pulsar **"Instalar de
todas formas"**: el paquete no lleva código nativo ni permisos. Para
evitarlo, instalar desde **Chrome actualizado** en vez de Samsung
Internet.

---

## Mantenimiento

| Quiero…                        | Dónde se cambia |
|--------------------------------|-----------------|
| Cambiar un estilo              | Su archivo en `css/` (mismo nombre que en GAS) |
| Cambiar lógica de la app       | Su archivo en `js/` (mismo nombre que en GAS) |
| Cambiar la URL del motor GAS   | `index.html` → línea `window.URL_EXEC` |
| Cambiar nombre de instalación  | `manifest.json` → `name` / `short_name` |
| Cambiar los iconos             | Reemplazar `icon-192.png` / `icon-512.png` (mismos nombres y medidas) |

Notas:

- `js/Core_Script.js` debe quedar **último** y `js/GitHub_Cromo.js`
  siempre al final de todos (el orden del `index.html` ya lo cuida).
- El nombre y el icono de la app **ya instalada** quedan congelados:
  para verlos nuevos, desinstalar y reinstalar.
- Respaldo del monolito: `Index_GitHub.html` v4.1 queda en el centro
  de descargas por si algún día hay que volver atrás.
