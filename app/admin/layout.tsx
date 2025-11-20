import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "edit Aja - Admin Login",
  description: "Admin login page for edit Aja",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}

