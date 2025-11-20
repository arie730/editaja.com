"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Force dynamic rendering to avoid prerendering issues with useSearchParams
export const dynamic = 'force-dynamic';

interface Item {
  id: string;
  prompt: string;
  image?: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  copied?: number;
  saved?: number;
  createdAt?: string;
  label?: string;
  type?: string;
}

const PER_PAGE = 24;
const BATCH_SIZE = 50;

function ItemCard({
  item,
  formatDate,
  copyPrompt,
  onTagClick,
}: {
  item: Item;
  formatDate: (date?: string) => string;
  copyPrompt: (text: string, button: HTMLButtonElement) => void;
  onTagClick: (tag: string) => void;
}) {
  const [showFull, setShowFull] = useState(false);

  return (
    <article className="rounded-2xl overflow-hidden border border-white/10 bg-[#14141f] flex flex-col">
      <div className="aspect-[4/3] bg-black/30 relative">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.prompt?.substring(0, 80) || ""}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-gray-400 text-sm">No Image</div>
        )}
        {item.category && (
          <span className="absolute top-2 left-2 text-xs bg-black/60 backdrop-blur px-2 py-1 rounded-md border border-white/10">
            {item.category}
          </span>
        )}
        {(item.label || item.type) && (
          <span className="absolute top-2 right-2 text-[10px] bg-indigo-500/20 text-indigo-500 px-2 py-1 rounded-md border border-indigo-500/30">
            {[item.label, item.type].filter(Boolean).join(" ")}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3 grow">
        <div className="text-xs text-gray-400 flex items-center gap-3">
          <span>ID: {item.id}</span>
          <span>•</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>

        {showFull ? (
          <p className="text-sm whitespace-pre-wrap">{item.prompt}</p>
        ) : (
          <p className="text-sm line-clamp-4">{item.prompt}</p>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag, tagIndex) => (
              <button
                key={`${item.id}-tag-${tagIndex}-${tag}`}
                onClick={() => onTagClick(tag)}
                className="text-xs px-2 py-1 rounded-md border border-white/10 hover:bg-white/5"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="text-xs text-gray-400 flex items-center gap-3">
            <span title="Copied">📋 {item.copied || 0}</span>
            <span title="Saved">💾 {item.saved || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => copyPrompt(item.prompt || "", e.currentTarget)}
              className="copy-btn text-xs px-3 py-1 rounded-lg bg-indigo-500 hover:opacity-90 font-semibold"
            >
              Copy Prompt
            </button>
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-xs px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5"
            >
              {showFull ? "Lihat Ringkas" : "Lihat Lengkap"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CopasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const [exportStatus, setExportStatus] = useState("Mempersiapkan...");
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load data when authenticated
  useEffect(() => {
    if (authenticated) {
      loadData();
    }
  }, [authenticated]);

  // Apply filters
  useEffect(() => {
    if (items.length === 0) return;

    const q = searchQuery.toLowerCase().trim();
    const cat = selectedCategory.toLowerCase();
    const tag = selectedTag.toLowerCase();

    const filtered = items.filter((item) => {
      const text = `${item.prompt || ""} ${item.category || ""} ${(item.tags || []).join(" ")}`.toLowerCase();

      if (q) {
        const words = q.split(/\s+/).filter((w) => w);
        if (!words.every((word) => text.includes(word))) {
          return false;
        }
      }

      if (cat && item.category?.toLowerCase() !== cat) {
        return false;
      }

      if (tag && !(item.tags || []).some((t) => t.toLowerCase() === tag)) {
        return false;
      }

      return true;
    });

    setFilteredItems(filtered);
    setCurrentPage(1);
  }, [items, searchQuery, selectedCategory, selectedTag]);

  // Update URL params from search params
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("category") || "";
    const tag = searchParams.get("tag") || "";
    const page = parseInt(searchParams.get("page") || "1");

    setSearchQuery(q);
    setSelectedCategory(cat);
    setSelectedTag(tag);
    setCurrentPage(page);
  }, [searchParams]);

  async function checkAuth() {
    try {
      const res = await fetch("/api/copas/login");
      const data = await res.json();
      setAuthenticated(data.authenticated || false);
    } catch (error) {
      setAuthenticated(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await fetch("/api/copas/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
        setPassword("");
      } else {
        setLoginError(data.error || "Password salah!");
      }
    } catch (error: any) {
      setLoginError("Terjadi kesalahan. Coba lagi.");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/copas/logout", { method: "POST" });
      setAuthenticated(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/copas/data");
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.data) {
        setItems(data.data);

        // Extract categories and tags
        const cats = new Set<string>();
        const tagSet = new Set<string>();
        data.data.forEach((item: Item) => {
          if (item.category) cats.add(item.category);
          (item.tags || []).forEach((tag) => tagSet.add(tag));
        });
        setCategories(Array.from(cats).sort());
        setTags(Array.from(tagSet).sort());
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  function updateFilters() {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedTag) params.set("tag", selectedTag);
    params.set("page", "1");
    router.push(`/copas?${params.toString()}`);
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  async function copyPrompt(text: string, button: HTMLButtonElement) {
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    } catch (error) {
      alert("Gagal menyalin. Coba manual.");
    }
  }

  async function startExport() {
    const batchSelect = document.getElementById("batchSelect") as HTMLSelectElement;
    const batch = batchSelect ? parseInt(batchSelect.value) : 0;
    setCurrentBatch(batch);
    setExportModalOpen(true);
    setExportProgress(0);
    setExportTotal(0);
    setExportStatus("Mempersiapkan...");

    try {
      // Prepare export
      const prepareRes = await fetch(`/api/copas/export?action=prepare_export&batch=${batch}`);
      const prepareData = await prepareRes.json();

      if (prepareData.status === "started") {
        setExportTotal(prepareData.total);
        setTotalBatches(prepareData.totalBatches || 1);
        setExportStatus(`Batch ${batch + 1} dari ${prepareData.totalBatches || 1}`);

        // Start downloading images
        const downloadRes = await fetch(`/api/copas/export?action=download_images&batch=${batch}`);
        const downloadData = await downloadRes.json();

        if (downloadData.status === "completed") {
          setExportProgress(downloadData.result.total);
          setExportTotal(downloadData.result.total);
          setExportStatus(
            `Selesai! ${downloadData.result.downloaded} berhasil, ${downloadData.result.skipped} sudah ada, ${downloadData.result.failed} gagal`
          );

          // Download JSON file
          setTimeout(() => {
            window.location.href = `/api/copas/export?action=get_export_file&batch=${batch}`;
            setExportModalOpen(false);
          }, 500);
        } else {
          setExportStatus("Error: " + (downloadData.error || "Unknown error"));
        }
      } else {
        setExportStatus("Error: " + (prepareData.error || "Unknown error"));
      }
    } catch (error: any) {
      setExportStatus("Error: " + error.message);
    }
  }

  // Login page
  if (authenticated === false) {
    return (
      <div className="min-h-screen bg-[#0b0b12] text-white flex items-center justify-center">
        <div className="bg-[#14141f] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="size-16 rounded-xl bg-indigo-500/20 grid place-items-center mx-auto mb-4">
              <span className="text-indigo-500 font-bold text-2xl">VP</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Viral Prompts Viewer</h1>
            <p className="text-sm text-gray-400">Masukkan password untuk melanjutkan</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Masukkan password"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-500 hover:opacity-90 rounded-xl px-4 py-3 font-semibold"
            >
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading state
  if (authenticated === null || loading) {
    return (
      <div className="min-h-screen bg-[#0b0b12] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Main page
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const offset = (page - 1) * PER_PAGE;
  const shown = filteredItems.slice(offset, offset + PER_PAGE);
  const batches = Math.ceil(filteredItems.length / BATCH_SIZE);

  function buildQueryString(extra: Record<string, string> = {}) {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedTag) params.set("tag", selectedTag);
    Object.entries(extra).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    return params.toString();
  }

  return (
    <div className="min-h-screen bg-[#0b0b12] text-white">
      <header className="sticky top-0 z-20 backdrop-blur bg-[#0b0b12]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-indigo-500/20 grid place-items-center">
              <span className="text-indigo-500 font-bold">VP</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Viral Prompts Viewer</h1>
            <span className="text-xs text-gray-400 hidden sm:inline-block">by chatgambar.com</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
            >
              Logout
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateFilters();
              }}
              className="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-4 gap-2"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari prompt / tag / kategori..."
                className="bg-[#14141f] border border-white/10 rounded-xl px-3 py-2 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#14141f] border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-[#14141f] border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">Semua Tag</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <button className="bg-indigo-500 hover:opacity-90 rounded-xl px-4 py-2 font-semibold">
                Filter
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-400">
            Menampilkan <span className="font-semibold">{shown.length}</span> dari{" "}
            <span className="font-semibold">{filteredItems.length}</span> hasil. Halaman{" "}
            <span className="font-semibold">{page}</span> / <span className="font-semibold">{totalPages}</span>.
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            {filteredItems.length > 0 && (
              <div className="flex gap-2 items-center">
                <select
                  id="batchSelect"
                  className="bg-[#14141f] border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {Array.from({ length: batches }).map((_, i) => {
                    const start = i * BATCH_SIZE + 1;
                    const end = Math.min((i + 1) * BATCH_SIZE, filteredItems.length);
                    return (
                      <option key={i} value={i}>
                        Batch {i + 1} (Item {start}-{end})
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={startExport}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-semibold text-sm flex items-center gap-2"
                >
                  <span>📥</span>
                  <span>Export JSON</span>
                </button>
              </div>
            )}
            <button
              onClick={() => {
                const newPage = Math.max(1, page - 1);
                router.push(`/copas?${buildQueryString({ page: newPage.toString() })}`);
              }}
              disabled={page <= 1}
              className="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => {
                const newPage = Math.min(totalPages, page + 1);
                router.push(`/copas?${buildQueryString({ page: newPage.toString() })}`);
              }}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#14141f] border border-white/10">
            <h2 className="text-lg font-semibold mb-2">Tidak ada data</h2>
            <p className="text-gray-400 text-sm">
              Coba refresh halaman atau tunggu beberapa saat. Pastikan API dapat diakses.
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {shown.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  formatDate={formatDate}
                  copyPrompt={copyPrompt}
                  onTagClick={(tag) => {
                    setSelectedTag(tag);
                    updateFilters();
                  }}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  const window = 2;
                  return p === 1 || p === totalPages || (p >= page - window && p <= page + window);
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <div key={p} className="flex items-center gap-2">
                      {showEllipsis && <span className="text-gray-400">…</span>}
                      <button
                        onClick={() => router.push(`/copas?${buildQueryString({ page: p.toString() })}`)}
                        className={`px-3 py-1 rounded-lg ${
                          p === page
                            ? "bg-indigo-500 text-white"
                            : "border border-white/10 hover:bg-white/5"
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
        Sumber data:{" "}
        <a className="text-indigo-500 hover:underline" href="https://chatgambar.com/api/v1/viral-prompts">
          https://chatgambar.com/api/v1/viral-prompts
        </a>{" "}
        • Gambar dari <span className="text-indigo-500">https://copasprompt.id</span>
      </footer>

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#14141f] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Export Progress</h3>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-indigo-500 font-semibold">
                  Batch {currentBatch + 1} dari {totalBatches}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">{exportStatus}</span>
                <span className="text-gray-400">
                  {exportProgress} / {exportTotal}
                </span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${exportTotal > 0 ? (exportProgress / exportTotal) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Sedang mengunduh gambar ke folder lokal. Harap tunggu...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CopasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0b12] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <CopasPageContent />
    </Suspense>
  );
}

