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

## Estructura del repositorio

```
portal-mantenimiento-ensma/
├── index.html          Portal completo (estilos y lógica)
├── js/
│   ├── config.js       Modo de almacenamiento y datos de Firebase
│   └── almacen.js      Capa de datos: navegador (local) o Firebase
├── assets/
│   ├── escudo.png      Escudo institucional
│   └── favicon.png
├── firestore.rules     Reglas de seguridad para Firebase
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

## 2. Conectar Firebase (registros compartidos)

Para que todo el comité vea y actualice los mismos registros se usa Cloud Firestore (plan gratuito Spark).

1. Entre a <https://console.firebase.google.com> con una cuenta institucional y cree un proyecto (por ejemplo `mantenimiento-ensma`). Google Analytics no es necesario.
2. **Build → Firestore Database → Create database**. Elija la ubicación `southamerica-east1` (São Paulo) o `us-east1` e inicie en **modo de producción**.
3. **Build → Authentication → Get started → Sign-in method → Google → Enable**.
4. **Authentication → Settings → Authorized domains → Add domain**: agregue `USUARIO.github.io`.
5. **Project settings (engranaje) → Your apps → Web (`</>`)**: registre la app y copie el objeto `firebaseConfig`.
6. Abra `js/config.js`, cambie `modo: "local"` por `modo: "firebase"` y pegue los valores en `firebase: { ... }`. Escriba el dominio del correo institucional en `dominioPermitido` (por ejemplo `ensmagirardot.edu.co`).
7. **Firestore Database → Rules**: copie el contenido de `firestore.rules`, reemplace `TU-DOMINIO[.]edu[.]co` por el dominio institucional y publique.
8. Suba el `config.js` modificado a GitHub. Al abrir el portal aparecerá el botón **Iniciar sesión con Google**.

> Los valores de `firebaseConfig` no son secretos: identifican el proyecto. La protección de los datos la dan las reglas de Firestore y el inicio de sesión; no publique el portal sin configurar las reglas del paso 7.

### Si la institución no tiene correo con dominio propio

Deje `dominioPermitido: ""` y, en `firestore.rules`, cambie la función `institucional()` por una lista de correos autorizados:

```
function institucional() {
  return request.auth != null && request.auth.token.email in [
    'rectoria@gmail.com',
    'coordinacion@gmail.com',
    'lider.tic@gmail.com'
  ];
}
```

## Uso y límites

- **Fotos**: se reducen en el navegador antes de guardarse (solicitud: 1 foto; orden de trabajo e inspección física: hasta 3).
- **Informes PDF**: se generan en el navegador con jsPDF. El correo al directivo se prepara con un enlace `mailto:` y un botón para copiar el mensaje; el PDF se adjunta manualmente.
- **Plan gratuito de Firebase**: 1 GiB de almacenamiento y 50.000 lecturas / 20.000 escrituras diarias, suficiente para el uso de una institución educativa.
- **Librerías externas** (se cargan desde CDN): jsPDF 2.5.1, Chart.js 4.4.1, Firebase 10.12.2 y las fuentes Barlow Semi Condensed y Work Sans de Google Fonts.

## Respaldo de la información

Desde el tablero, **Exportar datos (CSV)** descarga las solicitudes filtradas para abrirlas en Excel. Se recomienda descargar el CSV y el reporte PDF al cierre de cada semestre y guardarlos con el informe al Consejo Directivo.

## Créditos

Plan de mantenimiento preventivo y correctivo · Gestión Administrativa · Escuela Normal Superior María Auxiliadora, Girardot.
