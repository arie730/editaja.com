# Cara Membuat Akun Admin

Saat ini **tidak ada akun admin default**. Anda harus membuat akun admin secara manual melalui Firebase Console.

## Langkah-langkah Membuat Akun Admin

### Step 1: Buat User di Firebase Authentication

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Anda
3. Pergi ke **Authentication** > **Users**
4. Klik **Add user**
5. Masukkan:
   - **Email**: misalnya `admin@editaja.com`
   - **Password**: buat password yang kuat
6. Klik **Add user**
7. **Catat UID** dari user yang baru dibuat (klik pada user untuk melihat UID)

### Step 2: Buat Dokumen Admin di Firestore

1. Di Firebase Console, pergilah ke **Firestore Database**
2. Klik **Start collection** (jika collection `admins` belum ada)
3. **Collection ID**: masukkan `admins`
4. **Document ID**: masukkan **UID dari Step 1** (bukan email!)
5. Klik **Add field**:
   - **Field name**: `email`
   - **Type**: `string`
   - **Value**: email admin (misalnya `admin@editaja.com`)
6. Klik **Add field** lagi:
   - **Field name**: `isAdmin`
   - **Type**: `boolean`
   - **Value**: `true`
7. Klik **Add field** lagi (opsional):
   - **Field name**: `createdAt`
   - **Type**: `timestamp`
   - **Value**: pilih timestamp sekarang
8. Klik **Save**

### Step 3: Login sebagai Admin

1. Buka aplikasi di browser: `http://localhost:3000/admin`
2. Masukkan:
   - **Email**: `admin@editaja.com` (atau email yang Anda buat)
   - **Password**: password yang Anda buat di Step 1
3. Klik **Login**
4. Anda akan diarahkan ke `/admin/dashboard`

## Contoh Akun Admin

Setelah setup, Anda bisa login dengan:
- **Email**: `admin@editaja.com` (atau email yang Anda buat)
- **Password**: (password yang Anda buat di Firebase Console)

## Troubleshooting

### "Access denied. Admin privileges required."
- Pastikan user sudah dibuat di Firebase Authentication
- Pastikan dokumen admin sudah dibuat di Firestore dengan UID yang benar
- Pastikan field `isAdmin` = `true`
- Pastikan Document ID di Firestore = UID dari Authentication (bukan email!)

### Lupa UID User?
1. Buka Firebase Console > Authentication > Users
2. Klik pada user yang ingin dijadikan admin
3. Copy **User UID** yang ada di bagian atas

### Cara Cek Apakah User Sudah Admin?
1. Buka Firestore Database
2. Buka collection `admins`
3. Cari document dengan ID = UID user
4. Pastikan field `isAdmin` = `true`

## Alternatif: Menggunakan Script

Jika Anda sudah membuat user di Authentication, Anda bisa menggunakan script:

```bash
# Install ts-node jika belum
npm install -g ts-node

# Jalankan script (ganti UID dan email dengan data Anda)
npx ts-node scripts/create-admin.ts <UID> <email>
```

Contoh:
```bash
npx ts-node scripts/create-admin.ts abc123xyz456 admin@editaja.com
```

## Catatan Penting

⚠️ **PENTING**: 
- Document ID di Firestore **HARUS** sama dengan UID dari Authentication
- Jangan menggunakan email sebagai Document ID
- Field `isAdmin` harus `true` (boolean, bukan string)
- Pastikan Firebase sudah dikonfigurasi dengan benar di `.env.local`







