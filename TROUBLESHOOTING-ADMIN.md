# Troubleshooting: Access Denied - Admin Privileges Required

Jika Anda mendapatkan error **"Access denied. Admin privileges required."**, ikuti langkah-langkah berikut:

## 🔍 Langkah 1: Gunakan Debug Tool

1. Login terlebih dahulu dengan email dan password Anda di `/admin`
2. Setelah login (meski error), klik link **"Debug Admin Status"**
3. Atau buka langsung: `http://localhost:3000/admin/debug`
4. Tool ini akan menampilkan informasi detail tentang:
   - UID user Anda
   - Apakah document admin ada di Firestore
   - Apakah field `isAdmin` sudah benar
   - Rekomendasi perbaikan

## 🐛 Masalah Umum dan Solusinya

### Masalah 1: Document Tidak Ada di Firestore

**Gejala:**
- Debug tool menampilkan "Document Exists: ❌ No"
- Error: "Access denied. Admin privileges required."

**Solusi:**
1. Buka Firebase Console → Firestore Database
2. Pastikan collection `admins` ada (jika tidak, buat baru)
3. Buat document baru dengan:
   - **Document ID**: UID user Anda (BUKAN email!)
   - **Field `email`** (string): email user Anda
   - **Field `isAdmin`** (boolean): `true` (pastikan boolean, bukan string!)
   - **Field `createdAt`** (timestamp): timestamp sekarang (opsional)

### Masalah 2: Document ID Salah

**Gejala:**
- Document ada tapi Document ID tidak sama dengan UID
- Debug tool menampilkan "ID Match: ❌ No"

**Solusi:**
1. Document ID **HARUS** sama persis dengan UID user
2. UID bisa dilihat di:
   - Firebase Console → Authentication → Users → klik user → lihat "User UID"
   - Debug tool di `/admin/debug`
3. Jika Document ID salah:
   - Hapus document yang salah
   - Buat document baru dengan Document ID = UID user

### Masalah 3: Field isAdmin Bukan Boolean

**Gejala:**
- Debug tool menampilkan "isAdmin Type: string" (seharusnya "boolean")
- Field `isAdmin` = `"true"` (string) bukan `true` (boolean)

**Solusi:**
1. Buka Firebase Console → Firestore Database
2. Buka document admin Anda
3. Edit field `isAdmin`
4. Pastikan type = **boolean** (bukan string!)
5. Pastikan value = **true** (bukan "true")

### Masalah 4: Firestore Security Rules

**Gejala:**
- Error: "permission-denied"
- Debug tool tidak bisa membaca document

**Solusi:**
1. Buka Firebase Console → Firestore Database → Rules
2. Pastikan rules mengizinkan read untuk authenticated users:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read for admins collection (temporary for setup)
    match /admins/{adminId} {
      allow read: if request.auth != null;
      allow write: if false; // Only allow creation through admin panel or script
    }
  }
}
```

**Catatan:** Rules di atas hanya untuk development. Di production, gunakan rules yang lebih ketat.

### Masalah 5: User Tidak Ada di Authentication

**Gejala:**
- Error saat login: "auth/user-not-found" atau "auth/wrong-password"
- Tidak bisa login sama sekali

**Solusi:**
1. Pastikan user sudah dibuat di Firebase Console → Authentication → Users
2. Jika belum, buat user baru:
   - Klik "Add user"
   - Masukkan email dan password
   - Klik "Add user"
3. Setelah user dibuat, ikuti langkah di Masalah 1 untuk membuat document admin

## ✅ Checklist Verifikasi

Gunakan checklist ini untuk memastikan setup admin sudah benar:

- [ ] User ada di Firebase Authentication
- [ ] Collection `admins` ada di Firestore
- [ ] Document dengan Document ID = UID user ada di collection `admins`
- [ ] Field `email` (string) ada dan benar
- [ ] Field `isAdmin` (boolean) = `true` (bukan string "true")
- [ ] Firestore security rules mengizinkan read
- [ ] Environment variables (.env.local) sudah dikonfigurasi dengan benar
- [ ] Development server sudah direstart setelah mengubah .env.local

## 🔧 Cara Cepat: Menggunakan Setup Page

Cara termudah untuk membuat admin adalah menggunakan setup page:

1. Buka `http://localhost:3000/admin/setup`
2. Isi form:
   - Email: email admin Anda
   - Password: password admin Anda
   - Confirm Password: ulangi password
3. Klik "Create Admin Account"
4. Sistem akan otomatis:
   - Membuat user di Authentication
   - Membuat document admin di Firestore
   - Set admin privileges
5. Login di `/admin` dengan email dan password yang baru dibuat

## 📝 Contoh Setup Manual

Jika Anda ingin setup manual, berikut contohnya:

### Step 1: Buat User di Authentication
1. Firebase Console → Authentication → Users
2. Klik "Add user"
3. Email: `admin@editaja.com`
4. Password: `yourpassword123`
5. Klik "Add user"
6. **Copy UID**: `abc123xyz456` (contoh)

### Step 2: Buat Document Admin di Firestore
1. Firebase Console → Firestore Database
2. Collection: `admins` (buat jika belum ada)
3. Klik "Add document"
4. Document ID: `abc123xyz456` (UID dari step 1, BUKAN email!)
5. Add field:
   - `email` (string): `admin@editaja.com`
   - `isAdmin` (boolean): `true` (pastikan boolean, bukan string!)
   - `createdAt` (timestamp): sekarang
6. Klik "Save"

### Step 3: Login
1. Buka `http://localhost:3000/admin`
2. Email: `admin@editaja.com`
3. Password: `yourpassword123`
4. Klik "Login"

## 🆘 Masih Bermasalah?

Jika masih bermasalah setelah mengikuti langkah-langkah di atas:

1. **Cek Browser Console**: Buka Developer Tools (F12) → Console, lihat error yang muncul
2. **Cek Network Tab**: Lihat request ke Firestore, apakah ada error
3. **Gunakan Debug Tool**: Buka `/admin/debug` untuk melihat informasi detail
4. **Cek Firestore Console**: Pastikan document admin benar-benar ada dan field-nya benar
5. **Restart Server**: Restart development server setelah mengubah konfigurasi

## 📞 Informasi untuk Debug

Jika perlu bantuan lebih lanjut, siapkan informasi berikut:

- UID user (dari Authentication atau debug tool)
- Apakah document admin ada di Firestore?
- Apa value dan type dari field `isAdmin`?
- Error message lengkap dari browser console
- Screenshot dari Firestore Console (collection `admins`)







