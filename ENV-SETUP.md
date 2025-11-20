# Environment Variables Setup

## Freepik API Key Configuration

Untuk mengatasi error "Missing or insufficient permissions" di server-side API route, Anda bisa menyimpan Freepik API key di environment variable.

## Opsi 1: Environment Variable (Recommended)

### Setup

1. Buat atau edit file `.env.local` di root project:
   ```env
   FREEPIK_API_KEY=your_freepik_api_key_here
   ```

2. Restart development server:
   ```bash
   npm run dev
   ```

### Keuntungan
- ✅ Tidak perlu akses Firestore dari server-side
- ✅ Lebih aman (tidak ter-expose di client)
- ✅ Tidak ada masalah permission

## Opsi 2: Update Firestore Rules (Alternative)

Jika tidak ingin menggunakan environment variable, update Firestore rules untuk mengizinkan read settings:

```javascript
// Settings collection
match /settings/{settingId} {
  // Allow read for everyone (needed for server-side API routes)
  allow read: if true;
  
  // Only admins can write
  allow write: if isAdmin();
}
```

**Note**: Rules ini sudah di-update di file `firestore-rules.txt`

## Verifikasi

Setelah setup:
1. Coba generate image lagi
2. Seharusnya tidak ada error "Missing or insufficient permissions"
3. API key akan diambil dari environment variable atau Firestore

## Catatan Keamanan

- Environment variable lebih aman karena tidak ter-expose ke client
- Firestore rules yang mengizinkan read untuk semua masih aman karena API key hanya untuk read-only
- Pastikan `.env.local` sudah di-ignore di git (sudah ada di `.gitignore`)







