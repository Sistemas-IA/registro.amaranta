// Node 18 ESM
import { google } from "googleapis";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createHash, randomUUID } from "crypto";

/* =========================
   CONFIG
========================= */

const ALLOWED_ORIGIN = "https://registro.amaranta.ar";
const EXPECTED_HOSTNAME = "registro.amaranta.ar";
const EXPECTED_ACTION = "submit";

// Sheets
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Clientes";
const FAIL_SHEET = "IntentosFallidos";

// Validaciones
const RE_NAME = /^[\p{L}\p{M}](?:[\p{L}\p{M}\s'’-])*$/u;
const RE_DNI = /^\d{7,8}$/;
const RE_CODIGO = /^\d{2,4}$/;
const RE_NUMERO = /^\d{6,9}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_LISTA_1_50 = /^(?:[1-9]|[1-4]\d|50)$/;

// Upstash (trim para evitar bug de espacios/saltos de línea)
const redis = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_URL || "").trim(),
  token: (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim(),
});

/* 5 envíos / IP / 5 min */
const rlIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  prefix: "ip",
  analytics: true,
});

/* 2 envíos / DNI o Email / 1 h */
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

/* Google Sheets auth */
const auth = new google.auth.GoogleAuth({
  credentials: safeJsonParse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default async function handler(req, res) {
  // CORS básico (solo tu dominio)
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ ok: false, error: "Origen no permitido." });
  }
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const ip = getClientIp(req);

  // Rate-limit IP (hashed para no guardar IP en claro en Redis)
  const ipKey = hashKey("ip", ip);
  const ipLimit = await rlIp.limit(ipKey);
  if (!ipLimit.success) {
    logFail(ip, "Rate-limit IP").catch(() => {});
    return res.status(429).json({ ok: false, error: "Demasiadas peticiones, intenta luego." });
  }

  // Rate-limit global
  const gLimit = await rlGlobal.limit("global");
  if (!gLimit.success) {
    logFail(ip, "Rate-limit global").catch(() => {});
    return res.status(503).json({ ok: false, error: "Servicio saturado, intenta en unos minutos." });
  }

  let reservedKeys = [];
  const reqId = randomUUID();
  const pendingVal = `pending:${reqId}`;

  try {
    if (!SPREADSHEET_ID) throw new HttpError(500, "Servidor no configurado (SPREADSHEET_ID).");

    const body = await readJsonBody(req);

    // Honeypot: si viene lleno -> no guardamos nada y respondemos OK (no le damos pista al bot)
    const website = String(body?.website || "").trim();
    if (website) {
      logFail(ip, "Honeypot").catch(() => {});
      return res.status(200).json({ ok: true });
    }

    const nombre = sanitize(body?.nombre);
    const apellido = sanitize(body?.apellido);
    const dni = digitsOnly(body?.dni);
    const codigo = digitsOnly(body?.codigo);
    const numero = digitsOnly(body?.numero);
    const email = sanitize(body?.email).toLowerCase();
    const direccion = sanitize(body?.direccion);
    const comentarios = sanitize(body?.comentarios || "");
    const lista = sanitize(body?.lista || "");
    const recaptchaToken = body?.recaptchaToken;

    // reCAPTCHA (score + action + hostname)
    const cap = await verifyCaptcha(recaptchaToken, ip);
    if (!cap.success) throw new HttpError(403, "reCAPTCHA inválido.");
    if (cap.score < 0.5) throw new HttpError(403, "reCAPTCHA rechazó al usuario.");
    if (cap.action !== EXPECTED_ACTION) throw new HttpError(403, "reCAPTCHA action inválida.");
    if (cap.hostname !== EXPECTED_HOSTNAME) throw new HttpError(403, "reCAPTCHA hostname inválido.");

    // Validaciones
    if (!nombre) throw new HttpError(400, "Nombre es obligatorio.");
    if (!apellido) throw new HttpError(400, "Apellido es obligatorio.");
    if (!dni) throw new HttpError(400, "DNI es obligatorio.");
    if (!codigo) throw new HttpError(400, "Código de área es obligatorio.");
    if (!numero) throw new HttpError(400, "Número de celular es obligatorio.");
    if (!email) throw new HttpError(400, "Email es obligatorio.");
    if (!direccion) throw new HttpError(400, "Dirección es obligatoria.");

    if (nombre.length < 2 || nombre.length > 50 || !RE_NAME.test(nombre)) throw new HttpError(400, "Nombre inválido.");
    if (apellido.length < 2 || apellido.length > 50 || !RE_NAME.test(apellido)) throw new HttpError(400, "Apellido inválido.");
    if (!RE_DNI.test(dni)) throw new HttpError(400, "DNI inválido (7-8 dígitos).");
    if (!RE_CODIGO.test(codigo)) throw new HttpError(400, "Código de área inválido.");
    if (!RE_NUMERO.test(numero)) throw new HttpError(400, "Número inválido.");
    if (email.length > 100 || !RE_EMAIL.test(email)) throw new HttpError(400, "Email inválido.");
    if (direccion.length > 100) throw new HttpError(400, "Dirección: máximo 100 caracteres.");
    if (comentarios.length > 250) throw new HttpError(400, "Comentarios: máximo 250 caracteres.");
    if (lista && !RE_LISTA_1_50.test(lista)) throw new HttpError(400, "Lista inválida (debe ser 1 a 50).");

    // Rate-limit por identidad (hashed)
    const identity = (dni || email || "").toLowerCase();
    if (identity) {
      const idKey = hashKey("id", identity);
      const idLimit = await rlId.limit(idKey);
      if (!idLimit.success) throw new HttpError(429, "Demasiados intentos con el mismo DNI/email.");
    }

    // Normalización teléfono (tu formato)
    const telefono = normalizeTel(codigo, numero);
    const telKey = canonTelKey(telefono);

    // Duplicados por Upstash index (sin leer Sheets)
    const kDni = idxKey("dni", dni);
    const kTel = idxKey("tel", telKey);
    const kEm = idxKey("email", email);

    // Reservas cortas (10 min) para evitar carreras
    reservedKeys = await reserveKeysNx([kDni, kTel, kEm], pendingVal, 600);

    // Append a Sheets
    const nowIso = new Date().toISOString();

    const fila = [
      nombre,
      apellido,
      dni,
      telefono,
      email,
      direccion.slice(0, 100),
      comentarios.slice(0, 250),
      "Z-00",
      "Pendiente",
      lista.slice(0, 50),
      nowIso,
      ip,
      "", // Clave
      0,  // Grupo
      "", // Contadores
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });

    // Confirmar índice (sin TTL)
    const okVal = `ok:${nowIso}`;
    await Promise.all([
      redis.set(kDni, okVal),
      redis.set(kTel, okVal),
      redis.set(kEm, okVal),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Si falló después de reservar, liberar si sigue "pending"
    if (reservedKeys?.length) {
      await safeReleasePending(reservedKeys, pendingVal).catch(() => {});
    }

    const status = err instanceof HttpError ? err.status : 500;

    const msg = (err?.message || String(err)).slice(0, 200);
    await logFail(ip, msg).catch(() => {});

    const publicMsg =
      status === 500 ? "Error interno. Intentá de nuevo en unos minutos." : (err?.message || "Error");

    return res.status(status).json({ ok: false, error: publicMsg });
  }
}

/* =========================
   DUPLICADOS: INDEX HELPERS
========================= */

function idxKey(kind, value) {
  const h = hashKey(kind, value);
  return `idx:v1:${kind}:${h}`;
}

function hashKey(kind, value) {
  return createHash("sha256")
    .update(`${kind}:${String(value || "").trim().toLowerCase()}`)
    .digest("hex");
}

async function reserveKeysNx(keys, value, ttlSeconds) {
  const okKeys = [];
  for (const k of keys) {
    const r = await redis.set(k, value, { nx: true, ex: ttlSeconds });
    if (r !== "OK") {
      await safeReleasePending(okKeys, value).catch(() => {});
      throw new HttpError(409, "DNI, teléfono o email ya registrado.");
    }
    okKeys.push(k);
  }
  return okKeys;
}

async function safeReleasePending(keys, pendingVal) {
  for (const k of keys) {
    const cur = await redis.get(k);
    if (cur === pendingVal) await redis.del(k);
  }
}

/* =========================
   HELPERS GENERALES
========================= */

function getClientIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const xr = (req.headers["x-real-ip"] || "").trim();
  return xf || xr || req.socket?.remoteAddress || "unknown";
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function verifyCaptcha(token, ip) {
  if (!token) return { success: false, score: 0, hostname: "", action: "" };

  const params = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET || "",
    response: String(token),
    remoteip: String(ip || ""),
  });

  const out = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: params,
  }).then((r) => r.json()).catch(() => null);

  if (!out) return { success: false, score: 0, hostname: "", action: "" };

  return {
    success: out.success === true,
    score: Number(out.score || 0),
    hostname: String(out.hostname || ""),
    action: String(out.action || ""),
  };
}

function normalizeTel(c = "", n = "") {
  return "549" + digitsOnly(c) + digitsOnly(n);
}

function digitsOnly(v = "") {
  return String(v || "").replace(/\D+/g, "");
}

function canonTelKey(s) {
  const d = digitsOnly(s);
  if (!d) return "";
  return d.startsWith("549") ? d : "549" + d;
}

function sanitize(v = "") {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s
    .replace(/^[=+\-@]/, "'$&")
    .replace(/[<>]/g, "");
}

function safeJsonParse(raw) {
  try {
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function logFail(ip, msg) {
  try {
    if (!SPREADSHEET_ID) return;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${FAIL_SHEET}!A:C`,
      valueInputOption: "RAW",
      requestBody: { values: [[new Date().toISOString(), ip, String(msg || "").slice(0, 200)]] },
    });
  } catch {}
}
