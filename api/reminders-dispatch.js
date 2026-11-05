export const config = { maxDuration: 30 };

async function db(path, options = {}) {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase belum dikonfigurasi.");
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
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error(data?.message || "Supabase HTTP " + response.status);
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST." });
  const expected = String(process.env.REMINDER_CRON_SECRET || "");
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return res.status(401).json({ error: "Tidak diizinkan." });

  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) return res.status(503).json({ error: "OneSignal belum dikonfigurasi." });

  try {
    const now = new Date().toISOString();
    const due = await db("reminders?status=eq.pending&scheduled_at=lte." +
      encodeURIComponent(now) + "&select=id,device_id,message&order=scheduled_at.asc&limit=50");
    let sent = 0, failed = 0, skipped = 0;

    for (const reminder of due || []) {
      const claimed = await db("reminders?id=eq." + encodeURIComponent(reminder.id) +
        "&status=eq.pending", {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "sending" })
      });
      if (!claimed?.length) { skipped++; continue; }

      try {
        const devices = await db("reminder_devices?id=eq." +
          encodeURIComponent(reminder.device_id) + "&select=onesignal_subscription_id");
        const subscriptionId = devices?.[0]?.onesignal_subscription_id;
        if (!subscriptionId) throw new Error("Perangkat belum berlangganan notifikasi.");

        const response = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: {
            Authorization: "Key " + apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            app_id: appId,
            include_subscription_ids: [subscriptionId],
            headings: { en: "Pengingat EdhyX", id: "Pengingat EdhyX" },
            contents: { en: reminder.message, id: reminder.message },
            url: "https://martaedhyx.github.io/x/"
          }),
          signal: AbortSignal.timeout(12000)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.errors) throw new Error("OneSignal HTTP " + response.status);
        await db("reminders?id=eq." + encodeURIComponent(reminder.id), {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString() })
        });
        sent++;
      } catch (error) {
        await db("reminders?id=eq." + encodeURIComponent(reminder.id), {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed" })
        });
        failed++;
      }
    }
    return res.status(200).json({ ok: true, checked: due?.length || 0, sent, failed, skipped });
  } catch (error) {
    return res.status(503).json({ error: String(error?.message || "Pengiriman pengingat gagal.").slice(0, 300) });
  }
}
