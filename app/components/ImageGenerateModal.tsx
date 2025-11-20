"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Style } from "@/lib/styles";
import { uploadImageToLocal, saveGenerationToFirestore } from "@/lib/storage";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  getUserTokens,
  deductUserTokens,
  TOKEN_COST_PER_GENERATE,
  canAnonymousUserGenerate,
  getRemainingAnonymousGenerations,
  incrementAnonymousGenerationCount,
} from "@/lib/tokens";
import { getTokenCostPerGenerate, getMaxAnonymousGenerations, getSocialMediaSettings, SocialMediaSettings, getInitialTokens } from "@/lib/settings";
import TopupModal from "@/app/components/TopupModal";
import { signInWithGoogle } from "@/lib/auth";

interface ImageGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  style: Style | null;
  onTokenUpdate?: (newTokenCount: number) => void;
}

type ProgressStep = 
  | "idle"
  | "uploading"
  | "processing"
  | "generating"
  | "saving"
  | "complete";

export default function ImageGenerateModal({
  isOpen,
  onClose,
  style,
  onTokenUpdate,
}: ImageGenerateModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [originalUrls, setOriginalUrls] = useState<string[]>([]); // Store original URLs for download
  const [error, setError] = useState<string | null>(null);
  const [userTokens, setUserTokens] = useState<number | null>(null);
  const [remainingAnonymous, setRemainingAnonymous] = useState<number>(1);
  const [maxAnonymousGenerations, setMaxAnonymousGenerations] = useState<number>(1);
  const [progressStep, setProgressStep] = useState<ProgressStep>("idle");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalImage, setShareModalImage] = useState<string | null>(null);
  const [socialMediaSettings, setSocialMediaSettings] = useState<SocialMediaSettings>({
    facebook: true,
    twitter: true,
    whatsapp: true,
    telegram: true,
    linkedin: true,
    pinterest: true,
  });
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [tokenCostPerGenerate, setTokenCostPerGenerate] = useState<number>(TOKEN_COST_PER_GENERATE);
  const [initialTokens, setInitialTokens] = useState<number>(100);
  const [locationFetched, setLocationFetched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geolocationAbortControllerRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Close login modal when user logs in
  useEffect(() => {
    if (user && loginModalOpen) {
      setLoginModalOpen(false);
      setLoggingIn(false);
    }
  }, [user, loginModalOpen]);

  // Load user tokens or anonymous generation count
  useEffect(() => {
    if (!isOpen || !style) return;

    let isCancelled = false;

    const loadTokenInfo = async () => {
      if (user?.uid) {
        try {
          const tokens = await getUserTokens(user.uid);
          if (!isCancelled) {
            setUserTokens(tokens);
            setRemainingAnonymous(0);
          }
        } catch (error) {
          if (!isCancelled) {
            console.error("Error loading user tokens:", error);
            setUserTokens(null);
          }
        }
      } else {
        // Anonymous user - check remaining generations
        try {
          const maxGen = await getMaxAnonymousGenerations();
          const remaining = await getRemainingAnonymousGenerations();
          if (!isCancelled) {
            setMaxAnonymousGenerations(maxGen);
            setRemainingAnonymous(remaining);
            setUserTokens(null);
          }
        } catch (error) {
          if (!isCancelled) {
            console.error("Error loading anonymous generation limit:", error);
            setRemainingAnonymous(1);
            setUserTokens(null);
          }
        }
      }
      
      // Load token cost per generate from settings
      try {
        const cost = await getTokenCostPerGenerate();
        if (!isCancelled) {
          setTokenCostPerGenerate(cost);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error loading token cost:", error);
          // Keep default value
        }
      }
      
      // Load social media settings
      try {
        const socialSettings = await getSocialMediaSettings();
        if (!isCancelled) {
          setSocialMediaSettings(socialSettings);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error loading social media settings:", error);
          // Keep default values
        }
      }
      
      // Load initial tokens for new users
      try {
        const initial = await getInitialTokens();
        if (!isCancelled) {
          setInitialTokens(initial);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error loading initial tokens:", error);
          // Keep default value
        }
      }
    };

    loadTokenInfo();

    return () => {
      isCancelled = true;
      // Cleanup: abort any pending geolocation requests
      if (geolocationAbortControllerRef.current) {
        geolocationAbortControllerRef.current.abort();
        geolocationAbortControllerRef.current = null;
      }
    };
  }, [user?.uid, isOpen, style?.id]); // Use style.id instead of style object to prevent unnecessary re-renders

  // Set initial prompt from style (separate effect to avoid dependency issues)
  useEffect(() => {
    if (isOpen && style?.prompt) {
      setCustomPrompt(style.prompt);
    } else if (!isOpen) {
      // Reset when modal closes
      setCustomPrompt("");
      setLocationFetched(false);
    }
  }, [isOpen, style?.id, style?.prompt]);

  // Handle topup success - reload tokens
  const handleTopupSuccess = async () => {
    if (user?.uid) {
      try {
        const tokens = await getUserTokens(user.uid);
        setUserTokens(tokens);
        // Notify parent component to update token display
        if (onTokenUpdate) {
          onTokenUpdate(tokens);
        }
      } catch (error) {
        console.error("Error loading user tokens after topup:", error);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setGeneratedUrls([]);
    }
  };

  const handleGenerate = async () => {
    // Prevent multiple simultaneous calls
    if (isGenerating) {
      console.warn("Generation already in progress, ignoring duplicate call");
      return;
    }

    if (!selectedFile || !style) {
      setError("Please select an image and style");
      return;
    }

    // Check token/limit before generating
    if (user?.uid) {
      // Logged-in user: Check tokens
      if (userTokens === null) {
        setError("Loading token information...");
        return;
      }
      if (userTokens < tokenCostPerGenerate) {
        // Open topup modal instead of showing error
        setTopupModalOpen(true);
        return;
      }
    } else {
      // Anonymous user: Check generation limit
      try {
        const canGenerate = await canAnonymousUserGenerate();
        if (!canGenerate) {
          // Show login modal instead of error
          setLoginModalOpen(true);
          return;
        }
      } catch (error) {
        console.error("Error checking anonymous generation limit:", error);
        setError("Error checking generation limit. Please try again.");
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedUrls([]);
    setProgressStep("uploading");
    setProgressMessage("Uploading your image...");

    try {
      // Check if user is authenticated
      const currentUser = auth?.currentUser;
      const userId = currentUser?.uid || "anonymous";

      // Upload original image to local server
      let originalImageUrl = "";
      try {
        setProgressMessage("Uploading image to server...");
        originalImageUrl = await uploadImageToLocal(
          selectedFile,
          userId,
          "original"
        );
        console.log("Original image uploaded to local storage:", originalImageUrl);
      } catch (uploadError: any) {
        console.error("Failed to upload original image:", uploadError);
        // Don't use preview URL as fallback - it's a blob URL that won't work on server
        // Leave originalImageUrl empty so admin knows the upload failed
        originalImageUrl = "";
        console.warn("Original image upload failed, will not be saved to Firestore");
      }

      // Prepare form data for API
      setProgressStep("processing");
      setProgressMessage("Preparing your image for generation...");
      
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("styleId", style.id);
      // Use custom prompt if user edited it, otherwise use style prompt
      const promptToUse = customPrompt.trim() || style.prompt;
      formData.append("stylePrompt", promptToUse);
      formData.append("userId", userId);

      // Call AI API
      setProgressStep("generating");
      setProgressMessage("Generating your image with AI... This may take a minute.");
      
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        body: formData,
      });

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json().catch(async () => {
        const text = await response.text();
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      });

      if (!data.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      if (!data.urls || data.urls.length === 0) {
        throw new Error("No generated images received");
      }

      // Deduct tokens or increment anonymous count AFTER successful generation
      if (user?.uid) {
        // Deduct tokens for logged-in user
        try {
          const success = await deductUserTokens(user.uid, tokenCostPerGenerate);
          if (!success) {
            throw new Error("Failed to deduct tokens");
          }
          // Update local token count
          setUserTokens((prev) => (prev !== null ? prev - tokenCostPerGenerate : null));
          
          // Refresh token count from server
          const updatedTokens = await getUserTokens(user.uid);
          setUserTokens(updatedTokens);
          
          // Notify parent component to update token display
          if (onTokenUpdate) {
            onTokenUpdate(updatedTokens);
          }
        } catch (tokenError: any) {
          console.error("Error deducting tokens:", tokenError);
          throw new Error("Failed to process payment. Generation cancelled.");
        }
      } else {
        // Increment anonymous generation count
        await incrementAnonymousGenerationCount();
        const remaining = await getRemainingAnonymousGenerations();
        setRemainingAnonymous(remaining);
      }

      setGeneratedUrls(data.urls);
      setProgressMessage("Image generated! Saving to gallery...");

      // Download and save generated images to local server
      // IMPORTANT: Always save to local storage, never use CDN URLs
      setProgressStep("saving");
      const savedGeneratedUrls: string[] = [];
      const savedOriginalUrls: string[] = []; // Store original URLs for download
      const failedImages: number[] = [];
      
      try {
        for (let i = 0; i < data.urls.length; i++) {
          setProgressMessage(`Saving image ${i + 1} of ${data.urls.length}...`);
          const generatedUrl = data.urls[i];
          let saved = false;
          
          // Try server-side save first (more reliable, no CORS issues)
          try {
            const saveResponse = await fetch("/api/image/save-generated", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                imageUrl: generatedUrl,
                userId: userId,
                index: i,
              }),
            });

            if (saveResponse.ok) {
              const saveData = await saveResponse.json();
              // Accept URLs from gambar.editaja.com or local /uploads/
              if (saveData.ok && saveData.url && (
                saveData.url.startsWith("/uploads/") || 
                saveData.url.includes("gambar.editaja.com") ||
                saveData.url.startsWith("http")
              )) {
                savedGeneratedUrls.push(saveData.url);
                // Store original URL if available (for download)
                if (saveData.original_url) {
                  // Store original URLs in same order as generated URLs
                  while (savedGeneratedUrls.length > savedOriginalUrls.length) {
                    savedOriginalUrls.push("");
                  }
                  savedOriginalUrls[i] = saveData.original_url;
                }
                console.log(`✅ Generated image ${i + 1} saved via server-side:`, {
                  optimized: saveData.url,
                  original: saveData.original_url
                });
                saved = true;
              } else {
                console.warn(`Server-side save returned invalid URL for image ${i + 1}`);
              }
            } else {
              const errorData = await saveResponse.json().catch(() => ({}));
              console.warn(`Server-side save failed for image ${i + 1}:`, saveResponse.status, errorData);
            }
          } catch (serverError: any) {
            console.warn(`Server-side save error for image ${i + 1}:`, serverError.message);
          }

          // If server-side failed, try client-side save
          if (!saved) {
            try {
              // Download the generated image
              const imageResponse = await fetch(generatedUrl, {
                mode: 'cors',
                cache: 'no-cache',
              });
              
              if (!imageResponse.ok) {
                throw new Error(`Failed to download: ${imageResponse.status} ${imageResponse.statusText}`);
              }
              
              const imageBlob = await imageResponse.blob();
              if (!imageBlob || imageBlob.size === 0) {
                throw new Error("Downloaded image is empty");
              }
              
              const imageFile = new File([imageBlob], `generated_${i + 1}.jpg`, {
                type: "image/jpeg",
              });

              // Upload to local server
              const localUrl = await uploadImageToLocal(
                imageFile,
                userId,
                "generated"
              );
              
              if (localUrl && (localUrl.startsWith("/uploads/") || localUrl.includes("gambar.editaja.com") || localUrl.startsWith("http"))) {
                savedGeneratedUrls.push(localUrl);
                console.log(`✅ Generated image ${i + 1} saved via client-side:`, localUrl);
                saved = true;
              } else {
                throw new Error(`Invalid local URL returned: ${localUrl}`);
              }
            } catch (imgError: any) {
              console.error(`❌ Failed to save generated image ${i + 1}:`, imgError);
              console.error(`   Error details:`, imgError.message);
              failedImages.push(i + 1);
              // Don't use CDN URL - retry or show error
              // We'll handle this below
            }
          }
        }
        
        // If some images failed to save, retry them
        if (failedImages.length > 0) {
          console.warn(`⚠️ Retrying ${failedImages.length} failed image(s)...`);
          for (const imgIndex of failedImages) {
            const retryIndex = imgIndex - 1;
            if (retryIndex >= 0 && retryIndex < data.urls.length) {
              setProgressMessage(`Retrying image ${imgIndex}...`);
              const generatedUrl = data.urls[retryIndex];
              
              try {
                // Try server-side again with longer timeout
                const saveResponse = await fetch("/api/image/save-generated", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    imageUrl: generatedUrl,
                    userId: userId,
                    index: retryIndex,
                  }),
                });

                if (saveResponse.ok) {
                  const saveData = await saveResponse.json();
                  if (saveData.ok && saveData.url && (
                    saveData.url.startsWith("/uploads/") || 
                    saveData.url.includes("gambar.editaja.com") ||
                    saveData.url.startsWith("http")
                  )) {
                    // Add to savedGeneratedUrls at correct index
                    savedGeneratedUrls[retryIndex] = saveData.url;
                    console.log(`✅ Retry successful for image ${imgIndex}:`, saveData.url);
                    // Remove from failed list
                    const failedIndex = failedImages.indexOf(imgIndex);
                    if (failedIndex > -1) {
                      failedImages.splice(failedIndex, 1);
                    }
                  } else {
                    console.warn(`Retry returned invalid URL for image ${imgIndex}`);
                  }
                } else {
                  const errorData = await saveResponse.json().catch(() => ({}));
                  console.warn(`Retry failed for image ${imgIndex}:`, saveResponse.status, errorData);
                }
              } catch (retryError: any) {
                console.error(`❌ Retry error for image ${imgIndex}:`, retryError.message);
              }
            }
          }
        }
      } catch (saveError: any) {
        console.error("❌ Critical error saving generated images:", saveError);
        // Don't use CDN URLs - show error to user instead
        setError(`Failed to save images to local storage: ${saveError.message}. Please try again.`);
      }

      // Update generated URLs - accept URLs from gambar.editaja.com or local /uploads/
      const validLocalUrls = savedGeneratedUrls.filter(url => 
        url && (
          url.startsWith("/uploads/") || 
          url.includes("gambar.editaja.com") ||
          url.startsWith("http")
        )
      );
      
      if (validLocalUrls.length === data.urls.length) {
        // All images saved successfully
        setGeneratedUrls(validLocalUrls);
        // Set original URLs (use original if available, otherwise fallback to optimized)
        const finalOriginalUrls = validLocalUrls.map((url, idx) => 
          savedOriginalUrls[idx] || url
        );
        setOriginalUrls(finalOriginalUrls);
        console.log(`✅ All ${validLocalUrls.length} image(s) saved to local storage`);
      } else if (validLocalUrls.length > 0) {
        // Some images saved, some failed
        console.warn(`⚠️ Only ${validLocalUrls.length} of ${data.urls.length} images saved to local storage`);
        setGeneratedUrls(validLocalUrls);
        // Set original URLs
        const finalOriginalUrls = validLocalUrls.map((url, idx) => 
          savedOriginalUrls[idx] || url
        );
        setOriginalUrls(finalOriginalUrls);
        setError(`Warning: ${data.urls.length - validLocalUrls.length} image(s) failed to save. Please try generating again.`);
      } else {
        // All failed - don't use CDN URLs, show error
        console.error("❌ Failed to save any images to local storage");
        setError("Failed to save images to local storage. Please check server logs and try again.");
        // Don't set generatedUrls - let user retry
        return;
      }

      // Skip geolocation fetch to prevent repeated API calls and save bandwidth
      // Location is optional and not critical for generation
      // Disabled to prevent unnecessary API calls
      let location: { country?: string; city?: string; ip?: string } | undefined = undefined;
      
      // Geolocation fetch disabled - was causing repeated API calls
      // Uncomment below if location tracking is needed
      /*
      if (!locationFetched) {
        try {
          // Cancel any previous geolocation request
          if (geolocationAbortControllerRef.current) {
            geolocationAbortControllerRef.current.abort();
          }
          
          // Create new abort controller
          const controller = new AbortController();
          geolocationAbortControllerRef.current = controller;
          
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 2000); // 2 second timeout
          
          try {
            const response = await fetch("/api/geolocation", {
              signal: controller.signal,
              method: 'GET',
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok && !controller.signal.aborted) {
              const locationData = await response.json();
              
              if (locationData && locationData.country && locationData.country !== "Unknown") {
                location = {
                  country: locationData.country,
                  ...(locationData.city && locationData.city !== "Unknown" ? { city: locationData.city } : {}),
                  ...(locationData.ip && locationData.ip !== "unknown" ? { ip: locationData.ip } : {}),
                };
                setLocationFetched(true);
              }
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name !== 'AbortError') {
              console.warn("Failed to get user location:", fetchError);
            }
          }
        } catch (locationError) {
          console.warn("Failed to get user location:", locationError);
        }
      }
      */

      // Save to Firestore - only if we have valid local URLs
      if (validLocalUrls.length === 0) {
        console.error("❌ Cannot save to Firestore: No valid local URLs");
        setError("Failed to save images to local storage. Please try generating again.");
        setIsGenerating(false);
        return;
      }

      try {
        const generationData: {
          userId: string;
          styleId: string;
          styleName: string;
          originalImageUrl: string;
          generatedImageUrls: string[];
          location?: { country?: string; city?: string; ip?: string };
        } = {
          userId: userId,
          styleId: style.id,
          styleName: style.name,
          originalImageUrl: originalImageUrl || "",
          generatedImageUrls: validLocalUrls, // Only use local URLs
        };

        // Only add location if it exists and has valid data
        if (location && Object.keys(location).length > 0) {
          generationData.location = location;
        }

        setProgressMessage("Finalizing...");
        try {
          const docId = await saveGenerationToFirestore(generationData);
          if (docId && docId !== "save-skipped-duplicate" && docId !== "save-failed-but-ok") {
            console.log("Generation saved to Firestore with ID:", docId);
          } else {
            console.log("Generation completed (Firestore save skipped or failed, but images are generated)");
          }
        } catch (firestoreError: any) {
          // This catch block should rarely be hit now since saveGenerationToFirestore
          // handles errors internally, but just in case
          console.warn("Failed to save to Firestore:", firestoreError.message);
          // Continue even if Firestore save fails - images are still generated
        }
      } catch (firestoreOuterError: any) {
        console.warn("Error in Firestore save process:", firestoreOuterError);
        // Continue even if Firestore save fails - images are still generated
      }

      setProgressStep("complete");
      setProgressMessage("Complete! Your images are ready.");
    } catch (err: any) {
      console.error("Error generating image:", err);
      const errorMessage = err.message || "Failed to generate image";
      setError(errorMessage);
      setProgressStep("idle");
      setProgressMessage("");
      console.error("Full error:", err);
    } finally {
      setIsGenerating(false);
      if (!error) {
        setTimeout(() => {
          setProgressStep("idle");
          setProgressMessage("");
        }, 2000);
      }
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setGeneratedUrls([]);
      setError(null);
      setProgressStep("idle");
      setProgressMessage("");
      setShareModalOpen(false);
      setShareModalImage(null);
      setCustomPrompt(style?.prompt || "");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    }
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
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  };

  const handleShareToSocial = (url: string, platform: string) => {
    // Check if platform is enabled
    if (platform !== "copy" && !socialMediaSettings[platform as keyof SocialMediaSettings]) {
      showToast(`${platform.charAt(0).toUpperCase() + platform.slice(1)} sharing is disabled`);
      return;
    }

    const encodedUrl = encodeURIComponent(url);
    // Use editaja.com in share message instead of freepik
    const text = encodeURIComponent(`Check out this amazing AI-generated image created with editaja.com! ${url}`);
    const title = encodeURIComponent("AI Generated Image - editaja.com");

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

  const handleDownload = async (url: string, index?: number) => {
    try {
      // Use original URL if available, otherwise use the provided URL (optimized)
      const downloadUrl = (index !== undefined && originalUrls[index]) ? originalUrls[index] : url;
      
      console.log("Downloading image:", { 
        displayUrl: url, 
        downloadUrl, 
        index, 
        hasOriginal: index !== undefined && !!originalUrls[index] 
      });
      
      // Try direct download first
      try {
        const response = await fetch(downloadUrl, {
          mode: 'cors',
          cache: 'no-cache',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        // Extract filename from URL or use default
        let filename = `editaja.com_${new Date().toISOString().split("T")[0]}.jpg`;
        try {
          const urlPath = new URL(downloadUrl).pathname;
          const urlFilename = urlPath.split('/').pop();
          if (urlFilename && urlFilename.includes('.')) {
            filename = urlFilename;
          }
        } catch (e) {
          // Use default filename if URL parsing fails
        }
        
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);
        
        // Open share modal after successful download
        setShareModalImage(url);
        setShareModalOpen(true);
      } catch (fetchError: any) {
        // If direct fetch fails (CORS issue), try using anchor tag with download attribute
        console.warn("Direct download failed, trying anchor download:", fetchError.message);
        
        try {
          // Fallback: use anchor tag with download attribute (works for same-origin or CORS-allowed)
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `editaja.com_${new Date().toISOString().split("T")[0]}.jpg`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setShareModalImage(url);
          setShareModalOpen(true);
        } catch (anchorError: any) {
          console.error("Anchor download also failed:", anchorError);
          throw new Error(`Failed to download image. Please try right-clicking and selecting "Save image as".`);
        }
      }
    } catch (error: any) {
      console.error("Error downloading image:", error);
      setError(error.message || "Failed to download image. Please try right-clicking and selecting 'Save image as'.");
    }
  };

  const getProgressPercentage = (): number => {
    switch (progressStep) {
      case "uploading":
        return 20;
      case "processing":
        return 40;
      case "generating":
        return 70;
      case "saving":
        return 90;
      case "complete":
        return 100;
      default:
        return 0;
    }
  };

  if (!isOpen || !style) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[95vh] bg-[#111118] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Simple with close button only */}
        <div className="flex items-center justify-end px-4 py-3 border-b border-white/10 sticky top-0 bg-[#111118] z-10">
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>


        {/* Main Content Area - Simplified */}
        <div className="flex-1 overflow-y-auto p-4">
          {!generatedUrls.length ? (
            <div className="max-w-5xl mx-auto">
              {/* 2 Kolom: Upload di kiri (desktop), Upload di atas (mobile) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Upload/Preview Column - Kiri di desktop, Atas di mobile */}
                <div className="flex flex-col order-1 md:order-1">
                  {/* Upload Section with Style Preview */}
                  {!previewUrl && !isGenerating && (
                    <div className="relative flex-1 min-h-[300px]">
                      <label
                        htmlFor="image-upload"
                        className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-white/20 rounded-xl bg-white/5 hover:border-primary/50 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden"
                      >
                        {/* Style Preview Image in background */}
                        {style.imageUrl && (
                          <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                            <Image
                              src={style.imageUrl}
                              alt={style.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40"></div>
                          </div>
                        )}
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
                          <span className="material-symbols-outlined text-5xl text-white/40 group-hover:text-primary mb-4 transition-colors">
                            cloud_upload
                          </span>
                          <p className="mb-2 text-sm font-semibold text-white/70">
                            <span className="text-primary">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-white/50">PNG, JPG, WEBP (MAX. 10MB)</p>
                        </div>
                        <input
                          ref={fileInputRef}
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          disabled={isGenerating}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {/* Preview Section */}
                  {previewUrl && (
                    <div className="relative flex-1 min-h-[300px]">
                      <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-white/10 bg-[#1A1A1A] shadow-lg">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                        {isGenerating && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
                              <p className="text-white text-sm font-medium">{progressMessage}</p>
                            </div>
                          </div>
                        )}
                        {!isGenerating && (
                          <button
                            onClick={() => {
                              setSelectedFile(null);
                              setPreviewUrl(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }}
                            className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors"
                            title="Change image"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Prompt Editor Column - Kanan di desktop, Bawah di mobile */}
                <div className="flex flex-col order-2 md:order-2">
                  {!isGenerating ? (
                    <>
                      <label className="block text-white/70 text-sm font-medium mb-2">
                        Prompt (Optional - Edit to customize)
                      </label>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Enter your custom prompt..."
                        className="w-full px-4 py-3 rounded border border-white/10 bg-[#1A1A1A] text-white placeholder:text-white/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none flex-1 min-h-[300px]"
                        disabled={isGenerating}
                      />
                      <p className="text-white/50 text-xs mt-2">
                        Leave empty or edit to customize the generation style
                      </p>
                    </>
                  ) : (
                    <div className="hidden md:flex flex-col gap-3 p-4 rounded-lg bg-white/5 border border-white/10 min-h-[300px] justify-center">
                      <div className="text-center space-y-2">
                        <span className="material-symbols-outlined text-primary text-4xl animate-pulse block mx-auto">auto_awesome</span>
                        <p className="text-white/70 text-sm">{progressMessage}</p>
                        <p className="text-white/50 text-xs">Please wait...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              {selectedFile && !isGenerating && (
                <div className="max-w-5xl mx-auto">
                  {user?.uid ? (
                    // Logged-in user
                    <button
                      onClick={handleGenerate}
                      disabled={!selectedFile || (userTokens !== null && userTokens < tokenCostPerGenerate)}
                      className="w-full py-3.5 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30"
                    >
                      <span className="material-symbols-outlined text-xl">auto_awesome</span>
                      <span>Generate Image</span>
                      <span className="text-white/80 text-sm font-normal">
                        ({tokenCostPerGenerate} {tokenCostPerGenerate === 1 ? 'diamond' : 'diamonds'})
                      </span>
                    </button>
                  ) : (
                    // Anonymous user
                    <button
                      onClick={() => {
                        if (remainingAnonymous <= 0) {
                          setLoginModalOpen(true);
                        } else {
                          handleGenerate();
                        }
                      }}
                      disabled={!selectedFile}
                      className="w-full py-3.5 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30"
                    >
                      <span className="material-symbols-outlined text-xl">auto_awesome</span>
                      {remainingAnonymous > 0 ? (
                        <>
                          <span>Generate Image</span>
                          <span className="text-white/80 text-sm font-normal">
                            (Sisa Free Generate: {remainingAnonymous})
                          </span>
                        </>
                      ) : (
                        <span>Silahkan login free ({initialTokens} {initialTokens === 1 ? 'token' : 'tokens'})</span>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Progress Bar - Simple */}
              {isGenerating && (
                <div className="max-w-5xl mx-auto space-y-3">
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                  <p className="text-center text-white/70 text-sm">{progressMessage}</p>
                </div>
              )}
            </div>
          ) : (
            /* Generated Images Display - 2 kolom: gambar dan tombol share */
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Success Message */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/50">
                  <span className="material-symbols-outlined text-green-400">check_circle</span>
                  <p className="text-green-400 font-semibold">Generated Successfully!</p>
                </div>
              </div>

              {generatedUrls.map((url, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start"
                >
                  {/* Image Column */}
                  <div className="relative w-full rounded-lg overflow-hidden border-2 border-white/10 hover:border-primary/50 transition-all bg-black/20">
                    <img
                      src={url}
                      alt={`Generated ${index + 1}`}
                      className="w-full h-auto block"
                      style={{ maxHeight: '70vh' }}
                    />
                    {/* Download icon - Always visible at top right */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(url, index);
                      }}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white hover:text-primary transition-colors z-10 shadow-lg"
                      title="Download image"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                    </button>
                  </div>

                  {/* Share Buttons Column */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-white font-semibold text-lg mb-2">Share to Social Media</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {socialMediaSettings.facebook && (
                        <button
                          onClick={() => handleShareToSocial(url, "facebook")}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#1877F2]/20 hover:bg-[#1877F2]/30 border border-[#1877F2]/50 text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">share</span>
                          <span className="text-sm font-medium">Facebook</span>
                        </button>
                      )}
                      {socialMediaSettings.twitter && (
                        <button
                          onClick={() => handleShareToSocial(url, "twitter")}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 border border-[#1DA1F2]/50 text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">chat</span>
                          <span className="text-sm font-medium">Twitter</span>
                        </button>
                      )}
                      {socialMediaSettings.whatsapp && (
                        <button
                          onClick={() => handleShareToSocial(url, "whatsapp")}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/50 text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">chat</span>
                          <span className="text-sm font-medium">WhatsApp</span>
                        </button>
                      )}
                      {socialMediaSettings.telegram && (
                        <button
                          onClick={() => handleShareToSocial(url, "telegram")}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#0088cc]/20 hover:bg-[#0088cc]/30 border border-[#0088cc]/50 text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">send</span>
                          <span className="text-sm font-medium">Telegram</span>
                        </button>
                      )}
                      {socialMediaSettings.linkedin && (
                        <button
                          onClick={() => handleShareToSocial(url, "linkedin")}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#0077b5]/20 hover:bg-[#0077b5]/30 border border-[#0077b5]/50 text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">work</span>
                          <span className="text-sm font-medium">LinkedIn</span>
                        </button>
                      )}
                      {socialMediaSettings.pinterest && (
                        <button
                          onClick={() => handleShareToSocial(url, "pinterest")}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#BD081C]/20 hover:bg-[#BD081C]/30 border border-[#BD081C]/50 text-white transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">photo_library</span>
                          <span className="text-sm font-medium">Pinterest</span>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleShareToSocial(url, "copy")}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors mt-2"
                    >
                      <span className="material-symbols-outlined">content_copy</span>
                      <span className="text-sm font-medium">Copy Link</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error Message - Simplified */}
          {error && (
            <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <span className="material-symbols-outlined text-red-400 flex-shrink-0">error</span>
              <p className="text-red-300 text-sm whitespace-pre-wrap">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal After Download */}
      {shareModalOpen && shareModalImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
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
            {shareModalImage && (
              <div className="mb-6 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                <img
                  src={shareModalImage}
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
                    handleShareToSocial(shareModalImage!, "facebook");
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
                    handleShareToSocial(shareModalImage!, "twitter");
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
                    handleShareToSocial(shareModalImage!, "whatsapp");
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
                    handleShareToSocial(shareModalImage!, "telegram");
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
                    handleShareToSocial(shareModalImage!, "linkedin");
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
                    handleShareToSocial(shareModalImage!, "pinterest");
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

      {/* Topup Modal */}
      {user && (
        <TopupModal
          isOpen={topupModalOpen}
          onClose={() => setTopupModalOpen(false)}
          currentDiamonds={userTokens || 0}
          onTopupSuccess={handleTopupSuccess}
        />
      )}

      {/* Login Modal for Anonymous Users */}
      {loginModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLoginModalOpen(false)}
        >
          <div
            className="relative bg-[#242424] rounded-xl border border-white/10 p-6 max-w-md w-full shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              title="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-5xl">lock</span>
              </div>
              <h2 className="text-white text-2xl font-bold mb-2 text-center">Free Generate Habis</h2>
              <p className="text-white/70 text-sm text-center">
                Anda telah mencapai batas {maxAnonymousGenerations} free generate untuk hari ini.
              </p>
              <p className="text-white/50 text-xs text-center mt-2">
                Batas akan reset besok. Login untuk mendapatkan gratis generate lagi dan generate tanpa batas!
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  try {
                    setLoggingIn(true);
                    await signInWithGoogle(false); // Use popup instead of redirect
                    // Modal will close automatically when user state changes
                    setLoginModalOpen(false);
                  } catch (error: any) {
                    console.error("Error signing in with Google:", error);
                    setError(error.message || "Failed to sign in with Google");
                    setLoggingIn(false);
                  }
                }}
                disabled={loggingIn}
                className="w-full px-4 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loggingIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setLoginModalOpen(false)}
                disabled={loggingIn}
                className="w-full px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

