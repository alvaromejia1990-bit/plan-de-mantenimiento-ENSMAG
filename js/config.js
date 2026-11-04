/*
 * Configuración del Portal de Mantenimiento ENSMA
 * ------------------------------------------------
 * modo: "local"    → los registros se guardan solo en el navegador de quien usa el portal.
 *                    Sirve para pruebas y demostraciones. No se comparten entre equipos.
 * modo: "firebase" → los registros se guardan en Cloud Firestore (Firebase) y los ve
 *                    todo el comité. Requiere iniciar sesión con una cuenta de Google.
 *
 * Para pasar a "firebase", siga el README.md (sección "Conectar Firebase") y pegue aquí
 * el objeto de configuración que entrega la consola de Firebase.
 */
window.PORTAL_CONFIG = {
  modo: "local",

  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },

  // Dominio de correo institucional permitido (sin @). Ejemplo: "ensmagirardot.edu.co".
  // Déjelo vacío para permitir cualquier cuenta de Google. La restricción real
  // se aplica en las reglas de Firestore (archivo firestore.rules).
  dominioPermitido: "",
};
