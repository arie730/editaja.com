import type { Metadata } from "next";
import ProtectedRoute from "@/app/components/ProtectedRoute";

export const metadata: Metadata = {
  title: "edit Aja - Settings",
  description: "Settings for edit Aja admin",
};

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedRoute requireAdmin={true}>
      {children}
    </ProtectedRoute>
  );
}
