# Local Storage Setup

## Overview

Sistem sekarang menyimpan foto asli user dan foto hasil generate ke folder lokal proyek (`public/uploads/`) daripada menggunakan Firebase Storage (yang berbayar).

## Struktur Folder

```
public/
  uploads/
    {userId}/
      original_{timestamp}.jpg    # Foto asli user
      generated_{timestamp}.jpg    # Foto hasil generate
```

## Cara Kerja

1. **Upload Foto Asli**: User upload foto → Disimpan ke `public/uploads/{userId}/original_{timestamp}.jpg`
2. **Generate Image**: Foto dikirim ke Freepik API → Mendapat URL hasil generate
3. **Download & Save**: Hasil generate didownload dan disimpan ke `public/uploads/{userId}/generated_{timestamp}.jpg`
4. **Save to Firestore**: URL lokal disimpan ke Firestore untuk referensi

## File yang Dibuat

- `app/api/upload/route.ts` - API route untuk upload file ke server
- `lib/storage.ts` - Updated untuk menggunakan local storage
- `app/components/ImageGenerateModal.tsx` - Updated untuk upload ke local

## URL Format

- Foto asli: `/uploads/{userId}/original_{timestamp}.jpg`
- Foto generate: `/uploads/{userId}/generated_{timestamp}.jpg`

## Keuntungan

✅ **Gratis** - Tidak perlu bayar Firebase Storage  
✅ **Lokal** - File tersimpan di server Anda  
✅ **Kontrol Penuh** - Anda kontrol penuh atas file  
✅ **Mudah Backup** - Cukup backup folder `public/uploads/`  

## Catatan Penting

⚠️ **Folder Size**: Pastikan server Anda punya cukup space untuk menyimpan gambar  
⚠️ **Backup**: Lakukan backup folder `public/uploads/` secara berkala  
⚠️ **.gitignore**: Folder uploads sudah di-ignore di git (tidak akan di-commit)  
⚠️ **Production**: Pastikan folder `public/uploads/` ada dan writable di production  

## Troubleshooting

### Error: "ENOENT: no such file or directory"
- Pastikan folder `public/uploads/` ada
- API route akan membuat folder otomatis, pastikan server punya permission write

### Error: "EACCES: permission denied"
- Pastikan folder `public/uploads/` writable
- Di Linux/Mac: `chmod -R 755 public/uploads/`

### File tidak muncul di browser
- Pastikan Next.js serve static files dari folder `public/`
- Restart development server setelah membuat folder

## Maintenance

### Cleanup Old Files
Anda bisa membuat script untuk cleanup file lama:

```bash
# Hapus file lebih dari 30 hari
find public/uploads -type f -mtime +30 -delete
```

### Backup
```bash
# Backup folder uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz public/uploads/
```







