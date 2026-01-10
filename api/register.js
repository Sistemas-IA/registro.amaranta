// Node 18 ESM
import { google } from "googleapis";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/* =========================
   0) CONFIG / ENV
========================= */
const ALLOWED_ORIGIN = "https://registro.amaranta.ar";

const SPREADSHEET_ID = (process.env.SPREADSHEET_ID || "").trim();
const SHEET_NAME = (process.env.SHEET_NAME || "Clientes").trim();
const FAIL_SHEET = "IntentosFallidos";

const RECAPTCHA_SECRET = (process.env.RECAPTCHA_SECRET || "").trim();

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

/* =========================
   1) UPSTASH (solo rate-limit)
   - Fail-open: si Upstash falla/no está, NO rompe el registro.
========================= */
const redis =
  UPSTASH_URL && UPSTASH_TOKEN ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN }) : null;

function makeLimiter(prefix, limit, window) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
    analytics: true,
  });
}

// IP: 5 envíos / 5 min
const rlIp = makeLimiter("ip", 5, "5 m");
// DNI: 3 envíos / 1 h
const rlDni = makeLimiter("dni", 3, "1 h");
// Email: 3 envíos / 1 h
const rlEmail = makeLimiter("email", 3, "1 h");
// Tel: 3 envíos / 1 h
const rlTel = makeLimiter("tel", 3, "1 h");
// Global: 100 envíos / 5 min
const rlGlobal = makeLimiter("glob", 100, "5 m");

async function limitOrPass(limiter, key) {
  if (!limiter) return { success: true };
  try {
    return await limiter.limit(String(key || ""));
  } catch {
    // Fail-open
    return { success: true };
  }
}

/* =========================
   2) GOOGLE SHEETS
========================= */
const auth = new google.auth.GoogleAuth({
  credentials: safeJsonParse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

/* =========================
   3) VALIDACIONES
========================= */
const RE_NAME = /^[\p{L}\p{M}](?:[\p{L}\p{M}\s'’-]){1,49}$/u; // 2..50
const RE_DNI = /^[1-9]\d{6,7}$/; // 7-8 dígitos, sin 0 inicial
const RE_COD = /^\d{2,4}$/;
const RE_NUM = /^\d{6,9}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_LISTA_1_50 = /^(?:[1-9]|[1-4]\d|50)$/;

/* =========================
   4) HANDLER
========================= */
export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const ip =
    (req.headers["x-forwarded-for"] ?? "").toString().split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  // Global + IP rate limit (Upstash)
  if (!(await limitOrPass(rlGlobal, "global")).success) {
    await logFail({ ip, motivo: "Rate-limit global" });
    return res.status(503).json({ ok: false, error: "Servicio saturado, intentá en unos minutos." });
  }
  if (!(await limitOrPass(rlIp, ip)).success) {
    await logFail({ ip, motivo: "Rate-limit IP" });
    return res.status(429).json({ ok: false, error: "Demasiadas peticiones, intentá luego." });
  }

  let ctx = { ip, dni: "", telefono: "", email: "" };

  try {
    const body = req.body || {};

    // Honeypot
    const website = str(body.website);
    if (website) {
      ctx.motivo = "Honeypot";
      throw httpError(400, "Solicitud rechazada.");
    }

    // Campos base (antes de normalizar)
    const nombre = str(body.nombre);
    const apellido = str(body.apellido);
    const dni = digits(body.dni);
    const codigo = digits(body.codigo);
    const numero = digits(body.numero);
    const email = str(body.email).toLowerCase();

    const direccion = str(body.direccion);
    const comentarios = str(body.comentarios);
    const lista = str(body.lista);
    const recaptchaToken = str(body.recaptchaToken);

    // Contexto de log (ya con datos)
    ctx.dni = dni;
    ctx.email = email;

    // Required
    if (!nombre) throw httpError(400, "Nombre es obligatorio.");
    if (!apellido) throw httpError(400, "Apellido es obligatorio.");
    if (!dni) throw httpError(400, "DNI es obligatorio.");
    if (!codigo) throw httpError(400, "Cod. área es obligatorio.");
    if (!numero) throw httpError(400, "Número de celular es obligatorio.");
    if (!email) throw httpError(400, "Email es obligatorio.");
    if (!direccion) throw httpError(400, "Dirección es obligatoria.");

    // Format
    if (!RE_NAME.test(nombre)) throw httpError(400, "Nombre inválido.");
    if (!RE_NAME.test(apellido)) throw httpError(400, "Apellido inválido.");
    if (!RE_DNI.test(dni)) throw httpError(400, "DNI inválido.");
    if (!RE_COD.test(codigo)) throw httpError(400, "Código de área inválido.");
    if (!RE_NUM.test(numero)) throw httpError(400, "Número inválido.");
    if (email.length > 100 || !RE_EMAIL.test(email)) throw httpError(400, "Email inválido.");
    if (direccion.length > 100) throw httpError(400, "Dirección demasiado larga (máx 100).");
    if (comentarios.length > 250) throw httpError(400, "Comentarios demasiado largos (máx 250).");
    if (lista && !RE_LISTA_1_50.test(lista)) throw httpError(400, "Lista inválida (1 a 50).");

    // Tel normalizado
    const telefono = canonTel("549" + codigo + numero);
    ctx.telefono = telefono;

    // Rate-limit por identidad (separados)
    if (dni && !(await limitOrPass(rlDni, dni)).success) {
      ctx.motivo = "Rate-limit DNI";
      throw httpError(429, "Demasiados intentos con ese DNI. Probá más tarde.");
    }
    if (email && !(await limitOrPass(rlEmail, email)).success) {
      ctx.motivo = "Rate-limit Email";
      throw httpError(429, "Demasiados intentos con ese email. Probá más tarde.");
    }
    if (telefono && !(await limitOrPass(rlTel, telefono)).success) {
      ctx.motivo = "Rate-limit Tel";
      throw httpError(429, "Demasiados intentos con ese celular. Probá más tarde.");
    }

    // reCAPTCHA v3
    const score = await verifyCaptcha(recaptchaToken, ip);
    if (score < 0.5) {
      ctx.motivo = `reCAPTCHA score=${score}`;
      throw httpError(400, "reCAPTCHA rechazó la solicitud.");
    }

    // Sanitización (Sheets-safe)
    const safeNombre = sanitize(nombre);
    const safeApellido = sanitize(apellido);
    const safeDni = sanitize(dni);
    const safeEmail = sanitize(email);
    const safeDireccion = sanitize(direccion.slice(0, 100));
    const safeComentarios = sanitize(comentarios.slice(0, 250));
    const safeLista = sanitize(lista.slice(0, 50));

    // Duplicados en Sheets (C:D:E = DNI/Tel/Email)
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!C2:E`,
    });

    const rows = existing?.data?.values || [];
    const dniKey = canonDni(safeDni);
    const telKey = canonTel(telefono);
    const emKey = canonEmail(safeEmail);

    let dupDni = false;
    let dupTel = false;
    let dupEmail = false;

    for (const r of rows) {
      const rDni = canonDni(r?.[0]);
      const rTel = canonTel(r?.[1]);
      const rEm = canonEmail(r?.[2]);

      if (dniKey && rDni && dniKey === rDni) dupDni = true;
      if (telKey && rTel && telKey === rTel) dupTel = true;
      if (emKey && rEm && emKey === rEm) dupEmail = true;

      if (dupDni || dupTel || dupEmail) break;
    }

    if (dupDni || dupTel || dupEmail) {
      const types = [];
      if (dupDni) types.push("DNI");
      if (dupEmail) types.push("Email");
      if (dupTel) types.push("Celular");

      const msg =
        types.length === 1
          ? `Ya existe un cliente con ese ${types[0]}.`
          : `Ya existe un cliente con esos datos: ${types.join(", ")}.`;

      const e = httpError(409, msg);
      e.duplicateTypes = types;
      ctx.motivo = `Duplicado: ${types.join(",")}`;
      throw e;
    }

    // Clave LLNNLL (sin unicidad forzada)
    const clave = generateClave();

    // Append A:O (15 cols)
    const fila = [
      safeNombre,              // A Nombre
      safeApellido,            // B Apellido
      safeDni,                 // C DNI
      telefono,                // D Telefono
      safeEmail,               // E Email
      safeDireccion,           // F Direccion
      safeComentarios,         // G Comentarios
      "Z-00",                  // H Zona
      "Pendiente",             // I Estado
      safeLista,               // J Lista
      new Date().toISOString(),// K Timestamp
      ip,                      // L IP
      clave,                   // M Clave
      0,                       // N Grupo
      "",                      // O Contadores
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [fila] },
    });

    return res.status(200).json({ ok: true, clave });
  } catch (err) {
    const status = Number(err?.status) || 400;
    const msg = err?.message || "Error interno";

    await logFail({
      ip: ctx.ip || ip,
      dni: ctx.dni || "",
      telefono: ctx.telefono || "",
      email: ctx.email || "",
      motivo: ctx.motivo ? `${ctx.motivo} | ${msg}` : msg,
    });

    // si es duplicado, devolvemos también types
    const payload = { ok: false, error: msg };
    if (Array.isArray(err?.duplicateTypes)) payload.duplicateTypes = err.duplicateTypes;

    return res.status(status).json(payload);
  }
}

/* =========================
   HELPERS
========================= */
function safeJsonParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function str(v) {
  return String(v ?? "").trim();
}

function digits(v) {
  return String(v ?? "").replace(/\D+/g, "").trim();
}

function canonDni(v) {
  return digits(v);
}

function canonEmail(v) {
  return str(v).toLowerCase();
}

function canonTel(v) {
  const d = digits(v);
  if (!d) return "";
  return d.startsWith("549") ? d : "549" + d;
}

// Evita fórmula en Sheets + limpia tags
function sanitize(v = "") {
  return String(v)
    .trim()
    .replace(/^[=+\-@]/, "'$&")
    .replace(/[<>]/g, "");
}

// LLNNLL (sin O y sin 0)
function generateClave() {
  const L = "ABCDEFGHIJKLMNPQRSTUVWXYZ";
  const D = "123456789";
  const pick = (s) => s.charAt(Math.floor(Math.random() * s.length));
  return pick(L) + pick(L) + pick(D) + pick(D) + pick(L) + pick(L);
}

async function verifyCaptcha(token, ip) {
  if (!RECAPTCHA_SECRET) return 0;
  if (!token) return 0;

  const params = new URLSearchParams({
    secret: RECAPTCHA_SECRET,
    response: token,
    remoteip: ip,
  });

  const r = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: params,
  }).then((x) => x.json());

  if (!r?.success) return 0;
  return Number(r?.score || 0);
}

// IntentosFallidos: Timestamp | IP | DNI | Telefono | Email | Motivo
async function logFail({ ip = "", dni = "", telefono = "", email = "", motivo = "" }) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${FAIL_SHEET}!A:F`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[new Date().toISOString(), ip, String(dni), String(telefono), String(email), String(motivo).slice(0, 200)]],
      },
    });
  } catch {
    // no-op
  }
}
