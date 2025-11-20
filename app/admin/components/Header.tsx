"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useAuth } from "@/app/contexts/AuthContext";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/admin");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <header className="flex h-[73px] items-center justify-between whitespace-nowrap border-b border-solid border-white/10 px-4 md:px-10 py-3 bg-[#101022]">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
          aria-label="Toggle menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">{title}</h2>
      </div>
      <div className="flex flex-1 justify-end gap-4 items-center">
        <button className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-2xl">notifications</span>
        </button>
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
            title="Logout"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
        <div
          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
          style={{
            backgroundImage:
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDmmCv6Zu4MlFqEhqU3hk08U_0VYAIEIRi3se_5OUMITJE7tSr_6XYtME9SEtnTcP4OjomZ3JHbrlirUcq3VWjb_JN_FKTN48HbiBCrIivHX8t0VOLO1wiK7ttCxt7vrBPtWmY0mYZKnoE-x9ExMWPoem6HRcbuBBV5SAhmozExmARv42tffNU371cirseF28qIycZ7f502vw1zKQgTLV2ZhLcEnsivMpsQbA7t8xCYegq4IQGjf_W7Rc5JraeRBVY4eaNU3VYM-g")',
          }}
        />
      </div>
    </header>
  );
}

