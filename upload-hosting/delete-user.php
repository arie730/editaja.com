<?php
$API_TOKEN = "arie";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") exit(0);

$headers = getallheaders();
if (!isset($headers["Authorization"]) || $headers["Authorization"] !== $API_TOKEN) {
    echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);

if (!isset($input["user_id"])) {
    echo json_encode(["status" => "error", "message" => "Missing user_id"]);
    exit;
}

$user_id = trim($input["user_id"]);
// Sanitize: hanya alphanumeric, underscore, dan dash
$user_id = preg_replace("/[^a-zA-Z0-9_-]/", "", $user_id);

if (empty($user_id)) {
    echo json_encode(["status" => "error", "message" => "Invalid user_id"]);
    exit;
}

// ==== DELETE USER FOLDERS ====
$deleted_folders = [];
$deleted_files = [];

// Folders to delete
$folders_to_delete = [
    "uploads/original/" . $user_id,
    "uploads/generated/" . $user_id,
    "uploads/optimized/original/" . $user_id,
    "uploads/optimized/generated/" . $user_id,
];

// Function to delete directory recursively
function deleteDirectory($dir) {
    if (!is_dir($dir)) {
        return false;
    }
    
    $files = array_diff(scandir($dir), array('.', '..'));
    foreach ($files as $file) {
        $file_path = $dir . '/' . $file;
        if (is_dir($file_path)) {
            deleteDirectory($file_path);
        } else {
            unlink($file_path);
        }
    }
    return rmdir($dir);
}

// Delete each folder
foreach ($folders_to_delete as $folder) {
    if (is_dir($folder)) {
        if (deleteDirectory($folder)) {
            $deleted_folders[] = $folder;
        }
    }
}

// Delete user metadata JSON file
$db_file = "uploads/images_" . $user_id . ".json";
if (file_exists($db_file)) {
    unlink($db_file);
    $deleted_files[] = $db_file;
}

echo json_encode([
    "status" => "success",
    "user_id" => $user_id,
    "deleted_folders" => $deleted_folders,
    "deleted_files" => $deleted_files,
    "message" => "User folders and files deleted successfully"
]);

