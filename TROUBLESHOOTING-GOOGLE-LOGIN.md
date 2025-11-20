# Troubleshooting Google Login di VPS

## Masalah: Error saat login dengan Google di VPS (editaja.com)

### ✅ Langkah 1: Tambahkan Authorized Domains di Firebase Console

**PENTING:** Ini adalah langkah yang paling sering menyebabkan error!

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Anda
3. Pergi ke **Authentication** → **Settings** → **Authorized domains**
4. Klik **Add domain**
5. Tambahkan domain berikut:
   - `editaja.com`
   - `www.editaja.com`
   - `localhost` (untuk development)
6. Klik **Done**

**Catatan:** Firebase secara default hanya mengizinkan:
- `localhost`
- Domain Firebase project Anda (`.firebaseapp.com`)
- Domain custom yang sudah ditambahkan

### ✅ Langkah 2: Verifikasi Environment Variables di VPS

Pastikan semua environment variables sudah di-set dengan benar di VPS:

```bash
# Cek environment variables
echo $NEXT_PUBLIC_FIREBASE_API_KEY
echo $NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID
echo $NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
echo $NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
echo $NEXT_PUBLIC_FIREBASE_APP_ID
```

**File `.env.local` atau `.env.production` harus berisi:**

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**PENTING:** 
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` harus sesuai dengan project ID Anda
- Pastikan tidak ada spasi atau karakter tambahan
- Setelah mengubah `.env`, **restart aplikasi Next.js**

### ✅ Langkah 3: Rebuild dan Restart Aplikasi

Setelah mengubah environment variables atau authorized domains:

```bash
# Rebuild aplikasi
npm run build

# Restart aplikasi (sesuai dengan setup Anda)
# Jika menggunakan PM2:
pm2 restart editaja

# Jika menggunakan systemd:
sudo systemctl restart editaja

# Jika menggunakan Docker:
docker-compose restart
```

### ✅ Langkah 4: Verifikasi Konfigurasi Firebase

1. Buka Firebase Console → **Project Settings** (gear icon)
2. Scroll ke **Your apps** → Pilih web app Anda
3. Pastikan konfigurasi cocok dengan environment variables di VPS:
   - `apiKey` = `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` = `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` = `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` = `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` = `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` = `NEXT_PUBLIC_FIREBASE_APP_ID`

### ✅ Langkah 5: Cek Browser Console untuk Error Detail

Buka browser console (F12) dan cek error message yang muncul:

**Error umum dan solusinya:**

1. **"auth/unauthorized-domain"**
   - **Solusi:** Tambahkan domain di Firebase Console → Authentication → Settings → Authorized domains

2. **"auth/popup-blocked"**
   - **Solusi:** Izinkan popup untuk domain editaja.com di browser
   - Atau gunakan redirect method (akan otomatis fallback)

3. **"auth/network-request-failed"**
   - **Solusi:** Cek koneksi internet dan pastikan Firebase API dapat diakses dari VPS

4. **"Firebase auth not initialized"**
   - **Solusi:** Pastikan semua environment variables sudah di-set dan aplikasi sudah di-rebuild

### ✅ Langkah 6: Test dengan Browser Incognito

Coba login dengan browser incognito/private untuk menghindari masalah cache atau cookie.

### ✅ Langkah 7: Verifikasi OAuth Consent Screen (Jika perlu)

Jika menggunakan Google OAuth:

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Pilih project yang sama dengan Firebase
3. Pergi ke **APIs & Services** → **OAuth consent screen**
4. Pastikan:
   - **Authorized domains** sudah ditambahkan
   - **Authorized redirect URIs** sudah di-set:
     - `https://editaja.com/__/auth/handler`
     - `https://www.editaja.com/__/auth/handler`
     - `https://[YOUR-PROJECT-ID].firebaseapp.com/__/auth/handler`

### ✅ Langkah 8: Cek Firestore Security Rules

Pastikan Firestore rules mengizinkan user untuk membuat document di collection `users`:

```javascript
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

### ✅ Langkah 9: Cek Logs di VPS

Cek logs aplikasi untuk error detail:

```bash
# Jika menggunakan PM2:
pm2 logs editaja

# Jika menggunakan systemd:
sudo journalctl -u editaja -f

# Jika menggunakan Docker:
docker-compose logs -f
```

### ✅ Langkah 10: Test dengan curl (Verifikasi API Key)

Test apakah Firebase API dapat diakses:

```bash
curl "https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=YOUR_API_KEY"
```

Jika error, kemungkinan API key tidak valid atau domain tidak authorized.

## Checklist Final

- [ ] Domain `editaja.com` dan `www.editaja.com` sudah ditambahkan di Firebase Console → Authentication → Settings → Authorized domains
- [ ] Semua environment variables sudah di-set dengan benar di VPS
- [ ] Aplikasi sudah di-rebuild setelah mengubah environment variables
- [ ] Aplikasi sudah di-restart
- [ ] Browser console tidak menunjukkan error
- [ ] Firestore security rules sudah benar
- [ ] OAuth consent screen sudah dikonfigurasi (jika perlu)

## Masih Error?

Jika masih error setelah semua langkah di atas:

1. **Cek error message spesifik** di browser console
2. **Cek logs** di VPS untuk detail error
3. **Test dengan domain Firebase default** (`your-project.firebaseapp.com`) untuk memastikan konfigurasi benar
4. **Hubungi support** dengan menyertakan:
   - Error message lengkap dari console
   - Logs dari VPS
   - Screenshot dari Firebase Console → Authentication → Settings → Authorized domains


