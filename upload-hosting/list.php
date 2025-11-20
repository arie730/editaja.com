<?php
$API_TOKEN = "arie";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Authorization");

$headers = getallheaders();
if (!isset($headers["Authorization"]) || $headers["Authorization"] !== $API_TOKEN) {
    echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    exit;
}

// ==== GET USER ID ====
// Ambil user_id dari GET atau POST, sanitize untuk keamanan
$user_id = isset($_GET["user_id"]) ? trim($_GET["user_id"]) : (isset($_POST["user_id"]) ? trim($_POST["user_id"]) : null);
if ($user_id) {
    // Sanitize: hanya alphanumeric, underscore, dan dash
    $user_id = preg_replace("/[^a-zA-Z0-9_-]/", "", $user_id);
}

// ==== GET IMAGES ====
$all_images = [];

if ($user_id && !empty($user_id)) {
    // Jika ada user_id, ambil dari file JSON user tersebut
    $db_file = "uploads/images_" . $user_id . ".json";
    if (file_exists($db_file)) {
        $user_db = json_decode(file_get_contents($db_file), true);
        if (is_array($user_db)) {
            $all_images = $user_db;
        }
    }
} else {
    // Jika tidak ada user_id, ambil dari semua file JSON (untuk admin/backward compatibility)
    // Scan semua file images_*.json
    $upload_dir = "uploads/";
    $files = glob($upload_dir . "images_*.json");
    
    foreach ($files as $file) {
        $file_data = json_decode(file_get_contents($file), true);
        if (is_array($file_data)) {
            $all_images = array_merge($all_images, $file_data);
        }
    }
    
    // Juga cek file images.json lama (backward compatibility)
    $old_db_file = "uploads/images.json";
    if (file_exists($old_db_file)) {
        $old_db = json_decode(file_get_contents($old_db_file), true);
        if (is_array($old_db)) {
            $all_images = array_merge($all_images, $old_db);
        }
    }
}

// Sort by created_at descending (newest first)
usort($all_images, function($a, $b) {
    $dateA = isset($a["created_at"]) ? strtotime($a["created_at"]) : 0;
    $dateB = isset($b["created_at"]) ? strtotime($b["created_at"]) : 0;
    return $dateB - $dateA;
});

echo json_encode([
    "status" => "success",
    "data" => $all_images,
    "user_id" => $user_id,
    "count" => count($all_images)
]);
