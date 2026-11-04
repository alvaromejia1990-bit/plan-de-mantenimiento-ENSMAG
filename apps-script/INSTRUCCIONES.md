# Conectar el portal con Google Sheets (Apps Script)

Con este modo, **los usuarios y todos los formatos quedan guardados en una hoja de cálculo de Google** de la cuenta institucional, y **las fotos en una carpeta de Google Drive**. En el navegador no queda guardado ningún registro: solo se conserva el ingreso mientras la pestaña está abierta.

Tiempo estimado: 15 minutos. Se necesita una cuenta de Google; se recomienda una institucional o una creada solo para el portal (por ejemplo, `mantenimiento.ensmag@gmail.com`), no la personal.

---

## Paso 1. Crear la hoja de cálculo

1. Entre a <https://sheets.google.com> con la cuenta elegida.
2. Cree una hoja en blanco y llámela **Portal de Mantenimiento ENSMA**.
3. No la comparta todavía. Más adelante puede compartirla **solo como lector** con rectoría o el comité para consultar los datos.

## Paso 2. Pegar el código

1. En la hoja: **Extensiones → Apps Script**. Se abre el editor en otra pestaña.
2. Póngale nombre al proyecto (arriba a la izquierda): **Portal Mantenimiento ENSMA**.
3. En el archivo `Código.gs`, borre todo y pegue el contenido de **`apps-script/Code.gs`** de este repositorio. Guarde (ícono de disquete o Ctrl + S).
4. Engranaje **Configuración del proyecto** (menú izquierdo) → marque **Mostrar el archivo de manifiesto "appsscript.json" en el editor**.
5. Vuelva a **Editor** (`< >`), abra `appsscript.json`, borre todo y pegue el contenido de **`apps-script/appsscript.json`**. Guarde.

## Paso 3. Autorizar y preparar la hoja

1. En la barra superior del editor, en el selector de funciones, elija **`prepararHoja`** y pulse **Ejecutar**.
2. Aparece **Se requiere autorización** → **Revisar permisos** → elija la cuenta.
3. Si aparece "Google no verificó esta app": **Configuración avanzada → Ir a Portal Mantenimiento ENSMA (no seguro)**. Es normal: la app es suya y no está publicada para otros.
4. Pulse **Permitir**. El script pide acceso a esta hoja de cálculo y a Google Drive (para las fotos).
5. Vuelva a la hoja: aparecen las pestañas `usuarios`, `solicitudes`, `inspecciones`, `equipos`, `ordenes`, `bajas`, `optimizaciones` y `config`, y en Drive se crea la carpeta **Portal Mantenimiento ENSMA - Fotos**.

## Paso 4. Publicar como aplicación web

1. En el editor: **Implementar → Nueva implementación**.
2. En el engranaje de "Seleccionar tipo", elija **Aplicación web**.
3. Configure:
   - **Descripción**: Portal de mantenimiento v1
   - **Ejecutar como**: **Yo** (la cuenta dueña de la hoja)
   - **Quién tiene acceso**: **Cualquier persona**
4. Pulse **Implementar** y copie la **URL de la aplicación web**. Termina en `/exec`.

> "Cualquier persona" significa que el portal puede comunicarse con el script sin pedir cuenta de Google. Los datos siguen protegidos: el script solo responde a quien ingresó con usuario, contraseña y rol válidos, y aplica en el servidor los permisos de cada rol.

## Paso 5. Conectar el portal en GitHub

En el repositorio, edite **`js/config.js`** (ícono de lápiz) y deje:

```js
window.PORTAL_CONFIG = {
  modo: "google",

  // URL de la aplicación web de Google Apps Script (termina en /exec)
  urlAppsScript: "https://script.google.com/macros/s/XXXXXXXXXXXX/exec",
  ...
```

Guarde con **Commit changes** y espere 1 o 2 minutos a que GitHub Pages se actualice.

## Paso 6. Primer ingreso

1. Abra el portal. Aparece **Configuración inicial: cuenta del Rector**. Créela (solo se puede una vez).
2. Con esa cuenta, en **Usuarios y roles**, cree las cuentas del comité (PM_PCO) y de los docentes.
3. Compruebe en la hoja que aparecen las filas en `usuarios` y, al enviar un formato, en la pestaña correspondiente.

---

## Cómo se ven los datos en la hoja

- Cada pestaña es un formato y cada fila un registro, con una columna por campo (fecha, sede, espacio, descripción, estado…). Se puede filtrar, ordenar, hacer tablas dinámicas o descargar a Excel.
- Las fotos aparecen como enlaces a Google Drive.
- Las columnas ocultas (`_json` en los formatos; `sal` y `hash` en usuarios) las usa el portal. **No las edite ni borre.** Para corregir un registro, hágalo desde el portal.
- La pestaña `usuarios` guarda las contraseñas cifradas (no se pueden leer).

## Actualizar el código del script más adelante

Si se cambia `Code.gs`: pegue el código nuevo, guarde y vaya a **Implementar → Gestionar implementaciones → lápiz (Editar) → Versión: Nueva versión → Implementar**. Así la URL `/exec` no cambia y no hay que tocar `js/config.js`.

## Recomendaciones

- **Dueño de la hoja**: el portal funciona con la cuenta que implementó el script. Si esa persona sale de la institución, transfiera la propiedad de la hoja y vuelva a implementar con la nueva cuenta.
- **Respaldo**: Google Sheets guarda el historial de versiones (**Archivo → Historial de versiones**). Además, cada semestre descargue una copia (**Archivo → Descargar → Microsoft Excel**) y el reporte PDF del tablero.
- **Sesiones**: duran hasta 6 horas sin actividad y terminan al cerrar la pestaña.
- **Velocidad**: cada envío tarda de 1 a 3 segundos; los cambios de otros usuarios aparecen en unos 15 segundos.
- **Límites**: Apps Script atiende hasta 30 peticiones simultáneas por cuenta y una hoja admite hasta 10 millones de celdas; para el uso de una institución educativa es suficiente.
