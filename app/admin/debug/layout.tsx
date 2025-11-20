import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "edit Aja - Admin Debug",
  description: "Admin debug tool for edit Aja",
};

export default function AdminDebugLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}







