"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useAuth } from "@/app/contexts/AuthContext";

export default function LogoutButton() {
  const router = useRouter();
  const { setUser, setIsAdmin } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setIsAdmin(false);
      router.push("/admin");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 px-3 py-2 text-white/70 hover:bg-white/5 rounded-lg"
    >
      <span className="material-symbols-outlined text-2xl">logout</span>
      <p className="text-sm font-medium">Logout</p>
    </button>
  );
}







