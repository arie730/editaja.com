# ⚠️ TIDAK MENGGUNAKAN FIREBASE STORAGE

## Informasi Penting

Aplikasi ini **TIDAK menggunakan Firebase Storage** karena berbayar.

## Penyimpanan File

Semua file (foto asli dan hasil generate) disimpan di:
- **Lokasi**: `public/uploads/{userId}/`
- **Format**: 
  - Foto asli: `original_{timestamp}.jpg`
  - Hasil generate: `generated_{timestamp}.jpg`

## Apa yang Perlu Di-Setup

### ✅ Yang Perlu:
1. **Firestore Rules** - Untuk database
   - Copy dari file `firestore-rules.txt`
   - Paste di Firebase Console > Firestore Database > Rules

### ❌ Yang TIDAK Perlu:
1. **Firebase Storage Rules** - TIDAK PERLU
2. **Firebase Storage CORS** - TIDAK PERLU
3. **Firebase Storage Setup** - TIDAK PERLU

## Struktur Folder

```
public/
  uploads/
    {userId}/
      original_{timestamp}.jpg
      generated_{timestamp}.jpg
```

## Backup

Untuk backup, cukup backup folder `public/uploads/`:
```bash
# Backup
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz public/uploads/

# Restore
tar -xzf uploads-backup-YYYYMMDD.tar.gz
```

## Catatan

- File disimpan di server lokal
- Tidak ada biaya storage
- File bisa diakses via URL: `/uploads/{userId}/filename.jpg`
- Pastikan folder `public/uploads/` writable







