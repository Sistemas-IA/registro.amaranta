// api/register.js
// Node 18 ESM
import { google } from "googleapis";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { randomUUID } from "crypto";

/* =========================
   1) UPSTASH (rate + índices)
========================= */
const redis = Redis.fromEnv();

/* 5 envíos / IP / 5 min */
const rlIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  prefix: "ip",
  analytics: true,
});

/* 2 envíos / DNI|email / 1 h */
const rlId = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "1 h"),
  prefix: "id",
  analytics: true,
});

/* 100 envíos totales / 5 min */
const rlGlobal = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "5 m"),
  prefix: "glob",
  analytics: true,
});

const RESERVE_TTL_SECONDS = 15 * 60; // 15 min

/* =========================
   2) GOOGLE SHEETS
========================= */
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Clientes";
const FAIL_SHEET = "IntentosFallidos";

/* =========================
   3) VALIDACIONES
========================= */
const RE_NAME = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/;
const RE_DNI = /^\d{7,8}$/;
const RE_COD = /^\d{2,4}$/;
const RE_NUM = /^\d{6,9}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_NUM_1_50 = /^(?:[1-9]|[1-4]\d|50)$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  res.setHeader("Access-Control-Allow-Origin", "https://registro.amaranta.ar");

  const ip =
    (req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  if (!(await rlIp.limit(ip)).success) {
    await logFail(ip, "Rate-limit IP");
    return res.status(429).json({ ok: false, error: "Demasiadas peticiones, intenta luego." });
  }

  if (!(await rlGlobal.limit("global")).success) {
    await logFail(ip, "Rate-limit global");
    return res.status(503).json({
      ok: false,
      error: "Servicio saturado, intenta nuevamente en unos minutos.",
    });
  }

  const reservedKeys = [];

  try {
    if (!SPREADSHEET_ID) throw new Error("Falta SPREADSHEET_ID");

    const {
      nombre,
      apellido,
      dni,
      codigo,
      numero,
      email,
      direccion,
      comentarios = "",
      lista = "",
      recaptchaToken,
    } = req.body || {};

    /* reCAPTCHA */
    const score = await verifyCaptcha(recaptchaToken, ip);
    if (score < 0.5) throw new Error("reCAPTCHA rechazó al usuario");

    /* Validaciones */
    const nNombre = sanitize(nombre);
    const nApellido = sanitize(apellido);
    const nDni = sanitize(dni);
    const nCodigo = sanitize(codigo);
    const nNumero = sanitize(numero);
    const nEmail = sanitize(email).toLowerCase();
    const nDireccion = sanitize(direccion).slice(0, 100);
    const nComentarios = sanitize(comentarios).slice(0, 250);
    const nLista = sanitize(lista).slice(0, 50);

    if (!RE_NAME.test(nNombre)) throw new Error("Nombre inválido");
    if (!RE_NAME.test(nApellido)) throw new Error("Apellido inválido");
    if (!RE_DNI.test(nDni)) throw new Error("DNI inválido");
    if (!RE_COD.test(nCodigo)) throw new Error("Código de área inválido");
    if (!RE_NUM.test(nNumero)) throw new Error("Número inválido");
    if (nEmail.length > 100 || !RE_EMAIL.test(nEmail)) throw new Error("Email inválido");
    if (!nDireccion) throw new Error("Dirección obligatoria");
    if (nLista && !RE_NUM_1_50.test(nLista)) throw new Error("Lista inválida (1-50)");

    /* Rate-limit por identidad */
    const identity = (nDni || nEmail || "").toLowerCase();
    if (identity && !(await rlId.limit(identity)).success) {
      throw new Error("Demasiados intentos con el mismo DNI/e-mail");
    }

    /* Tel normalizado */
    const telefono = normalizarTel(nCodigo, nNumero);

    /* Duplicados (Upstash) */
    const requestId = randomUUID();
    const kDni = keyDni(nDni);
    const kTel = keyTel(telefono);
    const kEmail = keyEmail(nEmail);

    await reserveOr409(kDni, `pending:${requestId}`, reservedKeys, "DNI ya registrado");
    await reserveOr409(kTel, `pending:${requestId}`, reservedKeys, "Teléfono ya registrado");
    await reserveOr409(kEmail, `pending:${requestId}`, reservedKeys, "Email ya registrado");

    /* CLAVE random (no chequea unicidad) */
    const clave = generateClaveRandom();

    /* Fila (orden EXACTO de tu hoja):
       Nombre, Apellido, DNI, Telefono, Email, Direccion, Comentarios,
       Zona, Estado, Lista, Timestamp, IP, Clave, Grupo, Contadores
    */
    const nowIso = new Date().toISOString();
    const fila = [
      nNombre,
      nApellido,
      nDni,
      telefono,
      nEmail,
      nDireccion,
      nComentarios,
      "Z-00",
      "Pendiente",
      nLista,
      nowIso,
      ip,
      clave,
      0,
      "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });

    /* Commit: convertir reservas a “ocupado” */
    await commitIndex(kDni, nowIso);
    await commitIndex(kTel, nowIso);
    await commitIndex(kEmail, nowIso);

    return res.json({ ok: true, clave });
  } catch (err) {
    await safeRelease(reservedKeys);

    const quota =
      err?.code === 429 ||
      err?.code === 403 ||
      /quota|rate/i.test(err?.errors?.[0]?.reason || "");

    await logFail(ip, err?.message || String(err));

    if (/ya registrado/i.test(err?.message || "")) {
      return res.status(409).json({ ok: false, error: err.message });
    }

    return res.status(quota ? 503 : 400).json({
      ok: false,
      error: err?.message || "Error interno",
    });
  }
}

/* =========================
   HELPERS
========================= */
async function verifyCaptcha(token, ip) {
  const params = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET,
    response: token || "",
    remoteip: ip,
  });

  const r = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: params,
  }).then((r) => r.json());

  return r?.score || 0;
}

function normalizarTel(c = "", n = "") {
  return "549" + String(c || "") + String(n || "");
}

function sanitize(v = "") {
  return String(v ?? "")
    .trim()
    .replace(/^[=+\-@]/, "'$&")
    .replace(/[<>]/g, "");
}

/* --- Index keys --- */
const digits = (s) => String(s || "").replace(/\D+/g, "");
const canonEmail = (s) => String(s || "").trim().toLowerCase();
const canonDni = (s) => digits(s);
const canonTel = (s) => {
  const d = digits(s);
  if (!d) return "";
  return d.startsWith("549") ? d : "549" + d;
};

function keyDni(dni) {
  return `idx:dni:${canonDni(dni)}`;
}
function keyTel(tel) {
  return `idx:tel:${canonTel(tel)}`;
}
function keyEmail(email) {
  return `idx:email:${canonEmail(email)}`;
}

async function reserveOr409(key, value, reservedKeys, msg409) {
  if (!key || key.endsWith(":")) return;
  const ok = await redis.set(key, value, { nx: true, ex: RESERVE_TTL_SECONDS });
  if (!ok) throw new Error(msg409);
  reservedKeys.push(key);
}

async function commitIndex(key, value) {
  if (!key || key.endsWith(":")) return;
  // sin TTL (o muy largo) también sirve; Upstash permite set sin ex.
  await redis.set(key, String(value || ""));
}

async function safeRelease(keys) {
  if (!Array.isArray(keys) || !keys.length) return;
  try {
    await redis.del(...keys);
  } catch (_) {}
}

/* CLAVE random (mismo formato que tu Apps Script) */
function generateClaveRandom() {
  const L = "ABCDEFGHIJKLMNPQRSTUVWXYZ"; // sin O
  const D = "123456789"; // sin 0
  const pick = (s) => s.charAt(Math.floor(Math.random() * s.length));
  return pick(L) + pick(L) + pick(D) + pick(D) + pick(L) + pick(L);
}

async function logFail(ip, msg) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${FAIL_SHEET}!A:C`,
      valueInputOption: "RAW",
      requestBody: { values: [[new Date().toISOString(), ip, String(msg || "")]] },
    });
  } catch (_) {}
}
