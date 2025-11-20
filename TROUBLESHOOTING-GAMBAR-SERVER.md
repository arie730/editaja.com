# Troubleshooting: Gambar Belum Masuk ke gambar.editaja.com

Panduan lengkap untuk mengatasi masalah gambar yang belum tersimpan ke server gambar.editaja.com.

## 🔍 Langkah Debugging

### 1. Cek Environment Variable

**Problem**: Environment variable `NEXT_PUBLIC_GAMBAR_SERVER_URL` belum di-set.

**Solusi di Vercel**:
1. Buka Vercel Dashboard
2. Pilih project editaja.com
3. Go to **Settings** → **Environment Variables**
4. Tambahkan:
   - **Name**: `NEXT_PUBLIC_GAMBAR_SERVER_URL`
   - **Value**: `https://gambar.editaja.com`
   - **Environment**: Production, Preview, Development
5. **Redeploy** project (penting!)

**Cek di Code**:
```typescript
// Di app/api/image/save-generated/route.ts
console.log('GAMBAR_SERVER_URL:', process.env.NEXT_PUBLIC_GAMBAR_SERVER_URL);
```

**Note**: Pastikan prefix `NEXT_PUBLIC_` ada, karena ini untuk client-side access juga.

### 2. Cek Server gambar.editaja.com Sudah Siap

**Test Health Endpoint**:
```bash
curl https://gambar.editaja.com/health.php
```

Expected response:
```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00+00:00"
}
```

**Jika 404 atau error**:
- Pastikan semua file sudah di-upload ke hosting
- Cek `.htaccess` sudah ada
- Cek `mod_rewrite` enabled
- Lihat `SETUP-HOSTING.md` untuk troubleshooting

### 3. Cek Logs di Server Utama (editaja.com)

**Di Vercel**:
1. Buka Vercel Dashboard
2. Pilih project → **Functions** → **Logs**
3. Cari log dengan keyword: `Save Generated`

**Di Code** (sudah ada logging):
```typescript
console.log(`[Save Generated] Using gambar server URL: ${GAMBAR_SERVER_URL}`);
console.log(`[Save Generated] Attempting to upload to gambar server: ${uploadUrl}`);
console.log(`[Save Generated] Upload response status: ${uploadResponse.status}`);
```

**Cek Error Messages**:
- `Failed to upload to gambar server: 404` → Endpoint tidak ditemukan
- `Failed to upload to gambar server: 500` → Server error
- `Failed to upload to gambar server: Connection timeout` → Server tidak bisa diakses
- `Failed to upload to gambar server: CORS error` → CORS issue

### 4. Test Upload Manual

**Test dari server utama ke gambar server**:

```bash
# Dari terminal server editaja.com atau local
curl -X POST https://gambar.editaja.com/api/upload/generated-from-url \
  -H "Content-Type: application/json" \
  -H "Origin: https://editaja.com" \
  -d '{
    "imageUrl": "https://example.com/test-image.jpg",
    "userId": "test-user",
    "index": 0
  }'
```

Expected response:
```json
{
  "ok": true,
  "url": "/generated/generated_1234567890_abc123.jpg",
  "fullUrl": "https://gambar.editaja.com/generated/generated_1234567890_abc123.jpg",
  "filename": "generated_1234567890_abc123.jpg",
  "size": 12345
}
```

**Jika gagal**:
- Cek error message
- Cek apakah server gambar.editaja.com bisa diakses
- Cek firewall/security group

### 5. Cek Browser Console

**Buka browser console** (F12) saat generate image:

Cek log messages:
- `✅ Generated image 1 saved via server-side:` → Success
- `Server-side save failed` → Error di server
- `Server-side save returned invalid URL` → Response tidak valid

**Cek Network Tab**:
1. Buka Developer Tools → **Network** tab
2. Generate image baru
3. Cari request ke `/api/image/save-generated`
4. Cek response:
   - **Status**: Harus 200 OK
   - **Response body**: Harus ada `ok: true` dan `url` dengan domain gambar.editaja.com

### 6. Cek Fallback ke Local Storage

Jika upload ke gambar.editaja.com gagal, sistem akan fallback ke local storage.

**Cek Log**:
```
Error uploading to gambar server, falling back to local storage: [error message]
Image saved locally as fallback: /path/to/public/uploads/...
```

**Jika selalu fallback**:
- Berarti upload ke gambar.editaja.com selalu gagal
- Cek error message untuk tahu penyebabnya
- Kemungkinan:
  - Server gambar.editaja.com tidak bisa diakses
  - Endpoint URL salah
  - CORS issue
  - Server error

## 🔧 Checklist Troubleshooting

### Server Utama (editaja.com):
- [ ] Environment variable `NEXT_PUBLIC_GAMBAR_SERVER_URL` sudah di-set di Vercel
- [ ] Project sudah di-redeploy setelah set env var
- [ ] Cek logs di Vercel untuk error messages
- [ ] Test generate image baru
- [ ] Cek browser console untuk error

### Server Gambar (gambar.editaja.com):
- [ ] Semua file sudah di-upload ke hosting
- [ ] Test `https://gambar.editaja.com/health.php` berhasil
- [ ] Test `https://gambar.editaja.com/api/upload/generated-from-url.php` bisa diakses
- [ ] Folder `public/generated/` permission 755 atau 777
- [ ] Cek error log di hosting gambar.editaja.com

## 🐛 Common Issues & Solutions

### Issue 1: "Failed to upload to gambar server: 404"

**Problem**: Endpoint tidak ditemukan di server gambar.

**Solution**:
1. Cek URL endpoint benar: `https://gambar.editaja.com/api/upload/generated-from-url`
2. Test endpoint langsung: `https://gambar.editaja.com/api/upload/generated-from-url.php`
3. Cek `.htaccess` routing sudah benar
4. Jika masih 404, gunakan file langsung tanpa routing (buat file di `/api/upload/generated-from-url.php`)

### Issue 2: "Failed to upload to gambar server: CORS error"

**Problem**: CORS tidak di-set dengan benar.

**Solution**:
1. Cek `config.php` di server gambar:
   ```php
   define('ALLOWED_ORIGINS', '*'); // Untuk test, kurang secure
   ```
2. Atau set spesifik:
   ```php
   define('ALLOWED_ORIGINS', ['https://editaja.com', 'https://www.editaja.com']);
   ```
3. Pastikan CORS headers di-set di semua endpoint (sudah ada di code)

### Issue 3: "Connection timeout" atau "Network error"

**Problem**: Server gambar.editaja.com tidak bisa diakses.

**Solution**:
1. Test `https://gambar.editaja.com/health.php` dari browser
2. Cek DNS sudah benar
3. Cek firewall/security group hosting gambar.editaja.com
4. Cek apakah hosting mengizinkan outbound HTTP requests

### Issue 4: "Environment variable not set"

**Problem**: `NEXT_PUBLIC_GAMBAR_SERVER_URL` belum di-set atau belum di-redeploy.

**Solution**:
1. Set env var di Vercel (lihat langkah 1 di atas)
2. **PENTING**: Redeploy project setelah set env var
3. Cek di code:
   ```typescript
   console.log('GAMBAR_SERVER_URL:', process.env.NEXT_PUBLIC_GAMBAR_SERVER_URL);
   ```

### Issue 5: Gambar masuk ke local storage, bukan gambar.editaja.com

**Problem**: Upload ke gambar.editaja.com gagal, fallback ke local.

**Solution**:
1. Cek error log untuk tahu kenapa gagal
2. Pastikan server gambar.editaja.com sudah siap
3. Test endpoint secara manual (langkah 4 di atas)
4. Jika server gambar siap tapi masih gagal, cek network/firewall

## 📝 Test Flow Lengkap

### Step 1: Test Health Endpoint
```bash
curl https://gambar.editaja.com/health.php
```
Expected: JSON dengan `"ok": true`

### Step 2: Test Upload Endpoint
```bash
curl -X POST https://gambar.editaja.com/api/upload/generated-from-url.php \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/test.jpg", "userId": "test", "index": 0}'
```
Expected: JSON dengan `"ok": true` dan `"fullUrl"`

### Step 3: Test dari editaja.com
1. Buka aplikasi editaja.com
2. Generate image baru
3. Cek browser console (F12)
4. Cek network tab untuk request ke `/api/image/save-generated`
5. Cek response harus ada URL dari gambar.editaja.com

### Step 4: Verifikasi File Tersimpan
Cek di hosting gambar.editaja.com:
- Folder: `public/generated/`
- Harus ada file baru dengan format: `generated_{timestamp}_{random}.jpg`

## 🔍 Debug Commands

### Di Server Utama (Vercel Logs):
```bash
# Filter logs untuk save-generated
grep "Save Generated" logs
```

### Di Server Gambar (Hosting Logs):
```bash
# Cek error log PHP
tail -f /path/to/error_log

# Cek access log
tail -f /path/to/access_log | grep "upload"
```

## 📞 Jika Masih Error

Jika masih ada masalah setelah semua langkah di atas:

1. **Cek Logs Lengkap**:
   - Vercel logs (server utama)
   - PHP error log (server gambar)
   - Browser console

2. **Cek Network**:
   - Test ping ke gambar.editaja.com
   - Test curl dari server utama ke server gambar

3. **Cek Configuration**:
   - Environment variables
   - Server configuration
   - File permissions

4. **Cek Code**:
   - Pastikan code sudah di-deploy
   - Pastikan tidak ada typo di URL
   - Pastikan semua file sudah ada

## ✅ Success Indicators

Jika berhasil, Anda akan melihat:

1. **Di Browser Console**:
   ```
   ✅ Generated image 1 saved via server-side: https://gambar.editaja.com/generated/...
   ```

2. **Di Vercel Logs**:
   ```
   Image uploaded to gambar server successfully: https://gambar.editaja.com/generated/...
   ```

3. **Di Server Gambar**:
   - File baru muncul di folder `public/generated/`

4. **Di Firestore**:
   - URL tersimpan dengan format: `https://gambar.editaja.com/generated/...`

