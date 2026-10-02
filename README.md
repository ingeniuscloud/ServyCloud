# ServyCloud 🚀

> **Enlace de Cobertura:** [Ir a la Aplicación](https://servycloud.github.io)

Envoltorio de **app única** en GitHub Pages: carga el código GAS de
ServyCloud a pantalla completa (iframe), muestra un preloader orbital
mientras entra y ofrece el botón **"Instalar app"** en Android.

---

## Contenido del repositorio (6 archivos, en la raíz)

| Archivo         | Qué es |
|-----------------|--------|
| `index.html`    | El envoltorio (app única + preloader + botón instalar) |
| `manifest.json` | Identidad de instalación: **ServyCloud / Servy** |
| `sw.js`         | Service worker de paso puro (hace la página instalable, no guarda caché) |
| `icon-192.png`  | Icono PWA 192×192 (S blanca sobre azul, rompe el borde inferior) |
| `icon-512.png`  | Icono PWA 512×512 (mismo diseño) |
| `README.md`     | Este archivo |

---

## Publicar (repositorio gratuito de GitHub Pages)

1. Crear el repositorio y subir estos **6 archivos a la raíz** (rama `main`).
2. En **Settings → Pages**, elegir *Deploy from a branch* → `main` / `(root)`.
3. Esperar ~1 minuto y abrir la URL del sitio. Listo.

Todos los enlaces internos son relativos, así que funciona igual en un
sitio de usuario (`servycloud.github.io`) que en un sitio de proyecto
(`servycloud.github.io/nombre-del-repo/`).

---

## Instalar en el teléfono (Android)

- Entrar al sitio **2 veces** (la 1ª visita solo cuenta); desde la 2ª,
  abajo a la izquierda aparece la píldora **"Instalar app"**.
- Si ya se cerró la píldora, calla 3 días; también sirve el menú de
  Chrome: ⋮ → *Añadir a pantalla de inicio*.
- En iPhone la píldora no aparece: Safari no permite instalar por
  código (decisión del dueño).

### Si Google Play Protect muestra un aviso al instalar

*"Se bloqueó la app no segura… diseñada para una versión anterior de
Android"*: ese aviso lo provoca el **WebAPK** que fabrica el navegador
al instalar (su número de versión interna lo decide el navegador/servidor
de Google, no este repositorio). Para esta app es seguro pulsar
**"Instalar de todas formas"**: el paquete no lleva código nativo ni
permisos, solo abre este sitio a pantalla completa. Para evitarlo:
instalar desde **Chrome actualizado** en vez de Samsung Internet.

---

## Mantenimiento

| Quiero…                       | Dónde se cambia |
|-------------------------------|-----------------|
| Cambiar la URL del código GAS | `index.html` → constante `URL_SERVYCLOUD` (única línea) |
| Cambiar nombre de instalación | `manifest.json` → `name` (largo) y `short_name` (corto, ideal ≤10 letras) |
| Cambiar los iconos            | Reemplazar `icon-192.png` / `icon-512.png` (mismos nombres y medidas, PNG sin transparencia) |
| Texto del preloader / color de barras | `index.html` → constantes `TEXTO_CENTRAL_PRELOADER`, `ESTADO_PRELOADER`, `COLOR_BARRAS_APP` |

Notas:

- Los cambios tardan ~10 minutos en propagarse (caché de GitHub Pages).
- El nombre y el icono de la app **ya instalada** quedan congelados:
  para verlos nuevos hay que desinstalar y reinstalar.
- El preloader se retira cuando la app emite
  `postMessage({tipo:'app-lista'})`; si no avisa, hay fallback de 5 seg.
