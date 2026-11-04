/*
 * Capa de almacenamiento del portal.
 * Expone window.claude.use("db" | "user" | "downloads") con la misma interfaz que usa
 * index.html, sobre dos motores intercambiables:
 *   - local:    localStorage del navegador (pruebas, un solo equipo)
 *   - firebase: Cloud Firestore + inicio de sesión con Google (uso institucional)
 */
(function () {
  "use strict";
  const CFG = window.PORTAL_CONFIG || { modo: "local" };
  const FB_VER = "10.12.2";

  // ------------------------------------------------------------------
  // Descargas: archivo generado por el navegador
  // ------------------------------------------------------------------
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { status: "saved" };
    },
  };

  // ------------------------------------------------------------------
  // Motor local (localStorage)
  // ------------------------------------------------------------------
  function motorLocal() {
    const KEY = "portal-mantenimiento-ensma:v1";
    let datos = {};
    try { datos = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { datos = {}; }
    const oyentes = new Set();
    const persistir = () => {
      try { localStorage.setItem(KEY, JSON.stringify(datos)); }
      catch (e) { const err = new Error("El navegador no tiene espacio para más registros."); err.code = "quota_exceeded"; throw err; }
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
        onSnapshot(next) {
          const f = () => { const d = this._docs(); next({ docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }); };
          oyentes.add(f); setTimeout(f, 0); return () => oyentes.delete(f);
        },
        doc(id) { return referencia(c, id || Math.random().toString(36).slice(2, 12)); },
        async add(b) { const r = this.doc(); await r.set(b); return r; },
      };
    }
    function referencia(c, id) {
      return {
        id, path: c + "/" + id,
        async get() { return snapDoc(id, col(c)[id]); },
        async set(b) { col(c)[id] = JSON.parse(JSON.stringify(b)); persistir(); },
        async update(b) {
          if (!col(c)[id]) { const e = new Error("El documento no existe."); e.code = "invalid_argument"; throw e; }
          col(c)[id] = Object.assign({}, col(c)[id], JSON.parse(JSON.stringify(b))); persistir();
        },
        async delete() { delete col(c)[id]; persistir(); },
        onSnapshot(next) { const f = () => next(snapDoc(id, col(c)[id])); oyentes.add(f); setTimeout(f, 0); return () => oyentes.delete(f); },
      };
    }
    const db = {
      collection: (c) => consulta(c),
      doc: (ruta) => { const p = ruta.split("/"); return referencia(p.slice(0, -1).join("/"), p[p.length - 1]); },
    };
    let uid = null;
    try { uid = localStorage.getItem(KEY + ":uid") || ("local-" + Math.random().toString(36).slice(2, 10)); localStorage.setItem(KEY + ":uid", uid); } catch (_) { uid = "local"; }
    const user = { id: async () => uid, can: async () => true, isOwner: () => true, canEdit: () => true };
    barraSesion({ texto: "Modo local: los registros se guardan solo en este navegador.", aviso: true });
    return { db, user };
  }

  // ------------------------------------------------------------------
  // Motor Firebase (Firestore + Google)
  // ------------------------------------------------------------------
  function cargarScript(src) {
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No se pudo cargar " + src)); document.head.appendChild(s); });
  }
  const mapaError = (e) => {
    const c = e && e.code;
    const out = new Error(e && e.message ? e.message : "Error de almacenamiento");
    out.code = c === "permission-denied" || c === "unauthenticated" ? "invalid_argument" : c === "resource-exhausted" ? "quota_exceeded" : c === "not-found" ? "invalid_argument" : "unavailable";
    return out;
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
  async function motorFirebase() {
    await cargarScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
    await Promise.all([cargarScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`), cargarScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore-compat.js`)]);
    const app = window.firebase.initializeApp(CFG.firebase);
    const auth = app.auth();
    const usuario = await new Promise((ok) => { const off = auth.onAuthStateChanged((u) => { off(); ok(u); }); });
    const proveedor = new window.firebase.auth.GoogleAuthProvider();
    if (CFG.dominioPermitido) proveedor.setCustomParameters({ hd: CFG.dominioPermitido, prompt: "select_account" });
    const entrar = async () => { try { await auth.signInWithPopup(proveedor); location.reload(); } catch (e) { alertaSesion("No se pudo iniciar sesión: " + (e && e.message ? e.message : "intente de nuevo.")); } };
    const salir = async () => { await auth.signOut(); location.reload(); };

    if (!usuario) {
      barraSesion({ texto: "Inicie sesión con su cuenta institucional para enviar y consultar los formatos.", boton: "Iniciar sesión con Google", accion: entrar, aviso: true });
      return { db: null, user: null };
    }
    const correo = usuario.email || "";
    if (CFG.dominioPermitido && !correo.toLowerCase().endsWith("@" + CFG.dominioPermitido.toLowerCase())) {
      barraSesion({ texto: `La cuenta ${correo} no pertenece al dominio institucional (${CFG.dominioPermitido}).`, boton: "Cambiar de cuenta", accion: salir, aviso: true });
      return { db: null, user: null };
    }
    barraSesion({ texto: "Sesión: " + correo, boton: "Cerrar sesión", accion: salir });
    const db = envolverDb(app.firestore());
    const user = { id: async () => usuario.uid, can: async () => null, isOwner: () => false, canEdit: () => false };
    return { db, user };
  }

  // ------------------------------------------------------------------
  // Barra de sesión en el encabezado
  // ------------------------------------------------------------------
  function barraSesion({ texto, boton, accion, aviso }) {
    const pintar = () => {
      const cab = document.querySelector(".top-in"); if (!cab) return;
      let b = document.getElementById("sesion");
      if (!b) { b = document.createElement("div"); b.id = "sesion"; b.style.cssText = "margin-left:auto;display:flex;gap:10px;align-items:center;font-size:13px;text-align:right;max-width:340px"; cab.appendChild(b); }
      b.innerHTML = "";
      const t = document.createElement("span"); t.textContent = texto; t.style.color = aviso ? "var(--magenta)" : "var(--tenue)"; b.appendChild(t);
      if (boton) { const k = document.createElement("button"); k.type = "button"; k.className = "btn"; k.textContent = boton; k.style.whiteSpace = "nowrap"; k.addEventListener("click", accion); b.appendChild(k); }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pintar); else pintar();
  }
  function alertaSesion(msg) { const e = document.getElementById("estadoDb"); if (e) { e.className = "banner warn"; e.style.display = ""; e.textContent = msg; } }

  // ------------------------------------------------------------------
  // Punto de entrada compatible: window.claude.use(nombre)
  // ------------------------------------------------------------------
  let motor = null;
  const iniciar = () => {
    if (!motor) {
      motor = (CFG.modo === "firebase" && CFG.firebase && CFG.firebase.apiKey ? motorFirebase() : Promise.resolve(motorLocal()))
        .catch((e) => { console.error(e); alertaSesion("No se pudo conectar con la base de datos. Revise js/config.js y la conexión a internet."); return { db: null, user: null }; });
    }
    return motor;
  };
  window.claude = {
    use: async (nombre) => {
      if (nombre === "downloads") return downloads;
      const m = await iniciar();
      if (nombre === "db") return m.db;
      if (nombre === "user") return m.user;
      return null;
    },
  };
})();
