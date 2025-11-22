"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import { getDashboardStats, getRecentGenerations, getPopularStyles } from "@/lib/dashboard";
import { subscribeToActiveVisitors } from "@/lib/visitors";
import { getUsers } from "@/lib/users";

interface DashboardStats {
  totalUsers: number;
  dailyGenerations: number;
  activeStyles: number;
  activeVisitors: number;
  todayVisitors: number;
  totalGenerations: number;
  conversionRate: number;
}

interface RecentGeneration {
  id: string;
  userId: string;
  styleName: string;
  createdAt: Date | any;
}

interface PopularStyle {
  name: string;
  count: number;
}

export default function AdminDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("7days");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentGenerations, setRecentGenerations] = useState<RecentGeneration[]>([]);
  const [popularStyles, setPopularStyles] = useState<PopularStyle[]>([]);

  // Load dashboard stats
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [dashboardStats, recent, popular] = await Promise.all([
          getDashboardStats(),
          getRecentGenerations(5),
          getPopularStyles(5),
        ]);
        setStats(dashboardStats);
        setRecentGenerations(recent);
        setPopularStyles(popular);
      } catch (error: any) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();

    // OPTIMIZED: Refresh every 2 minutes instead of 30 seconds to reduce quota usage
    // Dashboard doesn't need to update every 30 seconds
    const interval = setInterval(loadDashboard, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, []);

  // Subscribe to active visitors (real-time)
  useEffect(() => {
    const unsubscribe = subscribeToActiveVisitors((count) => {
      setActiveVisitors(count);
      if (stats) {
        setStats({ ...stats, activeVisitors: count });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [stats]);

  const formatTimeAgo = (date: Date | any): string => {
    if (!date) return "Unknown";
    
    const createdAt = date instanceof Date
      ? date
      : (date && typeof date.toDate === "function"
        ? date.toDate()
        : new Date(0));
    
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="flex-1 p-6 md:p-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-2 rounded-xl bg-[#242424]/40 p-6 border border-white/10">
                  <p className="text-white/70 text-base font-medium leading-normal">Total Users</p>
                  <p className="text-white tracking-light text-2xl font-bold leading-tight">
                    {stats?.totalUsers.toLocaleString() || "0"}
                  </p>
                  <p className="text-[#2ECC71] text-sm font-medium leading-normal">
                    Registered users
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-[#242424]/40 p-6 border border-white/10">
                  <p className="text-white/70 text-base font-medium leading-normal">Daily Generations</p>
                  <p className="text-white tracking-light text-2xl font-bold leading-tight">
                    {stats?.dailyGenerations.toLocaleString() || "0"}
                  </p>
                  <p className="text-[#2ECC71] text-sm font-medium leading-normal">
                    Today's generations
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-[#242424]/40 p-6 border border-white/10">
                  <p className="text-white/70 text-base font-medium leading-normal">Active Styles</p>
                  <p className="text-white tracking-light text-2xl font-bold leading-tight">
                    {stats?.activeStyles || "0"}
                  </p>
                  <p className="text-[#2ECC71] text-sm font-medium leading-normal">
                    Available styles
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-[#242424]/40 p-6 border border-white/10 relative">
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Live
                    </span>
                  </div>
                  <p className="text-white/70 text-base font-medium leading-normal">Active Visitors</p>
                  <p className="text-white tracking-light text-2xl font-bold leading-tight">
                    {activeVisitors || stats?.activeVisitors || "0"}
                  </p>
                  <p className="text-[#2ECC71] text-sm font-medium leading-normal">
                    Last 5 minutes
                  </p>
                </div>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
                <div className="flex flex-col gap-2 rounded-xl bg-[#242424]/40 p-6 border border-white/10">
                  <p className="text-white/70 text-base font-medium leading-normal">Today's Visitors</p>
                  <p className="text-white tracking-light text-2xl font-bold leading-tight">
                    {stats?.todayVisitors.toLocaleString() || "0"}
                  </p>
                  <p className="text-white/50 text-sm font-medium leading-normal">
                    Unique visitors today
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-[#242424]/40 p-6 border border-white/10">
                  <p className="text-white/70 text-base font-medium leading-normal">Total Generations</p>
                  <p className="text-white tracking-light text-2xl font-bold leading-tight">
                    {stats?.totalGenerations.toLocaleString() || "0"}
                  </p>
                  <p className="text-white/50 text-sm font-medium leading-normal">
                    All time
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-[#242424]/40 p-6 border border-white/10">
                  <p className="text-white/70 text-base font-medium leading-normal">Conversion Rate</p>
                  <p className="text-white tracking-light text-2xl font-bold leading-tight">
                    {stats?.conversionRate.toFixed(1) || "0.0"}%
                  </p>
                  <p className="text-white/50 text-sm font-medium leading-normal">
                    Visitors to generations
                  </p>
                </div>
              </div>

              {/* Recent Activity & Popular Styles */}
              <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Recent Activity */}
                <div className="flex flex-col rounded-xl border border-white/10 bg-[#242424]/40">
                  <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-6 pb-3 pt-5 border-b border-white/10">
                    Recent Activity
                  </h2>
                  <ul className="flex flex-col divide-y divide-white/10 p-2">
                    {recentGenerations.length === 0 ? (
                      <li className="flex items-center justify-center p-8">
                        <p className="text-white/50 text-sm">No recent activity</p>
                      </li>
                    ) : (
                      recentGenerations.map((gen) => (
                        <li key={gen.id} className="flex items-center gap-4 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                            <span className="material-symbols-outlined text-primary">auto_awesome</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-white text-sm">
                              Style <span className="font-bold">{gen.styleName}</span> used by{" "}
                              <span className="font-bold">
                                {gen.userId === "anonymous" ? "Anonymous" : gen.userId.substring(0, 8)}...
                              </span>
                            </p>
                            <p className="text-white/50 text-xs">{formatTimeAgo(gen.createdAt)}</p>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                {/* Popular Styles Table */}
                <div className="flex flex-col rounded-xl border border-white/10 bg-[#242424]/40">
                  <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-6 pb-3 pt-5 border-b border-white/10">
                    Popular Styles
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-white/10 text-white/50">
                        <tr>
                          <th className="px-6 py-3 font-medium">Style Name</th>
                          <th className="px-6 py-3 font-medium">Total Generations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {popularStyles.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-6 py-8 text-center text-white/50">
                              No data available
                            </td>
                          </tr>
                        ) : (
                          popularStyles.map((style, index) => (
                            <tr
                              key={style.name}
                              className={index < popularStyles.length - 1 ? "border-b border-white/10" : ""}
                            >
                              <td className="px-6 py-4 font-medium text-white">{style.name}</td>
                              <td className="px-6 py-4 text-white/80">{style.count.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
