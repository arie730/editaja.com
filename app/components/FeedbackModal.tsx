"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { isBetaTester } from "@/lib/beta-tester";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  user,
}: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState<"general" | "bug" | "feature" | "beta-testing">("general");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isUserBetaTester, setIsUserBetaTester] = useState(false);

  useEffect(() => {
    const checkBetaTester = async () => {
      if (user?.uid) {
        const betaTesterStatus = await isBetaTester(user.uid);
        setIsUserBetaTester(betaTesterStatus);
      }
    };
    checkBetaTester();
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFeedback("");
      setCategory("general");
      setScreenshot(null);
      setScreenshotPreview(null);
      setError("");
      setSuccess(false);
    }
  }, [isOpen]);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }

      setScreenshot(file);
      setError("");

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      setError("Please enter your feedback");
      return;
    }

    if (!user) {
      setError("Please login to submit feedback. You can login using the menu above.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("feedback", feedback);
      formData.append("category", category);
      formData.append("isBetaTester", isUserBetaTester.toString());
      
      if (screenshot) {
        formData.append("screenshot", screenshot);
      }

      const currentUser = user;
      const idToken = await currentUser.getIdToken();

      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      setError(error.message || "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-[#242424] p-6 sm:p-8 shadow-2xl border border-white/10 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-[#888888] hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">feedback</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Send Feedback</h2>
          </div>
          <p className="text-[#888888] text-sm">
            Help us improve by sharing your thoughts, reporting bugs, or suggesting features.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-500/20 border border-green-500/50 p-3 text-sm text-green-400">
            Thank you for your feedback! We'll review it soon.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Category
            </label>
            <select
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-10 text-sm text-white focus:border-primary focus:ring-primary"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              disabled={loading}
            >
              <option value="general">General Feedback</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              {isUserBetaTester && (
                <option value="beta-testing">Beta Testing Feedback</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Feedback <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary min-h-[120px] resize-y"
              placeholder="Describe your feedback, bug, or feature request..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Screenshot (Optional)
            </label>
            <div className="flex flex-col gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                disabled={loading}
                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-sm text-white file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer disabled:opacity-50"
              />
              {screenshotPreview && (
                <div className="relative rounded-lg border border-white/10 overflow-hidden">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshot(null);
                      setScreenshotPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-white/50 mt-1">
              Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-white/10 bg-[#1A1A1A] text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !feedback.trim()}
              className="px-6 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">send</span>
                  <span>Submit Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

