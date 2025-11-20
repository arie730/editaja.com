# Styles Management Guide

## Overview

Halaman `/admin/styles` sekarang sudah terhubung dengan Firestore dan memungkinkan Anda untuk:
- ✅ Menambahkan style baru (termasuk prompt)
- ✅ Mengedit style yang sudah ada
- ✅ Menghapus style
- ✅ Mencari style
- ✅ Melihat semua styles dari database

## Cara Menggunakan

### 1. Menambahkan Style Baru

1. Buka `/admin/styles`
2. Klik tombol **"Add New Style"**
3. Isi form:
   - **Style Name**: Nama style (contoh: "Neon Punk", "Retro Wave")
   - **AI Prompt**: Prompt yang akan digunakan untuk generate gambar
   - **Preview Image URL**: URL gambar preview untuk style ini
   - **Status**: Active atau Inactive
4. Klik **"Create Style"**

### 2. Mengedit Style

1. Di tabel styles, klik icon **edit** (✏️) pada style yang ingin diedit
2. Modal akan terbuka dengan data style yang sudah terisi
3. Edit data yang diperlukan
4. Klik **"Update Style"**

### 3. Menghapus Style

1. Klik icon **delete** (🗑️) pada style yang ingin dihapus
2. Konfirmasi penghapusan
3. Style akan dihapus dari database

### 4. Mencari Style

- Gunakan search box di bagian atas untuk mencari style berdasarkan nama
- Pencarian dilakukan secara real-time

## Struktur Data di Firestore

Setiap style disimpan di collection `styles` dengan struktur:

```javascript
{
  name: "Neon Punk",                    // String - Nama style
  prompt: "neon cyberpunk style...",   // String - AI prompt
  imageUrl: "https://...",             // String - URL gambar preview
  status: "Active",                     // String - "Active" atau "Inactive"
  createdAt: Timestamp,                 // Timestamp - Waktu dibuat
  updatedAt: Timestamp                  // Timestamp - Waktu diupdate (optional)
}
```

## Firestore Rules

Pastikan Firestore rules sudah diupdate untuk mengizinkan:
- ✅ Semua orang bisa **read** styles (untuk ditampilkan di homepage)
- ✅ Hanya admin yang bisa **create, update, delete** styles

Rules yang diperlukan sudah ada di file `firestore.rules`.

## Tips

1. **Prompt yang Baik**: 
   - Buat prompt yang jelas dan deskriptif
   - Contoh: "neon cyberpunk style with vibrant colors, futuristic cityscape, 80s retro aesthetic"

2. **Image URL**:
   - Gunakan URL gambar yang valid dan accessible
   - Bisa menggunakan URL dari Google Images, atau upload ke Firebase Storage

3. **Status**:
   - **Active**: Style akan ditampilkan di homepage
   - **Inactive**: Style tidak ditampilkan (tapi masih ada di database)

4. **Preview Image**:
   - Gunakan gambar yang representatif untuk style tersebut
   - Ukuran disarankan: square (1:1) untuk konsistensi

## Troubleshooting

### Styles tidak muncul
- Pastikan Firestore rules sudah diupdate
- Check browser console untuk error
- Pastikan collection `styles` ada di Firestore

### Tidak bisa save style
- Pastikan Anda sudah login sebagai admin
- Check Firestore rules untuk collection `styles`
- Pastikan semua field sudah diisi

### Error "permission-denied"
- Update Firestore rules (lihat `firestore.rules`)
- Pastikan user sudah login sebagai admin
- Refresh browser setelah update rules

## Next Steps

Setelah styles dibuat, Anda bisa:
1. Menampilkan styles di homepage dari Firestore
2. Menggunakan prompt untuk generate gambar
3. Menambahkan fitur upload gambar ke Firebase Storage
4. Menambahkan kategori/tags untuk styles







