# Pengingat EdhyX

Fitur ini menambahkan perintah pengingat melalui chat, penyimpanan jadwal di Supabase, dan push notification melalui OneSignal. Pemicu pengiriman dijalankan oleh cron-job.org yang memanggil API Vercel.

## 1. Siapkan database Supabase

1. Buat project Supabase Free.
2. Buka SQL Editor.
3. Jalankan seluruh isi file \`supabase/reminders.sql\`.
4. Dari Project Settings → API, salin Project URL dan service_role key. **Jangan pernah memasukkan service_role key ke file frontend atau membagikannya di chat.**

## 2. Siapkan OneSignal

1. Buat aplikasi OneSignal untuk Web Push.
2. Atur site URL sesuai alamat aplikasi GitHub Pages: \`https://martaedhyx.github.io\`.
3. Salin App ID dan REST API Key.
4. Masukkan App ID ke konstanta \`ONESIGNAL_APP_ID\` di \`reminder-client.js\`.
5. Pastikan worker \`OneSignalSDKWorker.js\` dapat diakses dari \`https://martaedhyx.github.io/x/OneSignalSDKWorker.js\`.

Pada iPhone, pengguna harus menambahkan EdhyX ke Layar Utama dan membuka aplikasi dari ikon tersebut sebelum meminta izin notifikasi. Push web di iOS memerlukan iOS/iPadOS 16.4 atau lebih baru.

## 3. Atur Environment Variables di Vercel

Tambahkan variabel berikut pada project Vercel yang melayani API EdhyX:

- \`SUPABASE_URL\` — Project URL Supabase.
- \`SUPABASE_SERVICE_ROLE_KEY\` — service_role key Supabase.
- \`ONESIGNAL_APP_ID\` — App ID OneSignal.
- \`ONESIGNAL_REST_API_KEY\` — REST API Key OneSignal.
- \`REMINDER_CRON_SECRET\` — token acak panjang yang hanya diketahui Vercel dan cron-job.org.

Setelah menyimpan variabel, lakukan redeploy agar API membaca konfigurasi terbaru.

## 4. Atur cron-job.org

Buat job dengan konfigurasi:

- URL: \`https://xbot-marta-edi.vercel.app/api/reminders-dispatch\`
- Method: \`POST\`
- Interval: setiap 1 menit.
- Header: \`Authorization: Bearer TOKEN_RAHASIA\`, dengan nilai yang sama persis seperti \`REMINDER_CRON_SECRET\` di Vercel.

Jangan menaruh token rahasia di URL atau di file frontend.

## 5. Uji dari EdhyX

1. Buka EdhyX melalui HTTPS.
2. Tekan **Aktifkan notifikasi** dan izinkan notifikasi.
3. Kirim pesan seperti: \`Ingatkan saya besok jam 08:00 untuk rapat\`.
4. Pastikan pesan sukses disimpan.
5. Untuk tes awal, gunakan waktu beberapa menit ke depan.

## Perintah yang dikenali

- \`Ingatkan saya besok jam 08:00 untuk rapat\`
- \`Tolong ingatkan aku hari ini jam 20:30 untuk minum air\`
- \`Buat pengingat lusa jam 7 pagi untuk olahraga\`

## Catatan operasional

- Supabase Free menyediakan database 500 MB, tetapi project dapat dijeda jika aktivitas terlalu rendah selama sekitar 7 hari. Periksa email pemberitahuan Supabase dan pulihkan project bila dijeda.
- cron-job.org gratis dan mendukung pemanggilan hingga setiap menit; waktu pengiriman tetap bergantung pada jadwal cron dan latensi layanan.
- OneSignal Free mendukung Web Push dengan batas 10.000 subscriber per pengiriman.
- Vercel API hanya menyimpan jadwal dan mengirim notifikasi saat cron memanggil endpoint. Notifikasi tidak akan terkirim sebelum seluruh layanan eksternal dikonfigurasi.
