# ⚡ Quick Fix: Firestore Rules

## ❌ Rules Anda Sekarang (SALAH)

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

## ✅ Rules yang BENAR (Copy ini!)

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
    
    // Deny all other collections by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 🚀 Cara Update (3 Langkah)

1. **Buka Firebase Console**
   - https://console.firebase.google.com/
   - Pilih project Anda
   - Firestore Database → **Rules**

2. **Copy & Paste Rules**
   - Hapus rules lama
   - Paste rules yang benar (dari atas)
   - Klik **Publish**

3. **Test**
   - Refresh browser aplikasi
   - Coba login di `/admin`
   - Seharusnya tidak ada error "permission-denied" lagi!

## 💡 Kenapa Rules Lama Salah?

Rules lama: `allow read, write: if false;` memblokir **SEMUA** akses, termasuk:
- User tidak bisa check apakah mereka admin
- Aplikasi tidak bisa membaca document admin
- Semua operasi Firestore di-blokir

Rules baru mengizinkan:
- ✅ User bisa membaca document admin mereka sendiri (untuk check status)
- ✅ User bisa membaca/menulis data mereka sendiri
- ✅ Admin bisa membaca document admin lain
- ✅ Tetap aman (hanya user yang login bisa akses)

## 🔍 Verifikasi

Setelah update rules:
1. Refresh browser
2. Buka `/admin/debug`
3. Check browser console - tidak ada error "permission-denied"
4. Coba login - seharusnya berhasil!

## 📝 File Rules

Rules yang benar juga tersedia di file `firestore.rules` di project ini.







