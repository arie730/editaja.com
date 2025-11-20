"use client";

import { useEffect } from "react";

export default function MaterialSymbolsFont() {
  useEffect(() => {
    // Check if link already exists
    const existingLink = document.querySelector(
      'link[href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"]'
    );
    
    if (!existingLink) {
      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  return null;
}
