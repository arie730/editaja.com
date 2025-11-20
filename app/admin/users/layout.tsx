import type { Metadata } from "next";
import ProtectedRoute from "@/app/components/ProtectedRoute";

export const metadata: Metadata = {
  title: "edit Aja - Users",
  description: "User management for edit Aja admin",
};

export default function UsersLayout({
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
