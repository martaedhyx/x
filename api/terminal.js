import Sandbox from "e2b";
import { createHmac, timingSafeEqual } from "node:crypto";

const ORIGIN = "https://martaedhyx.github.io";
const MAX_COMMAND = 500;
const MAX_OUTPUT = 12000;
const SESSION_SECONDS = 240;

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env.TERMINAL_TOKEN_SECRET).update(data).digest("base64url");
  return data + "." + sig;
}

function verify(token) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", process.env.TERMINAL_TOKEN_SECRET).update(parts[0]).digest();
  let actual;
  try { actual = Buffer.from(parts[1], "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload.id || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Terminal-Key");
  res.setHeader("Cache-Control", "no-store");

  if (req.headers.origin && req.headers.origin !== ORIGIN) {
    return res.status(403).json({ error: "Origin tidak diizinkan." });
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST." });

  const access = process.env.TERMINAL_ACCESS_KEY;
  const secret = process.env.TERMINAL_TOKEN_SECRET;
  if (!process.env.E2B_API_KEY || !access || !secret) {
    return res.status(503).json({ error: "Backend belum dikonfigurasi. Periksa E2B_API_KEY, TERMINAL_ACCESS_KEY, dan TERMINAL_TOKEN_SECRET di Vercel." });
  }
  const supplied = String(req.headers["x-terminal-key"] || "");
  if (supplied.length !== access.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(access))) {
    return res.status(401).json({ error: "Kode akses terminal salah." });
  }

  const { action, command, token } = req.body || {};
  try {
    if (action === "start") {
      const sandbox = await Sandbox.create();
      const session = { id: sandbox.sandboxId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS, count: 0 };
      return res.status(200).json({
        token: sign(session),
        output: "Edhy Linux Sandbox siap. Coba perintah: pwd, ls, python --version, node --version",
        cwd: "/home/user"
      });
    }

    const session = verify(token);
    if (!session) return res.status(401).json({ error: "Sesi terminal kedaluwarsa. Buka terminal lagi." });

    if (action === "stop") {
      await Sandbox.kill(session.id);
      return res.status(200).json({ stopped: true });
    }

    if (action !== "run") return res.status(400).json({ error: "Aksi tidak dikenal." });
    if (typeof command !== "string" || !command.trim() || command.length > MAX_COMMAND) {
      return res.status(400).json({ error: "Perintah kosong atau terlalu panjang (maksimal 500 karakter)." });
    }
    if (session.count >= 40) return res.status(429).json({ error: "Batas 40 perintah per sesi tercapai. Buka sesi baru." });

    const sandbox = await Sandbox.connect(session.id);
    const result = await sandbox.commands.run(command, { timeoutMs: 12000 });
    session.count += 1;
    return res.status(200).json({
      token: sign(session),
      stdout: String(result.stdout || "").slice(0, MAX_OUTPUT),
      stderr: String(result.stderr || "").slice(0, MAX_OUTPUT),
      exitCode: result.exitCode,
      cwd: result.cwd || ""
    });
  } catch (error) {
    const message = String(error?.message || "Eksekusi gagal").slice(0, 500);
    return res.status(500).json({ error: message });
  }
}
