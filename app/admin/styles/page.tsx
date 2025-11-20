"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import { Style, getStyles, createStyle, updateStyle, deleteStyle, deleteAllStyles } from "@/lib/styles";
import StyleModal from "./components/StyleModal";
import ImportModal from "./components/ImportModal";

export default function AdminStylesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [styles, setStyles] = useState<Style[]>([]);
  const [filteredStyles, setFilteredStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<Style | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [success, setSuccess] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Load styles from Firestore
  useEffect(() => {
    loadStyles();
  }, []);

  // Get unique categories
  const categories = Array.from(
    new Set(styles.map((style) => style.category).filter((cat) => cat && cat.trim() !== ""))
  ).sort();

  // Filter styles based on search query and category
  useEffect(() => {
    let filtered = styles;

    // Filter by search query
    if (searchQuery.trim() !== "") {
      filtered = filtered.filter((style) =>
        style.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "") {
      filtered = filtered.filter((style) => style.category === selectedCategory);
    }

    setFilteredStyles(filtered);
    // Reset to first page when filter changes
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, styles]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredStyles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStyles = filteredStyles.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadStyles = async () => {
    try {
      setLoading(true);
      const data = await getStyles();
      setStyles(data);
      setFilteredStyles(data);
    } catch (error: any) {
      console.error("Error loading styles:", error);
      setError("Failed to load styles. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStyle = () => {
    setEditingStyle(null);
    setIsModalOpen(true);
  };

  const handleEditStyle = (style: Style) => {
    setEditingStyle(style);
    setIsModalOpen(true);
  };

  const handleSaveStyle = async (data: any) => {
    try {
      setSaving(true);
      setError("");

      if (editingStyle) {
        await updateStyle(editingStyle.id, data);
      } else {
        await createStyle(data);
      }

      await loadStyles();
      setIsModalOpen(false);
      setEditingStyle(null);
    } catch (error: any) {
      console.error("Error saving style:", error);
      setError(error.message || "Failed to save style");
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStyle = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      await deleteStyle(id);
      await loadStyles();
      setSuccess(`Style "${name}" deleted successfully`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      console.error("Error deleting style:", error);
      setError(error.message || "Failed to delete style");
    }
  };

  const handleDeleteAllStyles = async () => {
    if (styles.length === 0) {
      setError("No styles to delete");
      return;
    }

    const confirmMessage = `Are you sure you want to delete ALL ${styles.length} style(s)?\n\nThis action cannot be undone and will permanently delete all styles from the database.\n\nType "DELETE ALL" to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== "DELETE ALL") {
      return;
    }

    try {
      setDeletingAll(true);
      setError("");
      setSuccess("");
      
      const deletedCount = await deleteAllStyles();
      await loadStyles();
      
      setSuccess(`Successfully deleted ${deletedCount} style(s)`);
      setTimeout(() => setSuccess(""), 5000);
    } catch (error: any) {
      console.error("Error deleting all styles:", error);
      setError(error.message || "Failed to delete all styles");
    } finally {
      setDeletingAll(false);
    }
  };

  const handleBulkUpdateStatus = async (category: string, status: "Active" | "Inactive") => {
    if (!category) {
      setError("Please select a category");
      return;
    }

    const stylesInCategory = styles.filter((style) => style.category === category);
    if (stylesInCategory.length === 0) {
      setError(`No styles found in category "${category}"`);
      return;
    }

    const action = status === "Active" ? "activate" : "deactivate";
    const confirmMessage = `Are you sure you want to ${action} all ${stylesInCategory.length} style(s) in category "${category}"?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setBulkUpdating(true);
      setError("");
      setSuccess("");

      // Update all styles in the category
      const updatePromises = stylesInCategory.map((style) =>
        updateStyle(style.id, { status })
      );

      await Promise.all(updatePromises);
      await loadStyles();
      
      setSuccess(`Successfully ${action}d ${stylesInCategory.length} style(s) in category "${category}"`);
      setTimeout(() => setSuccess(""), 5000);
    } catch (error: any) {
      console.error("Error bulk updating styles:", error);
      setError(error.message || `Failed to ${action} styles`);
    } finally {
      setBulkUpdating(false);
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
        month: "2-digit",
        day: "2-digit",
      });
    } catch (error) {
      return "N/A";
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="Manage Styles" onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="flex-1 p-6 md:p-10">
          {/* Total Styles Info */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-sm">
                Total Styles: <span className="font-semibold text-white">{styles.length}</span>
              </span>
              {filteredStyles.length !== styles.length && (
                <>
                  <span className="text-white/50">•</span>
                  <span className="text-white/70 text-sm">
                    Filtered: <span className="font-semibold text-white">{filteredStyles.length}</span>
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm">Items per page:</label>
              <div className="relative">
                <select
                  className="appearance-none rounded-lg border border-white/10 bg-[#242424] py-1.5 pl-3 pr-8 text-sm text-white hover:bg-[#2a2a2a] focus:border-primary focus:ring-primary focus:outline-none"
                  style={{ color: '#ffffff' }}
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10} style={{ background: '#242424', color: '#ffffff' }}>10</option>
                  <option value={20} style={{ background: '#242424', color: '#ffffff' }}>20</option>
                  <option value={50} style={{ background: '#242424', color: '#ffffff' }}>50</option>
                  <option value={100} style={{ background: '#242424', color: '#ffffff' }}>100</option>
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50 text-lg">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                  search
                </span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#242424]/40 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary md:w-80"
                  placeholder="Search styles..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative">
                <select
                  className="appearance-none rounded-lg border border-white/10 bg-[#242424] py-2 pl-4 pr-10 text-sm text-white hover:bg-[#2a2a2a] focus:border-primary focus:ring-primary focus:outline-none w-full md:w-auto min-w-[200px]"
                  style={{ color: '#ffffff' }}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="" style={{ background: '#242424', color: '#ffffff' }}>All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category} style={{ background: '#242424', color: '#ffffff' }}>
                      {category}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                  expand_more
                </span>
              </div>
              {selectedCategory && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkUpdateStatus(selectedCategory, "Active")}
                    disabled={bulkUpdating}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Activate all styles in category "${selectedCategory}"`}
                  >
                    {bulkUpdating ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-r-transparent"></div>
                    ) : (
                      <span className="material-symbols-outlined text-xl">check_circle</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleBulkUpdateStatus(selectedCategory, "Inactive")}
                    disabled={bulkUpdating}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Deactivate all styles in category "${selectedCategory}"`}
                  >
                    {bulkUpdating ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-r-transparent"></div>
                    ) : (
                      <span className="material-symbols-outlined text-xl">cancel</span>
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#242424]/40 text-white hover:bg-white/5 transition-colors"
                title="Import JSON"
              >
                <span className="material-symbols-outlined text-xl">upload_file</span>
              </button>
              <button
                onClick={handleAddStyle}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                title="Add New Style"
              >
                <span className="material-symbols-outlined text-xl">add</span>
              </button>
              {styles.length > 0 && (
                <button
                  onClick={handleDeleteAllStyles}
                  disabled={deletingAll || loading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete All Styles"
                >
                  {deletingAll ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-r-transparent"></div>
                  ) : (
                    <span className="material-symbols-outlined text-xl">delete_sweep</span>
                  )}
                </button>
              )}
            </div>
          </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg bg-green-500/20 border border-green-500/50 p-3 text-sm text-green-400">
            {success}
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="text-white">Loading styles...</p>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-white/10 bg-[#242424]/40">
            {filteredStyles.length === 0 ? (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                  palette
                </span>
                <p className="text-white/70 text-lg mb-2">
                  {searchQuery ? "No styles found" : "No styles yet"}
                </p>
                <p className="text-white/50 text-sm mb-4">
                  {searchQuery
                    ? "Try a different search term"
                    : "Click 'Add New Style' to create your first style"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleAddStyle}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                  >
                    <span className="material-symbols-outlined text-xl">add</span>
                    Add New Style
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-white/50">
                      <tr>
                        <th className="px-6 py-4 font-medium">Style</th>
                        <th className="px-6 py-4 font-medium">Category</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Date Created</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedStyles.map((style, index) => (
                        <tr
                          key={style.id}
                          className={
                            index < paginatedStyles.length - 1
                              ? "border-b border-white/10"
                              : ""
                          }
                        >
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 shrink-0 rounded-md bg-cover bg-center overflow-hidden">
                                <Image
                                  alt={style.name}
                                  className="w-full h-full object-cover"
                                  src={style.imageUrl}
                                  width={40}
                                  height={40}
                                  unoptimized
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium text-white">{style.name}</span>
                                <span className="text-xs text-white/50 truncate max-w-[200px]">
                                  {style.prompt.substring(0, 50)}
                                  {style.prompt.length > 50 ? "..." : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {style.category ? (
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-primary/20 text-primary">
                                {style.category}
                              </span>
                            ) : (
                              <span className="text-white/30 text-xs">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                style.status === "Active"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {style.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-white/70">
                            {formatDate(style.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right">
                            <button
                              onClick={() => handleEditStyle(style)}
                              className="p-1 text-white/70 hover:text-white"
                              title="Edit style"
                            >
                              <span className="material-symbols-outlined text-xl">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteStyle(style.id, style.name)}
                              className="p-1 text-red-500/70 hover:text-red-500 ml-2"
                              title="Delete style"
                            >
                              <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="border-t border-white/10 px-6 py-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-sm text-white/70">
                        Showing <span className="font-medium text-white">{startIndex + 1}</span> to{" "}
                        <span className="font-medium text-white">
                          {Math.min(endIndex, filteredStyles.length)}
                        </span>{" "}
                        of <span className="font-medium text-white">{filteredStyles.length}</span> styles
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#242424]/40 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Previous page"
                        >
                          <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        
                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                                  currentPage === pageNum
                                    ? "border-primary bg-primary/20 text-primary font-semibold"
                                    : "border-white/10 bg-[#242424]/40 text-white/70 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#242424]/40 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Next page"
                        >
                          <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <StyleModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingStyle(null);
          }}
          onSave={handleSaveStyle}
          style={editingStyle}
          loading={saving}
        />

        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={loadStyles}
          existingStyles={styles}
        />
        </div>
      </div>
    </div>
  );
}
