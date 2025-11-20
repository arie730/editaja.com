"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import {
  getGenerations,
  getStyleNamesFromGenerations,
  deleteGeneration,
  Generation,
} from "@/lib/generations";

export default function AdminGalleryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [filteredGenerations, setFilteredGenerations] = useState<Generation[]>([]);
  const [styleNames, setStyleNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Load generations from Firestore
  useEffect(() => {
    const loadGenerations = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allGenerations, styles] = await Promise.all([
          getGenerations(),
          getStyleNamesFromGenerations(),
        ]);
        setGenerations(allGenerations);
        setStyleNames(styles);

        // Check if userId is in URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const userIdFromUrl = urlParams.get("userId");
        if (userIdFromUrl) {
          setSearchQuery(userIdFromUrl);
        }
      } catch (err: any) {
        console.error("Error loading generations:", err);
        setError(err.message || "Failed to load generations");
      } finally {
        setLoading(false);
      }
    };

    loadGenerations();
  }, []);

  // Filter generations based on search query and selected style
  useEffect(() => {
    let filtered = generations;

    // Filter by search query (userId)
    if (searchQuery.trim()) {
      filtered = filtered.filter((gen) =>
        gen.userId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by style
    if (selectedStyle) {
      filtered = filtered.filter((gen) => gen.styleName === selectedStyle);
    }

    setFilteredGenerations(filtered);
  }, [generations, searchQuery, selectedStyle]);

  // Format date
  const formatDate = (date: Date | any) => {
    if (!date) return "N/A";
    try {
      // Handle Firestore Timestamp
      if (date && typeof date.toDate === "function") {
        const d = date.toDate();
        return d.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      // Handle regular Date
      if (date instanceof Date) {
        return date.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return "Invalid date";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  // Handle delete generation
  const handleDelete = async (generationId: string) => {
    try {
      setDeletingId(generationId);
      setError(null);
      setSuccess(null);
      await deleteGeneration(generationId);
      
      // Remove from state
      setGenerations((prev) => prev.filter((gen) => gen.id !== generationId));
      setFilteredGenerations((prev) => prev.filter((gen) => gen.id !== generationId));
      setDeleteConfirm(null);
      setSuccess("Generation deleted successfully");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error deleting generation:", err);
      setError(err.message || "Failed to delete generation");
      setDeleteConfirm(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="Image Gallery" onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="flex-1 p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
            <h3 className="text-2xl font-bold text-white">User Generations</h3>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-auto">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                  search
                </span>
                <input
                  className="w-full md:w-64 rounded-lg border border-white/10 bg-[#242424]/40 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                  placeholder="Search by User ID..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Update URL without reload
                    const url = new URL(window.location.href);
                    if (e.target.value.trim()) {
                      url.searchParams.set("userId", e.target.value);
                    } else {
                      url.searchParams.delete("userId");
                    }
                    window.history.pushState({}, "", url);
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      const url = new URL(window.location.href);
                      url.searchParams.delete("userId");
                      window.history.pushState({}, "", url);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  className="appearance-none rounded-lg border border-white/10 bg-[#242424]/40 py-2 pl-4 pr-10 text-sm text-white/70 hover:bg-white/5 focus:border-primary focus:ring-primary"
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                >
                  <option value="">All Styles</option>
                  {styleNames.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 rounded-xl border border-green-500/50 bg-green-500/20 p-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/20 p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading generations...</p>
              </div>
            </div>
          ) : filteredGenerations.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                image
              </span>
              <p className="text-white/70 text-lg mb-2">No generations found</p>
              <p className="text-white/50 text-sm">
                {generations.length === 0
                  ? "No generations have been created yet."
                  : "Try adjusting your search or filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {filteredGenerations
                .filter((item) => item.generatedImageUrls.length > 0)
                .map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-white/10 hover:border-primary/50 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedGeneration(item);
                      setDetailModalOpen(true);
                    }}
                  >
                    <Image
                      src={
                        item.generatedImageUrls[0].startsWith("http")
                          ? item.generatedImageUrls[0]
                          : item.generatedImageUrls[0].startsWith("/")
                          ? item.generatedImageUrls[0]
                          : `/${item.generatedImageUrls[0]}`
                      }
                      alt="Generated Image"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 150px, (max-width: 1024px) 200px, 250px"
                      quality={60}
                      loading="lazy"
                      onError={(e) => {
                        console.error("Error loading generated image:", item.generatedImageUrls[0]);
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(item.id);
                      }}
                      disabled={deletingId === item.id}
                      className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                      title="Delete generation"
                    >
                      {deletingId === item.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <span className="material-symbols-outlined text-lg">delete</span>
                      )}
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="rounded-lg border border-white/10 bg-[#242424] p-6 max-w-md w-full">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Delete Generation?
                </h3>
                <p className="mb-4 text-sm text-white/70">
                  Are you sure you want to delete this generation? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleDelete(deleteConfirm);
                    }}
                    disabled={deletingId === deleteConfirm}
                    className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingId === deleteConfirm ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deletingId === deleteConfirm}
                    className="flex-1 rounded-lg border border-white/10 bg-[#242424]/40 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detail Modal */}
          {detailModalOpen && selectedGeneration && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => {
                setDetailModalOpen(false);
                setSelectedGeneration(null);
              }}
            >
              <div
                className="relative w-full max-w-6xl max-h-[90vh] bg-[#242424] rounded-xl border border-white/10 overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header - Fixed */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 flex-shrink-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Generation Details</h2>
                  <div className="flex items-center gap-2">
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailModalOpen(false);
                        setSelectedGeneration(null);
                        setDeleteConfirm(selectedGeneration.id);
                      }}
                      disabled={deletingId === selectedGeneration.id}
                      className="p-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete generation"
                    >
                      {deletingId === selectedGeneration.id ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <span className="material-symbols-outlined">delete</span>
                      )}
                    </button>
                    {/* Close Button */}
                    <button
                      onClick={() => {
                        setDetailModalOpen(false);
                        setSelectedGeneration(null);
                      }}
                      className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {/* Info Section - Compact */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-[#1A1A1A] border border-white/10">
                    <div>
                      <p className="text-xs sm:text-sm text-white/50 mb-1">User</p>
                      <p className="text-sm sm:text-base text-white font-medium truncate">{selectedGeneration.userId || "anonymous"}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-white/50 mb-1">Style</p>
                      <p className="text-sm sm:text-base text-white font-medium truncate">{selectedGeneration.styleName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-white/50 mb-1">Date</p>
                      <p className="text-sm sm:text-base text-white font-medium">{formatDate(selectedGeneration.createdAt)}</p>
                    </div>
                  </div>

                  {/* Images Section - Side by side on desktop, stacked on mobile */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Original Image */}
                    {selectedGeneration.originalImageUrl && selectedGeneration.originalImageUrl.trim() !== "" ? (
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">Original Image</h3>
                        <div className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                          <Image
                            alt="Original Image"
                            src={
                              selectedGeneration.originalImageUrl.startsWith("http")
                                ? selectedGeneration.originalImageUrl
                                : selectedGeneration.originalImageUrl.startsWith("/")
                                ? selectedGeneration.originalImageUrl
                                : `/${selectedGeneration.originalImageUrl}`
                            }
                            fill
                            className="object-cover"
                            unoptimized
                            onError={(e) => {
                              console.error("Error loading original image:", selectedGeneration.originalImageUrl);
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              // Show error message
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="flex flex-col items-center justify-center h-full p-4 text-center">
                                    <span class="material-symbols-outlined text-white/30 text-4xl mb-2">broken_image</span>
                                    <p class="text-white/50 text-sm">Failed to load original image</p>
                                    <p class="text-white/30 text-xs mt-1 break-all">${selectedGeneration.originalImageUrl}</p>
                                  </div>
                                `;
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">Original Image</h3>
                        <div className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-[#1A1A1A] flex items-center justify-center">
                          <div className="text-center text-white/30 p-4">
                            <span className="material-symbols-outlined text-4xl mb-2 block">image_not_supported</span>
                            <p className="text-sm">Original image not available</p>
                            <p className="text-xs mt-1 text-white/20">Image may not have been uploaded or saved</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Generated Images */}
                    {selectedGeneration.generatedImageUrls.length > 0 && (
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">
                          Generated ({selectedGeneration.generatedImageUrls.length})
                        </h3>
                        <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[60vh] overflow-y-auto">
                          {selectedGeneration.generatedImageUrls.map((url, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-[9/16] rounded-lg overflow-hidden border border-white/10"
                            >
                              <Image
                                alt={`Generated ${idx + 1}`}
                                src={
                                  url.startsWith("http") ? url : url.startsWith("/") ? url : `/${url}`
                                }
                                fill
                                className="object-cover"
                                unoptimized
                                onError={(e) => {
                                  console.error("Error loading generated image:", url);
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {filteredGenerations.length > 0 && (
            <div className="mt-8 text-center text-sm text-white/50">
              Showing {filteredGenerations.length} of {generations.length} generation(s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
