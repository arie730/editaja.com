"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { useGeneralSettings } from "@/app/components/GeneralSettingsProvider";
import { getUnreadFeedbackCount } from "@/lib/feedback";
import Image from "next/image";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { settings: generalSettings } = useGeneralSettings();
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState<number>(0);
  
  // Get display name or fallback to email username
  const displayName = user?.displayName || (user?.email ? user.email.split("@")[0] : loading ? "Loading..." : "Admin");

  // Load unread feedback count
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadFeedbackCount();
        setUnreadFeedbackCount(count);
      } catch (error) {
        console.error("Error loading unread feedback count:", error);
        setUnreadFeedbackCount(0);
      }
    };

    // Load immediately
    loadUnreadCount();

    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const menuItems = [
    {
      href: "/admin/dashboard",
      icon: "dashboard",
      label: "Dashboard",
    },
    {
      href: "/admin/users",
      icon: "group",
      label: "Users",
    },
    {
      href: "/admin/billing",
      icon: "account_balance_wallet",
      label: "Billing",
    },
    {
      href: "/admin/styles",
      icon: "palette",
      label: "Styles",
    },
    {
      href: "/admin/analytics",
      icon: "analytics",
      label: "Analytics",
    },
    {
      href: "/admin/gallery",
      icon: "gallery_thumbnail",
      label: "Image Gallery",
    },
    {
      href: "/admin/topups",
      icon: "payments",
      label: "Top-ups",
    },
    {
      href: "/admin/feedback",
      icon: "feedback",
      label: "Feedback",
    },
    {
      href: "/admin/settings",
      icon: "settings",
      label: "Settings",
    },
  ];

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay - only show when sidebar is open on mobile */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-[#111118] p-4 min-h-screen transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-3">
          {generalSettings?.logoPath ? (
            <div className="relative h-8 w-auto">
              <Image
                src={generalSettings.logoPath}
                alt={generalSettings.websiteName || "Logo"}
                width={120}
                height={32}
                className="h-8 w-auto object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="size-8 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor"></path>
              </svg>
            </div>
          )}
          <h1 className="text-white text-lg font-bold">
            {generalSettings?.websiteName || "edit Aja"}
          </h1>
        </div>

        {/* Navigation */}
        <div className="mt-4 flex flex-col justify-between flex-1">
          <nav className="flex flex-col gap-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors relative ${
                  isActive(item.href)
                    ? "bg-primary/20 text-primary"
                    : "text-white/70 hover:bg-white/5"
                }`}
                href={item.href}
                onClick={handleLinkClick}
              >
                <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                <p className="text-sm font-medium flex-1">{item.label}</p>
                {/* Badge for unread feedback */}
                {item.href === "/admin/feedback" && unreadFeedbackCount > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {unreadFeedbackCount > 99 ? "99+" : unreadFeedbackCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* User Profile */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
                  style={{
                    backgroundImage: `url("${user.photoURL}")`,
                  }}
                />
              ) : (
                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white/20">
                  <span className="text-white text-sm font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <h1 className="text-white text-base font-medium leading-normal truncate">{displayName}</h1>
                <p className="text-white/50 text-sm font-normal leading-normal">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

