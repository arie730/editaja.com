<?php
// ==== CONFIG ====
$API_TOKEN = "arie";
$WATERMARK_TEXT = "EDITAJA.COM"; // Teks watermark
$WATERMARK_FONT_SIZE = 12; // Ukuran font watermark
$WATERMARK_OPACITY = 80; // Opacity watermark (0-127, 0 = fully opaque, 127 = fully transparent)
$WATERMARK_POSITION = "bottom-right"; // Posisi: top-left, top-right, bottom-left, bottom-right, center

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") exit;

// ==== TOKEN CHECK ====
$headers = getallheaders();
if (!isset($headers["Authorization"]) || $headers["Authorization"] !== $API_TOKEN) {
    echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    exit;
}

// ==== VALIDASI FILE ====
if (!isset($_FILES["file"])) {
    echo json_encode(["status" => "error", "message" => "No file uploaded"]);
    exit;
}

$file = $_FILES["file"];
$ext = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));
$allowed = ['jpg','jpeg','png','webp'];

if (!in_array($ext, $allowed)) {
    echo json_encode(["status" => "error", "message" => "Invalid file type"]);
    exit;
}

// ==== GET USER ID ====
// Ambil user_id dari POST, sanitize untuk keamanan
$user_id = isset($_POST["user_id"]) ? trim($_POST["user_id"]) : "default";
// Sanitize: hanya alphanumeric, underscore, dan dash
$user_id = preg_replace("/[^a-zA-Z0-9_-]/", "", $user_id);
// Jika kosong setelah sanitize, gunakan default
if (empty($user_id)) {
    $user_id = "default";
}

// ==== GET IMAGE TYPE ====
// Tentukan apakah ini upload user atau hasil generated
// "upload" = gambar yang di-upload user, "generated" = hasil generate AI
$image_type = isset($_POST["image_type"]) ? trim($_POST["image_type"]) : "upload";
if (!in_array($image_type, ["upload", "generated"])) {
    $image_type = "upload";
}

// ==== GET WATERMARK SETTING ====
// Baca setting watermark dari POST (default: true untuk backward compatibility)
$watermark_enabled = true; // Default enabled
if (isset($_POST["watermark_enabled"])) {
    $watermark_enabled = filter_var($_POST["watermark_enabled"], FILTER_VALIDATE_BOOLEAN);
}

// ==== PATH FOLDER BERDASARKAN USER ID DAN TYPE ====
// Pisahkan folder: upload user vs hasil generated
$base_folder = ($image_type === "generated") ? "generated" : "original";
$orig_dir = "uploads/" . $base_folder . "/" . $user_id . "/";
$opt_dir  = "uploads/optimized/" . $base_folder . "/" . $user_id . "/";

// Buat folder jika belum ada
if (!is_dir($orig_dir)) mkdir($orig_dir, 0777, true);
if (!is_dir($opt_dir)) mkdir($opt_dir, 0777, true);

// ==== SAVE ORIGINAL ====
// Rename dengan format: editaja.com_img_YYYYMMDD_HHMMSS_uniqid.ext
$timestamp = date("Ymd_His");
$unique_id = uniqid();
$filename = "editaja.com_img_" . $timestamp . "_" . $unique_id . "." . $ext;
$orig_path = $orig_dir . $filename;
move_uploaded_file($file["tmp_name"], $orig_path);

// ==== LOAD ORIGINAL IMAGE ====
switch ($ext) {
    case 'jpg': case 'jpeg': $img_orig = imagecreatefromjpeg($orig_path); break;
    case 'png':  $img_orig = imagecreatefrompng($orig_path); break;
    case 'webp': $img_orig = imagecreatefromwebp($orig_path); break;
}

// Copy untuk processing
$img = $img_orig;

// ==== RESIZE (MAX WIDTH 1200px) ====
$MAX_WIDTH = 1200;
$w = imagesx($img);
$h = imagesy($img);

if ($w > $MAX_WIDTH) {
    $new_h = intval(($MAX_WIDTH / $w) * $h);
    $resized = imagecreatetruecolor($MAX_WIDTH, $new_h);
    imagealphablending($resized, false);
    imagesavealpha($resized, true);
    imagecopyresampled($resized, $img, 0, 0, 0, 0, $MAX_WIDTH, $new_h, $w, $h);
    $img = $resized;
    $w = $MAX_WIDTH;
    $h = $new_h;
}

// ==== ADD WATERMARK FUNCTION ====
function addWatermark($image, $text, $fontSize, $opacity, $position) {
    $width = imagesx($image);
    $height = imagesy($image);
    
    // Use built-in font (1-5, 5 is largest)
    $font = 5;
    
    // Calculate text position
    $textWidth = imagefontwidth($font) * strlen($text);
    $textHeight = imagefontheight($font);
    
    $x = 0;
    $y = 0;
    $padding = 10;
    
    switch ($position) {
        case "top-left":
            $x = $padding;
            $y = $padding;
            break;
        case "top-right":
            $x = $width - $textWidth - $padding;
            $y = $padding;
            break;
        case "bottom-left":
            $x = $padding;
            $y = $height - $textHeight - $padding;
            break;
        case "bottom-right":
            $x = $width - $textWidth - $padding;
            $y = $height - $textHeight - $padding;
            break;
        case "center":
            $x = ($width - $textWidth) / 2;
            $y = ($height - $textHeight) / 2;
            break;
        default:
            $x = $width - $textWidth - $padding;
            $y = $height - $textHeight - $padding;
    }
    
    // Create semi-transparent white color (0-127, lower = more opaque)
    $color = imagecolorallocatealpha($image, 255, 255, 255, $opacity);
    
    // Add text watermark
    imagestring($image, $font, $x, $y, $text, $color);
    
    return $image;
}

// ==== ADD WATERMARK TO ORIGINAL ====
// Tambahkan watermark hanya jika watermark_enabled = true
if ($watermark_enabled) {
    $img_orig = addWatermark($img_orig, $WATERMARK_TEXT, $WATERMARK_FONT_SIZE, $WATERMARK_OPACITY, $WATERMARK_POSITION);
}

// Save original (with or without watermark)
switch ($ext) {
    case 'jpg': case 'jpeg':
        imagejpeg($img_orig, $orig_path, 90);
        break;
    case 'png':
        imagepng($img_orig, $orig_path, 9);
        break;
    case 'webp':
        imagewebp($img_orig, $orig_path, 90);
        break;
}
imagedestroy($img_orig);

// ==== ADD WATERMARK TO OPTIMIZED (after resize) ====
// Tambahkan watermark hanya jika watermark_enabled = true
if ($watermark_enabled) {
    $img = addWatermark($img, $WATERMARK_TEXT, $WATERMARK_FONT_SIZE, $WATERMARK_OPACITY, $WATERMARK_POSITION);
}

// ==== SAVE OPTIMIZED (WEBP) ====
$opt_filename = str_replace(".".$ext, ".webp", $filename);
$opt_path = $opt_dir . $opt_filename;
imagewebp($img, $opt_path, 80);

// ==== SIMPAN METADATA KE JSON ====
$meta = [
    "id" => $filename,
    "user_id" => $user_id,
    "image_type" => $image_type, // "upload" or "generated"
    "original" => $orig_path,
    "optimized" => $opt_path,
    "created_at" => date("Y-m-d H:i:s")
];

// Simpan metadata per user (opsional, bisa juga satu file untuk semua)
$db_file = "uploads/images_" . $user_id . ".json";
$db = [];

if (file_exists($db_file)) {
    $db = json_decode(file_get_contents($db_file), true);
    if (!is_array($db)) {
        $db = [];
    }
}

$db[] = $meta;
file_put_contents($db_file, json_encode($db, JSON_PRETTY_PRINT));

echo json_encode([
    "status" => "success",
    "file_id" => $filename,
    "user_id" => $user_id,
    "original_url"  => "https://" . $_SERVER['HTTP_HOST'] . "/" . $orig_path,
    "optimized_url" => "https://" . $_SERVER['HTTP_HOST'] . "/" . $opt_path
]);
?>
