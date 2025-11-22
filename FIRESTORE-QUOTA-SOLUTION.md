# Firestore Quota Exceeded - Solusi

## ⚠️ Masalah: Firestore Quota Habis

Error `8 RESOURCE_EXHAUSTED: Quota exceeded` berarti quota Firestore Anda sudah habis. Ini biasanya terjadi pada Firestore **Spark (Free) Plan**.

## 🔍 Penyebab

Firestore Free Tier memiliki limit:
- **50,000 reads/day**
- **20,000 writes/day**
- **20,000 deletes/day**

Jika aplikasi Anda banyak melakukan operasi Firestore (reads/writes), quota bisa habis sebelum hari berakhir.

## ✅ Solusi

### Solusi 1: Upgrade ke Blaze Plan (Recommended)

**Blaze Plan** adalah pay-as-you-go, artinya:
- Tidak ada quota limit harian
- Hanya bayar per penggunaan
- Free tier allowance tetap tersedia (50k reads, 20k writes per hari)
- Biaya sangat murah untuk aplikasi kecil-menengah

**Cara Upgrade:**
1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Anda
3. Klik **Upgrade** di billing section
4. Pilih **Blaze Plan**
5. Setup billing (card/payment method)

**Perkiraan Biaya (contoh untuk 100k reads, 50k writes per hari):**
- Reads: (100k - 50k free) × $0.06 per 100k = **$0.03/hari** = **~$0.90/bulan**
- Writes: (50k - 20k free) × $0.18 per 100k = **$0.054/hari** = **~$1.62/bulan**
- **Total: ~$2.50/bulan** (sangat terjangkau!)

### Solusi 2: Tunggu Quota Reset

Firestore quota reset setiap hari pada jam 00:00 UTC (07:00 WIB).

**Cara Cek Quota:**
1. Firebase Console → Project Settings → Usage and Billing
2. Lihat usage harian Anda
3. Tunggu sampai reset (setiap hari)

**Note:** Ini bukan solusi jangka panjang. Aplikasi akan terus mengalami error setiap kali quota habis.

### Solusi 3: Optimasi Query (Sementara)

Kurangi penggunaan Firestore:
- Cache data di client-side
- Kurangi query yang tidak perlu
- Batch operations jika memungkinkan

**Note:** Ini hanya mengurangi masalah, tidak menyelesaikan akar masalahnya.

## 🔄 Manual Retry untuk Transaksi yang Gagal

Jika ada transaksi yang gagal karena quota exceeded, Anda bisa retry manual:

### Via API Endpoint

```
POST /api/midtrans/retry-failed
Body: { "orderId": "TOPUP-xxx" }
```

Atau via GET:
```
GET /api/midtrans/retry-failed?orderId=TOPUP-xxx
```

### Via Browser

Buka URL ini di browser (ganti `TOPUP-xxx` dengan order ID yang gagal):
```
https://editaja.com/api/midtrans/retry-failed?orderId=TOPUP-xxx
```

Endpoint ini akan:
1. Check status transaksi di Midtrans
2. Jika status "settlement", complete transaction (tambahkan diamond)
3. Update status di Firestore

## 📊 Monitor Quota Usage

### Cek Usage di Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Anda
3. Klik **Usage and Billing** di sidebar
4. Lihat **Firestore Usage**:
   - Reads (per hari)
   - Writes (per hari)
   - Storage (per hari)

### Setup Alerts

1. Firebase Console → Project Settings → Usage and Billing
2. Klik **Set alert** untuk quota limit
3. Setup email alert ketika quota mencapai 80%, 90%, 100%

## 🚀 Best Practices

### 1. Upgrade ke Blaze Plan

Ini adalah solusi terbaik untuk aplikasi production. Biaya sangat murah dan tidak ada quota limit.

### 2. Optimasi Query

- Gunakan `limit()` untuk membatasi hasil query
- Hindari query yang tidak perlu
- Cache data di client-side jika memungkinkan
- Gunakan batch operations untuk multiple writes

### 3. Monitor Usage

- Cek usage harian di Firebase Console
- Setup alerts untuk quota limit
- Optimasi query jika usage terlalu tinggi

### 4. Error Handling

Aplikasi sudah memiliki:
- ✅ Retry logic dengan exponential backoff
- ✅ Error handling untuk quota exceeded
- ✅ Manual retry endpoint (`/api/midtrans/retry-failed`)

## 🔧 Troubleshooting

### Error: "Quota exceeded" saat topup

**Penyebab:** Firestore quota habis

**Solusi:**
1. Upgrade ke Blaze Plan (recommended)
2. Atau tunggu quota reset (setiap hari)
3. Atau retry manual via `/api/midtrans/retry-failed?orderId=TOPUP-xxx`

### Transaksi tidak terproses setelah quota habis

**Penyebab:** Callback Midtrans gagal karena quota exceeded

**Solusi:**
1. Upgrade ke Blaze Plan
2. Atau retry manual via endpoint retry
3. Diamond akan ditambahkan setelah transaksi di-retry

### Bagaimana cara retry semua transaksi yang gagal?

Saat ini tidak ada batch retry. Anda perlu retry manual satu per satu via endpoint.

**Planned Feature:** Dashboard admin untuk retry semua failed transactions (TODO).

## 📝 Catatan Penting

⚠️ **Quota Exceeded = Transaksi Tidak Terproses**

Jika quota habis:
- ❌ Transaksi tidak tersimpan ke Firestore
- ❌ Diamond tidak ditambahkan ke user
- ❌ Status tetap "pending"

**Solusi:** Upgrade ke Blaze Plan untuk menghindari masalah ini.

## 🔗 Links

- [Firestore Pricing](https://firebase.google.com/pricing)
- [Firebase Console](https://console.firebase.google.com/)
- [Upgrade to Blaze Plan](https://console.firebase.google.com/project/_/settings/billing)

## 💡 Rekomendasi

Untuk aplikasi production dengan fitur topup/payment:
- ✅ **Wajib upgrade ke Blaze Plan**
- ✅ Biaya sangat murah (~$2-5/bulan untuk traffic normal)
- ✅ Tidak ada quota limit
- ✅ Aplikasi akan lebih stabil

**Blaze Plan sangat worth it untuk menghindari masalah quota!**


