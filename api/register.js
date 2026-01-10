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

/* 5 envíos / IP / 5 min */
const rlIp = makeLimiter("ip", 5, "5 m");
/* 2 envíos / DNI o email / 1 h */
const rlId = makeLimiter("id", 2, "1 h");
/* 100 envíos globales / 5 min */
const rlGlobal = makeLimiter("glob", 100, "5 m");

async function limitOrPass(limiter, key) {
  if (!limiter) return { success: true };
  try {
    return await limiter.limit(key);
  } catch {
    // Fail-open: no frenamos el registro si Upstash falla
    return { success: true };
  }
}

/* =========================
   2) GOOGLE SHEETS
========================= */
if (!SPREADSHEET_ID) {
  console.warn("SPREADSHEET_ID faltante");
}

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
  // CORS básico + preflight
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

  // 4.1 Rate limits (Upstash)
  if (!(await limitOrPass(rlIp, ip)).success) {
    await logFail(ip, "Rate-limit IP");
    return res.status(429).json({ ok: false, error: "Demasiadas peticiones, intenta luego." });
  }
  if (!(await limitOrPass(rlGlobal, "global")).success) {
    await logFail(ip, "Rate-limit global");
    return res
      .status(503)
      .json({ ok: false, error: "Servicio saturado, intenta nuevamente en unos minutos." });
  }

  try {
    const body = req.body || {};

    // Honeypot (campo oculto): si viene completo => bot
    const website = str(body.website);
    if (website) throw httpError(400, "Solicitud rechazada.");

    // Campos
    const nombre = str(body.nombre);
    const apellido = str(body.apellido);
    const dni = digits(body.dni);
    const codigo = digits(body.codigo);
    const numero = digits(body.numero);
    const email = str(body.email).toLowerCase();

    const direccion = str(body.direccion);
    const comentarios = str(body.comentarios);
    const lista = str(body.lista); // reservado (si viene, validamos 1..50)
    const recaptchaToken = str(body.recaptchaToken);

    // 4.2 Validación requerida
    if (!nombre) throw httpError(400, "Nombre es obligatorio.");
    if (!apellido) throw httpError(400, "Apellido es obligatorio.");
    if (!dni) throw httpError(400, "DNI es obligatorio.");
    if (!codigo) throw httpError(400, "Cod. área es obligatorio.");
    if (!numero) throw httpError(400, "Número de celular es obligatorio.");
    if (!email) throw httpError(400, "Email es obligatorio.");
    if (!direccion) throw httpError(400, "Dirección es obligatoria.");

    // 4.3 Validación formato
    if (!RE_NAME.test(nombre)) throw httpError(400, "Nombre inválido.");
    if (!RE_NAME.test(apellido)) throw httpError(400, "Apellido inválido.");
    if (!RE_DNI.test(dni)) throw httpError(400, "DNI inválido.");
    if (!RE_COD.test(codigo)) throw httpError(400, "Código de área inválido.");
    if (!RE_NUM.test(numero)) throw httpError(400, "Número inválido.");
    if (email.length > 100 || !RE_EMAIL.test(email)) throw httpError(400, "Email inválido.");
    if (direccion.length > 100) throw httpError(400, "Dirección demasiado larga (máx 100).");
    if (comentarios.length > 250) throw httpError(400, "Comentarios demasiado largos (máx 250).");
    if (lista && !RE_LISTA_1_50.test(lista)) throw httpError(400, "Lista inválida (1 a 50).");

    // 4.4 reCAPTCHA v3
    const score = await verifyCaptcha(recaptchaToken, ip);
    if (score < 0.5) throw httpError(400, "reCAPTCHA rechazó la solicitud.");

    // 4.5 Rate-limit por identidad (DNI o email)
    const identity = dni || email;
    if (identity && !(await limitOrPass(rlId, identity)).success) {
      throw httpError(429, "Demasiados intentos con el mismo DNI/email.");
    }

    // 4.6 Normalización + Sanitización
    const telefono = canonTel("549" + codigo + numero);

    const safeNombre = sanitize(nombre);
    const safeApellido = sanitize(apellido);
    const safeDni = sanitize(dni);
    const safeEmail = sanitize(email);
    const safeDireccion = sanitize(direccion.slice(0, 100));
    const safeComentarios = sanitize(comentarios.slice(0, 250));
    const safeLista = sanitize(lista.slice(0, 50));

    // 4.7 Chequeo duplicados en Sheets (OPCIÓN 1)
    // Leemos solo columnas C:D:E (DNI / Teléfono / Email) para ahorrar.
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!C2:E`,
    });

    const rows = existing?.data?.values || [];
    const dniKey = canonDni(safeDni);
    const telKey = canonTel(telefono);
    const emKey = canonEmail(safeEmail);

    for (const r of rows) {
      const rDni = canonDni(r?.[0]);
      const rTel = canonTel(r?.[1]);
      const rEm = canonEmail(r?.[2]);

      if ((dniKey && rDni && dniKey === rDni) || (telKey && rTel && telKey === rTel) || (emKey && rEm && emKey === rEm)) {
        throw httpError(409, "Ya existe un cliente con ese DNI, teléfono o email.");
      }
    }

    // 4.8 Generar clave (LLNNLL) — NO forzamos unicidad (como pediste)
    const clave = generateClave();

    // 4.9 Append fila (alineado a tus columnas)
    // Nombre, Apellido, DNI, Telefono, Email, Direccion, Comentarios,
    // Zona, Estado, Lista, Timestamp, IP, Clave, Grupo, Contadores
    const fila = [
      safeNombre,
      safeApellido,
      safeDni,
      telefono,
      safeEmail,
      safeDireccion,
      safeComentarios,
      "Z-00",
      "Pendiente",
      safeLista,
      new Date().toISOString(),
      ip,
      clave,
      0,
      "",
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

    await logFail(ip, msg);

    return res.status(status).json({ ok: false, error: msg });
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
  if (!RECAPTCHA_SECRET) return 0; // si faltara, se rechaza por score < 0.5
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

  // opcional: exigir success
  if (!r?.success) return 0;

  // opcional: si querés, podés exigir action === 'submit' (si alguna vez te rompe, lo sacás)
  // if (r?.action && r.action !== "submit") return 0;

  return Number(r?.score || 0);
}

async function logFail(ip, msg) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${FAIL_SHEET}!A:C`,
      valueInputOption: "RAW",
      requestBody: { values: [[new Date().toISOString(), ip, String(msg).slice(0, 200)]] },
    });
  } catch {
    // no-op
  }
}
