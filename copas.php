<?php
// viral_prompts.php
// Jalankan: http://localhost/viral_prompts.php  (atau di hosting kamu)

// ====== ERROR DISPLAY (boleh dimatikan di production) ======
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Start session untuk progress tracking
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ====== PASSWORD PROTECTION ======
const REQUIRED_PASSWORD = 'kmzwa78saa';

// Handle logout
if (isset($_GET['logout'])) {
    unset($_SESSION['authenticated']);
    header('Location: ' . str_replace('?logout=1', '', $_SERVER['REQUEST_URI']));
    exit;
}

// Handle login
if (isset($_POST['password'])) {
    if ($_POST['password'] === REQUIRED_PASSWORD) {
        $_SESSION['authenticated'] = true;
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    } else {
        $login_error = 'Password salah!';
    }
}

// Check authentication
if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    ?>
    <!DOCTYPE html>
    <html lang="id" class="dark">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="robots" content="noindex, nofollow">
      <title>Login Required - Viral Prompts Viewer</title>
      <script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        :root{ color-scheme: dark light; }
        body{ font-family: "Space Grotesk", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }
      </style>
      <script>
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              colors: {
                primary: "#6366f1",
                bgdark: "#0b0b12",
                card: "#14141f",
                soft: "#9CA3AF"
              },
              borderRadius: { '2xl': '1rem' }
            }
          }
        };
      </script>
    </head>
    <body class="bg-bgdark text-white min-h-screen flex items-center justify-center">
      <div class="bg-card border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
        <div class="text-center mb-6">
          <div class="size-16 rounded-xl bg-primary/20 grid place-items-center mx-auto mb-4">
            <span class="text-primary font-bold text-2xl">VP</span>
          </div>
          <h1 class="text-2xl font-bold mb-2">Viral Prompts Viewer</h1>
          <p class="text-sm text-soft">Masukkan password untuk melanjutkan</p>
        </div>
        
        <?php if (isset($login_error)): ?>
          <div class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300">
            <?= htmlspecialchars($login_error, ENT_QUOTES, 'UTF-8') ?>
          </div>
        <?php endif; ?>
        
        <form method="POST" class="space-y-4">
          <div>
            <label for="password" class="block text-sm font-semibold mb-2">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              required 
              autofocus
              class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Masukkan password">
          </div>
          <button 
            type="submit"
            class="w-full bg-primary hover:opacity-90 rounded-xl px-4 py-3 font-semibold">
            Masuk
          </button>
        </form>
      </div>
    </body>
    </html>
    <?php
    exit;
}

// ====== CONFIG ======
const API_URL   = 'https://chatgambar.com/api/v1/viral-prompts';

// Asal file gambar sebenarnya
const IMG_ORIGIN = 'https://copasprompt.id';

// Base URL untuk export (domain lokal proyek)
function get_base_url() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    $base = dirname($script);
    if ($base === '/' || $base === '\\') $base = '';
    return $protocol . '://' . $host . $base;
}
define('BASE_URL', get_base_url());

// Pakai Next.js Image Optimizer (true) atau langsung file asli (false)
const USE_NEXT_OPTIMIZER = true;

// Param default jika pakai optimizer
const OPTIMIZER_WIDTH   = 640; // ganti 960/1280 untuk lebih tajam
const OPTIMIZER_QUALITY = 100; // 1-100

// Cache API sederhana (file) agar hemat request
const CACHE_TTL = 300; // detik (5 menit)
const PER_PAGE  = 24;  // item per halaman

// Batch size untuk export
const BATCH_SIZE = 50; // jumlah item per batch

// Folder untuk menyimpan gambar yang didownload
// Simpan di root/images agar bisa diakses via http://localhost/images/...
define('IMAGES_DIR', __DIR__ . '/images');
define('IMAGES_URL', '/images');

// ====== UTIL ======
/** Bersihkan BOM & control chars yang bikin json_decode gagal */
function clean_json_string($s) {
    $s = preg_replace('/^\xEF\xBB\xBF/', '', $s ?? '');
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $s);
    if (!mb_check_encoding($s, 'UTF-8')) {
        $s = mb_convert_encoding($s, 'UTF-8', 'UTF-8');
    }
    return $s;
}

/** Ambil konten API dengan cache sederhana */
function fetch_api_with_cache($url) {
    $cacheFile = sys_get_temp_dir() . '/viral_prompts_cache.json';

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < CACHE_TTL)) {
        $raw = file_get_contents($cacheFile);
        return $raw !== false ? $raw : '';
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'User-Agent: ViralPrompts-PHP/1.1'
        ],
    ]);

    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err || $code < 200 || $code >= 300 || !$resp) {
        if (file_exists($cacheFile)) {
            return file_get_contents($cacheFile);
        }
        return '';
    }

    @file_put_contents($cacheFile, $resp);
    return $resp;
}

/** Normalisasi struktur JSON jadi array item */
function normalize_items($decoded) {
    if ($decoded === null) return [];

    if (is_array($decoded) && isset($decoded['data']) && is_array($decoded['data'])) {
        return $decoded['data'];
    }

    if (is_array($decoded) && (isset($decoded[0]) || empty($decoded))) {
        return $decoded;
    }

    if (is_array($decoded) && isset($decoded['id']) && (isset($decoded['prompt']) || isset($decoded['image']))) {
        return [$decoded];
    }

    if (is_object($decoded)) {
        return normalize_items((array)$decoded);
    }

    return [];
}

/** Bangun URL gambar absolut */
function image_url($img) {
    if (!$img) return '';
    if (preg_match('~^https?://~i', $img)) return $img;
    if ($img[0] !== '/') $img = '/'.$img;

    if (USE_NEXT_OPTIMIZER) {
        $urlParam = rawurlencode($img); // "/images/640.jpg" -> "%2Fimages%2F640.jpg"
        return rtrim(IMG_ORIGIN, '/') . "/_next/image?url={$urlParam}&w=" . OPTIMIZER_WIDTH . "&q=" . OPTIMIZER_QUALITY;
    } else {
        return rtrim(IMG_ORIGIN, '/') . $img; // https://copasprompt.id/images/640.jpg
    }
}

/** Format tanggal cantik */
function format_tanggal($s) {
    if (!$s) return '-';
    $ts = strtotime($s);
    if ($ts === false) return $s;
    return date('d M Y H:i', $ts);
}

/** Escape HTML */
function h($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** Ekstrak path gambar dari URL */
function extract_image_path($img) {
    if (!$img) return '';
    
    // Jika sudah full URL, ekstrak path saja
    if (preg_match('~^https?://~i', $img)) {
        $parsed = parse_url($img);
        $path = $parsed['path'] ?? '';
        
        // Jika ada query string dari Next.js optimizer, ekstrak parameter url
        if (strpos($path, '/_next/image') !== false) {
            if (isset($parsed['query'])) {
                parse_str($parsed['query'], $query);
                if (isset($query['url'])) {
                    $path = urldecode($query['url']);
                }
            }
        }
        
        if ($path) {
            // Pastikan path dimulai dengan /
            if ($path[0] !== '/') $path = '/' . $path;
            return $path;
        }
        return '';
    }
    
    // Jika relative path, tambahkan / jika belum ada
    if ($img[0] !== '/') $img = '/' . $img;
    return $img;
}

/** Download gambar dari URL asli ke folder lokal */
function download_image($imgPath, $sourceUrl = null) {
    if (!$imgPath) return false;
    
    // Buat folder images jika belum ada
    if (!is_dir(IMAGES_DIR)) {
        @mkdir(IMAGES_DIR, 0755, true);
    }
    
    // Path file lokal (hapus leading slash dan prefix /images jika ada)
    $localPath = ltrim($imgPath, '/');
    // Jika path sudah dimulai dengan "images/", hapus prefix tersebut
    if (strpos($localPath, 'images/') === 0) {
        $localPath = substr($localPath, 7); // Hapus "images/"
    }
    $localFile = IMAGES_DIR . '/' . $localPath;
    
    // Jika file sudah ada, skip download
    if (file_exists($localFile)) {
        return true;
    }
    
    // Buat direktori jika belum ada
    $localDir = dirname($localFile);
    if (!is_dir($localDir)) {
        @mkdir($localDir, 0755, true);
    }
    
    // Bangun URL sumber gambar
    if (!$sourceUrl) {
        // Jika path sudah relatif, gunakan IMG_ORIGIN
        $sourceUrl = rtrim(IMG_ORIGIN, '/') . $imgPath;
    }
    
    // Download gambar
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $sourceUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'User-Agent: ViralPrompts-PHP/1.1'
        ],
    ]);
    
    $imageData = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($err || $code < 200 || $code >= 300 || !$imageData) {
        return false;
    }
    
    // Simpan gambar
    return @file_put_contents($localFile, $imageData) !== false;
}

/** Bangun URL gambar untuk export (menggunakan domain lokal) */
function image_url_local($img, $skipDownload = false) {
    if (!$img) return '';
    
    $path = extract_image_path($img);
    if (!$path) return '';
    
    // Download gambar jika belum ada (kecuali skipDownload = true)
    if (!$skipDownload) {
        download_image($path);
    }
    
    // Hapus prefix /images/ dari path jika ada (untuk menghindari duplikasi)
    $cleanPath = ltrim($path, '/');
    if (strpos($cleanPath, 'images/') === 0) {
        $cleanPath = substr($cleanPath, 7); // Hapus "images/"
    }
    
    // Pastikan cleanPath tidak kosong
    if (empty($cleanPath)) {
        return '';
    }
    
    // Return URL lokal (IMAGES_URL sudah mengandung leading slash)
    return rtrim(BASE_URL, '/') . IMAGES_URL . '/' . $cleanPath;
}

/** Download semua gambar untuk items yang akan diexport dengan progress tracking */
function download_images_for_export($items, $progressFile = null) {
    $downloaded = 0;
    $failed = 0;
    $total = 0;
    $skipped = 0;
    
    // Hitung total gambar yang perlu didownload
    foreach ($items as $it) {
        $img = $it['image'] ?? '';
        if ($img) {
            $path = extract_image_path($img);
            if ($path) $total++;
        }
    }
    
    $current = 0;
    foreach ($items as $it) {
        $img = $it['image'] ?? '';
        if (!$img) continue;
        
        $path = extract_image_path($img);
        if (!$path) continue;
        
        $current++;
        
        // Cek apakah file sudah ada
        $localPath = ltrim($path, '/');
        if (strpos($localPath, 'images/') === 0) {
            $localPath = substr($localPath, 7);
        }
        $localFile = IMAGES_DIR . '/' . $localPath;
        
        if (file_exists($localFile)) {
            $skipped++;
            $downloaded++; // Dianggap berhasil karena sudah ada
        } else {
            if (download_image($path)) {
                $downloaded++;
            } else {
                $failed++;
            }
        }
        
        // Update progress file
        if ($progressFile) {
            $progress = [
                'current' => $current,
                'total' => $total,
                'downloaded' => $downloaded,
                'failed' => $failed,
                'skipped' => $skipped,
                'percentage' => $total > 0 ? round(($current / $total) * 100) : 0
            ];
            @file_put_contents($progressFile, json_encode($progress));
        }
    }
    
    return ['downloaded' => $downloaded, 'failed' => $failed, 'skipped' => $skipped, 'total' => $total];
}

/** Export data ke format JSON sesuai permintaan */
function export_to_json($items, $skipDownload = false) {
    // Download semua gambar terlebih dahulu (jika belum didownload)
    if (!$skipDownload) {
        download_images_for_export($items);
    }
    
    $export = [];
    foreach ($items as $it) {
        $export[] = [
            'prompt' => $it['prompt'] ?? '',
            'imageUrl' => image_url_local($it['image'] ?? '', $skipDownload),
            'status' => 'Active',
            'category' => $it['category'] ?? '',
            'tags' => is_array($it['tags'] ?? null) ? $it['tags'] : []
        ];
    }
    return json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

// ====== FETCH & DECODE ======
$raw = fetch_api_with_cache(API_URL);
$clean = clean_json_string($raw);

$decoded = json_decode($clean, true);
if ($decoded === null) {
    $clean2 = preg_replace('/[^\P{C}\t\r\n]/u', '', $clean);
    $decoded = json_decode($clean2, true);
}
$items = normalize_items($decoded);

// ====== FILTERING (GET) ======
$q        = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
$category = isset($_GET['category']) ? trim((string)$_GET['category']) : '';
$tag      = isset($_GET['tag']) ? trim((string)$_GET['tag']) : '';
$page     = max(1, (int)($_GET['page'] ?? 1));

$categories = [];
$tagsAll    = [];
foreach ($items as $it) {
    if (!empty($it['category'])) {
        $categories[$it['category']] = true;
    }
    if (!empty($it['tags']) && is_array($it['tags'])) {
        foreach ($it['tags'] as $tg) {
            $tagsAll[$tg] = true;
        }
    }
}
ksort($categories);
ksort($tagsAll);

$filtered = array_values(array_filter($items, function($it) use ($q, $category, $tag) {
    $txt = strtolower(
        ($it['prompt'] ?? '') . ' ' .
        ($it['category'] ?? '') . ' ' .
        implode(' ', $it['tags'] ?? [])
    );

    if ($q !== '') {
        $qok = true;
        foreach (preg_split('/\s+/', strtolower($q)) as $needle) {
            if ($needle !== '' && strpos($txt, $needle) === false) {
                $qok = false; break;
            }
        }
        if (!$qok) return false;
    }

    if ($category !== '' && strtolower($category) !== strtolower($it['category'] ?? '')) {
        return false;
    }

    if ($tag !== '') {
        $tags = array_map('strtolower', $it['tags'] ?? []);
        if (!in_array(strtolower($tag), $tags, true)) return false;
    }

    return true;
}));

$total     = count($filtered);
$totalPage = max(1, (int)ceil($total / PER_PAGE));
$page      = min($page, $totalPage);
$offset    = ($page - 1) * PER_PAGE;
$shown     = array_slice($filtered, $offset, PER_PAGE);

function qs_without_page(array $extra = []) {
    $params = $_GET;
    unset($params['page']);
    unset($params['export']); // Jangan include export di query string
    $params = array_merge($params, $extra);
    return http_build_query($params);
}

// ====== HANDLE EXPORT ======
if (isset($_GET['export']) && $_GET['export'] === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="viral-prompts-export-' . date('Y-m-d-His') . '.json"');
    echo export_to_json($filtered);
    exit;
}

// ====== HANDLE PROGRESS TRACKING ======
if (isset($_GET['action']) && $_GET['action'] === 'prepare_export') {
    $batchIndex = isset($_GET['batch']) ? max(0, (int)$_GET['batch']) : 0;
    
    // Bagi filtered items menjadi batch
    $batches = array_chunk($filtered, BATCH_SIZE);
    $totalBatches = count($batches);
    
    // Validasi batch index
    if ($batchIndex >= $totalBatches) {
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'error' => 'Batch index tidak valid'
        ]);
        exit;
    }
    
    // Ambil items untuk batch yang dipilih
    $batchItems = $batches[$batchIndex];
    
    // Buat file progress
    $progressFile = sys_get_temp_dir() . '/viral_prompts_export_' . session_id() . '_batch_' . $batchIndex . '.json';
    
    // Simpan batch items ke session file untuk digunakan saat export
    $exportDataFile = sys_get_temp_dir() . '/viral_prompts_data_' . session_id() . '_batch_' . $batchIndex . '.json';
    @file_put_contents($exportDataFile, json_encode($batchItems));
    
    // Mulai download di background (simulasi dengan langsung download)
    // Untuk real progress, kita akan download satu per satu dengan AJAX
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'started',
        'progressFile' => basename($progressFile),
        'sessionId' => session_id(),
        'batchIndex' => $batchIndex,
        'totalBatches' => $totalBatches,
        'total' => count(array_filter($batchItems, function($it) {
            return !empty($it['image']);
        }))
    ]);
    exit;
}

if (isset($_GET['action']) && $_GET['action'] === 'check_progress') {
    $batchIndex = isset($_GET['batch']) ? max(0, (int)$_GET['batch']) : 0;
    $progressFile = sys_get_temp_dir() . '/viral_prompts_export_' . session_id() . '_batch_' . $batchIndex . '.json';
    if (file_exists($progressFile)) {
        $progress = json_decode(file_get_contents($progressFile), true);
        header('Content-Type: application/json');
        echo json_encode($progress);
    } else {
        header('Content-Type: application/json');
        echo json_encode(['current' => 0, 'total' => 0, 'percentage' => 0]);
    }
    exit;
}

if (isset($_GET['action']) && $_GET['action'] === 'download_images') {
    $batchIndex = isset($_GET['batch']) ? max(0, (int)$_GET['batch']) : 0;
    
    // Bagi filtered items menjadi batch
    $batches = array_chunk($filtered, BATCH_SIZE);
    if ($batchIndex >= count($batches)) {
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'error' => 'Batch index tidak valid'
        ]);
        exit;
    }
    
    // Ambil items untuk batch yang dipilih
    $batchItems = $batches[$batchIndex];
    
    // Download gambar dengan progress
    $progressFile = sys_get_temp_dir() . '/viral_prompts_export_' . session_id() . '_batch_' . $batchIndex . '.json';
    $result = download_images_for_export($batchItems, $progressFile);
    
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'completed',
        'result' => $result,
        'batchIndex' => $batchIndex
    ]);
    exit;
}

if (isset($_GET['action']) && $_GET['action'] === 'get_export_file') {
    $batchIndex = isset($_GET['batch']) ? max(0, (int)$_GET['batch']) : 0;
    
    // Generate dan return file JSON
    $exportDataFile = sys_get_temp_dir() . '/viral_prompts_data_' . session_id() . '_batch_' . $batchIndex . '.json';
    if (file_exists($exportDataFile)) {
        $items = json_decode(file_get_contents($exportDataFile), true);
        // Skip download karena sudah didownload sebelumnya
        $json = export_to_json($items, true);
        
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="viral-prompts-export-batch-' . ($batchIndex + 1) . '-' . date('Y-m-d-His') . '.json"');
        echo $json;
        
        // Cleanup
        @unlink($exportDataFile);
        @unlink(sys_get_temp_dir() . '/viral_prompts_export_' . session_id() . '_batch_' . $batchIndex . '.json');
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Export data not found']);
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Viral Prompts Viewer</title>
  <script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root{ color-scheme: dark light; }
    body{ font-family: "Space Grotesk", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }
    .line-clamp-4{ display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }
  </style>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            primary: "#6366f1",
            bgdark: "#0b0b12",
            card: "#14141f",
            soft: "#9CA3AF"
          },
          borderRadius: { '2xl': '1rem' }
        }
      }
    };
  </script>
</head>
<body class="bg-bgdark text-white min-h-screen">
  <header class="sticky top-0 z-20 backdrop-blur bg-bgdark/80 border-b border-white/10">
    <div class="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <div class="size-9 rounded-xl bg-primary/20 grid place-items-center">
          <span class="text-primary font-bold">VP</span>
        </div>
        <h1 class="text-xl sm:text-2xl font-bold">Viral Prompts Viewer</h1>
        <span class="text-xs text-soft hidden sm:inline-block">by chatgambar.com</span>
      </div>
      <div class="flex items-center gap-3">
        <a href="?logout=1" class="text-xs text-soft hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">Logout</a>
      <form class="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-4 gap-2" method="get">
        <input type="text" name="q" value="<?=h($q)?>" placeholder="Cari prompt / tag / kategori..."
               class="bg-card border border-white/10 rounded-xl px-3 py-2 placeholder:text-soft focus:outline-none focus:ring-2 focus:ring-primary/50">
        <select name="category" class="bg-card border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">Semua Kategori</option>
          <?php foreach(array_keys($categories) as $cat): ?>
            <option value="<?=h($cat)?>" <?= strtolower($category)===strtolower($cat)?'selected':'';?>><?=h($cat)?></option>
          <?php endforeach; ?>
        </select>
        <select name="tag" class="bg-card border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">Semua Tag</option>
          <?php foreach(array_keys($tagsAll) as $tg): ?>
            <option value="<?=h($tg)?>" <?= strtolower($tag)===strtolower($tg)?'selected':'';?>><?=h($tg)?></option>
          <?php endforeach; ?>
        </select>
        <button class="bg-primary hover:opacity-90 rounded-xl px-4 py-2 font-semibold">Filter</button>
      </form>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6">
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <p class="text-sm text-soft">
        Menampilkan <span class="font-semibold"><?=count($shown)?></span> dari <span class="font-semibold"><?=$total?></span> hasil.
        Halaman <span class="font-semibold"><?=$page?></span> / <span class="font-semibold"><?=$totalPage?></span>.
      </p>
      <div class="flex gap-2 items-center flex-wrap">
        <?php if (!empty($filtered)): 
          $totalBatches = (int)ceil(count($filtered) / BATCH_SIZE);
        ?>
          <div class="flex gap-2 items-center">
            <select id="batchSelect" class="bg-card border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <?php for($i = 0; $i < $totalBatches; $i++): 
                $start = ($i * BATCH_SIZE) + 1;
                $end = min(($i + 1) * BATCH_SIZE, count($filtered));
              ?>
                <option value="<?=$i?>">Batch <?=$i+1?> (Item <?=$start?>-<?=$end?>)</option>
              <?php endfor; ?>
            </select>
            <button onclick="startExport()"
               class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-semibold text-sm flex items-center gap-2">
              <span>📥</span>
              <span>Export JSON</span>
            </button>
          </div>
        <?php endif; ?>
        <a href="?<?=qs_without_page(['page'=>max(1,$page-1)])?>"
           class="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 <?= $page<=1?'pointer-events-none opacity-40':'';?>">Prev</a>
        <a href="?<?=qs_without_page(['page'=>min($totalPage,$page+1)])?>"
           class="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 <?= $page>=$totalPage?'pointer-events-none opacity-40':'';?>">Next</a>
      </div>
    </div>

    <?php if (empty($items)): ?>
      <div class="p-6 rounded-2xl bg-card border border-white/10">
        <h2 class="text-lg font-semibold mb-2">Tidak ada data</h2>
        <p class="text-soft text-sm">Coba refresh halaman atau tunggu beberapa saat. Pastikan API dapat diakses dari server kamu.</p>
        <details class="mt-3">
          <summary class="cursor-pointer text-primary">Debug JSON (raw)</summary>
          <pre class="mt-2 text-xs overflow-auto whitespace-pre-wrap"><?=h($raw ?: '[EMPTY]')?></pre>
        </details>
      </div>
    <?php else: ?>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <?php foreach ($shown as $it):
          $img    = image_url($it['image'] ?? '');
          $cat    = $it['category'] ?? '';
          $prompt = $it['prompt'] ?? '';
          $tags   = is_array($it['tags'] ?? null) ? $it['tags'] : [];
          $copied = (int)($it['copied'] ?? 0);
          $saved  = (int)($it['saved'] ?? 0);
          $date   = $it['createdAt'] ?? '';
          $label  = $it['label'] ?? '';
          $type   = $it['type'] ?? '';
          $id     = $it['id'] ?? '';
        ?>
        <article class="rounded-2xl overflow-hidden border border-white/10 bg-card flex flex-col">
          <div class="aspect-[4/3] bg-black/30 relative">
            <?php if ($img): ?>
              <img src="<?=h($img)?>" alt="<?=h(mb_strimwidth($prompt,0,80,'…'))?>" loading="lazy"
                   class="w-full h-full object-cover">
            <?php else: ?>
              <div class="w-full h-full grid place-items-center text-soft text-sm">No Image</div>
            <?php endif; ?>
            <?php if ($cat): ?>
              <span class="absolute top-2 left-2 text-xs bg-black/60 backdrop-blur px-2 py-1 rounded-md border border-white/10">
                <?=h($cat)?>
              </span>
            <?php endif; ?>
            <?php if ($label || $type): ?>
              <span class="absolute top-2 right-2 text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-md border border-primary/30">
                <?=h(trim($label.' '.$type))?>
              </span>
            <?php endif; ?>
          </div>

          <div class="p-4 flex flex-col gap-3 grow">
            <div class="text-xs text-soft flex items-center gap-3">
              <span>ID: <?=h($id)?></span>
              <span>•</span>
              <span><?=h(format_tanggal($date))?></span>
            </div>

            <p class="text-sm line-clamp-4" id="prompt-short-<?=$id?>"><?=h($prompt)?></p>
            <p class="text-sm hidden" id="prompt-full-<?=$id?>"><?=nl2br(h($prompt))?></p>

            <?php if (!empty($tags)): ?>
              <div class="flex flex-wrap gap-2">
                <?php foreach ($tags as $tg): ?>
                  <a href="?<?=qs_without_page(['tag'=>$tg,'page'=>1])?>"
                     class="text-xs px-2 py-1 rounded-md border border-white/10 hover:bg-white/5"><?=h($tg)?></a>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>

            <div class="mt-auto flex items-center justify-between gap-2">
              <div class="text-xs text-soft flex items-center gap-3">
                <span title="Copied">📋 <?=$copied?></span>
                <span title="Saved">💾 <?=$saved?></span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  data-copy="<?=h($prompt)?>"
                  class="copy-btn text-xs px-3 py-1 rounded-lg bg-primary hover:opacity-90 font-semibold">
                  Copy Prompt
                </button>
                <button
                  class="toggle-btn text-xs px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5"
                  data-id="<?=$id?>">Lihat Lengkap</button>
              </div>
            </div>
          </div>
        </article>
        <?php endforeach; ?>
      </div>

      <!-- Pagination bawah -->
      <div class="mt-6 flex items-center justify-center gap-2">
        <?php
          $window = 2;
          $start = max(1, $page - $window);
          $end   = min($totalPage, $page + $window);
          if ($start > 1) {
              echo '<a class="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5" href="?'.qs_without_page(['page'=>1]).'">1</a>';
              if ($start > 2) echo '<span class="text-soft">…</span>';
          }
          for ($p=$start; $p<=$end; $p++) {
              $cls = $p==$page ? 'bg-primary text-white' : 'border border-white/10 hover:bg-white/5';
              echo '<a class="px-3 py-1 rounded-lg '.$cls.'" href="?'.qs_without_page(['page'=>$p]).'">'.$p.'</a>';
          }
          if ($end < $totalPage) {
              if ($end < $totalPage-1) echo '<span class="text-soft">…</span>';
              echo '<a class="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5" href="?'.qs_without_page(['page'=>$totalPage]).'">'.$totalPage.'</a>';
          }
        ?>
      </div>
    <?php endif; ?>
  </main>

  <footer class="max-w-7xl mx-auto px-4 py-8 text-center text-xs text-soft">
    Sumber data: <a class="text-primary hover:underline" href="<?=h(API_URL)?>"><?=h(API_URL)?></a>
    • Gambar dari <span class="text-primary"><?=h(IMG_ORIGIN)?></span>
    • Mode: <?= USE_NEXT_OPTIMIZER ? 'Next.js Optimizer' : 'Direct File' ?>
    <details class="mt-3">
      <summary class="cursor-pointer text-primary">Lihat JSON Raw (debug)</summary>
      <pre class="mt-2 text-[10px] leading-4 overflow-auto whitespace-pre-wrap border border-white/10 rounded-xl p-3 bg-black/30"><?=h($raw ?: '[EMPTY]')?></pre>
    </details>
  </footer>

  <script>
    // Copy Prompt
    document.querySelectorAll('.copy-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const text = btn.getAttribute('data-copy') || '';
        try {
          await navigator.clipboard.writeText(text);
          const old = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(()=>btn.textContent = old, 1200);
        } catch(e) {
          alert('Gagal menyalin. Coba manual.');
        }
      });
    });

    // Toggle full prompt
    document.querySelectorAll('.toggle-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        const shortEl = document.getElementById('prompt-short-'+id);
        const fullEl  = document.getElementById('prompt-full-'+id);
        if (!shortEl || !fullEl) return;
        const isShort = !fullEl.classList.contains('block');
        if (isShort) {
          shortEl.classList.add('hidden');
          fullEl.classList.remove('hidden');
          fullEl.classList.add('block');
          btn.textContent = 'Lihat Ringkas';
        } else {
          fullEl.classList.add('hidden');
          fullEl.classList.remove('block');
          shortEl.classList.remove('hidden');
          btn.textContent = 'Lihat Lengkap';
        }
      });
    });

    // Export dengan progress
    let exportInterval = null;
    let currentBatch = 0;
    
    function startExport() {
      // Ambil batch yang dipilih
      const batchSelect = document.getElementById('batchSelect');
      currentBatch = batchSelect ? parseInt(batchSelect.value) : 0;
      
      // Tampilkan modal
      document.getElementById('exportModal').classList.remove('hidden');
      document.getElementById('exportProgress').textContent = '0';
      document.getElementById('exportTotal').textContent = '0';
      document.getElementById('exportStatus').textContent = 'Mempersiapkan...';
      document.getElementById('progressBar').style.width = '0%';
      document.getElementById('batchInfo').textContent = `Batch ${currentBatch + 1}`;
      
      // Disable export button dan batch select
      const exportBtn = document.querySelector('button[onclick="startExport()"]');
      if (exportBtn) exportBtn.disabled = true;
      if (batchSelect) batchSelect.disabled = true;
      
      // Mulai proses
      const queryParams = new URLSearchParams('<?=qs_without_page()?>');
      queryParams.set('batch', currentBatch);
      
      fetch('?action=prepare_export&' + queryParams.toString())
        .then(r => r.json())
        .then(data => {
          if (data.status === 'started') {
            document.getElementById('exportTotal').textContent = data.total;
            document.getElementById('batchInfo').textContent = `Batch ${currentBatch + 1} dari ${data.totalBatches || 1}`;
            
            // Mulai download gambar
            const downloadParams = new URLSearchParams('<?=qs_without_page()?>');
            downloadParams.set('batch', currentBatch);
            
            fetch('?action=download_images&' + downloadParams.toString())
              .then(r => r.json())
              .then(result => {
                // Mulai polling progress
                checkProgress();
              })
              .catch(err => {
                console.error('Error:', err);
                document.getElementById('exportStatus').textContent = 'Error: ' + err.message;
              });
          } else if (data.status === 'error') {
            document.getElementById('exportStatus').textContent = 'Error: ' + (data.error || 'Unknown error');
          }
        })
        .catch(err => {
          console.error('Error:', err);
          document.getElementById('exportStatus').textContent = 'Error: ' + err.message;
        });
    }
    
    function checkProgress() {
      exportInterval = setInterval(() => {
        const queryParams = new URLSearchParams();
        queryParams.set('batch', currentBatch);
        
        fetch('?action=check_progress&' + queryParams.toString())
          .then(r => r.json())
          .then(progress => {
            const current = progress.current || 0;
            const total = progress.total || 0;
            const percentage = progress.percentage || 0;
            const downloaded = progress.downloaded || 0;
            const failed = progress.failed || 0;
            const skipped = progress.skipped || 0;
            
            document.getElementById('exportProgress').textContent = current;
            document.getElementById('exportTotal').textContent = total;
            document.getElementById('progressBar').style.width = percentage + '%';
            
            let status = `Mengunduh gambar: ${current}/${total}`;
            if (downloaded > 0) status += ` (${downloaded} berhasil`;
            if (skipped > 0) status += `, ${skipped} sudah ada`;
            if (failed > 0) status += `, ${failed} gagal`;
            if (downloaded > 0 || skipped > 0 || failed > 0) status += ')';
            
            document.getElementById('exportStatus').textContent = status;
            
            // Jika selesai
            if (current >= total && total > 0) {
              clearInterval(exportInterval);
              document.getElementById('exportStatus').textContent = 'Selesai! Mengunduh file JSON...';
              // Download file JSON
              setTimeout(() => {
                const downloadParams = new URLSearchParams();
                downloadParams.set('batch', currentBatch);
                window.location.href = '?action=get_export_file&' + downloadParams.toString();
                document.getElementById('exportModal').classList.add('hidden');
                const exportBtn = document.querySelector('button[onclick="startExport()"]');
                const batchSelect = document.getElementById('batchSelect');
                if (exportBtn) exportBtn.disabled = false;
                if (batchSelect) batchSelect.disabled = false;
              }, 500);
            }
          })
          .catch(err => {
            console.error('Error checking progress:', err);
          });
      }, 500); // Check setiap 500ms
    }
    
    function closeExportModal() {
      if (exportInterval) {
        clearInterval(exportInterval);
        exportInterval = null;
      }
      document.getElementById('exportModal').classList.add('hidden');
      const exportBtn = document.querySelector('button[onclick="startExport()"]');
      const batchSelect = document.getElementById('batchSelect');
      if (exportBtn) exportBtn.disabled = false;
      if (batchSelect) batchSelect.disabled = false;
    }
  </script>

  <!-- Export Progress Modal -->
  <div id="exportModal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-card border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">Export Progress</h3>
        <button onclick="closeExportModal()" class="text-soft hover:text-white">✕</button>
      </div>
      
      <div class="mb-4">
        <div class="flex items-center justify-between text-xs mb-2">
          <span id="batchInfo" class="text-primary font-semibold">Batch 1</span>
        </div>
        <div class="flex items-center justify-between text-sm mb-2">
          <span id="exportStatus" class="text-soft">Mempersiapkan...</span>
          <span class="text-soft">
            <span id="exportProgress">0</span> / <span id="exportTotal">0</span>
          </span>
        </div>
        <div class="w-full bg-black/30 rounded-full h-3 overflow-hidden">
          <div id="progressBar" class="bg-primary h-full rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
      </div>
      
      <p class="text-xs text-soft">
        Sedang mengunduh gambar ke folder lokal. Harap tunggu...
      </p>
    </div>
  </div>
</body>
</html>
