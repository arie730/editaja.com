"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import { getAllFeedbacks, getFeedbacksByCategory, Feedback, markFeedbackAsRead, deleteFeedback } from "@/lib/feedback";
import Image from "next/image";

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "beta-testing" | "bug" | "feature" | "general">("all");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load feedbacks
  useEffect(() => {
    const loadFeedbacks = async () => {
      try {
        setLoading(true);
        setError(null);
        const allFeedbacks = await getAllFeedbacks();
        setFeedbacks(allFeedbacks);
      } catch (err: any) {
        console.error("Error loading feedbacks:", err);
        setError(err.message || "Failed to load feedbacks");
      } finally {
        setLoading(false);
      }
    };

    loadFeedbacks();
  }, []);

  // Filter feedbacks based on active tab
  useEffect(() => {
    let filtered = feedbacks;

    if (activeTab === "beta-testing") {
      filtered = feedbacks.filter((f) => f.category === "beta-testing");
    } else if (activeTab !== "all") {
      filtered = feedbacks.filter((f) => f.category === activeTab);
    }

    setFilteredFeedbacks(filtered);
  }, [feedbacks, activeTab]);

  // Mark feedback as read when modal opens
  useEffect(() => {
    if (selectedFeedback && selectedFeedback.isRead !== true) {
      markFeedbackAsRead(selectedFeedback.id).catch((err) => {
        console.error("Error marking feedback as read:", err);
      });
      // Update local state
      setFeedbacks((prev) =>
        prev.map((f) =>
          f.id === selectedFeedback.id ? { ...f, isRead: true } : f
        )
      );
    }
  }, [selectedFeedback]);

  // Format date
  const formatDate = (date: Date | any) => {
    if (!date) return "N/A";
    try {
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

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-green-500/20 border-green-500/50 text-green-400";
      case "reviewed":
        return "bg-blue-500/20 border-blue-500/50 text-blue-400";
      default:
        return "bg-yellow-500/20 border-yellow-500/50 text-yellow-400";
    }
  };

  // Get category badge color
  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "beta-testing":
        return "bg-purple-500/20 border-purple-500/50 text-purple-400";
      case "bug":
        return "bg-red-500/20 border-red-500/50 text-red-400";
      case "feature":
        return "bg-blue-500/20 border-blue-500/50 text-blue-400";
      default:
        return "bg-gray-500/20 border-gray-500/50 text-gray-400";
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="User Feedback" onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex-1 p-6 md:p-10">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">User Feedback</h3>
            <p className="text-white/60 text-sm">
              Manage and review feedback from users
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-white/10">
            <nav className="flex gap-2">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "all"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("all")}
              >
                All ({feedbacks.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "beta-testing"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("beta-testing")}
              >
                Beta Testing ({feedbacks.filter((f) => f.category === "beta-testing").length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "bug"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("bug")}
              >
                Bug Reports ({feedbacks.filter((f) => f.category === "bug").length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "feature"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("feature")}
              >
                Feature Requests ({feedbacks.filter((f) => f.category === "feature").length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "general"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("general")}
              >
                General ({feedbacks.filter((f) => f.category === "general").length})
              </button>
            </nav>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/20 p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 rounded-xl border border-green-500/50 bg-green-500/20 p-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading feedbacks...</p>
              </div>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                feedback
              </span>
              <p className="text-white/70 text-lg mb-2">No feedback found</p>
              <p className="text-white/50 text-sm">
                {feedbacks.length === 0
                  ? "No feedback has been submitted yet."
                  : `No feedback found in "${activeTab}" category.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredFeedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className={`rounded-xl border p-6 hover:bg-[#242424]/60 transition-colors cursor-pointer relative ${
                    feedback.isRead !== true 
                      ? "border-primary/50 bg-primary/5" 
                      : "border-white/10 bg-[#242424]/40"
                  }`}
                  onClick={() => setSelectedFeedback(feedback)}
                >
                  {/* Unread indicator */}
                  {feedback.isRead !== true && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary"></div>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${getCategoryBadgeColor(feedback.category)}`}>
                          {feedback.category === "beta-testing" && (
                            <span className="material-symbols-outlined text-xs">science</span>
                          )}
                          {feedback.category === "bug" && (
                            <span className="material-symbols-outlined text-xs">bug_report</span>
                          )}
                          {feedback.category === "feature" && (
                            <span className="material-symbols-outlined text-xs">lightbulb</span>
                          )}
                          {feedback.category.replace("-", " ")}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${getStatusBadgeColor(feedback.status)}`}>
                          {feedback.status}
                        </span>
                        {feedback.isBetaTester && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/50 text-xs font-semibold text-purple-300">
                            <span className="material-symbols-outlined text-xs">science</span>
                            Beta Tester
                          </span>
                        )}
                      </div>
                      <p className="text-white/90 text-sm mb-2 line-clamp-2">{feedback.feedback}</p>
                      <div className="flex items-center gap-4 text-xs text-white/50 flex-wrap">
                        <span>{feedback.email || "No email"}</span>
                        <span>•</span>
                        <span>{formatDate(feedback.createdAt)}</span>
                        {feedback.screenshotPath && (
                          <>
                            <span>•</span>
                            <span className="text-primary">Has screenshot</span>
                          </>
                        )}
                      </div>
                    </div>
                    {feedback.screenshotPath && (
                      <div 
                        className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Image
                          src={feedback.screenshotPath}
                          alt="Screenshot"
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(feedback.id);
                      }}
                      className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      title="Delete feedback"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Feedback Detail Modal */}
          {selectedFeedback && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setSelectedFeedback(null)}
            >
              <div
                className="w-full max-w-3xl rounded-xl bg-[#242424] p-6 sm:p-8 shadow-2xl border border-white/10 relative max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="absolute top-4 right-4 p-2 rounded-lg text-[#888888] hover:text-white hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-semibold ${getCategoryBadgeColor(selectedFeedback.category)}`}>
                      {selectedFeedback.category === "beta-testing" && (
                        <span className="material-symbols-outlined text-sm">science</span>
                      )}
                      {selectedFeedback.category.replace("-", " ")}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-semibold ${getStatusBadgeColor(selectedFeedback.status)}`}>
                      {selectedFeedback.status}
                    </span>
                    {selectedFeedback.isBetaTester && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/50 text-sm font-semibold text-purple-300">
                        <span className="material-symbols-outlined text-sm">science</span>
                        Beta Tester
                      </span>
                    )}
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-white/50 mb-1">From</p>
                    <p className="text-white font-medium">{selectedFeedback.email || "No email"}</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-white/50 mb-1">Submitted</p>
                    <p className="text-white/70 text-sm">{formatDate(selectedFeedback.createdAt)}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-medium text-white/70 mb-2">Feedback</p>
                  <p className="text-white whitespace-pre-wrap">{selectedFeedback.feedback}</p>
                </div>

                {selectedFeedback.screenshotPath && (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-white/70 mb-2">Screenshot</p>
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                      <Image
                        src={selectedFeedback.screenshotPath}
                        alt="Screenshot"
                        width={800}
                        height={600}
                        className="w-full h-auto max-h-96 object-contain"
                        unoptimized
                      />
                    </div>
                  </div>
                )}

                {selectedFeedback.adminNotes && (
                  <div className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                    <p className="text-sm font-medium text-blue-400 mb-2">Admin Notes</p>
                    <p className="text-white/80 text-sm whitespace-pre-wrap">{selectedFeedback.adminNotes}</p>
                  </div>
                )}

                {/* Delete button */}
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/10">
                  <button
                    onClick={async () => {
                      if (!selectedFeedback) return;
                      try {
                        setDeletingId(selectedFeedback.id);
                        await deleteFeedback(selectedFeedback.id);
                        setFeedbacks((prev) => prev.filter((f) => f.id !== selectedFeedback.id));
                        setSelectedFeedback(null);
                        setSuccess("Feedback deleted successfully");
                        setTimeout(() => setSuccess(null), 3000);
                      } catch (err: any) {
                        console.error("Error deleting feedback:", err);
                        setError(err.message || "Failed to delete feedback");
                        setTimeout(() => setError(null), 3000);
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                    disabled={deletingId === selectedFeedback.id}
                    className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {deletingId === selectedFeedback.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">delete</span>
                        <span>Delete Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="rounded-lg border border-white/10 bg-[#242424] p-6 max-w-md w-full">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Delete Feedback?
                </h3>
                <p className="mb-4 text-sm text-white/70">
                  Are you sure you want to delete this feedback? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        setDeletingId(deleteConfirm);
                        await deleteFeedback(deleteConfirm);
                        setFeedbacks((prev) => prev.filter((f) => f.id !== deleteConfirm));
                        setDeleteConfirm(null);
                        setSuccess("Feedback deleted successfully");
                        setTimeout(() => setSuccess(null), 3000);
                      } catch (err: any) {
                        console.error("Error deleting feedback:", err);
                        setError(err.message || "Failed to delete feedback");
                        setTimeout(() => setError(null), 3000);
                      } finally {
                        setDeletingId(null);
                      }
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
        </div>
      </div>
    </div>
  );
}


