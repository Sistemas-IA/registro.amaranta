// Node 18 ESM
import { google } from "googleapis";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Clientes";
const ADMIN_KEY = (process.env.ADMIN_REINDEX_KEY || "").trim();

const redis = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_URL || "").trim(),
  token: (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim(),
});

const auth = new google.auth.GoogleAuth({
  credentials: safeJsonParse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  if (!ADMIN_KEY) return res.status(500).json({ ok: false, error: "Falta ADMIN_REINDEX_KEY." });

  const url = new URL(req.url, "http://localhost");
  const key = String(req.headers["x-admin-key"] || url.searchParams.get("key") || "").trim();

  if (key !== ADMIN_KEY) return res.status(401).json({ ok: false, error: "No autorizado." });

  if (!SPREADSHEET_ID) return res.status(500).json({ ok: false, error: "Falta SPREADSHEET_ID." });

  const start = Math.max(2, Number(url.searchParams.get("start") || 2));
  const batch = clamp(Number(url.searchParams.get("batch") || 500), 50, 1000);
  const end = start + batch - 1;

  // C = DNI, D = Tel, E = Email
  const range = `${SHEET_NAME}!C${start}:E${end}`;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const values = resp.data.values || [];
  if (!values.length) {
    return res.status(200).json({
      ok: true,
      processed: 0,
      setKeys: 0,
      start,
      nextStart: null,
      done: true,
    });
  }

  const stamp = `ok:${new Date().toISOString()}`;
  const pipe = redis.pipeline();

  let setKeys = 0;

  for (const r of values) {
    const dni = digitsOnly(r?.[0]);
    const tel = canonTelKey(String(r?.[1] || ""));
    const email = String(r?.[2] || "").trim().toLowerCase();

    if (dni) { pipe.set(idxKey("dni", dni), stamp); setKeys++; }
    if (tel) { pipe.set(idxKey("tel", tel), stamp); setKeys++; }
    if (email) { pipe.set(idxKey("email", email), stamp); setKeys++; }
  }

  await pipe.exec();

  const processed = values.length;
  const done = processed < batch;
  const nextStart = done ? null : (start + processed);

  return res.status(200).json({
    ok: true,
    range,
    processed,
    setKeys,
    start,
    nextStart,
    done,
  });
}

/* ===== Helpers ===== */

function idxKey(kind, value) {
  const h = hashKey(kind, value);
  return `idx:v1:${kind}:${h}`;
}

function hashKey(kind, value) {
  return createHash("sha256")
    .update(`${kind}:${String(value || "").trim().toLowerCase()}`)
    .digest("hex");
}

function digitsOnly(v = "") {
  return String(v || "").replace(/\D+/g, "");
}

function canonTelKey(s) {
  const d = digitsOnly(s);
  if (!d) return "";
  return d.startsWith("549") ? d : "549" + d;
}

function safeJsonParse(raw) {
  try {
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}
