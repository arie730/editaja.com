<?php
$API_TOKEN = "arie";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

$headers = getallheaders();
if (!isset($headers["Authorization"]) || $headers["Authorization"] !== $API_TOKEN) {
    echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);

if (!isset($input["id"])) {
    echo json_encode(["status" => "error", "message" => "Missing id"]);
    exit;
}

$id = $input["id"];

// ==== GET USER ID ====
// Ambil user_id dari input atau dari metadata gambar
$user_id = isset($input["user_id"]) ? trim($input["user_id"]) : null;
if ($user_id) {
    // Sanitize: hanya alphanumeric, underscore, dan dash
    $user_id = preg_replace("/[^a-zA-Z0-9_-]/", "", $user_id);
}

// ==== FIND AND DELETE IMAGE ====
$found = false;
$deleted_files = [];

if ($user_id && !empty($user_id)) {
    // Jika ada user_id, cari di file JSON user tersebut
    $db_file = "uploads/images_" . $user_id . ".json";
    if (file_exists($db_file)) {
        $db = json_decode(file_get_contents($db_file), true);
        if (is_array($db)) {
            $new_db = [];
            foreach ($db as $img) {
                if ($img["id"] === $id) {
                    $found = true;
                    // Delete files
                    if (isset($img["original"]) && file_exists($img["original"])) {
                        unlink($img["original"]);
                        $deleted_files[] = $img["original"];
                    }
                    if (isset($img["optimized"]) && file_exists($img["optimized"])) {
                        unlink($img["optimized"]);
                        $deleted_files[] = $img["optimized"];
                    }
                } else {
                    $new_db[] = $img;
                }
            }
            file_put_contents($db_file, json_encode($new_db, JSON_PRETTY_PRINT));
        }
    }
} else {
    // Jika tidak ada user_id, cari di semua file JSON
    $upload_dir = "uploads/";
    $files = glob($upload_dir . "images_*.json");
    
    // Juga cek file images.json lama
    $files[] = $upload_dir . "images.json";
    
    foreach ($files as $db_file) {
        if (!file_exists($db_file)) continue;
        
        $db = json_decode(file_get_contents($db_file), true);
        if (!is_array($db)) continue;
        
        $new_db = [];
        foreach ($db as $img) {
            if ($img["id"] === $id) {
                $found = true;
                // Delete files
                if (isset($img["original"]) && file_exists($img["original"])) {
                    unlink($img["original"]);
                    $deleted_files[] = $img["original"];
                }
                if (isset($img["optimized"]) && file_exists($img["optimized"])) {
                    unlink($img["optimized"]);
                    $deleted_files[] = $img["optimized"];
                }
            } else {
                $new_db[] = $img;
            }
        }
        file_put_contents($db_file, json_encode($new_db, JSON_PRETTY_PRINT));
        
        if ($found) break; // Stop setelah menemukan dan menghapus
    }
}

// If not found in metadata, try to delete by filename directly
if (!$found) {
    // Try to find and delete files by filename pattern
    // Filename format: editaja.com_img_YYYYMMDD_HHMMSS_uniqid.ext
    $base_filename = $id; // id is the filename
    
    // Try to find files in all possible locations
    $possible_paths = [];
    
    if ($user_id && !empty($user_id)) {
        // Try user-specific folders
        $possible_paths = [
            "uploads/original/" . $user_id . "/" . $base_filename,
            "uploads/generated/" . $user_id . "/" . $base_filename,
            "uploads/optimized/original/" . $user_id . "/" . str_replace(['.jpg', '.jpeg', '.png'], '.webp', $base_filename),
            "uploads/optimized/generated/" . $user_id . "/" . str_replace(['.jpg', '.jpeg', '.png'], '.webp', $base_filename),
        ];
    } else {
        // Try all user folders
        $upload_dir = "uploads/";
        $user_dirs = glob($upload_dir . "original/*", GLOB_ONLYDIR);
        foreach ($user_dirs as $user_dir) {
            $user_folder = basename($user_dir);
            $possible_paths[] = "uploads/original/" . $user_folder . "/" . $base_filename;
            $possible_paths[] = "uploads/generated/" . $user_folder . "/" . $base_filename;
            $possible_paths[] = "uploads/optimized/original/" . $user_folder . "/" . str_replace(['.jpg', '.jpeg', '.png'], '.webp', $base_filename);
            $possible_paths[] = "uploads/optimized/generated/" . $user_folder . "/" . str_replace(['.jpg', '.jpeg', '.png'], '.webp', $base_filename);
        }
    }
    
    // Try to delete files directly
    foreach ($possible_paths as $file_path) {
        if (file_exists($file_path)) {
            unlink($file_path);
            $deleted_files[] = $file_path;
            $found = true;
        }
    }
}

if (!$found) {
    echo json_encode(["status" => "error", "message" => "Image not found"]);
    exit;
}

echo json_encode([
    "status" => "success", 
    "deleted" => $id,
    "user_id" => $user_id,
    "files_deleted" => $deleted_files
]);
