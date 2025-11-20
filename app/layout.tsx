import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import MaterialSymbolsFont from "./components/MaterialSymbolsFont";
import AuthWrapper from "./components/AuthWrapper";
import GeneralSettingsProvider from "./components/GeneralSettingsProvider";
import DynamicHead from "./components/DynamicHead";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap", // Optimize font loading
  preload: true,
});

export const metadata: Metadata = {
  title: "edit Aja - AI Image Generator",
  description: "AI Image Generator - Transform your images with various styles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} font-display antialiased bg-background-light dark:bg-background-dark text-[#EAEAEA]`}
      >
        <MaterialSymbolsFont />
        <AuthWrapper>
          <GeneralSettingsProvider>
            <DynamicHead />
            {children}
          </GeneralSettingsProvider>
        </AuthWrapper>
      </body>
    </html>
  );
}
