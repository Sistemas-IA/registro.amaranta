import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_URL || "").trim(),
  token: (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim(),
});

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).end();

  // escribir algo liviano cuenta como actividad
  await redis.set("keepalive", String(Date.now()), { ex: 60 * 60 * 24 * 30 });

  return res.status(200).json({ ok: true });
}
