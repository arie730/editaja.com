"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { getGenerationsByUserId, Generation, deleteGenerationByUser } from "@/lib/generations";
import { getUserTokens } from "@/lib/tokens";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getSocialMediaSettings, SocialMediaSettings } from "@/lib/settings";

// Lazy load modal component
const TopupModal = dynamic(() => import("@/app/components/TopupModal"), {
  loading: () => null,
  ssr: false,
});

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userTokens, setUserTokens] = useState<number | null>(null);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; styleName: string; date: Date | any } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalImage, setShareModalImage] = useState<{ url: string; styleName: string } | null>(null);
  const [socialMediaSettings, setSocialMediaSettings] = useState<SocialMediaSettings>({
    facebook: true,
    twitter: true,
    whatsapp: true,
    telegram: true,
    linkedin: true,
    pinterest: true,
  });
  const [deletingGenerationId, setDeletingGenerationId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [generationToDelete, setGenerationToDelete] = useState<{ id: string; styleName: string } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    loadHistory();
    loadUserTokens();
    loadSocialMediaSettings();
  }, [user, router]);
  
  // Load social media settings
  const loadSocialMediaSettings = async () => {
    try {
      const settings = await getSocialMediaSettings();
      setSocialMediaSettings(settings);
    } catch (error) {
      console.error("Error loading social media settings:", error);
      // Keep default values
    }
  };

  // Load user tokens
  const loadUserTokens = async () => {
    if (user?.uid) {
      try {
        setTokensLoading(true);
        const tokens = await getUserTokens(user.uid);
        setUserTokens(tokens);
      } catch (error) {
        console.error("Error loading user tokens:", error);
        setUserTokens(null);
      } finally {
        setTokensLoading(false);
      }
    }
  };

  // Close user menu when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };

    const handleScroll = () => {
      if (userMenuOpen) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [userMenuOpen]);

  // Close modals with ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (imageModalOpen) {
          setImageModalOpen(false);
        }
        if (shareModalOpen) {
          setShareModalOpen(false);
        }
      }
    };

    if (imageModalOpen || shareModalOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [imageModalOpen, shareModalOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const loadHistory = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError("");
      const data = await getGenerationsByUserId(user.uid);
      setGenerations(data);
    } catch (error: any) {
      console.error("Error loading history:", error);
      setError("Failed to load generation history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | any) => {
    if (!date) return "N/A";
    try {
      let d: Date;
      if (date instanceof Date) {
        d = date;
      } else if (date && typeof date.toDate === "function") {
        d = date.toDate();
      } else if (date && date.seconds) {
        d = new Date(date.seconds * 1000);
      } else {
        d = new Date(date);
      }
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "N/A";
    }
  };

  const handleDownload = async (url: string, styleName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      // Format filename dengan editaja.com
      const sanitizedStyleName = styleName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `editaja.com_${sanitizedStyleName}_${timestamp}.jpg`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // Open share modal after successful download
      setShareModalImage({ url, styleName });
      setShareModalOpen(true);
    } catch (error) {
      console.error("Error downloading image:", error);
      setError("Failed to download image");
    }
  };

  const handleDeleteClick = (generationId: string, styleName: string) => {
    setGenerationToDelete({ id: generationId, styleName });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!generationToDelete || !user?.uid) {
      return;
    }

    try {
      setDeletingGenerationId(generationToDelete.id);
      setError("");
      await deleteGenerationByUser(generationToDelete.id, user.uid);
      
      // Reload history after successful deletion
      await loadHistory();
      
      // Close confirmation modal
      setDeleteConfirmOpen(false);
      setGenerationToDelete(null);
      
      // Show success message
      showToast("Generation deleted successfully");
    } catch (err: any) {
      console.error("Error deleting generation:", err);
      setError(err.message || "Failed to delete generation");
    } finally {
      setDeletingGenerationId(null);
    }
  };

  const handleImageClick = (url: string, styleName: string, date: Date | any) => {
    setSelectedImage({ url, styleName, date });
    setImageModalOpen(true);
  };

  const handleShareToSocial = (url: string, styleName: string, platform: string) => {
    // Check if platform is enabled
    if (platform !== "copy" && !socialMediaSettings[platform as keyof SocialMediaSettings]) {
      showToast(`${platform.charAt(0).toUpperCase() + platform.slice(1)} sharing is disabled`);
      return;
    }

    const encodedUrl = encodeURIComponent(url);
    // Use editaja.com in share message instead of freepik
    const text = encodeURIComponent(`Check out this amazing AI-generated image created with ${styleName} style on editaja.com! ${url}`);
    const title = encodeURIComponent(`AI Generated Image - ${styleName} style - editaja.com`);

    let shareUrl = "";
    switch (platform) {
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${text}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`;
        break;
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${text}`;
        break;
      case "telegram":
        shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${text}`;
        break;
      case "linkedin":
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case "pinterest":
        shareUrl = `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedUrl}&description=${text}`;
        break;
      case "copy":
        navigator.clipboard.writeText(url);
        showToast("Image URL copied to clipboard!");
        return;
      default:
        return;
    }

    window.open(shareUrl, "_blank", "width=600,height=400");
  };

  const showToast = (message: string) => {
    const toast = document.createElement("div");
    toast.className = "fixed top-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300";
    toast.style.opacity = "0";
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
      toast.style.opacity = "1";
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#101022]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#101022] flex items-center justify-between whitespace-nowrap border-b border-solid border-[#282839] px-6 py-3 sm:px-10 lg:px-20">
        <div className="flex items-center gap-4 text-white">
          <Link href="/" className="flex items-center gap-4">
            <div className="size-6 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.8261 17.4264C16.7203 18.1174 20.2244 18.5217 24 18.5217C27.7756 18.5217 31.2797 18.1174 34.1739 17.4264C36.9144 16.7722 39.9967 15.2331 41.3563 14.1648L24.8486 40.6391C24.4571 41.267 23.5429 41.267 23.1514 40.6391L6.64374 14.1648C8.00331 15.2331 11.0856 16.7722 13.8261 17.4264Z" fill="currentColor"></path>
                <path clipRule="evenodd" d="M39.998 12.236C39.9944 12.2537 39.9875 12.2845 39.9748 12.3294C39.9436 12.4399 39.8949 12.5741 39.8346 12.7175C39.8168 12.7597 39.7989 12.8007 39.7813 12.8398C38.5103 13.7113 35.9788 14.9393 33.7095 15.4811C30.9875 16.131 27.6413 16.5217 24 16.5217C20.3587 16.5217 17.0125 16.131 14.2905 15.4811C12.0012 14.9346 9.44505 13.6897 8.18538 12.8168C8.17384 12.7925 8.16216 12.767 8.15052 12.7408C8.09919 12.6249 8.05721 12.5114 8.02977 12.411C8.00356 12.3152 8.00039 12.2667 8.00004 12.2612C8.00004 12.261 8 12.2607 8.00004 12.2612C8.00004 12.2359 8.0104 11.9233 8.68485 11.3686C9.34546 10.8254 10.4222 10.2469 11.9291 9.72276C14.9242 8.68098 19.1919 8 24 8C28.8081 8 33.0758 8.68098 36.0709 9.72276C37.5778 10.2469 38.6545 10.8254 39.3151 11.3686C39.9006 11.8501 39.9857 12.1489 39.998 12.236ZM4.95178 15.2312L21.4543 41.6973C22.6288 43.5809 25.3712 43.5809 26.5457 41.6973L43.0534 15.223C43.0709 15.1948 43.0878 15.1662 43.104 15.1371L41.3563 14.1648C43.104 15.1371 43.1038 15.1374 43.104 15.1371L43.1051 15.135L43.1065 15.1325L43.1101 15.1261L43.1199 15.1082C43.1276 15.094 43.1377 15.0754 43.1497 15.0527C43.1738 15.0075 43.2062 14.9455 43.244 14.8701C43.319 14.7208 43.4196 14.511 43.5217 14.2683C43.6901 13.8679 44 13.0689 44 12.2609C44 10.5573 43.003 9.22254 41.8558 8.2791C40.6947 7.32427 39.1354 6.55361 37.385 5.94477C33.8654 4.72057 29.133 4 24 4C18.867 4 14.1346 4.72057 10.615 5.94478C8.86463 6.55361 7.30529 7.32428 6.14419 8.27911C4.99695 9.22255 3.99999 10.5573 3.99999 12.2609C3.99999 13.1275 4.29264 13.9078 4.49321 14.3607C4.60375 14.6102 4.71348 14.8196 4.79687 14.9689C4.83898 15.0444 4.87547 15.1065 4.9035 15.1529C4.91754 15.1762 4.92954 15.1957 4.93916 15.2111L4.94662 15.223L4.95178 15.2312ZM35.9868 18.996L24 38.22L12.0131 18.996C12.4661 19.1391 12.9179 19.2658 13.3617 19.3718C16.4281 20.1039 20.0901 20.5217 24 20.5217C27.9099 20.5217 31.5719 20.1039 34.6383 19.3718C35.082 19.2658 35.5339 19.1391 35.9868 18.996Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            </div>
            <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">edit Aja</h2>
          </Link>
        </div>
        <div className="hidden flex-1 justify-end gap-8 md:flex">
          <div className="flex items-center gap-9">
            {user && (
              <>
                <Link href="/user/favorites" className="text-white text-sm font-medium leading-normal hover:text-primary transition-colors">
                  Favorites
                </Link>
                <Link href="/user/history" className="text-white text-sm font-medium leading-normal hover:text-primary transition-colors">
                  History
                </Link>
              </>
            )}
          </div>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || user.email || "User"}
                    width={32}
                    height={32}
                    className="rounded-full border-2 border-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white/20">
                    <span className="text-white text-xs font-bold">
                      {user.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setTopupModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 hover:from-primary/30 hover:to-primary/20 transition-all cursor-pointer group"
                >
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  {tokensLoading ? (
                    <span className="text-white/50 text-sm">...</span>
                  ) : (
                    <span className="text-white text-sm font-bold group-hover:text-primary transition-colors">
                      {userTokens !== null ? userTokens.toLocaleString() : "—"}
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-red-500/20 text-red-400 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-red-500/30 transition-colors border border-red-500/50"
              >
                <span className="truncate">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/")}
              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors"
            >
              <span className="truncate">Login</span>
            </button>
          )}
        </div>
        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-3">
          {user ? (
            <>
              {/* Diamonds */}
              <button
                onClick={() => setTopupModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 hover:from-primary/30 hover:to-primary/20 transition-all"
              >
                <svg
                  className="w-4 h-4 text-primary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                {tokensLoading ? (
                  <span className="text-white/50 text-xs">...</span>
                ) : (
                  <span className="text-white text-xs font-bold">
                    {userTokens !== null ? userTokens.toLocaleString() : "—"}
                  </span>
                )}
              </button>
              
              {/* User Avatar with Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || user.email || "User"}
                      width={32}
                      height={32}
                      className="rounded-full border-2 border-white/20 cursor-pointer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white/20 cursor-pointer">
                      <span className="text-white text-xs font-bold">
                        {user.email?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                  <span className={`material-symbols-outlined text-white/70 text-lg transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                
                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-white/10 bg-[#242424] shadow-lg z-50 overflow-hidden">
                    <div className="py-1">
                      <Link
                        href="/user/favorites"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">favorite</span>
                        <span className="text-sm font-medium">Favorites</span>
                      </Link>
                      <Link
                        href="/user/history"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">history</span>
                        <span className="text-sm font-medium">History</span>
                      </Link>
                      <div className="border-t border-white/10 my-1"></div>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setTopupModalOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">diamond</span>
                        <span className="text-sm font-medium">Top Up Diamond</span>
                      </button>
                      <div className="border-t border-white/10 my-1"></div>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <main className="p-6 sm:p-10 lg:p-20">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-white text-3xl font-bold mb-6">My Generation History</h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading history...</p>
              </div>
            </div>
          ) : generations.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                history
              </span>
              <p className="text-white/70 text-lg mb-2">No generation history yet</p>
              <p className="text-white/50 text-sm mb-4">
                Start generating images to see them here
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Generate Image
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {generations.map((generation) =>
                generation.generatedImageUrls.map((url, index) => {
                  const imageKey = `${generation.id}-${index}`;
                  return (
                    <div
                      key={imageKey}
                      className="group relative aspect-square rounded-lg overflow-hidden border-2 border-white/10 hover:border-primary transition-all"
                    >
                      <div
                        onClick={() => handleImageClick(url, generation.styleName, generation.createdAt)}
                        className="w-full h-full cursor-pointer"
                      >
                        <Image
                          src={url}
                          alt={`Generated ${index + 1} - ${generation.styleName}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 150px, (max-width: 1024px) 200px, 250px"
                          quality={60}
                          loading="lazy"
                        />
                      </div>
                      {/* Delete button - only show on first image of each generation */}
                      {index === 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(generation.id, generation.styleName);
                          }}
                          disabled={deletingGenerationId === generation.id}
                          className="absolute top-2 right-2 p-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed z-10"
                          title="Delete generation"
                        >
                          {deletingGenerationId === generation.id ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <span className="material-symbols-outlined text-lg">delete</span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>
      <TopupModal
        isOpen={topupModalOpen}
        onClose={() => setTopupModalOpen(false)}
        currentDiamonds={userTokens || 0}
        onTopupSuccess={loadUserTokens}
      />

      {/* Image Modal */}
      {imageModalOpen && selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div
            className="relative max-w-7xl w-full h-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/70 hover:bg-black/80 text-white transition-colors backdrop-blur-sm"
              title="Close (ESC)"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>

            {/* Image Container */}
            <div className="relative w-full h-full flex-1 flex items-center justify-center p-4 sm:p-8">
              <div className="relative w-full h-full max-w-full max-h-full">
                <Image
                  src={selectedImage.url}
                  alt={selectedImage.styleName}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                  unoptimized
                  priority
                />
              </div>
            </div>

            {/* Download button */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedImage.url, selectedImage.styleName);
                  setImageModalOpen(false);
                }}
                className="px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                title="Download image"
              >
                <span className="material-symbols-outlined">download</span>
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal After Download */}
      {shareModalOpen && shareModalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="relative bg-[#242424] rounded-xl border border-white/10 p-6 max-w-md w-full shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShareModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              title="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-white text-2xl font-bold mb-2">Download Successful!</h2>
              <p className="text-white/70 text-sm">Share your image to social media</p>
            </div>

            {/* Preview Thumbnail */}
            {shareModalImage && shareModalImage.url && (
              <div className="mb-6 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                <img
                  src={shareModalImage.url}
                  alt="Preview"
                  className="w-full h-auto max-h-48 object-contain"
                />
              </div>
            )}

            {/* Share buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {socialMediaSettings.facebook && (
                <button
                  onClick={() => {
                    handleShareToSocial(shareModalImage.url, shareModalImage.styleName, "facebook");
                    setShareModalOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  <span className="text-white font-bold text-lg">f</span>
                  <span>Facebook</span>
                </button>
              )}
              {socialMediaSettings.twitter && (
                <button
                  onClick={() => {
                    handleShareToSocial(shareModalImage.url, shareModalImage.styleName, "twitter");
                    setShareModalOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-400 text-white font-medium hover:bg-blue-500 transition-colors"
                >
                  <span className="text-white font-bold text-lg">𝕏</span>
                  <span>Twitter</span>
                </button>
              )}
              {socialMediaSettings.whatsapp && (
                <button
                  onClick={() => {
                    handleShareToSocial(shareModalImage.url, shareModalImage.styleName, "whatsapp");
                    setShareModalOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
                >
                  <span className="text-white font-bold text-sm">WA</span>
                  <span>WhatsApp</span>
                </button>
              )}
              {socialMediaSettings.telegram && (
                <button
                  onClick={() => {
                    handleShareToSocial(shareModalImage.url, shareModalImage.styleName, "telegram");
                    setShareModalOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-400 text-white font-medium hover:bg-blue-500 transition-colors"
                >
                  <span className="text-white font-bold text-sm">TG</span>
                  <span>Telegram</span>
                </button>
              )}
              {socialMediaSettings.linkedin && (
                <button
                  onClick={() => {
                    handleShareToSocial(shareModalImage.url, shareModalImage.styleName, "linkedin");
                    setShareModalOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800 transition-colors"
                >
                  <span className="text-white font-bold text-sm">in</span>
                  <span>LinkedIn</span>
                </button>
              )}
              {socialMediaSettings.pinterest && (
                <button
                  onClick={() => {
                    handleShareToSocial(shareModalImage.url, shareModalImage.styleName, "pinterest");
                    setShareModalOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  <span className="text-white font-bold text-lg">P</span>
                  <span>Pinterest</span>
                </button>
              )}
            </div>

            {/* Close button at bottom */}
            <button
              onClick={() => setShareModalOpen(false)}
              className="w-full px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && generationToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            if (!deletingGenerationId) {
              setDeleteConfirmOpen(false);
              setGenerationToDelete(null);
            }
          }}
        >
          <div
            className="relative bg-[#242424] rounded-xl border border-white/10 p-6 max-w-md w-full shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                if (!deletingGenerationId) {
                  setDeleteConfirmOpen(false);
                  setGenerationToDelete(null);
                }
              }}
              disabled={deletingGenerationId !== null}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white transition-colors disabled:opacity-50"
              title="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-red-400 text-5xl">delete</span>
              </div>
              <h2 className="text-white text-2xl font-bold mb-2 text-center">Delete Generation?</h2>
              <p className="text-white/70 text-sm text-center">
                Are you sure you want to delete this generation? This action cannot be undone.
              </p>
              {generationToDelete.styleName && (
                <p className="text-white/50 text-xs text-center mt-2">
                  Style: <span className="font-medium">{generationToDelete.styleName}</span>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={deletingGenerationId !== null}
                className="w-full px-4 py-3 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingGenerationId ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">delete</span>
                    <span>Delete</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  if (!deletingGenerationId) {
                    setDeleteConfirmOpen(false);
                    setGenerationToDelete(null);
                  }
                }}
                disabled={deletingGenerationId !== null}
                className="w-full px-4 py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

