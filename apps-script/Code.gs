/**
 * Portal de Mantenimiento ENSMA · Servidor en Google Apps Script
 * --------------------------------------------------------------
 * Guarda los usuarios y todos los formatos del portal en esta hoja de cálculo
 * (una pestaña por formato) y las fotos en una carpeta de Google Drive.
 *
 * Instalación: ver apps-script/INSTRUCCIONES.md
 *   1. Crear una hoja de cálculo nueva en Google Drive.
 *   2. Extensiones → Apps Script → pegar este archivo y appsscript.json.
 *   3. Implementar → Nueva implementación → Aplicación web
 *      (Ejecutar como: Yo · Quién tiene acceso: Cualquier persona).
 *   4. Copiar la URL de la aplicación web en js/config.js del portal.
 */

// Dirección pública del portal (se usa en los correos para el enlace y el escudo)
const URL_PORTAL = "https://alvaromejia1990-bit.github.io/plan-de-mantenimiento-ENSMAG/";
const INSTITUCION = "Institución Educativa Escuela Normal Superior María Auxiliadora";

const COLECCIONES = ["solicitudes", "inspecciones", "equipos", "ordenes", "bajas", "optimizaciones", "config"];
const ROLES = ["Rector", "PM_PCO", "Docente"];
const NOMBRE_ROL = { Rector: "Rector (administrador)", PM_PCO: "PM_PCO (comité)", Docente: "Docente" };
const DURACION_SESION = 6 * 60 * 60; // segundos (máximo que permite CacheService)
const HOJA_USUARIOS = "usuarios";
const CAB_USUARIOS = ["uid", "usuario", "nombre", "cargo", "rol", "activo", "sal", "hash", "creado", "correo", "debeCambiar"];
const CARPETA_FOTOS = "Portal Mantenimiento ENSMA - Fotos";

// ---------------------------------------------------------------------------
// Entrada HTTP
// ---------------------------------------------------------------------------
function doGet() {
  return salida_({ ok: true, servicio: "Portal de Mantenimiento ENSMA", version: version_() });
}

function doPost(e) {
  let pedido;
  try { pedido = JSON.parse(e.postData.contents); }
  catch (x) { return salida_({ ok: false, codigo: "pedido", mensaje: "Pedido no válido." }); }
  try { return salida_(Object.assign({ ok: true }, despachar_(pedido))); }
  catch (err) { return salida_({ ok: false, codigo: err.codigo || "error", mensaje: err.message || String(err) }); }
}

function salida_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function fallo_(codigo, mensaje) { const e = new Error(mensaje); e.codigo = codigo; return e; }

function despachar_(p) {
  switch (p.accion) {
    case "estado": return { instalado: hayUsuarios_() };
    case "instalar": return instalar_(p);
    case "ingresar": return ingresar_(p);
  }
  const yo = sesion_(p.token);
  switch (p.accion) {
    case "perfil": return { perfil: perfilPublico_(yo) };
    case "salir": CacheService.getScriptCache().remove("t_" + p.token); return {};
    case "cambiarClave": return cambiarClave_(yo, p);
    case "usuarios_listar": soloRector_(yo); return { usuarios: leerUsuarios_().map(perfilPublico_) };
    case "usuarios_crear": soloRector_(yo); return crearYNotificar_(p.datos, p.notificar !== false);
    case "usuarios_crear_lote": soloRector_(yo); return { resultados: (p.lista || []).map(function (d) { try { return Object.assign({ correo: d.usuario, ok: true }, crearYNotificar_(d, p.notificar !== false)); } catch (e) { return { correo: d.usuario, ok: false, mensaje: e.message }; } }) };
    case "usuarios_actualizar": soloRector_(yo); return actualizarUsuario_(yo, p.uid, p.cambios);
    case "usuarios_restablecer": soloRector_(yo); return restablecerClave_(p.uid, p.clave);
    case "version": return { version: version_() };
    case "leer": return leer_(yo, p.cols || []);
    case "escribir": return escribir_(yo, p.col, p.id, p.datos, p.modo);
    case "borrar": return borrar_(yo, p.col, p.id);
    case "foto": return foto_(p.id);
  }
  throw fallo_("pedido", "Acción desconocida: " + p.accion);
}

// ---------------------------------------------------------------------------
// Usuarios y sesiones
// ---------------------------------------------------------------------------
function hojaUsuarios_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA_USUARIOS);
  if (!h) {
    h = libro.insertSheet(HOJA_USUARIOS);
    h.getRange(1, 1, 1, CAB_USUARIOS.length).setValues([CAB_USUARIOS]).setFontWeight("bold").setBackground("#1d4f8c").setFontColor("#ffffff");
    h.setFrozenRows(1);
    h.hideColumns(7, 2); // sal y hash
  } else if (h.getLastColumn() < CAB_USUARIOS.length) {
    h.getRange(1, 1, 1, CAB_USUARIOS.length).setValues([CAB_USUARIOS]).setFontWeight("bold").setBackground("#1d4f8c").setFontColor("#ffffff");
  }
  return h;
}
function leerUsuarios_() {
  const h = hojaUsuarios_(); const n = h.getLastRow();
  if (n < 2) return [];
  return h.getRange(2, 1, n - 1, CAB_USUARIOS.length).getValues().map(function (f) {
    const u = {}; CAB_USUARIOS.forEach(function (k, i) { u[k] = f[i]; });
    u.activo = u.activo === true || u.activo === "TRUE" || u.activo === "Sí"; u.usuario = String(u.usuario);
    u.debeCambiar = u.debeCambiar === true || u.debeCambiar === "TRUE"; u.correo = String(u.correo || (u.usuario.indexOf("@") > 0 ? u.usuario : "")); return u;
  });
}
function hayUsuarios_() { return leerUsuarios_().length > 0; }
function perfilPublico_(u) { return { uid: u.uid, usuario: u.usuario, nombre: u.nombre, cargo: u.cargo, rol: u.rol, activo: u.activo, creado: u.creado, correo: u.correo, debeCambiar: u.debeCambiar }; }
function hash_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join("");
}
function validarUsuario_(usuario) {
  const esCorreo = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(usuario || "");
  if (!esCorreo && !/^[a-z0-9._-]{3,40}$/.test(usuario || "")) throw fallo_("datos", "Correo no válido: " + (usuario || "(vacío)") + ".");
}
function validarClave_(clave) {
  if (!clave || String(clave).length < 8) throw fallo_("datos", "La contraseña debe tener al menos 8 caracteres.");
}
function crearUsuario_(d) {
  d = d || {}; const usuario = String(d.usuario || "").trim().toLowerCase();
  validarUsuario_(usuario); validarClave_(d.clave);
  if (ROLES.indexOf(d.rol) < 0) throw fallo_("datos", "Rol no válido.");
  if (!d.nombre) throw fallo_("datos", "Falta el nombre.");
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (leerUsuarios_().some(function (u) { return u.usuario === usuario; })) throw fallo_("datos", "Ese usuario ya existe.");
    const sal = Utilities.getUuid().slice(0, 12);
    const u = { uid: "u-" + Utilities.getUuid().slice(0, 8), usuario: usuario, nombre: d.nombre, cargo: d.cargo || "", rol: d.rol, activo: true, sal: sal, hash: hash_(sal + d.clave), creado: new Date().toISOString(),
      correo: usuario.indexOf("@") > 0 ? usuario : (d.correo || ""), debeCambiar: d.debeCambiar !== false };
    hojaUsuarios_().appendRow(CAB_USUARIOS.map(function (k) { return u[k]; }));
    return u;
  } finally { lock.releaseLock(); }
}
function nuevaSesion_(u) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put("t_" + token, u.uid, DURACION_SESION);
  return { token: token, perfil: perfilPublico_(u) };
}
function instalar_(p) {
  if (hayUsuarios_()) throw fallo_("datos", "El portal ya tiene una cuenta de Rector. Pida su usuario a rectoría.");
  const u = crearUsuario_({ usuario: p.usuario, nombre: p.nombre, cargo: "Rector(a)", rol: "Rector", clave: p.clave, debeCambiar: false });
  return nuevaSesion_(u);
}
function ingresar_(p) {
  const usuario = String(p.usuario || "").trim().toLowerCase();
  const u = leerUsuarios_().filter(function (x) { return x.usuario === usuario; })[0];
  if (!u || hash_(u.sal + p.clave) !== u.hash) { Utilities.sleep(800); throw fallo_("credenciales", "Usuario o contraseña incorrectos."); }
  if (!u.activo) throw fallo_("credenciales", "Esta cuenta está desactivada. Comuníquese con rectoría.");
  if (u.rol !== p.rol) throw fallo_("credenciales", "Su cuenta no tiene el rol " + (NOMBRE_ROL[p.rol] || p.rol) + ". Elija el rol que le asignó rectoría.");
  return nuevaSesion_(u);
}
function sesion_(token) {
  const uid = token ? CacheService.getScriptCache().get("t_" + token) : null;
  const u = uid ? leerUsuarios_().filter(function (x) { return x.uid === uid; })[0] : null;
  if (!u || !u.activo) throw fallo_("sesion", "La sesión expiró. Ingrese de nuevo.");
  CacheService.getScriptCache().put("t_" + token, uid, DURACION_SESION);
  return u;
}
function soloRector_(yo) { if (yo.rol !== "Rector") throw fallo_("permiso", "Solo el Rector puede administrar usuarios."); }
function filaUsuario_(uid) {
  const h = hojaUsuarios_(); const n = h.getLastRow(); if (n < 2) return -1;
  const ids = h.getRange(2, 1, n - 1, 1).getValues().map(function (f) { return f[0]; });
  const i = ids.indexOf(uid); return i < 0 ? -1 : i + 2;
}
function actualizarUsuario_(yo, uid, c) {
  c = c || {};
  if (uid === yo.uid && ((c.rol && c.rol !== "Rector") || c.activo === false)) throw fallo_("permiso", "No puede quitarse a sí mismo el rol de Rector ni desactivar su propia cuenta.");
  if (c.rol && ROLES.indexOf(c.rol) < 0) throw fallo_("datos", "Rol no válido.");
  const fila = filaUsuario_(uid); if (fila < 0) throw fallo_("datos", "El usuario no existe.");
  const h = hojaUsuarios_();
  ["nombre", "cargo", "rol", "activo", "debeCambiar"].forEach(function (k) { if (k in c) h.getRange(fila, CAB_USUARIOS.indexOf(k) + 1).setValue(c[k]); });
  return {};
}
function restablecerClave_(uid, clave) {
  validarClave_(clave);
  const fila = filaUsuario_(uid); if (fila < 0) throw fallo_("datos", "El usuario no existe.");
  const h = hojaUsuarios_(); const sal = h.getRange(fila, CAB_USUARIOS.indexOf("sal") + 1).getValue();
  h.getRange(fila, CAB_USUARIOS.indexOf("hash") + 1).setValue(hash_(sal + clave));
  h.getRange(fila, CAB_USUARIOS.indexOf("debeCambiar") + 1).setValue(true);
  return {};
}
function cambiarClave_(yo, p) {
  if (hash_(yo.sal + p.actual) !== yo.hash) throw fallo_("datos", "La contraseña actual no es correcta.");
  if (p.actual === p.nueva) throw fallo_("datos", "La nueva contraseña debe ser distinta de la actual.");
  restablecerClave_(yo.uid, p.nueva);
  hojaUsuarios_().getRange(filaUsuario_(yo.uid), CAB_USUARIOS.indexOf("debeCambiar") + 1).setValue(false);
  return {};
}

// ---------------------------------------------------------------------------
// Permisos por rol
// ---------------------------------------------------------------------------
function esComite_(u) { return u.rol === "Rector" || u.rol === "PM_PCO"; }
function puedeLeer_(u, col) {
  if (col === "bajas") return u.rol === "Rector";
  if (col === "config") return esComite_(u);
  return true;
}
function puedeCrear_(u, col) {
  if (col === "solicitudes" || col === "optimizaciones") return true;
  if (col === "ordenes" || col === "bajas") return u.rol === "Rector";
  return esComite_(u);
}
function puedeModificar_(u, col) {
  if (col === "ordenes" || col === "bajas") return u.rol === "Rector";
  return esComite_(u);
}

// ---------------------------------------------------------------------------
// Datos: una pestaña por colección. Columnas: id | _json | creado | actualizado | campos legibles…
// ---------------------------------------------------------------------------
function version_() { return Number(PropertiesService.getScriptProperties().getProperty("version") || "0"); }
function subirVersion_() { const v = version_() + 1; PropertiesService.getScriptProperties().setProperty("version", String(v)); return v; }

function hoja_(col) {
  if (COLECCIONES.indexOf(col) < 0) throw fallo_("datos", "Colección no válida: " + col);
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(col);
  if (!h) {
    h = libro.insertSheet(col);
    h.getRange(1, 1, 1, 4).setValues([["id", "_json", "creado", "actualizado"]]);
    h.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#1d4f8c").setFontColor("#ffffff");
    h.setFrozenRows(1); h.hideColumns(2);
  }
  return h;
}
function cabecera_(h) { return h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0]; }
function filaDe_(h, id) {
  const n = h.getLastRow(); if (n < 2) return -1;
  const ids = h.getRange(2, 1, n - 1, 1).getValues().map(function (f) { return String(f[0]); });
  const i = ids.indexOf(String(id)); return i < 0 ? -1 : i + 2;
}
function legible_(v) {
  const enlace = function (x) { return typeof x === "string" && x.indexOf("drive:") === 0 ? "https://drive.google.com/file/d/" + x.slice(6) + "/view" : x; };
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(function (x) { return typeof x === "object" ? JSON.stringify(x) : enlace(x); }).join(", ").slice(0, 45000);
  if (typeof v === "object") return JSON.stringify(v).slice(0, 45000);
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string") return String(enlace(v)).slice(0, 45000);
  return v;
}
function carpetaFotos_() {
  const props = PropertiesService.getScriptProperties(); const id = props.getProperty("carpetaFotos");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se creó de nuevo abajo */ } }
  const c = DriveApp.createFolder(CARPETA_FOTOS); props.setProperty("carpetaFotos", c.getId()); return c;
}
function guardarFotos_(col, id, datos) {
  let n = 0; const carpeta = { v: null };
  const una = function (x) {
    if (typeof x !== "string" || x.indexOf("data:image") !== 0) return x;
    const m = x.match(/^data:(image\/[a-z]+);base64,(.*)$/); if (!m) return x;
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], col + "_" + id + "_" + (++n) + "." + m[1].split("/")[1]);
    if (!carpeta.v) carpeta.v = carpetaFotos_();
    return "drive:" + carpeta.v.createFile(blob).getId();
  };
  const out = {};
  Object.keys(datos).forEach(function (k) { const v = datos[k]; out[k] = Array.isArray(v) ? v.map(una) : una(v); });
  return out;
}
function escribir_(yo, col, id, datos, modo) {
  if (!id || !/^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id)) throw fallo_("datos", "Identificador no válido.");
  if (!datos || typeof datos !== "object") throw fallo_("datos", "Datos no válidos.");
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const h = hoja_(col); let fila = filaDe_(h, id); let previo = null;
    if (fila > 0) previo = JSON.parse(h.getRange(fila, 2).getValue() || "{}");
    if (previo ? !puedeModificar_(yo, col) : !puedeCrear_(yo, col)) throw fallo_("permiso", "Su rol no tiene permiso para guardar en este formato.");
    if (modo === "update" && !previo) throw fallo_("datos", "El registro no existe.");
    const nuevos = guardarFotos_(col, id, datos);
    const doc = modo === "update" ? Object.assign({}, previo, nuevos) : nuevos;
    const json = JSON.stringify(doc);
    if (json.length > 49000) throw fallo_("cuota", "El registro es demasiado grande para guardarse.");
    const ahora = new Date().toISOString();
    let cab = cabecera_(h);
    const faltan = Object.keys(doc).filter(function (k) { return cab.indexOf(k) < 0; });
    if (faltan.length) { h.getRange(1, cab.length + 1, 1, faltan.length).setValues([faltan]).setFontWeight("bold").setBackground("#1d4f8c").setFontColor("#ffffff"); cab = cab.concat(faltan); }
    const valores = cab.map(function (k, i) {
      if (i === 0) return id; if (i === 1) return json;
      if (i === 2) return previo ? (previo.creado || h.getRange(fila, 3).getValue()) : (doc.creado || ahora);
      if (i === 3) return ahora;
      return legible_(doc[k]);
    });
    if (fila < 0) { fila = h.getLastRow() + 1; }
    h.getRange(fila, 1, 1, valores.length).setValues([valores]);
    const res = { version: subirVersion_(), doc: Object.assign({ id: id }, doc) };
    if (col === "solicitudes" && doc.estado === "Verificada por el comité" && (!previo || previo.estado !== doc.estado)) {
      try { res.correo = notificarVerificacion_(Object.assign({ id: id }, doc), yo); } catch (e) { res.correo = "No se pudo enviar el correo: " + e.message; }
    }
    return res;
  } finally { lock.releaseLock(); }
}
function borrar_(yo, col, id) {
  if (!puedeModificar_(yo, col)) throw fallo_("permiso", "Su rol no tiene permiso para borrar en este formato.");
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { const h = hoja_(col); const f = filaDe_(h, id); if (f > 0) h.deleteRow(f); return { version: subirVersion_() }; }
  finally { lock.releaseLock(); }
}
function leer_(yo, cols) {
  const datos = {};
  cols.forEach(function (col) {
    if (COLECCIONES.indexOf(col) < 0 || !puedeLeer_(yo, col)) return;
    const h = hoja_(col); const n = h.getLastRow();
    datos[col] = n < 2 ? [] : h.getRange(2, 1, n - 1, 2).getValues().filter(function (f) { return f[0] !== ""; }).map(function (f) {
      let d = {}; try { d = JSON.parse(f[1] || "{}"); } catch (e) { d = {}; }
      d.id = String(f[0]); return d;
    });
  });
  return { version: version_(), datos: datos };
}
function foto_(id) {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id || "")) throw fallo_("datos", "Foto no válida.");
  const blob = DriveApp.getFileById(id).getBlob();
  return { data: "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes()) };
}

/** Ejecute esta función una vez desde el editor para autorizar Drive y Sheets y crear las pestañas. */
function prepararHoja() {
  hojaUsuarios_(); COLECCIONES.forEach(hoja_); carpetaFotos_();
  SpreadsheetApp.getActiveSpreadsheet().toast("Hoja preparada. Ahora implemente la aplicación web.", "Portal de Mantenimiento ENSMA", 8);
}


// ---------------------------------------------------------------------------
// Correos institucionales
// ---------------------------------------------------------------------------
function esc_(t) { return String(t === undefined || t === null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function plantilla_(titulo, saludo, cuerpo, boton) {
  return '<div style="background:#f6f8fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1b2330">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #d6dce6">'
    + '<tr><td style="background:#1d4f8c;padding:18px 24px"><table role="presentation" cellspacing="0" cellpadding="0"><tr>'
    + '<td style="padding-right:14px"><img src="' + URL_PORTAL + 'assets/escudo.png" width="58" alt="Escudo ENSMA" style="display:block;background:#ffffff;border-radius:8px;padding:4px"></td>'
    + '<td><div style="color:#f6c1d6;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Escuela Normal Superior María Auxiliadora · Girardot</div>'
    + '<div style="color:#ffffff;font-size:20px;font-weight:bold;margin-top:4px">' + esc_(titulo) + '</div></td></tr></table></td></tr>'
    + '<tr><td style="height:5px;background:#b8175a"></td></tr>'
    + '<tr><td style="padding:24px">'
    + '<p style="font-size:16px;margin:0 0 14px"><b>' + saludo + '</b></p>' + cuerpo
    + (boton ? '<p style="text-align:center;margin:26px 0 8px"><a href="' + boton[1] + '" style="background:#1d4f8c;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:bold;display:inline-block">' + esc_(boton[0]) + '</a></p>' : '')
    + '</td></tr>'
    + '<tr><td style="background:#f6f8fb;padding:14px 24px;font-size:11.5px;color:#5a6475;border-top:1px solid #d6dce6">'
    + INSTITUCION + ' · Girardot, Cundinamarca<br>Plan de mantenimiento preventivo, correctivo y de optimización · Este es un mensaje automático del Portal de Mantenimiento.'
    + '</td></tr></table></div>';
}
function filaDato_(k, v) { return '<tr><td style="padding:7px 10px;background:#f6f8fb;color:#5a6475;font-size:12.5px;width:38%;border-bottom:1px solid #e6ebf2">' + esc_(k) + '</td><td style="padding:7px 10px;font-size:13.5px;border-bottom:1px solid #e6ebf2"><b>' + esc_(v || "—") + '</b></td></tr>'; }
function tablaDatos_(pares) { return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e6ebf2;border-radius:8px;border-collapse:separate;margin:8px 0 16px">' + pares.map(function (p) { return filaDato_(p[0], p[1]); }).join("") + '</table>'; }
function enviar_(para, asunto, html, extra) {
  MailApp.sendEmail(Object.assign({ to: para, subject: asunto, htmlBody: html, name: "Portal de Mantenimiento ENSMA" }, extra || {}));
}

function crearYNotificar_(d, notificar) {
  const u = crearUsuario_(d);
  let correo = "";
  if (notificar && u.correo) {
    try { enviarBienvenida_(u, d.clave); correo = "Correo de bienvenida enviado a " + u.correo + "."; }
    catch (e) { correo = "Usuario creado, pero no se pudo enviar el correo: " + e.message; }
  }
  return { usuario: perfilPublico_(u), correo: correo };
}
function enviarBienvenida_(u, clave) {
  const cuerpo = '<p style="font-size:14.5px;line-height:1.6;margin:0 0 12px">Reciba un saludo cordial. Le damos la bienvenida al <b>Portal de Mantenimiento</b> de nuestra Escuela Normal, la herramienta con la que, entre todos, cuidamos los espacios y los recursos donde aprenden nuestros estudiantes y se forman los maestros del Programa de Formación Complementaria.</p>'
    + '<p style="font-size:14.5px;line-height:1.6;margin:0 0 12px">Su participación es valiosa: cada reporte oportuno, cada propuesta de mejora y cada verificación fortalecen los procesos institucionales y hacen de la ENSMA un mejor lugar para enseñar y aprender. ¡Gracias por sumarse!</p>'
    + '<p style="font-size:14.5px;margin:18px 0 6px"><b style="color:#1d4f8c">Sus datos de acceso</b></p>'
    + tablaDatos_([["Usuario (correo)", u.usuario], ["Contraseña inicial", clave], ["Rol", NOMBRE_ROL[u.rol] || u.rol]])
    + '<p style="font-size:13px;line-height:1.55;color:#5a6475;margin:0 0 6px">Al ingresar por primera vez el portal le pedirá cambiar la contraseña inicial por una personal. No comparta sus datos de acceso.</p>';
  enviar_(u.correo, "Bienvenido(a) al Portal de Mantenimiento ENSMA", plantilla_("Bienvenida al Portal de Mantenimiento", "Hola, " + esc_(u.nombre) + ":", cuerpo, ["Ingresar al portal", URL_PORTAL]));
}
function notificarVerificacion_(s, yo) {
  const rectores = leerUsuarios_().filter(function (u) { return u.rol === "Rector" && u.activo && u.correo; });
  if (!rectores.length) return "No hay un correo de Rector registrado para notificar.";
  const v = s.verificacion || {};
  const prio = { 1: "1 – Crítica", 2: "2 – Alta", 3: "3 – Media", 4: "4 – Baja" }[s.prioridad] || "Sin asignar";
  const fecha = function (f) { f = String(f || ""); return f.length >= 10 ? f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4) : f; };
  const pesos = function (n) { return n === null || n === undefined || n === "" ? "" : "$ " + Number(n).toLocaleString("es-CO"); };
  let inline = {}, foto = "";
  if (typeof s.foto === "string" && s.foto.indexOf("drive:") === 0) {
    try { inline.foto = DriveApp.getFileById(s.foto.slice(6)).getBlob(); foto = '<p style="margin:6px 0 16px"><img src="cid:foto" alt="Fotografía del daño" style="max-width:100%;border-radius:8px;border:1px solid #d6dce6"></p>'; } catch (e) { foto = ""; }
  }
  const cuerpo = '<p style="font-size:14.5px;line-height:1.6;margin:0 0 12px">El comité del plan de mantenimiento verificó la siguiente solicitud y la presenta a rectoría para su aprobación y asignación de responsable y presupuesto en la sección <b>Orden de trabajo</b> del portal.</p>'
    + '<p style="font-size:14.5px;margin:16px 0 4px"><b style="color:#1d4f8c">1. Solicitud</b></p>'
    + tablaDatos_([["Número", s.numero || s.id], ["Fecha de reporte", fecha(s.fecha)], ["Reportada por", (s.nombre || "") + (s.rol ? " (" + s.rol + ")" : "")], ["Sede", s.sede], ["Espacio o ubicación", s.espacio], ["Infraestructura", s.infra], ["Componente", s.componente], ["Código de equipo", s.codigo], ["Riesgo inmediato", s.riesgo], ["Descripción", s.descripcion]])
    + foto
    + '<p style="font-size:14.5px;margin:16px 0 4px"><b style="color:#1d4f8c">2. Verificación del comité</b></p>'
    + tablaDatos_([["Fecha de verificación", fecha(v.fecha)], ["Verificada por", v.verificador], ["Prioridad asignada", prio], ["Diagnóstico", v.diagnostico], ["Recomendación", v.recomendacion], ["Costo estimado", pesos(v.costoEstimado)], ["Observaciones", v.observaciones]]);
  enviar_(rectores.map(function (u) { return u.correo; }).join(","), "Solicitud verificada por el comité: " + (s.numero || s.id) + " – " + (s.espacio || ""),
    plantilla_("Solicitud de mantenimiento verificada", "Señor(a) Rector(a):", cuerpo, ["Revisar en Orden de trabajo", URL_PORTAL + "#orden-trabajo"]),
    Object.keys(inline).length ? { inlineImages: inline } : {});
  return "Rectoría fue notificada por correo (" + rectores.map(function (u) { return u.correo; }).join(", ") + ").";
}

/** Prueba de correo: ejecútela desde el editor para autorizar el envío y ver el diseño en su bandeja. */
function probarCorreo() {
  const yo = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  enviarBienvenida_({ nombre: "Docente de prueba", usuario: yo, correo: yo, rol: "Docente" }, "Ensma2026*");
}
