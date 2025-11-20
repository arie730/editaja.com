"use client";

import { useEffect } from "react";
import { useGeneralSettings } from "./GeneralSettingsProvider";

export default function DynamicHead() {
  const { settings, loading } = useGeneralSettings();

  useEffect(() => {
    if (loading || !settings) return;

    // Update page title
    if (settings.websiteName) {
      document.title = `${settings.websiteName} - AI Image Generator`;
    }

    // Update or create favicon
    if (settings.faviconPath) {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      existingFavicons.forEach((link) => link.remove());

      // Add new favicon
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = settings.faviconPath.endsWith(".ico") ? "image/x-icon" : "image/png";
      link.href = settings.faviconPath;
      document.head.appendChild(link);
    }
  }, [settings, loading]);

  return null;
}



