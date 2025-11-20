<?php
// file: freepik_ai_preview.php
// Jalankan di XAMPP: http://localhost/freepik_ai_preview.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

// Include database configuration to get API key
require_once __DIR__ . '/config/database.php';

const FREEPIK_ENDPOINT_CREATE = 'https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview';
const FREEPIK_ENDPOINT_STATUS = 'https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview/';

// Get API key from database
function getFreepikApiKeyForFile() {
    return getFreepikApiKey();
}

// Template dasar; placeholder {{SIZE}} akan diisi sesuai rasio
const TEMPLATE_PROMPT_BASE = <<<TXT
Create a vertical frame - size {{SIZE}} (4K quality) - divided into three equally sized horizontal images placed together.
The main character is based on the reference face, hairstyle, and body: a young figure with an expression of sadness and nostalgia, deep eyes radiating loneliness.
The outfit is a loose winter puffer set with wide-leg pants and a black scarf.
The overall atmosphere is covered in white snow, with a cold color palette that evokes melancholy and solitude.

Image 1 (portrait):
The character holds a transparent umbrella, turning their head slightly back while looking directly at the frame. The expression is sorrowful, with soulful eyes. The background is blurred with snowy whiteness.

Image 2 (full body):
The character, with the umbrella, stands alone in a vast snowy field, walking while gazing at the sky. The camera angle looks downward from above, as if the character is raising a hand to catch falling snowflakes. In the distance, a few bare, leafless trees stand. The scene conveys smallness and isolation against the vastness of nature.

Image 3 (close-up):
A zoomed-in shot of the character's eyes, with a distant, sorrowful gaze that evokes feelings of loneliness and yearning.
TXT;

function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function to_base64_from_upload($field){
  if (!isset($_FILES[$field]) || $_FILES[$field]['error'] !== UPLOAD_ERR_OK) return null;
  $bin = file_get_contents($_FILES[$field]['tmp_name']);
  return $bin ? base64_encode($bin) : null;
}

function http_json_post($url, $api_key, array $payload){
  $ch = curl_init();
  curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'x-freepik-api-key: ' . $api_key,
    ],
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
  ]);
  $resp = curl_exec($ch);
  $err  = curl_error($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return [$resp, $err, $code];
}

function http_json_get($url, $api_key){
  $ch = curl_init();
  curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
      'x-freepik-api-key: ' . $api_key,
    ],
  ]);
  $resp = curl_exec($ch);
  $err  = curl_error($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return [$resp, $err, $code];
}

function poll_freepik_result($task_id, $api_key, $max_wait_seconds = 90, $interval_seconds = 3){
  $deadline = time() + $max_wait_seconds;
  $last_json = null;
  while (time() < $deadline) {
    [$resp, $err, $code] = http_json_get(FREEPIK_ENDPOINT_STATUS . urlencode($task_id), $api_key);
    if ($err) return ['error' => "cURL GET error: $err"];
    $json = json_decode($resp, true);
    $last_json = $json;

    $status = $json['data']['status'] ?? null;
    if ($status === 'COMPLETED') {
      $urls = $json['data']['generated'] ?? [];
      return ['ok' => true, 'json' => $json, 'urls' => $urls];
    }
    if ($status === 'FAILED' || $status === 'CANCELLED') {
      return ['error' => "Task $status", 'json' => $json];
    }
    sleep($interval_seconds);
  }
  return ['error' => 'Timeout menunggu hasil', 'json' => $last_json];
}

function build_prompt(){
  $size = '2160x3840 pixels';
  $desc = 'vertical 9:16';
  $ratio_instruction =
    "Generate the image strictly in {$desc} aspect ratio, full {$size} resolution. ".
    "Do not crop, stretch, pad, or add borders. Keep the exact ratio across all three panels.\n\n";
  $base = str_replace('{{SIZE}}', $size, TEMPLATE_PROMPT_BASE);
  return $ratio_instruction . $base;
}

// ===== AJAX endpoint =====
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax'] ?? '') === '1') {
  header('Content-Type: application/json');
  
  $FREEPIK_API_KEY = getFreepikApiKeyForFile();
  if (!$FREEPIK_API_KEY || $FREEPIK_API_KEY === 'YOUR_FREEPIK_API_KEY') {
    echo json_encode(['ok'=>false,'error'=>'API key belum diisi. Silakan set API key di halaman admin/settings.php.']); exit;
  }

  $prompt = build_prompt();

  $reference_images = [];
  $b64_1 = to_base64_from_upload('ref_file_1');
  if ($b64_1) $reference_images[] = $b64_1;

  $payload = ['prompt' => $prompt];
  if (!empty($reference_images)) $payload['reference_images'] = $reference_images;

  [$resp, $err, $code] = http_json_post(FREEPIK_ENDPOINT_CREATE, $FREEPIK_API_KEY, $payload);
  if ($err) { echo json_encode(['ok'=>false,'error'=>"cURL POST error: $err"]); exit; }
  if ($code < 200 || $code >= 300) { echo json_encode(['ok'=>false,'error'=>"HTTP $code", 'raw'=>$resp]); exit; }

  $create_json = json_decode($resp, true);
  $task_id = $create_json['data']['task_id'] ?? null;
  if (!$task_id) { echo json_encode(['ok'=>false,'error'=>"Tidak ada task_id",'raw'=>$resp]); exit; }

  $poll = poll_freepik_result($task_id, $FREEPIK_API_KEY, 90, 3);
  if (!empty($poll['ok'])) {
    echo json_encode([
      'ok'=>true,
      'urls'=>$poll['urls'] ?? [],
      'status'=>$poll['json']['data']['status'] ?? 'COMPLETED',
    ]);
  } else {
    echo json_encode(['ok'=>false,'error'=>$poll['error'] ?? 'Gagal','raw'=>$poll['json'] ?? null]);
  }
  exit;
}
?>
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Freepik AI Image Preview — XAMPP</title>
  <link rel="icon" type="image/png" href="/fav.png">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root{--bg:#0b0d10;--card:#141820;--fg:#EAF0F6;--muted:#9FB0C0;--acc:#3CC4FF;--ok:#19c37d;--err:#ff5a5a;--bd:#222A35}
    *{box-sizing:border-box}
    body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;background:linear-gradient(180deg,#0b0d10,#0e1218);color:var(--fg)}
    .wrap{max-width:960px;margin:24px auto;padding:0 16px}
    .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:20px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
    h1{margin:0 0 8px;font-size:22px}
    label{display:block;font-weight:600;margin:14px 0 6px}
    input[type="file"]{width:100%;padding:12px;border-radius:10px;border:1px solid var(--bd);background:#0f1319;color:var(--fg)}
    .hint{color:var(--muted);font-size:13px}
    .btn{display:inline-block;padding:12px 16px;border-radius:10px;background:var(--acc);color:#03121A;font-weight:700;text-decoration:none;border:0;cursor:pointer}
    .btn:disabled{opacity:.6;cursor:not-allowed}
    .sp{height:12px}
    .grid-img{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
    img{max-width:100%;border-radius:12px;border:1px solid var(--bd)}
    .error{background:#2b1416;border:1px solid #4b1f23;color:#ffb4b4;padding:12px;border-radius:10px;white-space:pre-wrap}
    .ok{background:#102318;border:1px solid #1f3a2a;color:#c6f3da;padding:12px;border-radius:10px;white-space:pre-wrap}

    .overlay{position:fixed;inset:0;background:rgba(7,10,14,.6);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;z-index:50}
    .spinner{width:54px;height:54px;border-radius:50%;border:6px solid rgba(255,255,255,.18);border-top-color:#3CC4FF;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .skeleton{border-radius:12px;border:1px solid var(--bd);background:linear-gradient(90deg,#0f1319 25%,#151b24 37%,#0f1319 63%);background-size:400% 100%;animation:shimmer 1.4s ease-in-out infinite}
    @keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
    .skeleton-box{height:260px}
    .fade-in{animation:fade .35s ease-out}
    @keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Freepik AI Image Preview</h1>
      <p class="hint">
        Template prompt otomatis. Unggah 1 gambar referensi (opsional), lalu klik <b>Generate</b>. Rasio hasil sudah diatur ke <b>vertikal 9:16</b>.
      </p>

      <form id="genForm" enctype="multipart/form-data">
        <label for="ref_file_1">Upload Referensi (opsional)</label>
        <input type="file" id="ref_file_1" name="ref_file_1" accept="image/*" />
        <div class="sp"></div>
        <button class="btn" type="submit" id="btnGen">Generate</button>
      </form>
    </div>

    <div class="sp"></div>
    <div id="result"></div>
  </div>

  <div class="overlay" id="overlay">
    <div>
      <div class="spinner" style="margin:auto"></div>
      <div class="hint" style="text-align:center;margin-top:12px">Sedang memproses…</div>
    </div>
  </div>

  <script>
    const form = document.getElementById('genForm');
    const resultEl = document.getElementById('result');
    const overlay = document.getElementById('overlay');
    const btn = document.getElementById('btnGen');

    function showOverlay(){ overlay.style.display='flex'; }
    function hideOverlay(){ overlay.style.display='none'; }

    function showSkeleton(){
      const skeleton = `
        <div class="card fade-in">
          <h2 style="margin:0 0 10px">Menunggu Hasil…</h2>
          <div class="grid-img">
            <div class="skeleton skeleton-box"></div>
            <div class="skeleton skeleton-box"></div>
            <div class="skeleton skeleton-box"></div>
          </div>
        </div>`;
      resultEl.innerHTML = skeleton;
    }

    function renderError(msg, raw=null){
      const pre = raw ? `<pre class="error" style="margin-top:8px">${escapeHtml(JSON.stringify(raw,null,2))}</pre>` : '';
      resultEl.innerHTML = `
        <div class="card fade-in">
          <h2 style="margin:0 0 10px">Gagal</h2>
          <div class="error">${escapeHtml(msg)}</div>
          ${pre}
        </div>`;
    }

    function renderImages(urls){
      if (!urls || !urls.length){
        resultEl.innerHTML = `
          <div class="card fade-in">
            <h2 style="margin:0 0 10px">Selesai</h2>
            <div class="ok">Status COMPLETED, tetapi field <code>generated</code> kosong.</div>
          </div>`;
        return;
      }
      const items = urls.map(u=>`
        <div>
          <img src="${escapeAttr(u)}" alt="Generated image"/>
          <div class="hint" style="margin-top:6px;word-break:break-all">URL: ${escapeHtml(u)}</div>
        </div>`).join('');
      resultEl.innerHTML = `
        <div class="card fade-in">
          <h2 style="margin:0 0 10px">Hasil (9:16) 🎉</h2>
          <div class="grid-img">${items}</div>
        </div>`;
    }

    function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
    function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      btn.disabled = true;
      showOverlay();
      showSkeleton();

      try{
        const fd = new FormData(form);
        fd.append('ajax','1');

        const res = await fetch(location.href, { method:'POST', body: fd });
        const data = await res.json().catch(()=>({ok:false,error:'Respons bukan JSON'}));

        if(!data.ok){
          renderError(data.error || 'Gagal', data.raw ?? null);
        }else{
          renderImages(data.urls || []);
        }
      }catch(err){
        renderError(err?.message || 'Terjadi kesalahan tak terduga');
      }finally{
        hideOverlay();
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>
