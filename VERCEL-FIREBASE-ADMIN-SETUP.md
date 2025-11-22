# Setup Firebase Admin SDK di Vercel

## ⚠️ Penting: Tanpa Setup Ini, Fitur Topup Tidak Akan Bekerja!

Firebase Admin SDK **WAJIB** di-setup di Vercel untuk:
- ✅ Menyimpan transaksi topup ke Firestore
- ✅ Update status transaksi dari Midtrans callback
- ✅ Menambahkan diamonds ke user setelah pembayaran sukses

**Error yang akan muncul jika belum di-setup:**
```
Firebase Admin SDK not initialized. Please setup Firebase Admin SDK by setting FIREBASE_SERVICE_ACCOUNT environment variable.
```

## Step 1: Download Service Account Key dari Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Anda
3. Klik **Settings** (ikon gear) > **Project settings**
4. Pilih tab **Service accounts**
5. Klik **Generate new private key**
6. Klik **Generate key** di dialog yang muncul
7. File JSON akan terdownload (contoh: `your-project-firebase-adminsdk-xxxxx.json`)

## Step 2: Convert JSON ke Single Line String

File JSON yang didownload memiliki format multi-line. Di Vercel, kita perlu convert ke single-line JSON string.

### Opsi A: Menggunakan Online Tool (Paling Mudah)

1. Buka file JSON yang didownload dengan text editor
2. Copy semua isinya
3. Buka [JSON Minify Tool](https://jsonformatter.org/json-minify) atau tool serupa
4. Paste JSON dan klik "Minify" atau "Compress"
5. Copy hasil minified JSON

### Opsi B: Menggunakan Terminal/Command Prompt (Windows)

Jika Anda punya Node.js atau Python installed:

**Menggunakan Node.js:**
```bash
node -e "console.log(JSON.stringify(require('./path/to/serviceAccountKey.json')))"
```

**Menggunakan Python:**
```bash
python -c "import json; print(json.dumps(json.load(open('path/to/serviceAccountKey.json')), separators=(',', ':')))"
```

### Opsi C: Manual (Jika tidak ada tool)

1. Buka file JSON dengan text editor
2. Hapus semua line breaks (newlines) - bisa pakai Find & Replace: replace `\n` dengan kosong
3. Pastikan tidak ada space yang tidak perlu
4. Copy hasilnya

**Format yang benar:**
```json
{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

**⚠️ Catatan Penting:**
- `private_key` harus tetap memiliki `\n` di dalam string (untuk line breaks)
- Jangan hapus backslash escape characters (`\n`, `\"`, dll)
- JSON harus valid (bisa dicek di [JSONLint](https://jsonlint.com/))

## Step 3: Setup Environment Variable di Vercel

1. Login ke [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project Anda (`editaja.com` atau nama project Anda)
3. Klik tab **Settings**
4. Klik **Environment Variables** di sidebar kiri
5. Klik **Add New** untuk menambahkan variable baru

6. Isi form:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** Paste JSON string yang sudah di-convert (dari Step 2)
   - **Environment:** Pilih semua (Production, Preview, Development) atau minimal Production

7. Klik **Save**

**⚠️ Penting:**
- Value harus di-paste sebagai single line (tidak ada line breaks)
- Tidak perlu wrap dengan quotes (Vercel akan handle ini)
- Pastikan JSON valid sebelum save

## Step 4: Redeploy Application

Setelah menambahkan environment variable:

1. Klik tab **Deployments** di Vercel dashboard
2. Klik **...** (three dots) di deployment terbaru
3. Pilih **Redeploy**
4. Atau, push commit baru ke GitHub untuk trigger automatic deployment

**⚠️ Catatan:** Environment variable hanya akan tersedia setelah redeploy!

## Step 5: Verifikasi Setup

### Cara 1: Cek via Test Page

1. Buka halaman test: `https://editaja.com/tesmidtrans`
2. Login dengan akun Anda
3. Coba klik "Test Topup" pada salah satu package
4. Jika berhasil, tidak akan ada error "Firebase Admin SDK not initialized"
5. Check log di Vercel untuk melihat "✅ Transaction saved successfully"

### Cara 2: Cek via Vercel Logs

1. Buka Vercel Dashboard → Project → Logs
2. Buat test topup dari aplikasi
3. Cek log - harus ada:
   ```
   === SAVING TRANSACTION TO FIRESTORE ===
   ✅ Transaction saved successfully
   ```

### Cara 3: Test Callback Endpoint

1. Buka `https://editaja.com/api/midtrans/callback` di browser
2. Seharusnya return: `{"ok":true,"message":"Midtrans callback endpoint is active"}`

## Troubleshooting

### Error: "Firebase Admin SDK not initialized"

**Penyebab:**
- Environment variable `FIREBASE_SERVICE_ACCOUNT` belum di-set di Vercel
- Format JSON tidak valid
- Belum redeploy setelah menambahkan environment variable

**Solusi:**
1. Pastikan environment variable sudah di-set di Vercel Dashboard
2. Cek format JSON valid di [JSONLint](https://jsonlint.com/)
3. Pastikan sudah redeploy setelah menambahkan environment variable
4. Cek di Vercel Dashboard → Settings → Environment Variables

### Error: "Invalid JSON format"

**Penyebab:**
- JSON string tidak valid (missing quotes, commas, dll)
- Line breaks tidak di-escape dengan benar

**Solusi:**
1. Gunakan [JSON Minify Tool](https://jsonformatter.org/json-minify) untuk convert JSON
2. Atau gunakan Node.js/Python script seperti di Step 2
3. Pastikan `private_key` tetap memiliki `\n` di dalam string

### Error: "Transaction not found in Firestore"

**Penyebab:**
- Transaction tidak tersimpan saat payment dibuat (karena Admin SDK belum terinisialisasi)
- Ini terjadi jika topup dibuat sebelum setup Firebase Admin SDK

**Solusi:**
1. Setup Firebase Admin SDK (ikuti Step 1-4)
2. Buat topup baru (transaction lama tidak akan ter-update)
3. Cek log Vercel untuk memastikan "Transaction saved successfully"

### Cara Cek Environment Variable di Vercel

1. Vercel Dashboard → Project → Settings → Environment Variables
2. Pastikan `FIREBASE_SERVICE_ACCOUNT` ada di list
3. Klik untuk melihat value (harus mulai dengan `{"type":"service_account"...`)

### Test Setup Tanpa Redeploy

Tidak bisa! Environment variable hanya tersedia setelah redeploy. Pastikan:
1. ✅ Environment variable sudah di-set di Vercel
2. ✅ Redeploy application (atau push commit baru)
3. ✅ Test lagi setelah deploy selesai

## Quick Checklist

- [ ] Download service account key dari Firebase Console
- [ ] Convert JSON ke single-line string
- [ ] Tambahkan `FIREBASE_SERVICE_ACCOUNT` di Vercel Environment Variables
- [ ] Redeploy application di Vercel
- [ ] Test dengan membuat topup baru
- [ ] Cek log Vercel untuk "Transaction saved successfully"
- [ ] Test callback endpoint: `/api/midtrans/callback`

## Catatan Keamanan

⚠️ **JANGAN:**
- ❌ Commit file `serviceAccountKey.json` ke Git (sudah ada di `.gitignore`)
- ❌ Share service account key secara public
- ❌ Expose environment variable di client-side code

✅ **Lakukan:**
- ✅ Simpan file JSON dengan aman di lokal
- ✅ Gunakan environment variable di Vercel (sudah secure)
- ✅ Rotate key jika key tersebut ter-expose

## Need Help?

Jika masih ada masalah:

1. Cek log di Vercel Dashboard → Logs
2. Test di halaman `/tesmidtrans` untuk melihat error detail
3. Pastikan semua step di atas sudah diikuti dengan benar
4. Cek format JSON valid di [JSONLint](https://jsonlint.com/)

## Script Helper (Optional)

Jika Anda mau, bisa buat script helper untuk convert JSON:

**create-env-string.js:**
```javascript
const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.argv[2] || './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ File not found:', serviceAccountPath);
  console.log('Usage: node create-env-string.js [path/to/serviceAccountKey.json]');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const jsonString = JSON.stringify(serviceAccount);

console.log('\n=== FIREBASE_SERVICE_ACCOUNT Environment Variable ===\n');
console.log(jsonString);
console.log('\n=== Copy string above to Vercel Environment Variables ===\n');
```

**Usage:**
```bash
node create-env-string.js path/to/serviceAccountKey.json
```

Copy output string ke Vercel Environment Variables.

