"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { getUserTokens } from "@/lib/tokens";
import { Style, getActiveStyles, getTrendingStyles } from "@/lib/styles";
import { addFavorite, removeFavorite, getUserFavoriteStyleIds } from "@/lib/favorites";
import dynamic from "next/dynamic";

// Lazy load modal components for better initial load performance
const ImageGenerateModal = dynamic(() => import("@/app/components/ImageGenerateModal"), {
  loading: () => null,
  ssr: false,
});

const LoginModal = dynamic(() => import("@/app/components/LoginModal"), {
  loading: () => null,
  ssr: false,
});

const TopupModal = dynamic(() => import("@/app/components/TopupModal"), {
  loading: () => null,
  ssr: false,
});

const FeedbackButton = dynamic(() => import("@/app/components/FeedbackButton"), {
  loading: () => null,
  ssr: false,
});
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { isBetaTester } from "@/lib/beta-tester";
import { useGeneralSettings } from "@/app/components/GeneralSettingsProvider";
import { trackVisitor } from "@/lib/visitors";

export default function Home() {
  const [styles, setStyles] = useState<Style[]>([]);
  const [displayedStyles, setDisplayedStyles] = useState<Style[]>([]);
  const [trendingStyles, setTrendingStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [visibleStyles, setVisibleStyles] = useState<Style[]>([]);
  const [stylesPerPage] = useState(24); // Load 24 styles at a time
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [userTokens, setUserTokens] = useState<number | null>(null);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [favoriteStyleIds, setFavoriteStyleIds] = useState<Set<string>>(new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [clickedFavoriteId, setClickedFavoriteId] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isUserBetaTester, setIsUserBetaTester] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { settings: generalSettings } = useGeneralSettings();

  // Shuffle array function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Track visitor
  useEffect(() => {
    if (typeof window !== "undefined") {
      trackVisitor(window.location.pathname, user?.uid);
    }
  }, [user]);

  useEffect(() => {
    const loadStyles = async () => {
      try {
        setLoading(true);
        const activeStyles = await getActiveStyles();
        // Shuffle styles to display randomly
        const shuffledStyles = shuffleArray(activeStyles);
        setStyles(shuffledStyles);
        setDisplayedStyles(shuffledStyles);
        // Set first style as selected by default if available
        if (shuffledStyles.length > 0) {
          setSelectedStyleId(shuffledStyles[0].id);
        }
        
        // Calculate last update time from styles
        const updateTimes = activeStyles
          .map((style) => {
            if (!style.updatedAt) return null;
            if (style.updatedAt instanceof Date) return style.updatedAt;
            if (style.updatedAt && typeof (style.updatedAt as any).toDate === "function") {
              return (style.updatedAt as any).toDate();
            }
            return null;
          })
          .filter((date): date is Date => date !== null);
        
        if (updateTimes.length > 0) {
          const latestUpdate = new Date(Math.max(...updateTimes.map((d) => d.getTime())));
          setLastUpdateTime(latestUpdate);
        }
      } catch (error) {
        console.error("Error loading styles:", error);
      } finally {
        setLoading(false);
      }
    };

    const loadTrendingStyles = async () => {
      try {
        setTrendingLoading(true);
        // Use API route to get trending styles (server-side has full access)
        const response = await fetch("/api/trending-styles");
        const data = await response.json();
        
        if (data.ok && data.styles) {
          setTrendingStyles(data.styles);
        } else {
          // Fallback: try client-side if API fails
          const trending = await getTrendingStyles(6);
          setTrendingStyles(trending);
        }
      } catch (error) {
        console.error("Error loading trending styles:", error);
        // Fallback: try client-side
        try {
          const trending = await getTrendingStyles(6);
          setTrendingStyles(trending);
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError);
        }
      } finally {
        setTrendingLoading(false);
      }
    };

    // Load styles and trending styles in parallel for better performance
    Promise.all([loadStyles(), loadTrendingStyles()]).catch((error) => {
      console.error("Error loading initial data:", error);
    });
  }, []);

  // Check if user is beta tester
  useEffect(() => {
    const checkBetaTester = async () => {
      if (user?.uid) {
        const betaTesterStatus = await isBetaTester(user.uid);
        setIsUserBetaTester(betaTesterStatus);
      } else {
        setIsUserBetaTester(false);
      }
    };
    checkBetaTester();
  }, [user]);

  // Filter and search styles
  useEffect(() => {
    let filtered = [...styles];

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(
        (style) => style.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (style) =>
          style.name.toLowerCase().includes(query) ||
          style.prompt.toLowerCase().includes(query) ||
          style.category?.toLowerCase().includes(query) ||
          style.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setDisplayedStyles(filtered);
    setCurrentPage(1);
    setHasMore(filtered.length > stylesPerPage);
    
    // Update selected style if current selection is not in filtered results
    if (filtered.length > 0 && selectedStyleId) {
      const isSelectedInFiltered = filtered.some((s) => s.id === selectedStyleId);
      if (!isSelectedInFiltered) {
        setSelectedStyleId(filtered[0].id);
      }
    } else if (filtered.length > 0 && !selectedStyleId) {
      setSelectedStyleId(filtered[0].id);
    }
  }, [styles, selectedCategory, searchQuery, selectedStyleId, stylesPerPage]);

  // Update visible styles based on current page (lazy loading)
  useEffect(() => {
    if (displayedStyles.length > 0) {
      const endIndex = currentPage * stylesPerPage;
      const newVisibleStyles = displayedStyles.slice(0, endIndex);
      setVisibleStyles(newVisibleStyles);
      setHasMore(endIndex < displayedStyles.length);
    } else {
      setVisibleStyles([]);
      setHasMore(false);
    }
  }, [displayedStyles, currentPage, stylesPerPage]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading]);

  // Load user tokens when user is logged in
  useEffect(() => {
    if (!user?.uid) {
      setUserTokens(null);
      return;
    }

    let isCancelled = false;
    let retryTimeout: NodeJS.Timeout | null = null;

    const loadUserTokens = async (retryCount = 0) => {
      if (isCancelled) return;

      try {
        setTokensLoading(true);
        // Small delay on first load to ensure token initialization is complete after login
        if (retryCount === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const tokens = await getUserTokens(user.uid);
        if (!isCancelled) {
          setUserTokens(tokens);
          setTokensLoading(false);
        }
      } catch (error) {
        if (isCancelled) return;
        
        console.error(`Error loading user tokens (attempt ${retryCount + 1}):`, error);
        
        // Retry up to 2 times with increasing delays if initial load fails
        // This handles cases where token initialization is still in progress
        if (retryCount < 2) {
          const delay = (retryCount + 1) * 1000; // 1s, 2s
          retryTimeout = setTimeout(() => {
            if (!isCancelled) {
              loadUserTokens(retryCount + 1);
            }
          }, delay);
        } else {
          // After 2 retries, set to null and stop loading
          setUserTokens(null);
          setTokensLoading(false);
        }
      }
    };

    loadUserTokens();

    return () => {
      isCancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [user?.uid]);

  // Load user favorites when user is logged in
  useEffect(() => {
    const loadFavorites = async () => {
      if (user?.uid) {
        try {
          setFavoritesLoading(true);
          const favoriteIds = await getUserFavoriteStyleIds(user.uid);
          setFavoriteStyleIds(new Set(favoriteIds));
        } catch (error: any) {
          console.error("Error loading favorites:", error);
          // If permission error, just continue without favorites
          if (error.code !== "permission-denied") {
            // Only log non-permission errors
          }
          setFavoriteStyleIds(new Set());
        } finally {
          setFavoritesLoading(false);
        }
      } else {
        setFavoriteStyleIds(new Set());
      }
    };

    loadFavorites();
  }, [user]);

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

  const handleTopupSuccess = async () => {
    // Reload user tokens after topup
    if (user?.uid) {
      try {
        setTokensLoading(true);
        const tokens = await getUserTokens(user.uid);
        setUserTokens(tokens);
      } catch (error) {
        console.error("Error loading user tokens:", error);
      } finally {
        setTokensLoading(false);
      }
    }
  };

  // Format last update time
  const formatLastUpdate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUserTokens(null);
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleStyleClick = (styleId: string) => {
    setSelectedStyleId(styleId);
    const style = displayedStyles.find((s) => s.id === styleId);
    if (style) {
      setSelectedStyle(style);
      setModalOpen(true);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, style: Style) => {
    e.stopPropagation();
    
    if (!user?.uid) {
      setLoginModalOpen(true);
      return;
    }

    // Trigger click animation
    setClickedFavoriteId(style.id);
    setTimeout(() => setClickedFavoriteId(null), 100);

    try {
      const isFavorited = favoriteStyleIds.has(style.id);
      
      if (isFavorited) {
        await removeFavorite(user.uid, style.id);
        setFavoriteStyleIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(style.id);
          return newSet;
        });
      } else {
        await addFavorite(user.uid, style.id, style);
        setFavoriteStyleIds((prev) => new Set(prev).add(style.id));
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  // Get unique categories from styles
  const categories = Array.from(
    new Set(styles.map((style) => style.category).filter((cat) => cat && cat.trim()))
  ).sort();

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#101022] flex items-center justify-between whitespace-nowrap border-b border-solid border-[#282839] px-6 py-3 sm:px-10 lg:px-20">
        <div className="flex items-center gap-4 text-white">
          {generalSettings?.logoPath ? (
            <div className="relative h-6 w-auto">
              <Image
                src={generalSettings.logoPath}
                alt={generalSettings.websiteName || "Logo"}
                width={100}
                height={24}
                className="h-6 w-auto object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="size-6 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.8261 17.4264C16.7203 18.1174 20.2244 18.5217 24 18.5217C27.7756 18.5217 31.2797 18.1174 34.1739 17.4264C36.9144 16.7722 39.9967 15.2331 41.3563 14.1648L24.8486 40.6391C24.4571 41.267 23.5429 41.267 23.1514 40.6391L6.64374 14.1648C8.00331 15.2331 11.0856 16.7722 13.8261 17.4264Z" fill="currentColor"></path>
                <path clipRule="evenodd" d="M39.998 12.236C39.9944 12.2537 39.9875 12.2845 39.9748 12.3294C39.9436 12.4399 39.8949 12.5741 39.8346 12.7175C39.8168 12.7597 39.7989 12.8007 39.7813 12.8398C38.5103 13.7113 35.9788 14.9393 33.7095 15.4811C30.9875 16.131 27.6413 16.5217 24 16.5217C20.3587 16.5217 17.0125 16.131 14.2905 15.4811C12.0012 14.9346 9.44505 13.6897 8.18538 12.8168C8.17384 12.7925 8.16216 12.767 8.15052 12.7408C8.09919 12.6249 8.05721 12.5114 8.02977 12.411C8.00356 12.3152 8.00039 12.2667 8.00004 12.2612C8.00004 12.261 8 12.2607 8.00004 12.2612C8.00004 12.2359 8.0104 11.9233 8.68485 11.3686C9.34546 10.8254 10.4222 10.2469 11.9291 9.72276C14.9242 8.68098 19.1919 8 24 8C28.8081 8 33.0758 8.68098 36.0709 9.72276C37.5778 10.2469 38.6545 10.8254 39.3151 11.3686C39.9006 11.8501 39.9857 12.1489 39.998 12.236ZM4.95178 15.2312L21.4543 41.6973C22.6288 43.5809 25.3712 43.5809 26.5457 41.6973L43.0534 15.223C43.0709 15.1948 43.0878 15.1662 43.104 15.1371L41.3563 14.1648C43.104 15.1371 43.1038 15.1374 43.104 15.1371L43.1051 15.135L43.1065 15.1325L43.1101 15.1261L43.1199 15.1082C43.1276 15.094 43.1377 15.0754 43.1497 15.0527C43.1738 15.0075 43.2062 14.9455 43.244 14.8701C43.319 14.7208 43.4196 14.511 43.5217 14.2683C43.6901 13.8679 44 13.0689 44 12.2609C44 10.5573 43.003 9.22254 41.8558 8.2791C40.6947 7.32427 39.1354 6.55361 37.385 5.94477C33.8654 4.72057 29.133 4 24 4C18.867 4 14.1346 4.72057 10.615 5.94478C8.86463 6.55361 7.30529 7.32428 6.14419 8.27911C4.99695 9.22255 3.99999 10.5573 3.99999 12.2609C3.99999 13.1275 4.29264 13.9078 4.49321 14.3607C4.60375 14.6102 4.71348 14.8196 4.79687 14.9689C4.83898 15.0444 4.87547 15.1065 4.9035 15.1529C4.91754 15.1762 4.92954 15.1957 4.93916 15.2111L4.94662 15.223L4.95178 15.2312ZM35.9868 18.996L24 38.22L12.0131 18.996C12.4661 19.1391 12.9179 19.2658 13.3617 19.3718C16.4281 20.1039 20.0901 20.5217 24 20.5217C27.9099 20.5217 31.5719 20.1039 34.6383 19.3718C35.082 19.2658 35.5339 19.1391 35.9868 18.996Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            </div>
          )}
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
            {generalSettings?.websiteName || "edit Aja"}
          </h2>
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
              {/* User Avatar and Diamonds */}
              <div className="flex items-center gap-3">
                {/* User Avatar */}
                <div className="relative">
                  {user.photoURL ? (
                    <div className={`relative rounded-full ${isUserBetaTester ? 'p-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500' : ''}`}>
                      <Image
                        src={user.photoURL}
                        alt={user.displayName || user.email || "User"}
                        width={40}
                        height={40}
                        className={`rounded-full ${isUserBetaTester ? 'border-2 border-[#242424]' : 'border-2 border-white/20'}`}
                      />
                      {isUserBetaTester && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 border-2 border-[#242424] flex items-center justify-center shadow-lg">
                          <span className="material-symbols-outlined text-white text-xs">science</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`relative ${isUserBetaTester ? 'p-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-full' : ''}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUserBetaTester ? 'bg-[#242424] border-2 border-transparent' : 'bg-primary/20 border-2 border-white/20'}`}>
                        <span className="text-white text-sm font-bold">
                          {user.email?.[0]?.toUpperCase() || "U"}
                        </span>
                      </div>
                      {isUserBetaTester && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 border-2 border-[#242424] flex items-center justify-center shadow-lg">
                          <span className="material-symbols-outlined text-white text-xs">science</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Diamonds */}
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
              onClick={() => setLoginModalOpen(true)}
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
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors relative"
                >
                  <div className="relative">
                    {user.photoURL ? (
                      <div className={`relative rounded-full ${isUserBetaTester ? 'p-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500' : ''}`}>
                        <Image
                          src={user.photoURL}
                          alt={user.displayName || user.email || "User"}
                          width={32}
                          height={32}
                          className={`rounded-full cursor-pointer ${isUserBetaTester ? 'border-2 border-[#242424]' : 'border-2 border-white/20'}`}
                        />
                        {isUserBetaTester && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 border-2 border-[#242424] flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-[10px]">science</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`relative ${isUserBetaTester ? 'p-0.5 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-full' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${isUserBetaTester ? 'bg-[#242424] border-2 border-transparent' : 'bg-primary/20 border-2 border-white/20'}`}>
                          <span className="text-white text-xs font-bold">
                            {user.email?.[0]?.toUpperCase() || "U"}
                          </span>
                        </div>
                        {isUserBetaTester && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 border-2 border-[#242424] flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-[10px]">science</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`material-symbols-outlined text-white/70 text-lg transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                
                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-white/10 bg-[#242424] shadow-lg z-50 overflow-hidden">
                    <div className="py-1">
                      {/* User Email */}
                      <div className="px-4 py-2 border-b border-white/10">
                        <p className="text-xs text-white/50 mb-1">Email</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white/80 font-medium truncate">{user.email || "No email"}</p>
                          {isUserBetaTester && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/50 text-xs font-semibold text-purple-300">
                              <span className="material-symbols-outlined text-xs">science</span>
                              Beta Tester
                            </span>
                          )}
                        </div>
                      </div>
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
              onClick={() => setLoginModalOpen(true)}
              className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Last Update Notification */}
      {lastUpdateTime && (
        <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm text-white/70">
            <span className="material-symbols-outlined text-base text-primary">update</span>
            <span>
              Styles last updated:{" "}
              <span className="text-primary font-medium">
                {formatLastUpdate(lastUpdateTime)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-8">
          <div className="text-center mb-8">
            <h1 className="text-white text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-[-0.015em] mb-3">
              Choose Your Style
            </h1>
            <p className="text-[#9c9cba] text-base sm:text-lg max-w-2xl mx-auto mb-6">
              Select a style from our curated collection to transform your image.
            </p>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto mb-6">
              {/* Search Input */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-xl">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search styles by name, prompt, category, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-lg border border-white/10 bg-[#242424]/40 text-white placeholder:text-white/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Category Filter */}
              <div className="relative sm:w-48">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-xl z-10">
                  filter_list
                </span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-lg border border-white/10 bg-[#242424]/40 text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category} className="bg-[#242424]">
                      {category}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-xl pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Results Count */}
            {(searchQuery || selectedCategory) && (
              <div className="text-sm text-white/50 mb-4">
                Showing {displayedStyles.length} of {styles.length} style(s)
                {searchQuery && ` matching "${searchQuery}"`}
                {selectedCategory && ` in category "${selectedCategory}"`}
              </div>
            )}
          </div>

          {/* Trending Styles Section */}
          {!searchQuery && !selectedCategory && trendingStyles.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">trending_up</span>
                <h2 className="text-white text-2xl font-bold">Trending Styles</h2>
                <span className="text-white/50 text-sm">Most popular this week</span>
              </div>
              {trendingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 mb-6">
                  {trendingStyles.map((style) => {
                    const isSelected = selectedStyleId === style.id;
                    const isFavorited = favoriteStyleIds.has(style.id);
                    return (
                      <div
                        key={style.id}
                        onClick={() => handleStyleClick(style.id)}
                        className="group cursor-pointer relative aspect-square w-full rounded-lg overflow-hidden border-2 border-primary/50"
                      >
                        <Image
                          alt={`${style.name} Style Preview`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          src={style.imageUrl}
                          width={200}
                          height={200}
                          unoptimized
                        />
                        <div className="absolute bottom-1.5 left-1.5">
                          <span className="material-symbols-filled text-orange-500 text-lg drop-shadow-lg">local_fire_department</span>
                        </div>
                        {style.category && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                            <span className="inline-block px-2 py-0.5 rounded bg-primary/20 text-primary text-xs">
                              {style.category}
                            </span>
                          </div>
                        )}
                        {/* Favorite Button */}
                        <button
                          onClick={(e) => handleToggleFavorite(e, style)}
                          className="absolute top-1.5 right-1.5 z-20 p-1 cursor-pointer"
                          title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                          disabled={favoritesLoading}
                        >
                          <span
                            className={`material-symbols-outlined text-lg drop-shadow-lg ${
                              isFavorited ? "favorite-icon-filled" : "favorite-icon-gray"
                            } ${
                              clickedFavoriteId === style.id ? "favorite-icon-click-pop" : ""
                            }`}
                          >
                            favorite
                          </span>
                        </button>
                        <div
                          className={`absolute inset-0 ring-2 pointer-events-none transition-all ${
                            isSelected
                              ? "ring-primary"
                              : "ring-transparent group-hover:ring-primary"
                          }`}
                        ></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* All Styles Section */}
          {!searchQuery && !selectedCategory && (
            <div className="mb-4">
              <h2 className="text-white text-2xl font-bold mb-4">All Styles</h2>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading styles...</p>
              </div>
            </div>
          ) : styles.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                palette
              </span>
              <p className="text-white/70 text-lg mb-2">No styles available</p>
              <p className="text-white/50 text-sm">
                Check back later for new styles!
              </p>
            </div>
          ) : displayedStyles.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                search_off
              </span>
              <p className="text-white/70 text-lg mb-2">No styles found</p>
              <p className="text-white/50 text-sm mb-4">
                Try adjusting your search or filter criteria
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("");
                }}
                className="px-4 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-sm font-medium"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1 sm:gap-2">
                {visibleStyles.map((style, index) => {
                const isSelected = selectedStyleId === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => handleStyleClick(style.id)}
                    className="group cursor-pointer relative aspect-square w-full"
                  >
                    <Image
                      alt={`${style.name} Style Preview`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      src={style.imageUrl}
                      width={200}
                      height={200}
                      unoptimized
                    />
                    {style.category && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                        <span className="inline-block px-2 py-0.5 rounded bg-primary/20 text-primary text-xs">
                          {style.category}
                        </span>
                      </div>
                    )}
                    {/* Favorite Button */}
                    <button
                      onClick={(e) => handleToggleFavorite(e, style)}
                      className="absolute top-1.5 right-1.5 z-20 p-1 cursor-pointer"
                      title={favoriteStyleIds.has(style.id) ? "Remove from favorites" : "Add to favorites"}
                      disabled={favoritesLoading}
                    >
                      <span
                        className={`material-symbols-outlined text-lg drop-shadow-lg ${
                          favoriteStyleIds.has(style.id)
                            ? "favorite-icon-filled"
                            : "favorite-icon-gray"
                        } ${
                          clickedFavoriteId === style.id ? "favorite-icon-click-pop" : ""
                        }`}
                      >
                        favorite
                      </span>
                    </button>
                    <div
                      className={`absolute inset-0 ring-2 pointer-events-none transition-all ${
                        isSelected
                          ? "ring-primary"
                          : "ring-transparent group-hover:ring-primary"
                      }`}
                    ></div>
                  </div>
                );
              })}
              </div>
              {/* Observer target for infinite scroll */}
              {hasMore && (
                <div ref={observerTarget} className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#282839] px-6 py-8 sm:px-10 lg:px-20">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[#9c9cba]">
            © {new Date().getFullYear()} {generalSettings?.websiteName || "edit Aja"}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a className="text-sm text-white hover:text-primary" href="#">About</a>
            <a className="text-sm text-white hover:text-primary" href="#">Terms of Service</a>
            <a className="text-sm text-white hover:text-primary" href="#">Privacy Policy</a>
          </div>
        </div>
      </footer>

      {/* Image Generate Modal */}
      <ImageGenerateModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedStyle(null);
        }}
        style={selectedStyle}
        onTokenUpdate={(newTokenCount) => {
          // Update token count immediately after generation
          setUserTokens(newTokenCount);
        }}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      {/* Topup Modal */}
      {user && (
        <TopupModal
          isOpen={topupModalOpen}
          onClose={() => setTopupModalOpen(false)}
          currentDiamonds={userTokens || 0}
          onTopupSuccess={handleTopupSuccess}
        />
      )}

      {/* Feedback Button */}
      <FeedbackButton />
    </div>
  );
}
