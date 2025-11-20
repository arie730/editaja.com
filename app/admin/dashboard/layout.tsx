import type { Metadata } from "next";
import ProtectedRoute from "@/app/components/ProtectedRoute";

export const metadata: Metadata = {
  title: "edit Aja - Admin Dashboard",
  description: "Admin Dashboard for edit Aja",
};

export default function AdminDashboardLayout({
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
