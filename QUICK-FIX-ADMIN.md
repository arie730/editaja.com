# Quick Fix: Access Denied Error

## 🚀 Solusi Cepat (5 Menit)

### Option 1: Gunakan Setup Page (Paling Mudah)

1. Buka: `http://localhost:3000/admin/setup`
2. Isi form dengan email dan password baru
3. Klik "Create Admin Account"
4. Login di `/admin` dengan akun yang baru dibuat

### Option 2: Perbaiki Manual di Firebase Console

1. **Login dulu** di `/admin` (meskipun error)
2. Buka: `http://localhost:3000/admin/debug`
3. **Copy UID** yang ditampilkan (contoh: `abc123xyz456`)
4. Buka Firebase Console → Firestore Database
5. Buat/Edit document:
   - Collection: `admins`
   - Document ID: **Paste UID yang dicopy** (BUKAN email!)
   - Fields:
     - `email` (string): email Anda
     - `isAdmin` (boolean): `true` ← **PASTIKAN BOOLEAN, BUKAN STRING!**
6. Save
7. Refresh halaman debug, pastikan semua hijau (✅)
8. Login ulang di `/admin`

## ⚠️ Kesalahan Umum

1. **Document ID menggunakan email** → Harus menggunakan UID!
2. **isAdmin = "true" (string)** → Harus `true` (boolean)!
3. **Document tidak ada** → Harus dibuat dulu!
4. **UID salah** → Copy dari debug tool atau Firebase Console!

## 📋 Checklist Cepat

- [ ] User ada di Authentication
- [ ] Document ada di Firestore collection `admins`
- [ ] Document ID = UID user (bukan email)
- [ ] Field `isAdmin` = `true` (boolean, bukan string)
- [ ] Refresh browser setelah edit di Firebase
- [ ] Login ulang setelah perbaikan







