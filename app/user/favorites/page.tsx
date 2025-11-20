"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { getUserFavorites, removeFavorite, Favorite } from "@/lib/favorites";
import { getUserTokens } from "@/lib/tokens";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Style } from "@/lib/styles";

// Lazy load modal components
const ImageGenerateModal = dynamic(() => import("@/app/components/ImageGenerateModal"), {
  loading: () => null,
  ssr: false,
});

const TopupModal = dynamic(() => import("@/app/components/TopupModal"), {
  loading: () => null,
  ssr: false,
});

export default function FavoritesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [userTokens, setUserTokens] = useState<number | null>(null);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [clickedFavoriteId, setClickedFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    loadFavorites();
    loadUserTokens();
  }, [user, router]);

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

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const loadFavorites = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError("");
      const data = await getUserFavorites(user.uid);
      setFavorites(data);
    } catch (error: any) {
      console.error("Error loading favorites:", error);
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (e: React.MouseEvent, styleId: string) => {
    e.stopPropagation();
    if (!user?.uid) return;

    // Trigger click animation
    setClickedFavoriteId(styleId);
    setTimeout(() => setClickedFavoriteId(null), 100);

    try {
      await removeFavorite(user.uid, styleId);
      await loadFavorites();
    } catch (error: any) {
      console.error("Error removing favorite:", error);
      setError("Failed to remove favorite");
    }
  };

  const handleStyleClick = (favorite: Favorite) => {
    setSelectedStyle(favorite.style);
    setModalOpen(true);
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
          <h1 className="text-white text-3xl font-bold mb-6">My Favorite Styles</h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading favorites...</p>
              </div>
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                favorite
              </span>
              <p className="text-white/70 text-lg mb-2">No favorite styles yet</p>
              <p className="text-white/50 text-sm mb-4">
                Start adding styles to your favorites to see them here
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Browse Styles
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {favorites.map((favorite) => (
                <div
                  key={favorite.id}
                  className="group relative aspect-square rounded-lg overflow-hidden border-2 border-white/10 hover:border-primary transition-all cursor-pointer"
                  onClick={() => handleStyleClick(favorite)}
                >
                  <Image
                    src={favorite.style.imageUrl}
                    alt={favorite.style.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                      {favorite.style.category && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <span className="inline-block px-2 py-0.5 rounded bg-primary/20 text-primary text-xs">
                          {favorite.style.category}
                        </span>
                    </div>
                  )}
                  <button
                    onClick={(e) => handleRemoveFavorite(e, favorite.styleId)}
                    className="absolute top-1.5 right-1.5 z-20 p-1 cursor-pointer"
                    title="Remove from favorites"
                  >
                    <span
                      className={`material-symbols-outlined text-lg drop-shadow-lg favorite-icon-filled ${
                        clickedFavoriteId === favorite.styleId ? "favorite-icon-click-pop" : ""
                      }`}
                    >
                      favorite
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ImageGenerateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        style={selectedStyle}
      />
      <TopupModal
        isOpen={topupModalOpen}
        onClose={() => setTopupModalOpen(false)}
        currentDiamonds={userTokens || 0}
        onTopupSuccess={loadUserTokens}
      />
    </div>
  );
}

