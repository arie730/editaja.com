import { Metadata } from "next";
import ProtectedRoute from "@/app/components/ProtectedRoute";

export const metadata: Metadata = {
  title: "Feedback Management - edit Aja Admin",
  description: "Manage user feedback",
};

export default function FeedbackLayout({
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



