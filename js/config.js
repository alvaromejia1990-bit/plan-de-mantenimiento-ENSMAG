/*
 * Configuración del Portal de Mantenimiento ENSMA
 * ------------------------------------------------
 * modo: "local"    → los registros se guardan solo en el navegador de quien usa el portal.
 *                    Sirve para pruebas y demostraciones. No se comparten entre equipos.
 * modo: "google"   → los registros y los usuarios se guardan en una hoja de cálculo de
 *                    Google Sheets por medio de Google Apps Script; las fotos, en Google Drive.
 *                    Pegue en urlAppsScript la URL de la aplicación web (ver apps-script/INSTRUCCIONES.md).
 * modo: "firebase" → los registros y los usuarios se guardan en Firebase (Firestore y
 *                    Authentication) y los comparte toda la institución.
 *
 * En todos los modos se ingresa con usuario y contraseña. La primera vez se crea la cuenta
 * del Rector, que luego crea las cuentas del comité (PM_PCO) y de los docentes.
 *
 * Para pasar a "firebase", siga el README.md (sección "Conectar Firebase") y pegue aquí
 * el objeto de configuración que entrega la consola de Firebase.
 */
window.PORTAL_CONFIG = {
  modo: "google",

  // URL de la aplicación web de Google Apps Script (termina en /exec)
  urlAppsScript: "https://script.google.com/macros/s/AKfycbxviVXeeJiIE7b0b8YQk5Q_7f7yI37hyZ5bBck5Ie3VlzESmQciafsFm0xqNBoGCgSL5g/exec",

  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },

};
