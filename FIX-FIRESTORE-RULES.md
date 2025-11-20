# Fix Firestore Security Rules

## ❌ Rules yang SALAH (Current)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // ❌ Ini memblokir SEMUA akses!
    }
  }
}
```

**Masalah:** Rules ini memblokir **SEMUA** akses ke Firestore, termasuk untuk check admin status!

## ✅ Rules yang BENAR

### Untuk Development (Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users collection - users can read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admins collection
    match /admins/{adminId} {
      // Allow users to read their own admin document (to check if they are admin)
      allow read: if request.auth != null && request.auth.uid == adminId;
      
      // Only existing admins can read other admin documents
      allow read: if isAdmin();
      
      // Allow creation for admin setup (development)
      allow create: if request.auth != null;
      
      // Only admins can update/delete admin documents
      allow update, delete: if isAdmin();
    }
    
    // Styles collection
    match /styles/{styleId} {
      // Everyone can read styles (for public display on homepage)
      allow read: if true;
      
      // Only admins can create, update, or delete styles
      allow create, update, delete: if isAdmin();
    }
    
    // Deny all other collections by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Untuk Development (Lebih Longgar - Testing Only)

Jika rules di atas masih bermasalah, gunakan rules yang lebih longgar untuk testing:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write (DEVELOPMENT ONLY!)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **WARNING:** Rules ini hanya untuk development! Jangan gunakan di production!

## 📝 Cara Update Rules di Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Anda
3. Pergi ke **Firestore Database** → **Rules**
4. Copy rules yang benar (dari atas)
5. Paste ke editor rules
6. Klik **Publish**
7. Tunggu beberapa detik sampai rules di-deploy

## 🔍 Cara Verifikasi Rules

Setelah update rules:

1. Refresh browser aplikasi Anda
2. Coba login di `/admin`
3. Buka `/admin/debug` untuk verify
4. Check browser console - seharusnya tidak ada error "permission-denied"

## 🎯 Penjelasan Rules

### Rule untuk `admins` collection:

```javascript
match /admins/{adminId} {
  // User bisa membaca document admin mereka sendiri
  allow read: if request.auth != null && request.auth.uid == adminId;
  
  // Admin bisa membaca semua document admin
  allow read: if isAdmin();
  
  // User yang sudah login bisa create (untuk setup)
  allow create: if request.auth != null;
  
  // Hanya admin yang bisa update/delete
  allow update, delete: if isAdmin();
}
```

**Kenapa perlu `allow read` untuk adminId sendiri?**
- Ketika user login, aplikasi perlu check apakah user tersebut admin
- Function `checkAdminStatus()` akan membaca document `/admins/{uid}`
- Tanpa rule ini, user tidak bisa check status admin mereka sendiri

### Helper function `isAdmin()`:

```javascript
function isAdmin() {
  return request.auth != null && 
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
}
```

Function ini:
1. Check apakah user sudah login (`request.auth != null`)
2. Check apakah document admin exist untuk user tersebut
3. Check apakah field `isAdmin` = `true`

## 🚀 Quick Fix

1. **Copy rules yang benar** (dari file `firestore.rules` atau dari atas)
2. **Buka Firebase Console** → Firestore Database → Rules
3. **Paste rules** ke editor
4. **Klik Publish**
5. **Refresh aplikasi** dan coba login lagi

## ⚠️ Catatan Penting

- Rules yang lebih longgar (allow all untuk authenticated users) hanya untuk **development**
- Untuk **production**, gunakan rules yang lebih ketat (rules pertama)
- Pastikan setelah update rules, tunggu beberapa detik untuk rules di-deploy
- Refresh browser setelah update rules

## 🔐 Production Rules (Advanced)

Untuk production, Anda mungkin ingin rules yang lebih ketat:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
    }
    
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /admins/{adminId} {
      // Users can only read their own admin document
      allow read: if request.auth != null && request.auth.uid == adminId;
      
      // Only admins can create/update/delete (via server-side script)
      allow create, update, delete: if false; // Disable client-side creation
    }
    
    // Add other collections as needed
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Note:** Untuk production, admin creation harus dilakukan melalui:
- Server-side script
- Cloud Functions
- Firebase Admin SDK (backend only)

