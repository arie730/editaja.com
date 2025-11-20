"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { getGeneralSettings, GeneralSettings } from "@/lib/settings";

interface GeneralSettingsContextType {
  settings: GeneralSettings | null;
  loading: boolean;
  refreshSettings?: () => Promise<void>;
}

export const GeneralSettingsContext = createContext<GeneralSettingsContextType>({
  settings: null,
  loading: true,
  refreshSettings: undefined,
});

export const useGeneralSettings = () => useContext(GeneralSettingsContext);

export default function GeneralSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Expose refresh function via context
  const refreshSettings = async () => {
    try {
      setLoading(true);
      const generalSettings = await getGeneralSettings();
      setSettings(generalSettings);
    } catch (error) {
      console.error("Error loading general settings:", error);
      // Set default settings on error
      setSettings({
        websiteName: "edit Aja",
        logoPath: null,
        faviconPath: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, [refreshKey]);

  // Listen for storage event to refresh when settings are updated in another tab
  useEffect(() => {
    const handleStorageChange = () => {
      setRefreshKey((prev) => prev + 1);
    };

    window.addEventListener("storage", handleStorageChange);
    // Also listen for custom event for same-tab updates
    window.addEventListener("generalSettingsUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("generalSettingsUpdated", handleStorageChange);
    };
  }, []);

  return (
    <GeneralSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </GeneralSettingsContext.Provider>
  );
}

