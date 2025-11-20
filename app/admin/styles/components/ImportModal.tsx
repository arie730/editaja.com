"use client";

import { useState, useRef } from "react";
import { StyleFormData, Style } from "@/lib/styles";
import { createStyle } from "@/lib/styles";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  existingStyles?: Style[];
}

interface ImportStyleData {
  prompt: string;
  imageUrl: string;
  status?: "Active" | "Inactive";
  category?: string;
  tags?: string[];
}

export default function ImportModal({
  isOpen,
  onClose,
  onImportComplete,
  existingStyles = [],
}: ImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [preview, setPreview] = useState<ImportStyleData[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCounterRef = useRef(0);

  // Generate unique style code
  const generateStyleCode = (): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const counter = importCounterRef.current++;
    return `STYLE-${timestamp}-${counter}-${randomStr}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");
    setPreview([]);

    // Validate file type
    if (!file.name.endsWith(".json")) {
      setError("Please select a JSON file");
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate JSON structure
      if (!Array.isArray(data)) {
        setError("JSON file must contain an array of styles");
        return;
      }

      if (data.length === 0) {
        setError("JSON file is empty");
        return;
      }

      // Get existing prompts (normalized to lowercase for comparison)
      const existingPrompts = new Set(
        existingStyles.map((style) => style.prompt.trim().toLowerCase())
      );

      // Validate each style object and filter duplicates
      const validatedData: ImportStyleData[] = [];
      let duplicateCount = 0;
      
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item.prompt || typeof item.prompt !== "string") {
          setError(`Style at index ${i + 1}: "prompt" is required and must be a string`);
          return;
        }
        if (!item.imageUrl || typeof item.imageUrl !== "string") {
          setError(`Style at index ${i + 1}: "imageUrl" is required and must be a string`);
          return;
        }

        const normalizedPrompt = item.prompt.trim().toLowerCase();
        
        // Check if prompt already exists
        if (existingPrompts.has(normalizedPrompt)) {
          duplicateCount++;
          continue; // Skip duplicate
        }

        validatedData.push({
          prompt: item.prompt.trim(),
          imageUrl: item.imageUrl.trim(),
          status: item.status === "Inactive" ? "Inactive" : "Active",
          category: item.category && typeof item.category === "string" ? item.category.trim() : "",
          tags: Array.isArray(item.tags) ? item.tags.filter((t: any) => typeof t === "string").map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
        });
        
        // Add to existing prompts set to prevent duplicates within the same import
        existingPrompts.add(normalizedPrompt);
      }

      setPreview(validatedData);
      setDuplicateCount(duplicateCount);
      
      if (validatedData.length === 0) {
        setError(`All ${data.length} style(s) have duplicate prompts and will be skipped.`);
      } else {
        const message = duplicateCount > 0
          ? `Found ${validatedData.length} unique style(s) ready to import. ${duplicateCount} duplicate(s) will be skipped.`
          : `Found ${validatedData.length} valid style(s) ready to import`;
        setSuccess(message);
      }
    } catch (error: any) {
      console.error("Error parsing JSON:", error);
      if (error instanceof SyntaxError) {
        setError("Invalid JSON format. Please check your file.");
      } else {
        setError(error.message || "Failed to parse JSON file");
      }
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) {
      setError("No styles to import");
      return;
    }

    setImporting(true);
    setError("");
    setSuccess("");
    importCounterRef.current = 0; // Reset counter for new import

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < preview.length; i++) {
        setProgress({ current: i + 1, total: preview.length });

        try {
          const styleData: StyleFormData = {
            name: generateStyleCode(),
            prompt: preview[i].prompt,
            imageUrl: preview[i].imageUrl,
            status: preview[i].status || "Active",
            category: preview[i].category || "",
            tags: preview[i].tags || [],
          };

          await createStyle(styleData);
          successCount++;
        } catch (error: any) {
          console.error(`Error importing style ${i + 1}:`, error);
          failCount++;
          errors.push(`Style ${i + 1}: ${error.message || "Failed to import"}`);
        }
      }

      if (successCount > 0) {
        setSuccess(`Successfully imported ${successCount} style(s)${failCount > 0 ? `. ${failCount} failed.` : ""}`);
        if (failCount === 0) {
          setTimeout(() => {
            onImportComplete();
            handleClose();
          }, 1500);
        }
      }

      if (failCount > 0 && errors.length > 0) {
        setError(`Failed to import ${failCount} style(s):\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ""}`);
      }
    } catch (error: any) {
      console.error("Error during import:", error);
      setError(error.message || "Failed to import styles");
    } finally {
      setImporting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleClose = () => {
    if (!importing) {
      setError("");
      setSuccess("");
      setPreview([]);
      setDuplicateCount(0);
      setProgress({ current: 0, total: 0 });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-[#242424] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Import Styles from JSON</h2>
          <button
            onClick={handleClose}
            className="text-white/70 hover:text-white transition-colors"
            disabled={importing}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-500/20 border border-green-500/50 p-3 text-sm text-green-400">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* File Upload */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-[#EAEAEA]">
              Select JSON File
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                disabled={importing}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-12 rounded-lg border-2 border-dashed border-white/20 bg-[#1A1A1A] text-white hover:border-primary hover:bg-[#1A1A1A]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={importing}
              >
                <span className="material-symbols-outlined">upload_file</span>
                <span>Choose JSON File</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-white/50">
              JSON file should contain an array of style objects with: prompt, imageUrl, status (optional), category (optional), tags (optional)
            </p>
          </div>

          {/* JSON Format Example */}
          <div className="rounded-lg bg-[#1A1A1A] p-4 border border-white/10">
            <p className="text-sm font-medium text-white/70 mb-2">Expected JSON Format:</p>
            <pre className="text-xs text-white/50 overflow-x-auto">
{`[
  {
    "prompt": "A beautiful landscape...",
    "imageUrl": "https://example.com/image.jpg",
    "status": "Active",
    "category": "Nature",
    "tags": ["nature", "landscape"]
  },
  {
    "prompt": "Modern cityscape...",
    "imageUrl": "https://example.com/image2.jpg",
    "status": "Active",
    "category": "Urban",
    "tags": ["urban", "city"]
  }
]`}
            </pre>
          </div>

          {/* Duplicate Warning */}
          {duplicateCount > 0 && (
            <div className="rounded-lg bg-yellow-500/20 border border-yellow-500/50 p-3 text-sm text-yellow-400">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">warning</span>
                <span>{duplicateCount} style(s) with duplicate prompts will be skipped</span>
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="rounded-lg bg-[#1A1A1A] p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-white">
                  Preview ({preview.length} unique style(s) to import)
                </p>
                {importing && (
                  <div className="text-xs text-white/50">
                    {progress.current} / {progress.total}
                  </div>
                )}
              </div>
              {importing && (
                <div className="mb-3">
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {preview.slice(0, 10).map((style, index) => (
                  <div
                    key={index}
                    className="p-3 rounded bg-white/5 border border-white/5"
                  >
                    <p className="text-xs text-white/70 mb-1">
                      <span className="font-medium">#{index + 1}</span> - {style.prompt.substring(0, 50)}
                      {style.prompt.length > 50 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {style.category && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                          {style.category}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        style.status === "Active"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {style.status || "Active"}
                      </span>
                      {style.tags && style.tags.length > 0 && (
                        <span className="text-xs text-white/50">
                          {style.tags.length} tag(s)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {preview.length > 10 && (
                  <p className="text-xs text-white/50 text-center pt-2">
                    ... and {preview.length - 10} more style(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-12 rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={importing}
            >
              {preview.length > 0 && !importing ? "Cancel" : "Close"}
            </button>
            {preview.length > 0 && (
              <button
                type="button"
                onClick={handleImport}
                className="flex-1 h-12 rounded-lg bg-primary px-4 py-2 text-base font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={importing}
              >
                {importing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">file_upload</span>
                    <span>Import {preview.length} Style(s)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

