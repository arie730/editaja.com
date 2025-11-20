"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getThemeColors, ThemeColors } from "@/lib/settings";

interface ThemeContextType {
  colors: ThemeColors;
  loading: boolean;
  refreshColors: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: {
    primary: "#0d0df2",
    backgroundLight: "#f5f5f8",
    backgroundDark: "#111118",
  },
  loading: true,
  refreshColors: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [colors, setColors] = useState<ThemeColors>({
    primary: "#0d0df2",
    backgroundLight: "#f5f5f8",
    backgroundDark: "#111118",
  });
  const [loading, setLoading] = useState(true);

  const applyThemeColors = (themeColors: ThemeColors) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--color-primary", themeColors.primary);
      root.style.setProperty("--color-background-light", themeColors.backgroundLight);
      root.style.setProperty("--color-background-dark", themeColors.backgroundDark);
    }
  };

  const loadThemeColors = async () => {
    try {
      setLoading(true);
      const themeColors = await getThemeColors();
      if (themeColors) {
        setColors(themeColors);
        applyThemeColors(themeColors);
      } else {
        // Apply default colors
        applyThemeColors(colors);
      }
    } catch (error) {
      console.error("Error loading theme colors:", error);
      // Apply default colors on error
      applyThemeColors(colors);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemeColors();
  }, []);

  const refreshColors = async () => {
    await loadThemeColors();
  };

  return (
    <ThemeContext.Provider value={{ colors, loading, refreshColors }}>
      {children}
    </ThemeContext.Provider>
  );
};





