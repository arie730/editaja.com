"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import { getAnalyticsData, AnalyticsData } from "@/lib/analytics";

declare global {
  interface Window {
    Chart: any;
  }
}

export default function AdminAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<"7days" | "30days" | "90days" | "all">("30days");
  const dailyChartRef = useRef<HTMLCanvasElement>(null);
  const popularChartRef = useRef<HTMLCanvasElement>(null);
  const locationChartRef = useRef<HTMLCanvasElement>(null);
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyChart, setDailyChart] = useState<any>(null);
  const [popularChart, setPopularChart] = useState<any>(null);
  const [locationChart, setLocationChart] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnalyticsData(selectedPeriod);
        setAnalyticsData(data);
      } catch (err: any) {
        console.error("Error loading analytics:", err);
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [selectedPeriod]);

  useEffect(() => {
    // Check if Chart.js is already loaded
    if (window.Chart) {
      setChartsLoaded(true);
      return;
    }

    // Load Chart.js
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js";
    script.async = true;
    script.onload = () => {
      setChartsLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load Chart.js");
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Update charts when data or period changes
  useEffect(() => {
    if (!chartsLoaded || !analyticsData) return;

    const Chart = window.Chart;
    Chart.defaults.color = "rgba(255, 255, 255, 0.5)";
    Chart.defaults.borderColor = "rgba(255, 255, 255, 0.1)";
    Chart.defaults.font.family = "'Space Grotesk', 'sans-serif'";

    // Destroy existing charts
    if (dailyChart) dailyChart.destroy();
    if (popularChart) popularChart.destroy();
    if (locationChart) locationChart.destroy();

    // Format dates for daily chart
    const dailyLabels = analyticsData.dailyGenerations.map((item) => {
      const date = new Date(item.date);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
    const dailyData = analyticsData.dailyGenerations.map((item) => item.count);

    // Daily Generations Chart
    if (dailyChartRef.current) {
      const dailyCtx = dailyChartRef.current.getContext("2d");
      const newDailyChart = new Chart(dailyCtx, {
        type: "line",
        data: {
          labels: dailyLabels,
          datasets: [
            {
              label: "Generations",
              data: dailyData,
              borderColor: "#0d0df2",
              backgroundColor: "rgba(13, 13, 242, 0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#0d0df2",
              pointBorderColor: "#fff",
              pointHoverRadius: 7,
              pointHoverBackgroundColor: "#fff",
              pointHoverBorderColor: "#0d0df2",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: "rgba(255, 255, 255, 0.1)",
              },
            },
            x: {
              grid: {
                display: false,
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      });
      setDailyChart(newDailyChart);
    }

    // Popular Styles Chart
    if (popularChartRef.current) {
      const popularCtx = popularChartRef.current.getContext("2d");
      const styleLabels = analyticsData.popularStyles.map((item) => item.styleName);
      const styleData = analyticsData.popularStyles.map((item) => item.count);
      
      const newPopularChart = new Chart(popularCtx, {
        type: "bar",
        data: {
          labels: styleLabels,
          datasets: [
            {
              label: "Uses",
              data: styleData,
              backgroundColor: [
                "rgba(13, 13, 242, 0.7)",
                "rgba(13, 13, 242, 0.6)",
                "rgba(13, 13, 242, 0.5)",
                "rgba(13, 13, 242, 0.4)",
                "rgba(13, 13, 242, 0.3)",
                "rgba(13, 13, 242, 0.25)",
                "rgba(13, 13, 242, 0.2)",
                "rgba(13, 13, 242, 0.15)",
                "rgba(13, 13, 242, 0.1)",
                "rgba(13, 13, 242, 0.05)",
              ],
              borderColor: "#0d0df2",
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true,
              grid: {
                color: "rgba(255, 255, 255, 0.1)",
              },
            },
            y: {
              grid: {
                display: false,
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      });
      setPopularChart(newPopularChart);
    }

    // User Locations Chart
    if (locationChartRef.current && analyticsData.userLocations.length > 0) {
      const locationCtx = locationChartRef.current.getContext("2d");
      const locationLabels = analyticsData.userLocations.map((item) => item.country);
      const locationData = analyticsData.userLocations.map((item) => item.count);
      
      const newLocationChart = new Chart(locationCtx, {
        type: "doughnut",
        data: {
          labels: locationLabels,
          datasets: [
            {
              label: "Users",
              data: locationData,
              backgroundColor: [
                "rgba(13, 13, 242, 0.8)",
                "rgba(13, 13, 242, 0.7)",
                "rgba(13, 13, 242, 0.6)",
                "rgba(13, 13, 242, 0.5)",
                "rgba(13, 13, 242, 0.4)",
                "rgba(13, 13, 242, 0.3)",
                "rgba(13, 13, 242, 0.2)",
                "rgba(13, 13, 242, 0.15)",
                "rgba(13, 13, 242, 0.1)",
                "rgba(13, 13, 242, 0.05)",
              ],
              borderColor: "#0d0df2",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "rgba(255, 255, 255, 0.7)",
                padding: 15,
                font: {
                  size: 12,
                },
              },
            },
          },
        },
      });
      setLocationChart(newLocationChart);
    }

    return () => {
      if (dailyChart) dailyChart.destroy();
      if (popularChart) popularChart.destroy();
      if (locationChart) locationChart.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartsLoaded, analyticsData]);

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="Analytics" onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="flex-1 p-6 md:p-10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-white">Dashboard Overview</h3>
            <div className="relative">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as "7days" | "30days" | "90days" | "all")}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#242424]/40 px-4 py-2 text-sm text-white/70 hover:bg-white/5 appearance-none pr-10 cursor-pointer"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none text-xl">
                expand_more
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/20 p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading analytics...</p>
              </div>
            </div>
          ) : analyticsData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <span className="material-symbols-outlined text-3xl">auto_awesome</span>
                    </div>
                    <div>
                      <p className="text-sm text-white/50">Total Generations</p>
                      <p className="text-3xl font-bold text-white">
                        {analyticsData.totalGenerations.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <span className="material-symbols-outlined text-3xl">person</span>
                    </div>
                    <div>
                      <p className="text-sm text-white/50">Unique Users</p>
                      <p className="text-3xl font-bold text-white">
                        {analyticsData.totalUsers.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <span className="material-symbols-outlined text-3xl">trending_up</span>
                    </div>
                    <div>
                      <p className="text-sm text-white/50">Growth Rate</p>
                      <p className="text-3xl font-bold text-white">
                        {analyticsData.growthRate >= 0 ? "+" : ""}
                        {analyticsData.growthRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {analyticsData && (
            <>
              <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6 mb-8">
                <h4 className="text-lg font-semibold text-white mb-4">Daily Generations Over Time</h4>
                <div className="h-80">
                  {analyticsData.dailyGenerations.length > 0 ? (
                    <canvas ref={dailyChartRef} id="dailyGenerationsChart"></canvas>
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/50">
                      No data available for selected period
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Most Popular Styles</h4>
                  <div className="h-80">
                    {analyticsData.popularStyles.length > 0 ? (
                      <canvas ref={popularChartRef} id="popularStylesChart"></canvas>
                    ) : (
                      <div className="flex items-center justify-center h-full text-white/50">
                        No style data available
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Top Active Users</h4>
                  <div className="space-y-4">
                    {analyticsData.topUsers.length > 0 ? (
                      analyticsData.topUsers.map((user, index) => {
                        const maxCount = analyticsData.topUsers[0]?.count || 1;
                        const percentage = (user.count / maxCount) * 100;
                        return (
                          <div key={user.userId} className="flex items-center">
                            <div className="w-full bg-[#111118] rounded-full h-2.5">
                              <div
                                className="bg-primary h-2.5 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="ml-4 min-w-[150px] text-right">
                              <p className="text-sm font-medium text-white truncate">{user.email}</p>
                              <p className="text-xs text-white/50">
                                {user.count.toLocaleString()} generation{user.count !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-white/50">No user data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* User Locations Chart */}
              {analyticsData.userLocations.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#242424]/40 p-6 mb-8">
                  <h4 className="text-lg font-semibold text-white mb-4">User Locations</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-80">
                      <canvas ref={locationChartRef} id="userLocationsChart"></canvas>
                    </div>
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-white/70 mb-4">Top Countries</h5>
                      {analyticsData.userLocations.map((location, index) => (
                        <div key={location.country} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-primary">#{index + 1}</span>
                            <span className="text-sm text-white/90">{location.country}</span>
                          </div>
                          <span className="text-sm font-medium text-white">
                            {location.count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
