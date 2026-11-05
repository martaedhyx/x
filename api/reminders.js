import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export const config = { maxDuration: 15 };

const ORIGIN = "https://martaedhyx.github.io";
const MAX_MESSAGE = 500;

function cors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (origin === ORIGIN) res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  return !origin || origin === ORIGIN;
}

function jsonError(res, status, error) {
  return res.status(status).json({ error });
}

function configValues() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Backend pengingat belum dikonfigurasi di Vercel.");
  return { url, key };
}

async function db(path, options = {}) {
  const { url, key } = configValues();
  const response = await fetch(url + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.text();
  const data = body ? JSON.parse(body) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || "Database pengingat gagal (" + response.status + ").");
  return data;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function authorize(deviceId, token, createIfMissing = false) {
  if (!validId(deviceId) || typeof token !== "string" || token.length < 32 || token.length > 200) {
    return null;
  }
  const rows = await db("reminder_devices?id=eq." + encodeURIComponent(deviceId) + "&select=id,token_hash,onesignal_subscription_id", {
    method: "GET"
  });
  if (!rows.length && createIfMissing) {
    await db("reminder_devices", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: deviceId, token_hash: hash(token) })
    });
    return { id: deviceId, onesignal_subscription_id: null };
  }
  if (!rows.length) return null;
  const expected = Buffer.from(rows[0].token_hash || "");
  const actual = Buffer.from(hash(token));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return rows[0];
}

export default async function handler(req, res) {
  if (!cors(req, res)) return jsonError(res, 403, "Origin tidak diizinkan.");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "POST", "DELETE"].includes(req.method)) return jsonError(res, 405, "Metode tidak didukung.");

  try {
    const body = req.body || {};
    const action = String(body.action || req.query?.action || "");
    const deviceId = String(body.deviceId || req.query?.deviceId || "");
    const deviceToken = String(body.deviceToken || "");
    const device = await authorize(deviceId, deviceToken, action === "register");
    if (!device) return jsonError(res, 401, "Perangkat belum terdaftar atau token tidak valid.");

    if (action === "register") {
      return res.status(200).json({ ok: true, deviceId });
    }

    if (action === "subscribe") {
      const subscriptionId = String(body.subscriptionId || "");
      if (!subscriptionId || subscriptionId.length > 200) return jsonError(res, 400, "ID langganan notifikasi tidak valid.");
      await db("reminder_devices?id=eq." + encodeURIComponent(deviceId), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ onesignal_subscription_id: subscriptionId, updated_at: new Date().toISOString() })
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "create") {
      const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
      const scheduledAt = Date.parse(body.scheduledAt || "");
      if (!message) return jsonError(res, 400, "Isi pengingat wajib diisi.");
      if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) return jsonError(res, 400, "Waktu pengingat harus berada di masa depan.");
      const rows = await db("reminders", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ device_id: deviceId, message, scheduled_at: new Date(scheduledAt).toISOString() })
      });
      return res.status(201).json({ ok: true, reminder: rows?.[0] || null });
    }

    if (action === "list") {
      const rows = await db("reminders?device_id=eq." + encodeURIComponent(deviceId) +
        "&status=in.(pending,sending)&select=id,message,scheduled_at,status&order=scheduled_at.asc&limit=50");
      return res.status(200).json({ reminders: rows || [] });
    }

    if (action === "cancel") {
      const id = String(body.id || "");
      if (!validId(id)) return jsonError(res, 400, "ID pengingat tidak valid.");
      const rows = await db("reminders?id=eq." + encodeURIComponent(id) +
        "&device_id=eq." + encodeURIComponent(deviceId) + "&status=eq.pending", {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "cancelled" })
      });
      return res.status(200).json({ ok: true, cancelled: !!rows?.length });
    }

    return jsonError(res, 400, "Aksi pengingat tidak dikenal.");
  } catch (error) {
    return jsonError(res, 503, String(error?.message || "Layanan pengingat sedang tidak tersedia.").slice(0, 300));
  }
}
