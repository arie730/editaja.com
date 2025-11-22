# Firestore Quota Optimization Analysis

## 🔴 Masalah Utama yang Menyebabkan Quota Boros

### 1. **Real-time Listener yang Subscribe ke SEMUA Documents** ⚠️ SANGAT BOROS
**File:** `lib/visitors.ts` - `subscribeToActiveVisitors()`
- **Masalah:** Subscribe ke SEMUA documents di collection `visitors` tanpa filter
- **Dampak:** Setiap kali ada visitor baru atau update, SEMUA documents di-read
- **Contoh:** Jika ada 10,000 visitor documents, setiap update akan read 10,000 documents!

### 2. **Get All Documents Lalu Filter Client-Side** ⚠️ SANGAT BOROS
**File:** 
- `lib/visitors.ts` - `getActiveVisitorsCount()` dan `getTodayVisitorsCount()`
- `lib/feedback.ts` - `getUnreadFeedbackCount()`
- `lib/dashboard.ts` - `getRecentGenerations()`
- `lib/dashboard.ts` - `getPopularStyles()` (panggil `getGenerations()` yang get ALL)

**Masalah:** 
- Get ALL documents dari collection (bisa ribuan)
- Filter di client-side
- **Dampak:** Read ALL documents padahal hanya butuh sebagian kecil

### 3. **Admin Dashboard Refresh Terlalu Sering** ⚠️ BOROS
**File:** `app/admin/dashboard/page.tsx`
- Refresh setiap 30 detik
- Setiap refresh memanggil:
  - `getDashboardStats()` → getUsers(), getGenerations(), getActiveStyles(), getActiveVisitorsCount(), getTodayVisitorsCount()
  - `getRecentGenerations(5)` → get ALL generations, filter client-side
  - `getPopularStyles(5)` → get ALL generations, process client-side

**Dampak:** Dalam 1 jam = 120 kali refresh = ~600 queries!

### 4. **Visitor Tracking yang Tidak Optimal** ⚠️ BOROS
**File:** `lib/visitors.ts` - `trackVisitor()`
- Dipanggil setiap kali user load page
- Menggunakan `getDoc()` + `setDoc()` = 1 read + 1 write per page load
- **Dampak:** Jika 100 user load page = 100 reads + 100 writes

### 5. **getGenerations() Dipanggil Berulang** ⚠️ BOROS
**File:** `lib/dashboard.ts` - `getPopularStyles()`
- Panggil `getGenerations()` yang get ALL generations
- Process di client-side
- Dipanggil setiap 30 detik di admin dashboard

## 📊 Perkiraan Quota Usage

### Admin Dashboard (jika dibuka 1 jam):
- `getDashboardStats()` setiap 30 detik = 120 kali
- Setiap call = ~5 queries (users, generations, styles, visitors)
- **Total: ~600 queries per jam**

### Visitor Tracking (100 user load page):
- 100 reads + 100 writes = **200 operations**

### Real-time Listener (jika ada 10k visitors):
- Setiap update visitor = read 10k documents
- Jika 100 update per jam = **1,000,000 reads per jam!**

## ✅ Solusi Optimasi

### 1. Optimasi Real-time Listener
- Gunakan query dengan filter `where("isActive", "==", true)` dan `where("lastSeenAt", ">=", fiveMinutesAgo)`
- Atau gunakan polling dengan interval lebih lama (1-5 menit)

### 2. Optimasi Get All Documents
- Gunakan `where()` clause di query
- Atau gunakan `getCountFromServer()` jika hanya butuh count
- Atau limit query dengan pagination

### 3. Optimasi Admin Dashboard
- Kurangi refresh interval (60 detik atau lebih)
- Cache data di client-side
- Gunakan pagination untuk large collections

### 4. Optimasi Visitor Tracking
- Gunakan `setDoc(..., { merge: true })` langsung tanpa `getDoc()` terlebih dahulu
- Atau gunakan `increment()` untuk update

### 5. Optimasi Dashboard Stats
- Gunakan aggregate queries jika memungkinkan
- Cache stats dengan TTL
- Kurangi query yang tidak perlu

