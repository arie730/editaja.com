"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import { getAiApiKey, saveAiApiKey, testAiConnection, getThemeColors, saveThemeColors, ThemeColors, getMidtransConfig, saveMidtransConfig, MidtransConfig, getBetaTesterFreeTokens, saveBetaTesterFreeTokens, getBetaTesterRegistrationEnabled, saveBetaTesterRegistrationEnabled, getMaxBetaTesters, saveMaxBetaTesters, getGeneralSettings, saveGeneralSettings, GeneralSettings, getTopupPlans, saveTopupPlan, deleteTopupPlan, TopupPlan, getSocialMediaSettings, saveSocialMediaSettings, SocialMediaSettings } from "@/lib/settings";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { updateAdminPassword, updateAdminDisplayName } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { collection, getCountFromServer } from "firebase/firestore";

export default function AdminSettingsPage() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [activeTab, setActiveTab] = useState("api");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [themeColors, setThemeColors] = useState<ThemeColors>({
    primary: "#0d0df2",
    backgroundLight: "#f5f5f8",
    backgroundDark: "#111118",
  });
  const [savingColors, setSavingColors] = useState(false);
  const { refreshColors } = useTheme();
  const { user, setUser } = useAuth();
  
  // Account settings state
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Midtrans settings state
  const [midtransConfig, setMidtransConfig] = useState<MidtransConfig>({
    serverKey: "",
    clientKey: "",
    isProduction: false,
  });
  const [showMidtransServerKey, setShowMidtransServerKey] = useState(false);
  const [showMidtransClientKey, setShowMidtransClientKey] = useState(false);
  const [savingMidtrans, setSavingMidtrans] = useState(false);
  
  // Beta Tester settings state
  const [betaTesterFreeTokens, setBetaTesterFreeTokens] = useState<number>(1000);
  const [betaTesterRegistrationEnabled, setBetaTesterRegistrationEnabled] = useState<boolean>(true);
  const [maxBetaTesters, setMaxBetaTesters] = useState<number | null>(null);
  const [currentBetaTestersCount, setCurrentBetaTestersCount] = useState<number>(0);
  const [savingBetaTester, setSavingBetaTester] = useState(false);
  
  // General settings state
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    websiteName: "edit Aja",
    logoPath: null,
    faviconPath: null,
    watermarkEnabled: true,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [savingGeneral, setSavingGeneral] = useState(false);
  
  // Topup Plans state
  const [topupPlans, setTopupPlans] = useState<TopupPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<TopupPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  
  // Social Media Settings state
  const [socialMediaSettings, setSocialMediaSettings] = useState<SocialMediaSettings>({
    facebook: true,
    twitter: true,
    whatsapp: true,
    telegram: true,
    linkedin: true,
    pinterest: true,
  });
  const [savingSocialMedia, setSavingSocialMedia] = useState(false);

  // Load existing API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        setLoading(true);
        const existingKey = await getAiApiKey();
        if (existingKey) {
          setApiKey(existingKey);
        }
      } catch (error: any) {
        console.error("Error loading API key:", error);
        setMessage({ type: "error", text: "Failed to load API key" });
      } finally {
        setLoading(false);
      }
    };

    loadApiKey();
    loadThemeColors();
    loadMidtransConfig();
    loadBetaTesterSettings();
    loadGeneralSettings();
    loadTopupPlans();
    loadSocialMediaSettings();
    
    // Load user display name
    if (user?.displayName) {
      setDisplayName(user.displayName);
    } else if (user?.email) {
      setDisplayName(user.email.split("@")[0]);
    }
  }, [user]);
  
  // Load topup plans
  const loadTopupPlans = async () => {
    try {
      const plans = await getTopupPlans();
      setTopupPlans(plans);
    } catch (error: any) {
      console.error("Error loading topup plans:", error);
    }
  };
  
  // Load social media settings
  const loadSocialMediaSettings = async () => {
    try {
      const settings = await getSocialMediaSettings();
      setSocialMediaSettings(settings);
    } catch (error: any) {
      console.error("Error loading social media settings:", error);
    }
  };
  
  // Save social media settings
  const handleSaveSocialMediaSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSocialMedia(true);
      setMessage(null);
      await saveSocialMediaSettings(socialMediaSettings);
      setMessage({ type: "success", text: "Social media settings saved successfully!" });
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error("Error saving social media settings:", error);
      setMessage({ type: "error", text: error.message || "Failed to save social media settings" });
    } finally {
      setSavingSocialMedia(false);
    }
  };
  
  // Load general settings
  const loadGeneralSettings = async () => {
    try {
      const settings = await getGeneralSettings();
      setGeneralSettings(settings);
      if (settings.logoPath) {
        setLogoPreview(settings.logoPath);
      }
      if (settings.faviconPath) {
        setFaviconPreview(settings.faviconPath);
      }
    } catch (error: any) {
      console.error("Error loading general settings:", error);
    }
  };
  
  // Load Midtrans config
  const loadMidtransConfig = async () => {
    try {
      const config = await getMidtransConfig();
      if (config) {
        setMidtransConfig(config);
      }
    } catch (error: any) {
      console.error("Error loading Midtrans config:", error);
    }
  };
  
  // Load Beta Tester settings
  const loadBetaTesterSettings = async () => {
    try {
      const freeTokens = await getBetaTesterFreeTokens();
      const enabled = await getBetaTesterRegistrationEnabled();
      const maxUsers = await getMaxBetaTesters();
      setBetaTesterFreeTokens(freeTokens);
      setBetaTesterRegistrationEnabled(enabled);
      setMaxBetaTesters(maxUsers);
      
      // Load current beta testers count
      if (db) {
        try {
          const betaTestersCollection = collection(db, "betaTesters");
          const countSnapshot = await getCountFromServer(betaTestersCollection);
          setCurrentBetaTestersCount(countSnapshot.data().count);
        } catch (error) {
          console.error("Error loading beta testers count:", error);
        }
      }
    } catch (error: any) {
      console.error("Error loading beta tester settings:", error);
    }
  };
  
  // Save Beta Tester settings
  const handleSaveBetaTesterSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (betaTesterFreeTokens < 0) {
      setMessage({ type: "error", text: "Free tokens cannot be negative" });
      return;
    }
    
    if (maxBetaTesters !== null && maxBetaTesters < 0) {
      setMessage({ type: "error", text: "Max beta testers cannot be negative" });
      return;
    }
    
    try {
      setSavingBetaTester(true);
      setMessage(null);
      
      await saveBetaTesterFreeTokens(betaTesterFreeTokens);
      await saveBetaTesterRegistrationEnabled(betaTesterRegistrationEnabled);
      await saveMaxBetaTesters(maxBetaTesters);
      
      setMessage({ type: "success", text: "Beta tester settings saved successfully!" });
      
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error("Error saving beta tester settings:", error);
      setMessage({ type: "error", text: error.message || "Failed to save beta tester settings" });
    } finally {
      setSavingBetaTester(false);
    }
  };
  
  // Save Midtrans config
  const handleSaveMidtransConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!midtransConfig.serverKey.trim() || !midtransConfig.clientKey.trim()) {
      setMessage({ type: "error", text: "Server key and client key are required" });
      return;
    }

    try {
      setSavingMidtrans(true);
      setMessage(null);
      await saveMidtransConfig(midtransConfig);
      setMessage({ type: "success", text: "Midtrans configuration saved successfully!" });
    } catch (error: any) {
      console.error("Error saving Midtrans config:", error);
      setMessage({ type: "error", text: error.message || "Failed to save Midtrans configuration" });
    } finally {
      setSavingMidtrans(false);
    }
  };

  // Load theme colors on mount
  const loadThemeColors = async () => {
    try {
      const colors = await getThemeColors();
      if (colors) {
        setThemeColors(colors);
        applyThemeColors(colors);
      }
    } catch (error: any) {
      console.error("Error loading theme colors:", error);
    }
  };

  // Apply theme colors to CSS variables
  const applyThemeColors = (colors: ThemeColors) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--color-primary", colors.primary);
      root.style.setProperty("--color-background-light", colors.backgroundLight);
      root.style.setProperty("--color-background-dark", colors.backgroundDark);
    }
  };

  // Handle color change
  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const newColors = { ...themeColors, [key]: value };
    setThemeColors(newColors);
    applyThemeColors(newColors);
  };

  // Save theme colors
  const handleSaveThemeColors = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingColors(true);
      setMessage(null);
      await saveThemeColors(themeColors);
      // Refresh colors in ThemeContext to apply globally
      await refreshColors();
      setMessage({ type: "success", text: "Theme colors saved successfully! Changes applied to all pages." });
    } catch (error: any) {
      console.error("Error saving theme colors:", error);
      setMessage({ type: "error", text: error.message || "Failed to save theme colors" });
    } finally {
      setSavingColors(false);
    }
  };

  // Reset to default colors
  const handleResetColors = () => {
    const defaultColors: ThemeColors = {
      primary: "#0d0df2",
      backgroundLight: "#f5f5f8",
      backgroundDark: "#111118",
    };
    setThemeColors(defaultColors);
    applyThemeColors(defaultColors);
  };

  const toggleApiKeyVisibility = () => {
    setShowApiKey(!showApiKey);
  };

  const toggleMaintenanceMode = () => {
    setMaintenanceMode(!maintenanceMode);
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setMessage({ type: "error", text: "Please enter an API key" });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      await saveAiApiKey(apiKey.trim());
      setMessage({ type: "success", text: "API key saved successfully!" });
    } catch (error: any) {
      console.error("Error saving API key:", error);
      setMessage({ type: "error", text: error.message || "Failed to save API key" });
    } finally {
      setSaving(false);
    }
  };

  // Handle save general settings
  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSavingGeneral(true);
      setMessage(null);

      let logoPath = generalSettings.logoPath;
      let faviconPath = generalSettings.faviconPath;

      // Upload logo if new file selected
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        formData.append("type", "logo");

        const currentUser = auth?.currentUser;
        if (!currentUser) {
          throw new Error("User not authenticated");
        }

        const idToken = await currentUser.getIdToken();
        const uploadResponse = await fetch("/api/upload/settings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (!uploadData.ok) {
          throw new Error(uploadData.error || "Failed to upload logo");
        }

        logoPath = uploadData.url;
      }

      // Upload favicon if new file selected
      if (faviconFile) {
        const formData = new FormData();
        formData.append("file", faviconFile);
        formData.append("type", "favicon");

        const currentUser = auth?.currentUser;
        if (!currentUser) {
          throw new Error("User not authenticated");
        }

        const idToken = await currentUser.getIdToken();
        const uploadResponse = await fetch("/api/upload/settings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (!uploadData.ok) {
          throw new Error(uploadData.error || "Failed to upload favicon");
        }

        faviconPath = uploadData.url;
      }

      // Ensure watermarkEnabled has a value (default to true if undefined)
      const watermarkEnabled = generalSettings.watermarkEnabled !== undefined ? generalSettings.watermarkEnabled : true;

      // Save settings to Firestore
      await saveGeneralSettings({
        websiteName: generalSettings.websiteName,
        logoPath: logoPath,
        faviconPath: faviconPath,
        watermarkEnabled: watermarkEnabled,
      });

      // Update local state
      setGeneralSettings({
        ...generalSettings,
        logoPath: logoPath,
        faviconPath: faviconPath,
        watermarkEnabled: watermarkEnabled,
      });

      // Clear file inputs
      setLogoFile(null);
      setFaviconFile(null);

      setMessage({ type: "success", text: "General settings saved successfully!" });
      
      // Reload settings in provider (will trigger re-render)
      await loadGeneralSettings();
      
      // Dispatch custom event to refresh settings in all components
      window.dispatchEvent(new Event("generalSettingsUpdated"));
      
      // Reload page after 1.5 seconds to apply changes (favicon, title)
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Error saving general settings:", error);
      setMessage({ type: "error", text: error.message || "Failed to save general settings" });
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: "error", text: "Please enter an API key first" });
      return;
    }

    try {
      setTesting(true);
      setMessage(null);
      const result = await testAiConnection(apiKey.trim());
      if (result.valid) {
        setMessage({ type: "success", text: result.message || "Connection test successful!" });
      } else {
        setMessage({ type: "error", text: result.message || "Connection test failed. Please check your API key." });
      }
    } catch (error: any) {
      console.error("Error testing connection:", error);
      setMessage({ type: "error", text: error.message || "Failed to test connection" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="Settings" onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="flex-1 p-6 sm:p-8 md:p-10">
          <div className="mx-auto flex max-w-4xl flex-col gap-8">
            {/* Settings Tabs */}
            <nav className="flex gap-2 border-b border-white/10">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "general"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("general")}
              >
                General
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "api"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("api")}
              >
                API Integrations
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "account"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("account")}
              >
                Account
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "billing"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("billing")}
              >
                Billing
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "security"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("security")}
              >
                Security
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "theme"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("theme")}
              >
                Theme Colors
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "midtrans"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("midtrans")}
              >
                Midtrans
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "betaTester"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("betaTester")}
              >
                Beta Tester
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "topupPlans"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("topupPlans")}
              >
                Top Up Plans
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "socialMedia"
                    ? "border-b-2 border-primary text-primary"
                    : "text-white/70 hover:text-white"
                }`}
                onClick={() => setActiveTab("socialMedia")}
              >
                Social Media
              </button>
            </nav>

          {/* API Integrations Section */}
          {activeTab === "api" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  API Integrations
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Manage your API keys for third-party service integrations here.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <div className="flex flex-col gap-6">
                  <h3 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">
                    AI Integration
                  </h3>
                  <form onSubmit={handleSaveApiKey} className="flex flex-col gap-4">
                    <div>
                      <label
                        className="block text-sm font-medium text-white/70 mb-2"
                        htmlFor="api-key"
                      >
                        AI API Key
                      </label>
                      <div className="relative">
                        <input
                          className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-10 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors disabled:opacity-50"
                          id="api-key"
                          name="api-key"
                          placeholder="Enter your AI API key"
                          type={showApiKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          disabled={loading || saving}
                        />
                        <button
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white disabled:opacity-50"
                          type="button"
                          onClick={toggleApiKeyVisibility}
                          disabled={loading || saving}
                        >
                          <span className="material-symbols-outlined">
                            {showApiKey ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>
                    {message && (
                      <div
                        className={`p-3 rounded-lg text-sm ${
                          message.type === "success"
                            ? "bg-green-500/20 border border-green-500/50 text-green-400"
                            : "bg-red-500/20 border border-red-500/50 text-red-400"
                        }`}
                      >
                        {message.text}
                      </div>
                    )}
                    <div className="flex items-center justify-start gap-4 pt-2">
                      <button
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        type="submit"
                        disabled={loading || saving}
                      >
                        {saving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          "Save"
                        )}
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-white/70 shadow-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                        onClick={handleTestConnection}
                        disabled={loading || testing || !apiKey.trim()}
                      >
                        {testing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                            Testing...
                          </>
                        ) : (
                          "Test Connection"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          )}

          {/* General Settings Section */}
          {activeTab === "general" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  General Settings
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Configure the main application settings.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <form onSubmit={handleSaveGeneralSettings} className="flex flex-col gap-6">
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="website-name"
                    >
                      Website Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors disabled:opacity-50"
                      id="website-name"
                      name="website-name"
                      type="text"
                      value={generalSettings.websiteName}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, websiteName: e.target.value })}
                      placeholder="Enter website name"
                      disabled={savingGeneral}
                      required
                    />
                    <p className="text-xs text-white/50 mt-1">
                      This name will appear in the browser tab and throughout the website
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="logo"
                    >
                      Logo
                    </label>
                    <div className="flex flex-col gap-3">
                      {logoPreview && (
                        <div className="relative w-32 h-32 rounded-lg border border-white/10 overflow-hidden bg-[#1A1A1A]">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setLogoPreview(null);
                              setLogoFile(null);
                              setGeneralSettings({ ...generalSettings, logoPath: null });
                            }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith("image/")) {
                              setMessage({ type: "error", text: "Please select an image file" });
                              return;
                            }
                            if (file.size > 2 * 1024 * 1024) {
                              setMessage({ type: "error", text: "Logo size must be less than 2MB" });
                              return;
                            }
                            setLogoFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setLogoPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        disabled={savingGeneral}
                        className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-sm text-white file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Recommended: PNG or SVG, max 2MB. Will be displayed in the header
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="favicon"
                    >
                      Favicon
                    </label>
                    <div className="flex flex-col gap-3">
                      {faviconPreview && (
                        <div className="relative w-16 h-16 rounded-lg border border-white/10 overflow-hidden bg-[#1A1A1A]">
                          <img
                            src={faviconPreview}
                            alt="Favicon preview"
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setFaviconPreview(null);
                              setFaviconFile(null);
                              setGeneralSettings({ ...generalSettings, faviconPath: null });
                            }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*,.ico"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith("image/") && !file.name.endsWith(".ico")) {
                              setMessage({ type: "error", text: "Please select an image file or .ico file" });
                              return;
                            }
                            if (file.size > 1 * 1024 * 1024) {
                              setMessage({ type: "error", text: "Favicon size must be less than 1MB" });
                              return;
                            }
                            setFaviconFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFaviconPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        disabled={savingGeneral}
                        className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-sm text-white file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Recommended: ICO, PNG, or SVG, max 1MB. Will be displayed in browser tab
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Watermark on Generated Images
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const currentValue = generalSettings.watermarkEnabled !== undefined ? generalSettings.watermarkEnabled : true;
                          setGeneralSettings({ ...generalSettings, watermarkEnabled: !currentValue });
                        }}
                        disabled={savingGeneral}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] disabled:opacity-50 ${
                          (generalSettings.watermarkEnabled !== undefined ? generalSettings.watermarkEnabled : true)
                            ? "bg-primary"
                            : "bg-white/20"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            (generalSettings.watermarkEnabled !== undefined ? generalSettings.watermarkEnabled : true)
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-white/70">
                        {(generalSettings.watermarkEnabled !== undefined ? generalSettings.watermarkEnabled : true) ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      When enabled, generated images will have "EDITAJA.COM" watermark applied
                    </p>
                  </div>

                  {message && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        message.type === "success"
                          ? "bg-green-500/20 border border-green-500/50 text-green-400"
                          : "bg-red-500/20 border border-red-500/50 text-red-400"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}

                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={savingGeneral}
                    >
                      {savingGeneral ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Settings"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Old General Settings Section - REMOVED */}
          {false && activeTab === "general" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  General Settings
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Configure the main application settings.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <div className="flex flex-col gap-6">
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="app-name"
                    >
                      Application Name
                    </label>
                    <input
                      className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                      id="app-name"
                      name="app-name"
                      type="text"
                      defaultValue="edit Aja"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">Enable Maintenance Mode</p>
                      <p className="text-sm text-white/60">Users will be shown a maintenance page.</p>
                    </div>
                    <button
                      aria-checked={maintenanceMode}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#101022] ${
                        maintenanceMode ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={toggleMaintenanceMode}
                      role="switch"
                      type="button"
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          maintenanceMode ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>
                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
                      type="submit"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Theme Colors Section */}
          {activeTab === "theme" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Theme Colors
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Customize the color scheme of your website. Changes will be applied immediately.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <form onSubmit={handleSaveThemeColors} className="flex flex-col gap-6">
                  {/* Primary Color */}
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="primary-color"
                    >
                      Primary Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        id="primary-color"
                        value={themeColors.primary}
                        onChange={(e) => handleColorChange("primary", e.target.value)}
                        className="w-20 h-12 rounded-lg border border-white/10 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={themeColors.primary}
                        onChange={(e) => handleColorChange("primary", e.target.value)}
                        className="flex-1 rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                        placeholder="#0d0df2"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                      />
                      <div
                        className="w-12 h-12 rounded-lg border border-white/10"
                        style={{ backgroundColor: themeColors.primary }}
                      ></div>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Used for buttons, links, and accent elements
                    </p>
                  </div>

                  {/* Background Light Color */}
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="background-light-color"
                    >
                      Background Light Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        id="background-light-color"
                        value={themeColors.backgroundLight}
                        onChange={(e) => handleColorChange("backgroundLight", e.target.value)}
                        className="w-20 h-12 rounded-lg border border-white/10 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={themeColors.backgroundLight}
                        onChange={(e) => handleColorChange("backgroundLight", e.target.value)}
                        className="flex-1 rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                        placeholder="#f5f5f8"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                      />
                      <div
                        className="w-12 h-12 rounded-lg border border-white/10"
                        style={{ backgroundColor: themeColors.backgroundLight }}
                      ></div>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Used for light mode backgrounds
                    </p>
                  </div>

                  {/* Background Dark Color */}
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="background-dark-color"
                    >
                      Background Dark Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        id="background-dark-color"
                        value={themeColors.backgroundDark}
                        onChange={(e) => handleColorChange("backgroundDark", e.target.value)}
                        className="w-20 h-12 rounded-lg border border-white/10 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={themeColors.backgroundDark}
                        onChange={(e) => handleColorChange("backgroundDark", e.target.value)}
                        className="flex-1 rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                        placeholder="#111118"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                      />
                      <div
                        className="w-12 h-12 rounded-lg border border-white/10"
                        style={{ backgroundColor: themeColors.backgroundDark }}
                      ></div>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Used for dark mode backgrounds
                    </p>
                  </div>

                  {message && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        message.type === "success"
                          ? "bg-green-500/20 border border-green-500/50 text-green-400"
                          : "bg-red-500/20 border border-red-500/50 text-red-400"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}

                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={savingColors}
                    >
                      {savingColors ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Colors"
                      )}
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-white/70 shadow-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
                      type="button"
                      onClick={handleResetColors}
                    >
                      Reset to Default
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Account Settings Section */}
          {activeTab === "account" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Account Settings
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Manage your account information and profile.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setSavingAccount(true);
                    setMessage(null);
                    if (displayName.trim()) {
                      await updateAdminDisplayName(displayName.trim());
                      // Update user state immediately to reflect changes
                      if (auth?.currentUser) {
                        setUser(auth.currentUser);
                      }
                      setMessage({ type: "success", text: "Display name updated successfully!" });
                    }
                  } catch (error: any) {
                    console.error("Error updating display name:", error);
                    setMessage({ type: "error", text: error.message || "Failed to update display name" });
                  } finally {
                    setSavingAccount(false);
                  }
                }} className="flex flex-col gap-6">
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="display-name"
                    >
                      Display Name
                    </label>
                    <input
                      className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                      id="display-name"
                      name="display-name"
                      type="text"
                      placeholder="Enter your display name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={savingAccount}
                    />
                    <p className="text-xs text-white/50 mt-1">
                      This name will be displayed in your admin profile
                    </p>
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="email"
                    >
                      Email
                    </label>
                    <input
                      className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 px-4 text-white/50 cursor-not-allowed"
                      id="email"
                      name="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Email cannot be changed
                    </p>
                  </div>
                  {message && message.type && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        message.type === "success"
                          ? "bg-green-500/20 border border-green-500/50 text-green-400"
                          : "bg-red-500/20 border border-red-500/50 text-red-400"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}
                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={savingAccount || !displayName.trim()}
                    >
                      {savingAccount ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Security Settings Section */}
          {activeTab === "security" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Security Settings
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Change your password to keep your account secure.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (newPassword !== confirmPassword) {
                    setMessage({ type: "error", text: "New passwords do not match" });
                    return;
                  }
                  if (newPassword.length < 6) {
                    setMessage({ type: "error", text: "Password must be at least 6 characters long" });
                    return;
                  }
                  try {
                    setSavingPassword(true);
                    setMessage(null);
                    await updateAdminPassword(currentPassword, newPassword);
                    setMessage({ type: "success", text: "Password updated successfully!" });
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  } catch (error: any) {
                    console.error("Error updating password:", error);
                    setMessage({ type: "error", text: error.message || "Failed to update password" });
                  } finally {
                    setSavingPassword(false);
                  }
                }} className="flex flex-col gap-6">
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="current-password"
                    >
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-10 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                        id="current-password"
                        name="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter your current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={savingPassword}
                        required
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white disabled:opacity-50"
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        disabled={savingPassword}
                      >
                        <span className="material-symbols-outlined">
                          {showCurrentPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="new-password"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-10 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                        id="new-password"
                        name="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter your new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={savingPassword}
                        required
                        minLength={6}
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white disabled:opacity-50"
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={savingPassword}
                      >
                        <span className="material-symbols-outlined">
                          {showNewPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Password must be at least 6 characters long
                    </p>
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="confirm-password"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-10 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors"
                        id="confirm-password"
                        name="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={savingPassword}
                        required
                        minLength={6}
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white disabled:opacity-50"
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={savingPassword}
                      >
                        <span className="material-symbols-outlined">
                          {showConfirmPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>
                  {message && message.type && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        message.type === "success"
                          ? "bg-green-500/20 border border-green-500/50 text-green-400"
                          : "bg-red-500/20 border border-red-500/50 text-red-400"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}
                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {savingPassword ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Midtrans Configuration Section */}
          {activeTab === "midtrans" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Midtrans Payment Gateway
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Configure Midtrans payment gateway for diamond top-ups.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <form onSubmit={handleSaveMidtransConfig} className="flex flex-col gap-6">
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="midtrans-server-key"
                    >
                      Server Key
                    </label>
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-10 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors disabled:opacity-50"
                        id="midtrans-server-key"
                        name="midtrans-server-key"
                        placeholder="Enter your Midtrans Server Key"
                        type={showMidtransServerKey ? "text" : "password"}
                        value={midtransConfig.serverKey}
                        onChange={(e) => setMidtransConfig({ ...midtransConfig, serverKey: e.target.value })}
                        disabled={savingMidtrans}
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white disabled:opacity-50"
                        type="button"
                        onClick={() => setShowMidtransServerKey(!showMidtransServerKey)}
                        disabled={savingMidtrans}
                      >
                        <span className="material-symbols-outlined">
                          {showMidtransServerKey ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Your Midtrans server key (keep this secret)
                    </p>
                  </div>
                  
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="midtrans-client-key"
                    >
                      Client Key
                    </label>
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-10 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors disabled:opacity-50"
                        id="midtrans-client-key"
                        name="midtrans-client-key"
                        placeholder="Enter your Midtrans Client Key"
                        type={showMidtransClientKey ? "text" : "password"}
                        value={midtransConfig.clientKey}
                        onChange={(e) => setMidtransConfig({ ...midtransConfig, clientKey: e.target.value })}
                        disabled={savingMidtrans}
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white disabled:opacity-50"
                        type="button"
                        onClick={() => setShowMidtransClientKey(!showMidtransClientKey)}
                        disabled={savingMidtrans}
                      >
                        <span className="material-symbols-outlined">
                          {showMidtransClientKey ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      Your Midtrans client key (public, used in frontend)
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">Production Mode</p>
                      <p className="text-sm text-white/60">Enable for production, disable for sandbox/testing</p>
                    </div>
                    <button
                      aria-checked={midtransConfig.isProduction}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#101022] ${
                        midtransConfig.isProduction ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setMidtransConfig({ ...midtransConfig, isProduction: !midtransConfig.isProduction })}
                      role="switch"
                      type="button"
                      disabled={savingMidtrans}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          midtransConfig.isProduction ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>
                  
                  {message && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        message.type === "success"
                          ? "bg-green-500/20 border border-green-500/50 text-green-400"
                          : "bg-red-500/20 border border-red-500/50 text-red-400"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={savingMidtrans}
                    >
                      {savingMidtrans ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Configuration"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Beta Tester Section */}
          {activeTab === "betaTester" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Beta Tester Program
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Manage beta tester registration settings and free tokens.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <form onSubmit={handleSaveBetaTesterSettings} className="flex flex-col gap-6">
                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="beta-tester-free-tokens"
                    >
                      Free Tokens for Beta Testers
                    </label>
                    <input
                      className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors disabled:opacity-50"
                      id="beta-tester-free-tokens"
                      name="beta-tester-free-tokens"
                      type="number"
                      min="0"
                      placeholder="Enter free tokens amount"
                      value={betaTesterFreeTokens}
                      onChange={(e) => setBetaTesterFreeTokens(parseInt(e.target.value) || 0)}
                      disabled={savingBetaTester}
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Number of free tokens/diamonds given to users who register as beta testers
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-white/70 mb-2"
                      htmlFor="max-beta-testers"
                    >
                      Max Beta Testers (Optional)
                    </label>
                    <input
                      className="w-full rounded-lg border-white/10 bg-[#1A1A1A] py-2.5 pl-4 pr-4 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary/50 transition-colors disabled:opacity-50"
                      id="max-beta-testers"
                      name="max-beta-testers"
                      type="number"
                      min="0"
                      placeholder="Leave empty for unlimited"
                      value={maxBetaTesters === null ? "" : maxBetaTesters}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMaxBetaTesters(value === "" ? null : parseInt(value) || 0);
                      }}
                      disabled={savingBetaTester}
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Maximum number of users who can register as beta testers. Leave empty for unlimited.
                    </p>
                    {maxBetaTesters !== null && maxBetaTesters > 0 && (
                      <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                        <p className="text-xs text-blue-400">
                          <strong>Current:</strong> {currentBetaTestersCount} / {maxBetaTesters} beta tester{maxBetaTesters !== 1 ? 's' : ''} registered
                          {currentBetaTestersCount >= maxBetaTesters && (
                            <span className="ml-2 text-orange-400">(Full)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">Registration Enabled</p>
                      <p className="text-sm text-white/60">Enable or disable beta tester registration page</p>
                    </div>
                    <button
                      aria-checked={betaTesterRegistrationEnabled}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#101022] ${
                        betaTesterRegistrationEnabled ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setBetaTesterRegistrationEnabled(!betaTesterRegistrationEnabled)}
                      role="switch"
                      type="button"
                      disabled={savingBetaTester}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          betaTesterRegistrationEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>
                  
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
                    <p className="text-sm text-blue-400">
                      <strong>Registration Page:</strong> {betaTesterRegistrationEnabled ? (
                        <a href="/beta-tester" target="_blank" className="underline hover:text-blue-300">
                          /beta-tester
                        </a>
                      ) : (
                        "Disabled"
                      )}
                    </p>
                  </div>
                  
                  {message && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        message.type === "success"
                          ? "bg-green-500/20 border border-green-500/50 text-green-400"
                          : "bg-red-500/20 border border-red-500/50 text-red-400"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={savingBetaTester}
                    >
                      {savingBetaTester ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Settings"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Top Up Plans Section */}
          {activeTab === "topupPlans" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Top Up Plans Management
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Manage diamond top-up packages and pricing for the Top Up Diamonds modal.
                </p>
              </header>
              
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white text-lg font-semibold">Diamond Packages</h3>
                  <button
                    onClick={() => {
                      const newId = `plan_${Date.now()}`;
                      setEditingPlan({
                        id: newId,
                        diamonds: 100,
                        price: 10000,
                        anchorPrice: undefined,
                        bonus: 0,
                        popular: false,
                        order: topupPlans.length + 1,
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/80 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Add New Plan
                  </button>
                </div>

                {topupPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/70 mb-4">No plans configured yet.</p>
                    <button
                      onClick={() => {
                        const newId = `plan_${Date.now()}`;
                        setEditingPlan({
                          id: newId,
                          diamonds: 100,
                          price: 10000,
                          anchorPrice: undefined,
                          bonus: 0,
                          popular: false,
                          order: 1,
                        });
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/80 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">add</span>
                      Create First Plan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topupPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                              <p className="text-xs text-white/50 mb-1">Diamonds</p>
                              <p className="text-white font-semibold">{plan.diamonds}</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/50 mb-1">Price</p>
                              <p className="text-white font-semibold">
                                {new Intl.NumberFormat("id-ID", {
                                  style: "currency",
                                  currency: "IDR",
                                  minimumFractionDigits: 0,
                                }).format(plan.price)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/50 mb-1">Anchor Price</p>
                              <p className="text-white font-semibold">
                                {plan.anchorPrice
                                  ? new Intl.NumberFormat("id-ID", {
                                      style: "currency",
                                      currency: "IDR",
                                      minimumFractionDigits: 0,
                                    }).format(plan.anchorPrice)
                                  : "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/50 mb-1">Bonus</p>
                              <p className="text-white font-semibold">{plan.bonus || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/50 mb-1">Status</p>
                              <div className="flex items-center gap-2">
                                {plan.popular && (
                                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                                    Popular
                                  </span>
                                )}
                                <span className="text-white text-sm">Order: {plan.order || 0}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => setEditingPlan(plan)}
                              className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title="Edit"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm("Are you sure you want to delete this plan?")) {
                                  try {
                                    setDeletingPlanId(plan.id);
                                    await deleteTopupPlan(plan.id);
                                    await loadTopupPlans();
                                    setMessage({ type: "success", text: "Plan deleted successfully!" });
                                  } catch (error: any) {
                                    setMessage({ type: "error", text: error.message || "Failed to delete plan" });
                                  } finally {
                                    setDeletingPlanId(null);
                                  }
                                }
                              }}
                              disabled={deletingPlanId === plan.id}
                              className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {message && (
                  <div
                    className={`mt-4 p-3 rounded-lg text-sm ${
                      message.type === "success"
                        ? "bg-green-500/20 border border-green-500/50 text-green-400"
                        : "bg-red-500/20 border border-red-500/50 text-red-400"
                    }`}
                  >
                    {message.text}
                  </div>
                )}
              </div>

              {/* Edit Plan Modal */}
              {editingPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-2xl rounded-xl bg-[#242424] p-6 shadow-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-white text-xl font-bold">
                        {editingPlan.id.startsWith("plan_") ? "Add New Plan" : "Edit Plan"}
                      </h3>
                      <button
                        onClick={() => setEditingPlan(null)}
                        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          setSavingPlan(true);
                          setMessage(null);
                          await saveTopupPlan(editingPlan);
                          await loadTopupPlans();
                          setEditingPlan(null);
                          setMessage({ type: "success", text: "Plan saved successfully!" });
                        } catch (error: any) {
                          setMessage({ type: "error", text: error.message || "Failed to save plan" });
                        } finally {
                          setSavingPlan(false);
                        }
                      }}
                      className="flex flex-col gap-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Diamonds <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editingPlan.diamonds}
                            onChange={(e) =>
                              setEditingPlan({ ...editingPlan, diamonds: parseInt(e.target.value) || 0 })
                            }
                            className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-4 text-white focus:border-primary focus:ring-primary"
                            required
                            disabled={savingPlan}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Price (IDR) <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editingPlan.price}
                            onChange={(e) =>
                              setEditingPlan({ ...editingPlan, price: parseInt(e.target.value) || 0 })
                            }
                            className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-4 text-white focus:border-primary focus:ring-primary"
                            required
                            disabled={savingPlan}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Anchor Price (IDR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editingPlan.anchorPrice || ""}
                            onChange={(e) =>
                              setEditingPlan({
                                ...editingPlan,
                                anchorPrice: e.target.value ? parseInt(e.target.value) : undefined,
                              })
                            }
                            className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-4 text-white focus:border-primary focus:ring-primary"
                            placeholder="Optional"
                            disabled={savingPlan}
                          />
                          <p className="text-xs text-white/50 mt-1">Original price before discount</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Bonus Diamonds</label>
                          <input
                            type="number"
                            min="0"
                            value={editingPlan.bonus || 0}
                            onChange={(e) =>
                              setEditingPlan({ ...editingPlan, bonus: parseInt(e.target.value) || 0 })
                            }
                            className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-4 text-white focus:border-primary focus:ring-primary"
                            disabled={savingPlan}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Order</label>
                          <input
                            type="number"
                            min="0"
                            value={editingPlan.order || 0}
                            onChange={(e) =>
                              setEditingPlan({ ...editingPlan, order: parseInt(e.target.value) || 0 })
                            }
                            className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-4 text-white focus:border-primary focus:ring-primary"
                            disabled={savingPlan}
                          />
                          <p className="text-xs text-white/50 mt-1">Display order (lower = first)</p>
                        </div>
                        <div className="flex items-center justify-between pt-6">
                          <div>
                            <p className="font-medium text-white">Popular Badge</p>
                            <p className="text-sm text-white/60">Mark as popular plan</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingPlan({ ...editingPlan, popular: !editingPlan.popular })}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                              editingPlan.popular ? "bg-primary" : "bg-white/20"
                            }`}
                            disabled={savingPlan}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                                editingPlan.popular ? "translate-x-5" : "translate-x-0"
                              }`}
                            ></span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setEditingPlan(null)}
                          disabled={savingPlan}
                          className="px-4 py-2 rounded-lg border border-white/10 bg-[#1A1A1A] text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingPlan}
                          className="px-6 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingPlan ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Saving...
                            </>
                          ) : (
                            "Save Plan"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Social Media Settings Section */}
          {activeTab === "socialMedia" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Social Media Sharing
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  Enable or disable social media platforms for sharing generated images. Share messages will include editaja.com domain.
                </p>
              </header>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                <form onSubmit={handleSaveSocialMediaSettings} className="flex flex-col gap-6">
                  {/* Facebook */}
                  <div className="flex items-center justify-between py-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                        <span className="text-blue-400 font-bold text-lg">f</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">Facebook</p>
                        <p className="text-sm text-white/60">Enable Facebook sharing</p>
                      </div>
                    </div>
                    <button
                      aria-checked={socialMediaSettings.facebook}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] ${
                        socialMediaSettings.facebook ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setSocialMediaSettings({ ...socialMediaSettings, facebook: !socialMediaSettings.facebook })}
                      role="switch"
                      type="button"
                      disabled={savingSocialMedia}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          socialMediaSettings.facebook ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* Twitter */}
                  <div className="flex items-center justify-between py-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                        <span className="text-sky-400 font-bold text-lg">𝕏</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">Twitter / X</p>
                        <p className="text-sm text-white/60">Enable Twitter/X sharing</p>
                      </div>
                    </div>
                    <button
                      aria-checked={socialMediaSettings.twitter}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] ${
                        socialMediaSettings.twitter ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setSocialMediaSettings({ ...socialMediaSettings, twitter: !socialMediaSettings.twitter })}
                      role="switch"
                      type="button"
                      disabled={savingSocialMedia}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          socialMediaSettings.twitter ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* WhatsApp */}
                  <div className="flex items-center justify-between py-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <span className="text-green-400 font-bold text-lg">WA</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">WhatsApp</p>
                        <p className="text-sm text-white/60">Enable WhatsApp sharing</p>
                      </div>
                    </div>
                    <button
                      aria-checked={socialMediaSettings.whatsapp}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] ${
                        socialMediaSettings.whatsapp ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setSocialMediaSettings({ ...socialMediaSettings, whatsapp: !socialMediaSettings.whatsapp })}
                      role="switch"
                      type="button"
                      disabled={savingSocialMedia}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          socialMediaSettings.whatsapp ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* Telegram */}
                  <div className="flex items-center justify-between py-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-400/20 flex items-center justify-center">
                        <span className="text-blue-300 font-bold text-lg">TG</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">Telegram</p>
                        <p className="text-sm text-white/60">Enable Telegram sharing</p>
                      </div>
                    </div>
                    <button
                      aria-checked={socialMediaSettings.telegram}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] ${
                        socialMediaSettings.telegram ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setSocialMediaSettings({ ...socialMediaSettings, telegram: !socialMediaSettings.telegram })}
                      role="switch"
                      type="button"
                      disabled={savingSocialMedia}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          socialMediaSettings.telegram ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* LinkedIn */}
                  <div className="flex items-center justify-between py-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-700/20 flex items-center justify-center">
                        <span className="text-blue-500 font-bold text-lg">in</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">LinkedIn</p>
                        <p className="text-sm text-white/60">Enable LinkedIn sharing</p>
                      </div>
                    </div>
                    <button
                      aria-checked={socialMediaSettings.linkedin}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] ${
                        socialMediaSettings.linkedin ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setSocialMediaSettings({ ...socialMediaSettings, linkedin: !socialMediaSettings.linkedin })}
                      role="switch"
                      type="button"
                      disabled={savingSocialMedia}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          socialMediaSettings.linkedin ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* Pinterest */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                        <span className="text-red-400 font-bold text-lg">P</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">Pinterest</p>
                        <p className="text-sm text-white/60">Enable Pinterest sharing</p>
                      </div>
                    </div>
                    <button
                      aria-checked={socialMediaSettings.pinterest}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] ${
                        socialMediaSettings.pinterest ? "bg-primary" : "bg-white/20"
                      }`}
                      onClick={() => setSocialMediaSettings({ ...socialMediaSettings, pinterest: !socialMediaSettings.pinterest })}
                      role="switch"
                      type="button"
                      disabled={savingSocialMedia}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          socialMediaSettings.pinterest ? "translate-x-5" : "translate-x-0"
                        }`}
                      ></span>
                    </button>
                  </div>

                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 mt-4">
                    <p className="text-sm text-blue-400">
                      <strong>Note:</strong> Share messages will automatically include "editaja.com" domain. Only enabled platforms will appear in the share options.
                    </p>
                  </div>

                  {message && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        message.type === "success"
                          ? "bg-green-500/20 border border-green-500/50 text-green-400"
                          : "bg-red-500/20 border border-red-500/50 text-red-400"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}

                  <div className="flex items-center justify-start gap-4 pt-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={savingSocialMedia}
                    >
                      {savingSocialMedia ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        "Save Settings"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Placeholder for other tabs */}
          {activeTab !== "api" && activeTab !== "general" && activeTab !== "theme" && activeTab !== "account" && activeTab !== "security" && activeTab !== "midtrans" && activeTab !== "betaTester" && activeTab !== "topupPlans" && activeTab !== "socialMedia" && (
            <section className="flex flex-col gap-6">
              <header>
                <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  {activeTab === "billing" ? "Billing Settings" : "Settings"}
                </h2>
                <p className="text-white/60 text-base font-normal leading-normal pt-1">
                  This section is under development.
                </p>
              </header>
            </section>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
