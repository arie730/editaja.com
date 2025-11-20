# Fix Generations Rules - Missing Permissions Error

## Masalah

Error "Missing or insufficient permissions" saat generate image terjadi karena Firestore rules tidak mengizinkan anonymous users untuk create document di collection `generations`.

## Solusi

Update Firestore rules untuk mengizinkan:
1. **Authenticated users** - Bisa create dengan userId mereka sendiri
2. **Anonymous users** - Bisa create dengan userId "anonymous"

## Rules yang Diperbaiki

```javascript
// Generations collection - users can read their own, admins can read all
match /generations/{generationId} {
  // Users can read their own generations (authenticated)
  allow read: if request.auth != null && 
                 (resource == null || resource.data.userId == request.auth.uid);
  
  // Allow read for anonymous users' generations
  allow read: if resource != null && resource.data.userId == "anonymous";
  
  // Admins can read all generations
  allow read: if isAdmin();
  
  // Authenticated users can create their own generations
  allow create: if request.auth != null && 
                   request.resource.data.userId == request.auth.uid;
  
  // Anonymous users can create generations with userId "anonymous"
  allow create: if request.resource.data.userId == "anonymous";
  
  // Only admins can update or delete
  allow update, delete: if isAdmin();
}
```

## Cara Update Rules

1. Buka **Firebase Console** > **Firestore Database** > **Rules**
2. Copy rules dari file `firestore-rules.txt` (yang sudah diperbaiki)
3. Paste di editor
4. Klik **Publish**

## Verifikasi

Setelah update rules:
1. Coba generate image lagi (tanpa login)
2. Seharusnya tidak ada error "Missing or insufficient permissions"
3. Data generation akan tersimpan dengan `userId: "anonymous"`

## Catatan

- Rules sudah di-update di file `firestore-rules.txt`
- Rules juga sudah di-update di file `firestore.rules`
- Rules juga sudah di-update di file `FIREBASE-RULES-COMPLETE.txt`
- **Pastikan untuk copy rules yang baru ke Firebase Console!**







