# Firebase Admin SDK Setup Guide

## Mengapa Perlu Firebase Admin SDK?

Firebase Admin SDK diperlukan untuk:
- ✅ Menyimpan transaksi topup ke Firestore (bypass Firestore rules)
- ✅ Update status transaksi dari Midtrans callback
- ✅ Menambahkan diamonds ke user setelah pembayaran sukses
- ✅ Operasi server-side lainnya yang memerlukan akses admin

**Tanpa Admin SDK, transaksi tidak akan tersimpan dan callback Midtrans tidak akan bekerja!**

## Step 1: Buat Service Account di Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Anda
3. Klik **Settings** (ikon gear) > **Project settings**
4. Pilih tab **Service accounts**
5. Klik **Generate new private key**
6. Klik **Generate key** di dialog yang muncul
7. File JSON akan terdownload (simpan dengan aman!)

## Step 2: Setup di VPS

### Opsi A: Menggunakan .env.local (Recommended)

1. Upload file service account JSON ke VPS:
   ```bash
   # Upload file ke VPS (gunakan SCP atau SFTP)
   scp path/to/serviceAccountKey.json user@your-vps:/root/editaja.com/
   ```

2. Edit file `.env.local` di root project:
   ```bash
   cd /root/editaja.com
   nano .env.local
   ```

3. Tambahkan environment variable:
   ```env
   # Firebase Admin SDK Service Account
   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
   ```

   **Cara mendapatkan JSON string:**
   ```bash
   # Di VPS, jalankan:
   cat serviceAccountKey.json | jq -c
   # atau
   cat serviceAccountKey.json | tr -d '\n' | tr -d ' '
   ```

   **Atau gunakan Python:**
   ```bash
   python3 -c "import json; print(json.dumps(json.load(open('serviceAccountKey.json')), separators=(',', ':')))"
   ```

4. Simpan file dan restart aplikasi:
   ```bash
   # Jika menggunakan PM2
   pm2 restart editaja
   
   # Atau jika menggunakan npm start
   # Stop server (Ctrl+C) lalu
   npm start
   ```

### Opsi B: Menggunakan System Environment Variable

1. Edit file environment system (contoh untuk systemd):
   ```bash
   sudo nano /etc/systemd/system/editaja.service
   ```

2. Tambahkan di section `[Service]`:
   ```ini
   [Service]
   Environment="FIREBASE_SERVICE_ACCOUNT='{\"type\":\"service_account\",...}'"
   ```

3. Reload dan restart:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart editaja
   ```

### Opsi C: Menggunakan PM2 Ecosystem

1. Buat file `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'editaja',
       script: 'npm',
       args: 'start',
       env: {
         FIREBASE_SERVICE_ACCOUNT: '{"type":"service_account",...}'
       }
     }]
   };
   ```

2. Start dengan PM2:
   ```bash
   pm2 start ecosystem.config.js
   ```

## Step 3: Verifikasi Setup

1. Cek environment variable:
   ```bash
   # Di VPS, jalankan:
   node -e "console.log(process.env.FIREBASE_SERVICE_ACCOUNT ? 'OK' : 'NOT SET')"
   ```

2. Cek log server saat ada topup:
   ```bash
   # Lihat log
   pm2 logs editaja
   # atau
   tail -f /path/to/log/file
   ```

3. Test dengan membuat topup baru:
   - Buat topup dari aplikasi
   - Cek log server - seharusnya ada log "Transaction saved successfully"
   - Lakukan pembayaran
   - Cek log - seharusnya ada log "Midtrans Callback Received"

## Troubleshooting

### Error: "Firebase Admin SDK not initialized"

**Penyebab:** Environment variable `FIREBASE_SERVICE_ACCOUNT` tidak ter-set atau format salah.

**Solusi:**
1. Pastikan environment variable sudah di-set:
   ```bash
   echo $FIREBASE_SERVICE_ACCOUNT
   ```

2. Jika kosong, set ulang sesuai Opsi A, B, atau C di atas

3. Pastikan format JSON benar (harus valid JSON string)

4. Restart aplikasi setelah set environment variable

### Error: "Transaction not found in Firestore"

**Penyebab:** Transaksi tidak tersimpan saat pembayaran dibuat karena Admin SDK tidak terinisialisasi.

**Solusi:**
1. Setup Firebase Admin SDK (lihat Step 1-2)
2. Restart aplikasi
3. Buat topup baru (transaksi lama tidak akan ter-update)

### Error: "Invalid signature" di callback

**Penyebab:** Signature verification gagal (tapi sekarang sudah di-handle, callback tetap diproses)

**Solusi:** Pastikan Server Key di Midtrans config sama dengan yang di Firebase Console

## Catatan Penting

⚠️ **Keamanan:**
- Jangan commit file `serviceAccountKey.json` ke git
- Jangan expose environment variable di public
- File sudah ada di `.gitignore`

⚠️ **Format JSON:**
- Harus valid JSON
- Harus dalam format string (dengan quotes)
- Escape special characters jika perlu

⚠️ **Restart:**
- Setelah set environment variable, **WAJIB restart aplikasi**
- Environment variable hanya dibaca saat aplikasi start

## Verifikasi Akhir

Setelah setup, cek:

1. ✅ Environment variable ter-set:
   ```bash
   echo $FIREBASE_SERVICE_ACCOUNT | head -c 50
   # Seharusnya menampilkan: {"type":"service_account",...
   ```

2. ✅ Log server menunjukkan "Transaction saved successfully" saat topup dibuat

3. ✅ Log server menunjukkan "Midtrans Callback Received" saat pembayaran sukses

4. ✅ Status transaksi ter-update di admin panel

5. ✅ Diamonds ditambahkan ke user setelah pembayaran sukses


