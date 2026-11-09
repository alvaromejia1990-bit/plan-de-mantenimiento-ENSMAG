/*
 * Capa de datos y acceso del Portal de Mantenimiento ENSMA.
 * Expone window.claude.use("sesion" | "db" | "user" | "downloads") sobre dos motores:
 *   - local:    navegador (localStorage). Para pruebas y capacitación.
 *   - google:   Google Sheets + Google Apps Script (fotos en Google Drive).
 *   - firebase: Cloud Firestore + Firebase Authentication (usuario y contraseña).
 * Roles: "Rector" (administrador), "PM_PCO" (comité), "Docente".
 */
(function () {
  "use strict";
  const CFG = window.PORTAL_CONFIG || { modo: "local" };
  const FB_VER = "10.12.2";
  const DOMINIO_USUARIOS = "usuarios.ensma-portal.app"; // los usuarios se guardan como usuario@este-dominio
  const ROLES = ["Rector", "PM_PCO", "Docente"];
  const NOMBRE_ROL = { Rector: "Rector (administrador)", PM_PCO: "PM_PCO (comité)", Docente: "Docente" };
  const errorRol = (rol) => errorCon("invalid_argument", `Su cuenta no tiene el rol ${NOMBRE_ROL[rol] || rol}. Elija el rol que le asignó rectoría.`);
  const esCorreo = (u) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(u || "");
  const okUsuario = (u) => esCorreo(u) || /^[a-z0-9._-]{3,40}$/.test(u || "");
  const errorCon = (codigo, msg) => { const e = new Error(msg); e.code = codigo; return e; };

  // ------------------------------------------------------------------
  // Descargas
  // ------------------------------------------------------------------
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/octet-stream" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { status: "saved" };
    },
  };

  // ------------------------------------------------------------------
  // Pantalla de ingreso
  // ------------------------------------------------------------------
  const listo = () => new Promise((ok) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", ok) : ok()));
  function estilosLogin() {
    if (document.getElementById("login-css")) return;
    const st = document.createElement("style"); st.id = "login-css";
    st.textContent = `
      #login{position:fixed;inset:0;z-index:1000;background:var(--fondo,#f6f8fb);display:grid;place-items:center;padding:20px;overflow:auto}
      #login .caja{background:#fff;border:1.5px solid #b9c9e0;border-top:5px solid var(--azul,#1d4f8c);border-radius:14px;padding:26px 28px;width:100%;max-width:420px;box-shadow:0 10px 30px rgba(29,79,140,.08)}
      #login .enc{display:flex;gap:14px;align-items:center;margin-bottom:18px}
      #login .enc img{width:58px}
      #login .ie{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--magenta,#b8175a);font-weight:600}
      #login h1{font-family:var(--display,Arial);font-size:22px;color:var(--azul,#1d4f8c);margin:2px 0 0}
      #login h2{font-family:var(--display,Arial);font-size:18px;color:var(--azul,#1d4f8c);margin:0 0 4px}
      #login p{margin:0 0 14px;color:var(--tenue,#5a6475);font-size:13.5px}
      #login form{display:grid;gap:12px}
      #login select,#login input[type=text],#login input[type=email],#login input[type=password]{width:100%;padding:9px 11px;border:1.5px solid var(--campo-borde,#8ea7cb);border-radius:8px;background:var(--campo,#eef4fc);font:inherit}
      #login label{display:grid;gap:5px;font-size:13.5px;font-weight:600}
      #login .ver{display:flex;gap:8px;align-items:center;font-weight:500;font-size:13px}
      #login .ver input{width:16px;height:16px;accent-color:var(--azul,#1d4f8c)}
      #login .err{color:var(--critico,#c0392b);font-size:13.5px;min-height:1em}
      #login .alt{background:none;border:0;color:var(--azul,#1d4f8c);text-decoration:underline;cursor:pointer;padding:0;font-size:13px;justify-self:start}
      #login .nota{font-size:12px;color:var(--tenue,#5a6475);margin-top:10px}`;
    document.head.appendChild(st);
  }
  function campoClave(id, etiqueta, auto) {
    return `<label for="${id}">${etiqueta}<input type="password" id="${id}" autocomplete="${auto}" required></label>`;
  }
  async function pantallaIngreso({ ingresar, instalar, nota }) {
    await listo(); estilosLogin();
    const escudo = (document.querySelector(".top img") || {}).src || "assets/escudo.png";
    const div = document.createElement("div"); div.id = "login"; div.setAttribute("role", "dialog"); div.setAttribute("aria-modal", "true");
    document.body.appendChild(div);
    return new Promise((resolver) => {
      const vistaIngreso = () => {
        div.innerHTML = `<div class="caja"><div class="enc"><img src="${escudo}" alt="Escudo institucional"><div><div class="ie">Escuela Normal Superior María Auxiliadora</div><h1>Portal de mantenimiento</h1></div></div>
          <form id="lg-f" novalidate><h2>Ingresar</h2><p>Escriba su correo electrónico, la contraseña y elija su rol.</p>
          <label for="lg-u">Correo electrónico<input type="email" id="lg-u" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="nombre@dominio.edu.co"></label>
          ${campoClave("lg-p", "Contraseña", "current-password")}
          <label class="ver"><input type="checkbox" id="lg-ver"> Mostrar contraseña</label>
          <label for="lg-r">Rol<select id="lg-r" required><option value="">Seleccione su rol…</option><option value="Rector">Rector (administrador)</option><option value="PM_PCO">PM_PCO (comité de mantenimiento)</option><option value="Docente">Docente</option></select></label>
          <div class="err" id="lg-err" role="alert"></div>
          <button class="btn" type="submit" id="lg-btn">Ingresar</button>
          ${instalar ? '<button type="button" class="alt" id="lg-inst">Primera vez: crear la cuenta del Rector</button>' : ""}</form>
          ${nota ? `<div class="nota">${nota}</div>` : ""}</div>`;
        div.querySelector("#lg-ver").addEventListener("change", (e) => (div.querySelector("#lg-p").type = e.target.checked ? "text" : "password"));
        if (instalar) div.querySelector("#lg-inst").addEventListener("click", vistaInstalar);
        div.querySelector("#lg-u").focus();
        div.querySelector("#lg-f").addEventListener("submit", async (ev) => {
          ev.preventDefault(); const err = div.querySelector("#lg-err"); const btn = div.querySelector("#lg-btn");
          const u = div.querySelector("#lg-u").value.trim().toLowerCase(), p = div.querySelector("#lg-p").value, r = div.querySelector("#lg-r").value;
          if (!u || !p) { err.textContent = "Escriba su usuario y su contraseña."; return; }
          if (!r) { err.textContent = "Elija su rol."; div.querySelector("#lg-r").focus(); return; }
          btn.disabled = true; err.textContent = "";
          try { const s = await ingresar(u, p, r); div.remove(); resolver(s); }
          catch (e) { err.textContent = e.message || "No fue posible ingresar."; btn.disabled = false; }
        });
      };
      const vistaInstalar = () => {
        div.innerHTML = `<div class="caja"><div class="enc"><img src="${escudo}" alt="Escudo institucional"><div><div class="ie">Configuración inicial</div><h1>Cuenta del Rector</h1></div></div>
          <form id="in-f" novalidate><p>Esta cuenta administra el portal y crea los usuarios del comité y de los docentes. Solo se puede crear una vez.</p>
          <label for="in-n">Nombre completo<input type="text" id="in-n" required></label>
          <label for="in-u">Correo electrónico (será su usuario)<input type="email" id="in-u" autocapitalize="none" spellcheck="false" required placeholder="rectoria@dominio.edu.co"></label>
          ${campoClave("in-p", "Contraseña (mínimo 8 caracteres)", "new-password")}
          ${campoClave("in-p2", "Repita la contraseña", "new-password")}
          <label class="ver"><input type="checkbox" id="in-ver"> Mostrar contraseña</label>
          <div class="err" id="in-err" role="alert"></div>
          <button class="btn" type="submit" id="in-btn">Crear cuenta e ingresar</button>
          ${ingresar ? '<button type="button" class="alt" id="in-volver">Ya tengo cuenta: ingresar</button>' : ""}</form></div>`;
        div.querySelector("#in-ver").addEventListener("change", (e) => { const t = e.target.checked ? "text" : "password"; div.querySelector("#in-p").type = t; div.querySelector("#in-p2").type = t; });
        if (ingresar) div.querySelector("#in-volver").addEventListener("click", vistaIngreso);
        div.querySelector("#in-n").focus();
        div.querySelector("#in-f").addEventListener("submit", async (ev) => {
          ev.preventDefault(); const err = div.querySelector("#in-err"); const btn = div.querySelector("#in-btn");
          const n = div.querySelector("#in-n").value.trim(), u = div.querySelector("#in-u").value.trim().toLowerCase(), p = div.querySelector("#in-p").value, p2 = div.querySelector("#in-p2").value;
          if (!n) { err.textContent = "Escriba el nombre completo."; return; }
          if (!esCorreo(u)) { err.textContent = "Escriba un correo electrónico válido."; return; }
          if (p.length < 8) { err.textContent = "La contraseña debe tener al menos 8 caracteres."; return; }
          if (p !== p2) { err.textContent = "Las contraseñas no coinciden."; return; }
          btn.disabled = true; err.textContent = "";
          try { const s = await instalar({ nombre: n, usuario: u, clave: p }); div.remove(); resolver(s); }
          catch (e) { err.textContent = e.message || "No fue posible crear la cuenta."; btn.disabled = false; }
        });
      };
      if (ingresar) vistaIngreso(); else vistaInstalar();
    });
  }

  // ------------------------------------------------------------------
  // Motor local (navegador)
  // ------------------------------------------------------------------
  async function sha256(t) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  function motorLocal() {
    const KEY = "portal-mantenimiento-ensma:v1";
    let datos = {};
    try { datos = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { datos = {}; }
    const oyentes = new Set();
    const persistir = () => {
      try { localStorage.setItem(KEY, JSON.stringify(datos)); }
      catch (e) { throw errorCon("quota_exceeded", "El navegador no tiene espacio para más registros."); }
      oyentes.forEach((f) => f());
    };
    const col = (c) => (datos[c] = datos[c] || {});
    const snapDoc = (id, body) => ({ id, exists: body !== undefined, data: () => body, metadata: { fromCache: false, hasPendingWrites: false } });
    function consulta(c, orden, lim) {
      return {
        orderBy(campo, dir = "asc") { return consulta(c, { campo, dir }, lim); },
        limit(n) { return consulta(c, orden, n); },
        _docs() {
          let filas = Object.entries(col(c)).map(([id, b]) => snapDoc(id, b));
          if (orden) filas.sort((a, b) => { const x = a.data()[orden.campo] ?? "", y = b.data()[orden.campo] ?? ""; return (x < y ? -1 : x > y ? 1 : 0) * (orden.dir === "desc" ? -1 : 1); });
          return lim ? filas.slice(0, lim) : filas;
        },
        async get() { const d = this._docs(); return { docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false } }; },
        onSnapshot(next) { const f = () => { const d = this._docs(); next({ docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }); }; oyentes.add(f); setTimeout(f, 0); return () => oyentes.delete(f); },
        doc(id) { return referencia(c, id || Math.random().toString(36).slice(2, 12)); },
        async add(b) { const r = this.doc(); await r.set(b); return r; },
      };
    }
    function referencia(c, id) {
      return {
        id, path: c + "/" + id,
        async get() { return snapDoc(id, col(c)[id]); },
        async set(b) { col(c)[id] = JSON.parse(JSON.stringify(b)); persistir(); },
        async update(b) { if (!col(c)[id]) throw errorCon("invalid_argument", "El documento no existe."); col(c)[id] = Object.assign({}, col(c)[id], JSON.parse(JSON.stringify(b))); persistir(); },
        async delete() { delete col(c)[id]; persistir(); },
        onSnapshot(next) { const f = () => next(snapDoc(id, col(c)[id])); oyentes.add(f); setTimeout(f, 0); return () => oyentes.delete(f); },
      };
    }
    const db = { collection: (c) => consulta(c), doc: (ruta) => { const p = ruta.split("/"); return referencia(p.slice(0, -1).join("/"), p[p.length - 1]); } };

    // usuarios (solo en este navegador)
    const UKEY = KEY + ":usuarios", SKEY = KEY + ":sesion";
    const leerU = () => { try { return JSON.parse(localStorage.getItem(UKEY) || "{}"); } catch (_) { return {}; } };
    const guardarU = (u) => localStorage.setItem(UKEY, JSON.stringify(u));
    const publico = (id, u) => ({ uid: id, usuario: u.usuario, nombre: u.nombre, cargo: u.cargo || "", rol: u.rol, activo: u.activo !== false, creado: u.creado, correo: esCorreo(u.usuario) ? u.usuario : "", debeCambiar: !!u.debeCambiar });
    async function crearInterno({ usuario, nombre, cargo, rol, clave }) {
      const us = leerU();
      if (!okUsuario(usuario)) throw errorCon("invalid_argument", "Correo no válido: " + (usuario || "(vacío)") + ".");
      if (Object.values(us).some((x) => x.usuario === usuario)) throw errorCon("invalid_argument", "Ya existe un usuario con el correo " + usuario + ".");
      if (!ROLES.includes(rol)) throw errorCon("invalid_argument", "Rol no válido.");
      if (!clave || clave.length < 8) throw errorCon("invalid_argument", "La contraseña debe tener al menos 8 caracteres.");
      const sal = Math.random().toString(36).slice(2, 12); const id = "u-" + Math.random().toString(36).slice(2, 10);
      us[id] = { usuario, nombre, cargo: cargo || "", rol, activo: true, sal, hash: await sha256(sal + clave), creado: new Date().toISOString(), debeCambiar: arguments[0].debeCambiar !== false };
      guardarU(us); return publico(id, us[id]);
    }
    function sesionDe(id) {
      const u = leerU()[id];
      const s = {
        uid: id, usuario: u.usuario, nombre: u.nombre, cargo: u.cargo || "", rol: u.rol, modo: "local", soportaRestablecer: true, debeCambiar: !!u.debeCambiar, puedeNotificar: false,
        async salir() { sessionStorage.removeItem(SKEY); location.reload(); },
        async cambiarClave(actual, nueva) {
          const us = leerU(); const yo = us[id];
          if ((await sha256(yo.sal + actual)) !== yo.hash) throw errorCon("invalid_argument", "La contraseña actual no es correcta.");
          if (!nueva || nueva.length < 8) throw errorCon("invalid_argument", "La nueva contraseña debe tener al menos 8 caracteres.");
          if (actual === nueva) throw errorCon("invalid_argument", "La nueva contraseña debe ser distinta de la actual.");
          yo.hash = await sha256(yo.sal + nueva); yo.debeCambiar = false; guardarU(us); s.debeCambiar = false;
        },
        usuarios: {
          async listar() { const us = leerU(); return Object.entries(us).map(([k, v]) => publico(k, v)); },
          async crear(d) { if (s.rol !== "Rector") throw errorCon("invalid_argument", "Solo el Rector crea usuarios."); return { usuario: await crearInterno(d), correo: "" }; },
          async crearLote(lista, notificar) { const out = []; for (const d of lista) { try { out.push(Object.assign({ correo: d.usuario, ok: true }, await s.usuarios.crear(d, notificar))); } catch (e) { out.push({ correo: d.usuario, ok: false, mensaje: e.message }); } } return out; },
          async actualizar(uid, cambios) {
            if (s.rol !== "Rector") throw errorCon("invalid_argument", "Solo el Rector modifica usuarios.");
            const us = leerU(); if (!us[uid]) throw errorCon("invalid_argument", "El usuario no existe.");
            if (uid === id && (cambios.rol && cambios.rol !== "Rector" || cambios.activo === false)) throw errorCon("invalid_argument", "No puede quitarse a sí mismo el rol de Rector ni desactivar su propia cuenta.");
            ["rol", "activo", "nombre", "cargo"].forEach((k) => { if (k in cambios) us[uid][k] = cambios[k]; }); guardarU(us);
          },
          async restablecerClave(uid, nueva) {
            if (s.rol !== "Rector") throw errorCon("invalid_argument", "Solo el Rector restablece contraseñas.");
            if (!nueva || nueva.length < 8) throw errorCon("invalid_argument", "La contraseña debe tener al menos 8 caracteres.");
            const us = leerU(); us[uid].hash = await sha256(us[uid].sal + nueva); us[uid].debeCambiar = true; guardarU(us);
          },
        },
      };
      return s;
    }
    async function iniciarSesion() {
      localStorage.removeItem(SKEY);
      const guardada = sessionStorage.getItem(SKEY); const us = leerU();
      if (guardada && us[guardada] && us[guardada].activo !== false) return sesionDe(guardada);
      const hay = Object.keys(us).length > 0;
      return pantallaIngreso({
        nota: "Modo local: los usuarios y registros se guardan solo en este navegador.",
        ingresar: hay ? async (usuario, clave, rol) => {
          const lista = leerU(); const par = Object.entries(lista).find(([, v]) => v.usuario === usuario);
          if (!par || (await sha256(par[1].sal + clave)) !== par[1].hash) throw errorCon("invalid_argument", "Usuario o contraseña incorrectos.");
          if (par[1].activo === false) throw errorCon("invalid_argument", "Esta cuenta está desactivada. Comuníquese con rectoría.");
          if (par[1].rol !== rol) throw errorRol(rol);
          sessionStorage.setItem(SKEY, par[0]); return sesionDe(par[0]);
        } : null,
        instalar: hay ? null : async ({ nombre, usuario, clave }) => { const u = await crearInterno({ usuario, nombre, cargo: "Rector(a)", rol: "Rector", clave, debeCambiar: false }); sessionStorage.setItem(SKEY, u.uid); return sesionDe(u.uid); },
      });
    }
    return { iniciarSesion, db };
  }

  // ------------------------------------------------------------------
  // Motor Firebase
  // ------------------------------------------------------------------
  function cargarScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No se pudo cargar " + src)); document.head.appendChild(s); }); }
  const mapaError = (e) => {
    const c = e && e.code;
    return errorCon(c === "permission-denied" || c === "unauthenticated" ? "invalid_argument" : c === "resource-exhausted" ? "quota_exceeded" : c === "not-found" ? "invalid_argument" : "unavailable", e && e.message ? e.message : "Error de almacenamiento");
  };
  function envolverDb(fs) {
    const envQuery = (q) => ({
      orderBy: (campo, dir) => envQuery(q.orderBy(campo, dir || "asc")),
      limit: (n) => envQuery(q.limit(n)),
      get: () => q.get().catch((e) => { throw mapaError(e); }),
      onSnapshot: (next, err) => q.onSnapshot({ includeMetadataChanges: true }, (s) => next({ docs: s.docs.map((d) => ({ id: d.id, exists: true, data: () => d.data(), metadata: d.metadata })), size: s.size, empty: s.empty, metadata: s.metadata, docChanges: () => s.docChanges() }), (e) => err && err(mapaError(e))),
    });
    const envRef = (r) => ({
      id: r.id, path: r.path,
      get: () => r.get().then((d) => ({ id: d.id, exists: d.exists, data: () => d.data(), metadata: d.metadata })).catch((e) => { throw mapaError(e); }),
      set: (b) => r.set(b).catch((e) => { throw mapaError(e); }),
      update: (b) => r.update(b).catch((e) => { throw mapaError(e); }),
      delete: () => r.delete().catch((e) => { throw mapaError(e); }),
      onSnapshot: (next, err) => r.onSnapshot((d) => next({ id: d.id, exists: d.exists, data: () => d.data(), metadata: d.metadata }), (e) => err && err(mapaError(e))),
    });
    return {
      collection: (c) => { const ref = fs.collection(c); return Object.assign(envQuery(ref), { doc: (id) => envRef(id ? ref.doc(id) : ref.doc()), add: (b) => ref.add(b).then(envRef).catch((e) => { throw mapaError(e); }) }); },
      doc: (ruta) => envRef(fs.doc(ruta)),
    };
  }
  const correoDe = (u) => (esCorreo(u) ? u : `${u}@${DOMINIO_USUARIOS}`);
  const mensajeAuth = (e) => {
    const c = (e && e.code) || "";
    if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-email")) return "Usuario o contraseña incorrectos.";
    if (c.includes("too-many-requests")) return "Demasiados intentos. Espere unos minutos e intente de nuevo.";
    if (c.includes("email-already-in-use")) return "Ese usuario ya existe.";
    if (c.includes("weak-password")) return "La contraseña es muy débil: use al menos 8 caracteres.";
    if (c.includes("network")) return "Sin conexión a internet.";
    return (e && e.message) || "Error de autenticación.";
  };
  async function motorFirebase() {
    await cargarScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
    await Promise.all([cargarScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`), cargarScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore-compat.js`)]);
    const app = window.firebase.initializeApp(CFG.firebase);
    const auth = app.auth(), fs = app.firestore(), db = envolverDb(fs);
    await auth.setPersistence(window.firebase.auth.Auth.Persistence.SESSION).catch(() => {});

    async function perfil(user) {
      const d = await fs.collection("usuarios").doc(user.uid).get().catch(() => null);
      if (!d || !d.exists) throw errorCon("invalid_argument", "Su cuenta no tiene un rol asignado. Comuníquese con rectoría.");
      const p = d.data(); if (p.activo === false) throw errorCon("invalid_argument", "Esta cuenta está desactivada. Comuníquese con rectoría.");
      return p;
    }
    function sesionDe(user, p) {
      const s = {
        uid: user.uid, usuario: p.usuario, nombre: p.nombre, cargo: p.cargo || "", rol: p.rol, modo: "firebase", soportaRestablecer: false, debeCambiar: false, puedeNotificar: false,
        async salir() { await auth.signOut(); location.reload(); },
        async cambiarClave(actual, nueva) {
          if (!nueva || nueva.length < 8) throw errorCon("invalid_argument", "La nueva contraseña debe tener al menos 8 caracteres.");
          try { const cred = window.firebase.auth.EmailAuthProvider.credential(user.email, actual); await user.reauthenticateWithCredential(cred); await user.updatePassword(nueva); }
          catch (e) { throw errorCon("invalid_argument", mensajeAuth(e).replace("Usuario o contraseña incorrectos.", "La contraseña actual no es correcta.")); }
        },
        usuarios: {
          async listar() { const q = await fs.collection("usuarios").get(); return q.docs.map((d) => Object.assign({ uid: d.id }, d.data(), { activo: d.data().activo !== false })); },
          async crear({ usuario, nombre, cargo, rol, clave }) {
            if (!okUsuario(usuario)) throw errorCon("invalid_argument", "Correo no válido: " + (usuario || "(vacío)") + ".");
            if (!ROLES.includes(rol)) throw errorCon("invalid_argument", "Rol no válido.");
            const sec = window.firebase.apps.find((a) => a.name === "alta") || window.firebase.initializeApp(CFG.firebase, "alta");
            let nuevo;
            try { nuevo = await sec.auth().createUserWithEmailAndPassword(correoDe(usuario), clave); }
            catch (e) { throw errorCon("invalid_argument", mensajeAuth(e)); }
            const uid = nuevo.user.uid; await sec.auth().signOut();
            try { await fs.collection("usuarios").doc(uid).set({ usuario, nombre, cargo: cargo || "", rol, activo: true, creado: new Date().toISOString(), creadoPor: user.uid }); }
            catch (e) { throw mapaError(e); }
            return { usuario: { uid, usuario, nombre, cargo, rol, activo: true }, correo: "" };
          },
          async crearLote(lista) { const out = []; for (const d of lista) { try { out.push(Object.assign({ correo: d.usuario, ok: true }, await s.usuarios.crear(d))); } catch (e) { out.push({ correo: d.usuario, ok: false, mensaje: e.message }); } } return out; },
          async actualizar(uid, cambios) {
            if (uid === user.uid && (cambios.rol && cambios.rol !== "Rector" || cambios.activo === false)) throw errorCon("invalid_argument", "No puede quitarse a sí mismo el rol de Rector ni desactivar su propia cuenta.");
            const c = {}; ["rol", "activo", "nombre", "cargo"].forEach((k) => { if (k in cambios) c[k] = cambios[k]; });
            await fs.collection("usuarios").doc(uid).update(c).catch((e) => { throw mapaError(e); });
          },
          async restablecerClave() { throw errorCon("invalid_argument", "En Firebase la contraseña de otro usuario se restablece desde la consola de Firebase (Authentication)."); },
        },
      };
      return s;
    }
    const actual = await new Promise((ok) => { const off = auth.onAuthStateChanged((u) => { off(); ok(u); }); });
    if (actual) { try { return { db, sesion: sesionDe(actual, await perfil(actual)) }; } catch (e) { await auth.signOut(); } }
    const sesion = await pantallaIngreso({
      ingresar: async (usuario, clave, rol) => {
        let cred; try { cred = await auth.signInWithEmailAndPassword(correoDe(usuario), clave); } catch (e) { throw errorCon("invalid_argument", mensajeAuth(e)); }
        try { const p = await perfil(cred.user); if (p.rol !== rol) throw errorRol(rol); return sesionDe(cred.user, p); } catch (e) { await auth.signOut(); throw e; }
      },
      instalar: async ({ nombre, usuario, clave }) => {
        let cred; try { cred = await auth.createUserWithEmailAndPassword(correoDe(usuario), clave); } catch (e) { throw errorCon("invalid_argument", mensajeAuth(e)); }
        const p = { usuario, nombre, cargo: "Rector(a)", rol: "Rector", activo: true, creado: new Date().toISOString() };
        const lote = fs.batch();
        lote.set(fs.collection("usuarios").doc(cred.user.uid), p);
        lote.set(fs.collection("config").doc("instalacion"), { rector: cred.user.uid, fecha: new Date().toISOString() });
        try { await lote.commit(); }
        catch (e) { await cred.user.delete().catch(() => {}); throw errorCon("invalid_argument", "El portal ya tiene una cuenta de Rector. Pida su usuario a rectoría."); }
        return sesionDe(cred.user, p);
      },
    });
    return { db, sesion };
  }


  // ------------------------------------------------------------------
  // Motor Google (Google Sheets + Apps Script)
  // ------------------------------------------------------------------
  function motorGoogle() {
    const URL_API = CFG.urlAppsScript;
    const TKEY = "portal-mantenimiento-ensma:token";
    const PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    let TOKEN = sessionStorage.getItem(TKEY) || null;
    async function api(accion, datos) {
      let r;
      try { r = await fetch(URL_API, { method: "POST", body: JSON.stringify(Object.assign({ accion, token: TOKEN }, datos || {})) }); }
      catch (e) { throw errorCon("unavailable", "Sin conexión con el servidor de Google. Revise la conexión a internet."); }
      let j; try { j = await r.json(); } catch (e) { throw errorCon("unavailable", "El servidor de Google no respondió correctamente. Revise la URL en js/config.js."); }
      if (!j.ok) {
        if (j.codigo === "sesion" && TOKEN && accion !== "perfil") { sessionStorage.removeItem(TKEY); location.reload(); }
        throw errorCon(j.codigo === "cuota" ? "quota_exceeded" : "invalid_argument", j.mensaje || "Error del servidor.");
      }
      return j;
    }

    // --- datos en memoria (no se guardan en el navegador) ---
    const crudo = {}; const subs = {}; const fotos = {}; const pedidas = new Set();
    let version = null, ocupado = false, pendienteForzar = false;
    const notificar = (col) => (subs[col] || []).forEach((f) => f());
    const notificarTodo = () => Object.keys(subs).forEach(notificar);
    function pedirFoto(id) {
      if (pedidas.has(id)) return; pedidas.add(id);
      api("foto", { id }).then((r) => { fotos[id] = r.data; notificarTodo(); }).catch(() => {});
    }
    const resolverValor = (v) => {
      if (typeof v === "string" && v.indexOf("drive:") === 0) { const id = v.slice(6); if (fotos[id]) return fotos[id]; pedirFoto(id); return PLACEHOLDER; }
      return v;
    };
    function resolver(doc) { const o = {}; Object.keys(doc).forEach((k) => { const v = doc[k]; o[k] = Array.isArray(v) ? v.map(resolverValor) : resolverValor(v); }); return o; }
    async function sincronizar(forzar) {
      const cols = Object.keys(subs); if (!cols.length) return;
      if (ocupado) { pendienteForzar = pendienteForzar || forzar; return; }
      ocupado = true;
      try {
        if (!forzar && version !== null) { const v = (await api("version")).version; if (v === version) return; }
        const r = await api("leer", { cols });
        version = r.version;
        Object.keys(r.datos).forEach((col) => { crudo[col] = {}; r.datos[col].forEach((d) => { crudo[col][d.id] = d; }); notificar(col); });
      } catch (e) { console.warn(e); }
      finally { ocupado = false; if (pendienteForzar) { pendienteForzar = false; sincronizar(true); } }
    }
    setInterval(() => { if (document.visibilityState === "visible") sincronizar(false); }, 15000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sincronizar(false); });
    let programado = null;
    const suscribir = (col, f) => { (subs[col] = subs[col] || []).push(f); clearTimeout(programado); programado = setTimeout(() => sincronizar(true), 50); return () => { subs[col] = (subs[col] || []).filter((x) => x !== f); }; };
    const snapDoc = (id, d) => ({ id, exists: !!d, data: () => (d ? resolver(d) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });

    function consulta(c, orden, lim) {
      const docs = () => {
        let filas = Object.values(crudo[c] || {}).map((d) => snapDoc(d.id, d));
        if (orden) filas.sort((a, b) => { const x = a.data()[orden.campo] ?? "", y = b.data()[orden.campo] ?? ""; return (x < y ? -1 : x > y ? 1 : 0) * (orden.dir === "desc" ? -1 : 1); });
        return lim ? filas.slice(0, lim) : filas;
      };
      return {
        orderBy(campo, dir = "asc") { return consulta(c, { campo, dir }, lim); },
        limit(n) { return consulta(c, orden, n); },
        async get() { await sincronizar(true); const d = docs(); return { docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false } }; },
        onSnapshot(next) { return suscribir(c, () => { const d = docs(); next({ docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }); }); },
        doc(id) { return referencia(c, id || "d-" + Math.random().toString(36).slice(2, 12)); },
        async add(b) { const r = this.doc(); await r.set(b); return r; },
      };
    }
    async function escribir(c, id, datos, modo) {
      const r = await api("escribir", { col: c, id, datos, modo });
      if (r.correo) window.dispatchEvent(new CustomEvent("portal-correo", { detail: r.correo }));
      (crudo[c] = crudo[c] || {})[id] = r.doc;
      Object.keys(datos).forEach((k) => { const v = datos[k]; const r2 = r.doc[k]; if (typeof v === "string" && v.indexOf("data:image") === 0 && typeof r2 === "string") fotos[r2.slice(6)] = v; if (Array.isArray(v) && Array.isArray(r2)) v.forEach((x, i) => { if (typeof x === "string" && x.indexOf("data:image") === 0 && typeof r2[i] === "string") fotos[r2[i].slice(6)] = x; }); });
      notificar(c); setTimeout(() => sincronizar(false), 300);
    }
    function referencia(c, id) {
      return {
        id, path: c + "/" + id,
        async get() { await sincronizar(true); return snapDoc(id, (crudo[c] || {})[id]); },
        set: (b) => escribir(c, id, JSON.parse(JSON.stringify(b)), "set"),
        update: (b) => escribir(c, id, JSON.parse(JSON.stringify(b)), "update"),
        async delete() { await api("borrar", { col: c, id }); if (crudo[c]) delete crudo[c][id]; notificar(c); },
        onSnapshot(next) { return suscribir(c, () => next(snapDoc(id, (crudo[c] || {})[id]))); },
      };
    }
    const db = { collection: (c) => consulta(c), doc: (ruta) => { const p = ruta.split("/"); return referencia(p.slice(0, -1).join("/"), p[p.length - 1]); } };

    function sesionDe(perfil) {
      const s = {
        uid: perfil.uid, usuario: perfil.usuario, nombre: perfil.nombre, cargo: perfil.cargo || "", rol: perfil.rol, modo: "google", soportaRestablecer: true, debeCambiar: !!perfil.debeCambiar, puedeNotificar: true,
        async salir() { await api("salir").catch(() => {}); sessionStorage.removeItem(TKEY); location.reload(); },
        async cambiarClave(actual, nueva) { await api("cambiarClave", { actual, nueva }); s.debeCambiar = false; },
        usuarios: {
          async listar() { return (await api("usuarios_listar")).usuarios; },
          async crear(d, notificar) { const r = await api("usuarios_crear", { datos: d, notificar: notificar !== false }); return { usuario: r.usuario, correo: r.correo || "" }; },
          async crearLote(lista, notificar) { return (await api("usuarios_crear_lote", { lista, notificar: notificar !== false })).resultados; },
          async actualizar(uid, cambios) { await api("usuarios_actualizar", { uid, cambios }); },
          async restablecerClave(uid, clave) { await api("usuarios_restablecer", { uid, clave }); },
        },
      };
      return s;
    }
    async function iniciarSesion() {
      if (TOKEN) { try { return sesionDe((await api("perfil")).perfil); } catch (e) { TOKEN = null; sessionStorage.removeItem(TKEY); } }
      let instalado = true;
      try { instalado = (await api("estado")).instalado; }
      catch (e) { const el = document.getElementById("estadoDb"); if (el) { el.className = "banner warn"; el.style.display = ""; el.textContent = e.message; } }
      const entrar = (r) => { TOKEN = r.token; sessionStorage.setItem(TKEY, TOKEN); return sesionDe(r.perfil); };
      return pantallaIngreso({
        nota: "Los datos se guardan en la hoja de cálculo institucional de Google.",
        ingresar: instalado ? async (usuario, clave, rol) => entrar(await api("ingresar", { usuario, clave, rol })) : null,
        instalar: instalado ? null : async ({ nombre, usuario, clave }) => entrar(await api("instalar", { nombre, usuario, clave })),
      });
    }
    return { db, iniciarSesion };
  }
  // ------------------------------------------------------------------
  // Punto de entrada
  // ------------------------------------------------------------------
  let motor = null;
  const iniciar = () => {
    if (!motor) {
      motor = (async () => {
        if (CFG.modo === "firebase" && CFG.firebase && CFG.firebase.apiKey) return motorFirebase();
        if (CFG.modo === "google" && CFG.urlAppsScript) { const g = motorGoogle(); return { db: g.db, sesion: await g.iniciarSesion() }; }
        const m = motorLocal(); return { db: m.db, sesion: await m.iniciarSesion() };
      })().catch((e) => { console.error(e); const el = document.getElementById("estadoDb"); if (el) { el.className = "banner warn"; el.style.display = ""; el.textContent = "No se pudo conectar con la base de datos. Revise js/config.js y la conexión a internet."; } return { db: null, sesion: null }; });
    }
    return motor;
  };
  window.claude = {
    use: async (nombre) => {
      if (nombre === "downloads") return downloads;
      const m = await iniciar();
      if (nombre === "sesion") return m.sesion;
      if (nombre === "db") return m.sesion ? m.db : null;
      if (nombre === "user") return m.sesion ? { id: async () => m.sesion.uid, can: async () => true, isOwner: () => m.sesion.rol === "Rector", canEdit: () => m.sesion.rol === "Rector" } : null;
      return null;
    },
  };
})();
