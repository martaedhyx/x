(function () {
  "use strict";

  var API = "https://xbot-marta-edi.vercel.app/api/reminders";
  var ONESIGNAL_APP_ID = ""; // Isi setelah membuat aplikasi Web Push di OneSignal.
  var APP_URL = "https://martaedhyx.github.io/x/";
  var deviceIdKey = "edhyx_reminder_device_id";
  var deviceTokenKey = "edhyx_reminder_device_token";
  var oneSignalReady = false;
  var oneSignalInstance = null;
  var oneSignalInitPromise = null;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  function credentials() {
    var id = localStorage.getItem(deviceIdKey);
    var token = localStorage.getItem(deviceTokenKey);
    if (!id || !token) {
      id = uuid();
      token = uuid() + uuid();
      localStorage.setItem(deviceIdKey, id);
      localStorage.setItem(deviceTokenKey, token);
    }
    return { deviceId: id, deviceToken: token };
  }

  async function api(action, extra) {
    var c = credentials();
    var response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, c, extra || {}))
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || "Permintaan pengingat gagal (" + response.status + ").");
    return data;
  }

  function addBubble(message, isError) {
    var root = document.querySelector("#chat .wrap") || document.getElementById("chat");
    if (!root) { alert(message); return; }
    var node = document.createElement("div");
    node.className = isError ? "msg err" : "msg bot";
    node.textContent = message;
    root.appendChild(node);
    var chat = document.getElementById("chat");
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  function dateAtOffset(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function parseReminder(input) {
    var raw = String(input || "").trim();
    if (!/^\s*(?:tolong\s+)?(?:ingatkan|ingetin|buat\s+pengingat|remind\s+me|buat\s+alarm)\b/i.test(raw)) return null;

    var d = new Date();
    var dateMatch = raw.match(/\b(besok|lusa|hari ini|tanggal\s+\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/i);
    if (dateMatch) {
      var word = dateMatch[1].toLowerCase();
      if (word === "besok") d = dateAtOffset(1);
      else if (word === "lusa") d = dateAtOffset(2);
      else if (word === "hari ini") d = dateAtOffset(0);
      else {
        var nums = word.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);
        if (nums) {
          var year = nums[3] ? Number(nums[3]) : d.getFullYear();
          if (year < 100) year += 2000;
          d = new Date(year, Number(nums[2]) - 1, Number(nums[1]), 0, 0, 0, 0);
          if (d.getDate() !== Number(nums[1]) || d.getMonth() !== Number(nums[2]) - 1) return { error: "Tanggal pengingat tidak valid." };
        }
      }
    }

    var timeMatch = raw.match(/\bjam\s*(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam)?\b/i);
    if (!timeMatch) return { error: "Saya perlu jam yang jelas. Contoh: Ingatkan saya besok jam 08:00 untuk rapat." };
    var hour = Number(timeMatch[1]), minute = Number(timeMatch[2] || 0);
    var period = (timeMatch[3] || "").toLowerCase();
    if (hour > 23 || minute > 59) return { error: "Jam pengingat tidak valid." };
    if (period) {
      if (hour < 1 || hour > 12) return { error: "Gunakan jam 1 sampai 12 jika menulis pagi, siang, sore, atau malam." };
      if (period === "pagi" && hour === 12) hour = 0;
      else if ((period === "siang" || period === "sore" || period === "malam") && hour < 12) hour += 12;
    }
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() <= Date.now()) return { error: "Waktu itu sudah lewat. Pilih waktu yang akan datang." };

    var task = raw
      .replace(/^(?:tolong\s+)?(?:ingatkan|ingetin|buat\s+pengingat|remind\s+me|buat\s+alarm)\s*(?:saya|aku|gue)?\s*/i, "")
      .replace(/\b(?:hari ini|besok|lusa|tanggal\s+\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/i, "")
      .replace(/\bjam\s*\d{1,2}(?:[:.]\d{2})?\s*(?:pagi|siang|sore|malam)?\b/i, "")
      .replace(/\b(?:untuk|agar|supaya)\b/i, "")
      .replace(/[,.!?]+/g, " ").replace(/\s+/g, " ").trim();
    if (!task) task = "Pengingat dari EdhyX";
    return { message: task.slice(0, 500), scheduledAt: d.toISOString() };
  }

  async function registerDevice() {
    await api("register");
  }

  async function setupOneSignal() {
    if (!ONESIGNAL_APP_ID) return false;
    if (oneSignalInstance) return true;
    if (oneSignalInitPromise) return oneSignalInitPromise;

    oneSignalInitPromise = new Promise(function (resolve, reject) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            serviceWorkerPath: "OneSignalSDKWorker.js",
            serviceWorkerParam: { scope: "/x/" },
            notifyButton: { enable: false }
          });
          oneSignalInstance = OneSignal;
          oneSignalReady = true;
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });

      if (!document.querySelector('script[data-onesignal-sdk]')) {
        var script = document.createElement("script");
        script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
        script.async = true;
        script.dataset.onesignalSdk = "1";
        script.onerror = function () { reject(new Error("SDK OneSignal gagal dimuat.")); };
        document.head.appendChild(script);
      }
    });
    return oneSignalInitPromise;
  }

  async function enableNotifications() {
    if (!ONESIGNAL_APP_ID) {
      addBubble("Notifikasi belum siap. App ID OneSignal perlu diisi setelah aplikasi Web Push dibuat.", true);
      return;
    }
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) &&
        !(navigator.standalone || window.matchMedia("(display-mode: standalone)").matches)) {
      addBubble("Di iPhone, tambahkan EdhyX ke Layar Utama terlebih dahulu, lalu buka dari ikon EdhyX untuk mengaktifkan notifikasi.", true);
      return;
    }
    await setupOneSignal();
    var OneSignal = oneSignalInstance;
    var button = document.getElementById("edhyxNotifyBtn");
    if (button) button.disabled = true;
    try {
      var OneSignal = await new Promise(function (resolve, reject) {
        var started = Date.now();
        (function wait() {
          if (window.OneSignal && window.OneSignal.Notifications) return resolve(window.OneSignal);
          if (Date.now() - started > 12000) return reject(new Error("SDK OneSignal belum siap."));
          setTimeout(wait, 150);
        })();
      });
      await OneSignal.Notifications.requestPermission();
      var subscriptionId = OneSignal.User && OneSignal.User.PushSubscription && OneSignal.User.PushSubscription.id;
      if (!subscriptionId) throw new Error("Izin notifikasi belum aktif. Periksa pengaturan notifikasi perangkat.");
      await api("subscribe", { subscriptionId: subscriptionId });
      addBubble("Notifikasi EdhyX berhasil diaktifkan pada perangkat ini.");
    } catch (error) {
      addBubble(error.message || "Gagal mengaktifkan notifikasi.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function handleReminder(text) {
    var parsed = parseReminder(text);
    if (!parsed) return false;
    var chat = document.getElementById("chat");
    var root = document.querySelector("#chat .wrap") || chat;
    if (root) {
      var user = document.createElement("div");
      user.className = "msg user";
      user.textContent = String(text || "").trim();
      root.appendChild(user);
      if (chat) chat.scrollTop = chat.scrollHeight;
    }
    if (parsed.error) {
      addBubble(parsed.error, true);
      return true;
    }
    try {
      await registerDevice();
      var result = await api("create", parsed);
      var when = new Date(parsed.scheduledAt).toLocaleString("id-ID", {
        dateStyle: "full", timeStyle: "short"
      });
      addBubble("Pengingat berhasil disimpan: " + parsed.message + ". Waktu: " + when + ". Pastikan notifikasi EdhyX sudah diaktifkan.");
      return true;
    } catch (error) {
      addBubble(error.message || "Pengingat gagal disimpan.", true);
      return true;
    }
  }

  function addNotificationButton() {
    var top = document.querySelector(".top");
    if (!top || document.getElementById("edhyxNotifyBtn")) return;
    var button = document.createElement("button");
    button.id = "edhyxNotifyBtn";
    button.type = "button";
    button.textContent = "Aktifkan notifikasi";
    button.style.cssText = "margin-left:8px;padding:7px 10px;border:1px solid #555;border-radius:9px;font-size:12px;white-space:nowrap";
    button.addEventListener("click", enableNotifications);
    top.appendChild(button);
  }

  function install() {
    addNotificationButton();
  }

  window.EdhyReminders = { handle: handleReminder };

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./OneSignalSDKWorker.js", { scope: "/x/" }).catch(function () {});
  }
  setupOneSignal().catch(function () {});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
