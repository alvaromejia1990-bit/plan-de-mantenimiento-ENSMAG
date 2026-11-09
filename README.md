# Portal de Mantenimiento ENSMA

Formatos en línea y tablero de seguimiento del **Plan de mantenimiento preventivo y correctivo** de la Institución Educativa Escuela Normal Superior María Auxiliadora de Girardot (Cundinamarca). El portal sigue la ruta de mejoramiento de la Guía 34 del MEN: autoevaluación, plan de mejoramiento y seguimiento.

## Qué incluye

| Sección | Para qué sirve |
| --- | --- |
| Tablero (inicio) | Indicadores, 7 gráficos con filtros por año, semestre, sede e infraestructura; reporte en PDF y exportación CSV |
| 1. Solicitud de mantenimiento | Reporte de daños con foto (mantenimiento correctivo) |
| 2. Ficha de inspección | Física (por tipo de espacio) y tecnológica (por equipo); los hallazgos en mal estado crean solicitudes |
| 3. Hoja de vida de equipo | Inventario y datos técnicos de cada equipo tecnológico |
| 4. Orden de trabajo y recibo | Trabajo realizado, costo, fuente de recursos, registro fotográfico y recibo a satisfacción |
| 5. Acta de baja de bienes | Propuesta de baja con concepto técnico y destino (gestor RAEE) |
| 6. Solicitud de optimización | Mejoras propuestas por las áreas académicas o el PFC, con la necesidad y su articulación pedagógica |
| 7. Registro consolidado | Prioridad, estado y días hábiles de cada solicitud según la matriz del plan |
| 8. Informes | Informe PDF por solicitud (solicitud, novedad, ejecución, entrega y fotos) y mensaje para el directivo encargado |

## Acceso por usuario, contraseña y rol

Cada vez que se abre la dirección del portal se pide **correo electrónico, contraseña y rol**, con la opción "Mostrar contraseña". El rol elegido debe coincidir con el que rectoría asignó a la cuenta; si no coincide, el portal no deja entrar. La sesión se cierra al cerrar la pestaña o el navegador. La primera vez que se abre aparece **Configuración inicial: cuenta del Rector**; esa cuenta se crea una sola vez.

| Rol | Qué puede hacer |
| --- | --- |
| **Rector** (administrador) | Todo el portal. Crea usuarios (uno a uno o carga masiva), cambia roles, activa o desactiva cuentas (menú **Usuarios y roles**). Aprueba y asigna en **Orden de trabajo** y recibe en **Orden de recibo** |
| **PM_PCO** (comité) | Todo, excepto **Orden de trabajo**, **Orden de recibo** y **Acta de baja de bienes**. Verifica las solicitudes en **Registro consolidado** |
| **Docente** | **Inicio** (tablero), **Solicitud de mantenimiento** y **Solicitud de optimización** |

Cada persona puede cambiar su propia contraseña con el botón **Cambiar contraseña** del encabezado. Todo lo que se diligencia en los formularios queda guardado: solicitudes, inspecciones, hojas de vida, órdenes, bajas y solicitudes de optimización.

**Usuarios por correo y carga masiva**

El usuario de acceso es el correo electrónico institucional. En **Usuarios y roles** el Rector puede crear una cuenta individual o pegar una lista (o cargar un CSV) con las columnas `Nombre completo; Correo; Cargo; Rol`. Todas reciben la **contraseña inicial genérica** que se indique, y el portal obliga a cambiarla en el primer ingreso. Con la conexión a Google, cada persona recibe un **correo de bienvenida** con diseño institucional (escudo y colores), su usuario y su contraseña inicial.

**Flujo de una solicitud de mantenimiento**

1. Cualquier usuario envía la **Solicitud de mantenimiento** con fotografía → queda en **Registro consolidado** como *Recibida*.
2. El comité (PM_PCO) pulsa **Verificar y reportar**: fecha, prioridad, diagnóstico, recomendación y costo estimado → *Verificada por el comité*. El Rector recibe un **correo** con el detalle de la solicitud, la foto y la verificación.
3. El Rector, en **Orden de trabajo**, revisa la solicitud y decide: aprobar, escalar a la Secretaría de Educación o no aprobar. Al aprobar con responsable, presupuesto y fuente asignados, la orden pasa a *En ejecución*; si falta alguno, queda *Aprobada por rectoría* hasta completarla.
4. Terminado el trabajo, en **Orden de recibo** se registra la entrega con **fotografías obligatorias** (1 a 3). Si se recibe a satisfacción, la orden y la solicitud quedan *Cerradas*.

**Documentos en PDF**

- **Hoja de vida de equipo**: botón **Ver ficha** en la lista de equipos. Muestra la ficha de inventario con identificación, ubicación, especificaciones, estado, inspecciones, solicitudes y órdenes del equipo. Desde ahí se descarga la **ficha en PDF** con espacios de firma.
- **Acta de baja de bienes**: botón **Acta PDF** en la lista de propuestas. Genera el acta con los datos del bien, el concepto técnico, la decisión (aprueba / no aprueba) y cuatro espacios de firma: quien propone, concepto técnico, pagador(a) y rector(a).

## Estructura del repositorio

```
portal-mantenimiento-ensma/
├── index.html          Portal completo (estilos y lógica)
├── js/
│   ├── config.js       Modo de almacenamiento (google, firebase o local)
│   └── almacen.js      Capa de datos y de acceso
├── assets/
│   ├── escudo.png      Escudo institucional
│   └── favicon.png
├── apps-script/
│   ├── Code.gs           Servidor en Google Apps Script (hoja de cálculo + Drive)
│   ├── appsscript.json   Manifiesto del proyecto de Apps Script
│   └── INSTRUCCIONES.md  Paso a paso para conectar Google Sheets
├── firestore.rules     Reglas de seguridad para Firebase (opción alternativa)
├── .nojekyll           Indica a GitHub Pages que publique los archivos tal cual
└── README.md
```

## 1. Publicar en GitHub Pages

1. Cree un repositorio nuevo en GitHub (por ejemplo `portal-mantenimiento-ensma`).
2. Suba todos los archivos de esta carpeta a la rama `main` (botón **Add file → Upload files**, o con Git):
   ```bash
   git init
   git add .
   git commit -m "Portal de mantenimiento ENSMA"
   git branch -M main
   git remote add origin https://github.com/USUARIO/portal-mantenimiento-ensma.git
   git push -u origin main
   ```
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarde.
4. En uno o dos minutos el portal queda en `https://USUARIO.github.io/portal-mantenimiento-ensma/`.

Con la configuración inicial (`modo: "local"`) el portal ya funciona, pero **cada navegador guarda sus propios registros**: sirve para pruebas y capacitación, no para el trabajo del comité.

## 2. Guardar los datos en un servidor: Google Sheets (recomendado)

El portal viene configurado en `modo: "google"`: los usuarios y todos los formatos se guardan en una **hoja de cálculo de Google** de la cuenta institucional y las fotos en **Google Drive**. En el navegador no queda ningún registro. Siga **[apps-script/INSTRUCCIONES.md](apps-script/INSTRUCCIONES.md)**: crear la hoja, pegar `Code.gs`, publicar la aplicación web y pegar su URL en `js/config.js`.

Mientras `urlAppsScript` esté vacío, el portal funciona en modo local (solo para pruebas).

## 3. Opción alternativa: Firebase

En **modo local** los usuarios y los registros quedan solo en el navegador donde se crearon, y la contraseña se verifica en ese mismo navegador: sirve para pruebas y capacitación, no protege la información. Para el trabajo real de la institución use Firebase (plan gratuito Spark).

1. Entre a <https://console.firebase.google.com> con una cuenta institucional y cree un proyecto (por ejemplo `mantenimiento-ensma`).
2. **Build → Firestore Database → Create database**, ubicación `southamerica-east1` (São Paulo), **modo de producción**.
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable** (solo la primera opción; no active "Email link").
4. **Project settings (engranaje) → Your apps → Web (`</>`)**: registre la app y copie el objeto `firebaseConfig`.
5. En `js/config.js` cambie `modo: "local"` por `modo: "firebase"` y pegue los valores en `firebase: { ... }`.
6. **Firestore Database → Rules**: pegue el contenido de `firestore.rules` y publique.
7. Suba los archivos a GitHub, abra el portal y cree la **cuenta del Rector** en la pantalla de configuración inicial. Las reglas impiden crear una segunda cuenta de Rector por esa vía.
8. Con la cuenta del Rector entre a **Usuarios y roles** y cree las cuentas del comité (PM_PCO) y de los docentes.

> Los valores de `firebaseConfig` no son secretos: identifican el proyecto. La protección de los datos la dan el inicio de sesión y las reglas de `firestore.rules`, que aplican los permisos de cada rol en el servidor. No publique el portal en modo Firebase sin las reglas del paso 6.

**Detalles técnicos de las cuentas**

- Internamente cada usuario se registra en Firebase Authentication como `usuario@usuarios.ensma-portal.app`. Ese correo no existe ni recibe mensajes; solo sirve para el inicio de sesión.
- Si alguien olvida su contraseña, el Rector puede **desactivar** la cuenta y crear una nueva con otro usuario. Si se quiere conservar el mismo usuario, borre primero la cuenta en **Authentication → Users** de la consola de Firebase y el documento correspondiente en la colección `usuarios`, y luego créela de nuevo desde el portal.
- En modo local el Rector sí puede **restablecer contraseñas** desde la tabla de usuarios.

## Uso y límites

- **Fotos**: se reducen en el navegador antes de guardarse (solicitud: 1 foto; orden de trabajo e inspección física: hasta 3).
- **Informes PDF**: se generan en el navegador con jsPDF. El correo al directivo se prepara con un enlace `mailto:` y un botón para copiar el mensaje; el PDF se adjunta manualmente.
- **Plan gratuito de Firebase**: 1 GiB de almacenamiento y 50.000 lecturas / 20.000 escrituras diarias, suficiente para el uso de una institución educativa.
- **Librerías externas** (se cargan desde CDN): jsPDF 2.5.1, Chart.js 4.4.1, Firebase 10.12.2 (Authentication y Firestore) y las fuentes Barlow Semi Condensed y Work Sans de Google Fonts.

## Respaldo de la información

Desde el tablero, **Exportar datos (CSV)** descarga las solicitudes filtradas para abrirlas en Excel. Se recomienda descargar el CSV y el reporte PDF al cierre de cada semestre y guardarlos con el informe al Consejo Directivo.

## Créditos

Plan de mantenimiento preventivo y correctivo · Gestión Administrativa · Escuela Normal Superior María Auxiliadora, Girardot.
