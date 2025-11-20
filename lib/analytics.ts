import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { getGenerations } from "./generations";
import { getUsersWithGenerationCount } from "./users";

export interface AnalyticsData {
  totalGenerations: number;
  totalUsers: number;
  averageGenerationsPerUser: number;
  dailyGenerations: { date: string; count: number }[];
  popularStyles: { styleName: string; count: number }[];
  topUsers: { userId: string; email: string; count: number }[];
  userLocations: { country: string; count: number }[];
  growthRate: number;
}

// Get analytics data
export const getAnalyticsData = async (period: "7days" | "30days" | "90days" | "all" = "30days"): Promise<AnalyticsData> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const [generations, users] = await Promise.all([
      getGenerations(),
      getUsersWithGenerationCount(),
    ]);

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Filter generations by date
    const filteredGenerations = generations.filter((gen) => {
      const createdAt = gen.createdAt instanceof Date 
        ? gen.createdAt 
        : (gen.createdAt && typeof gen.createdAt.toDate === "function" 
          ? gen.createdAt.toDate() 
          : new Date(0));
      return createdAt >= startDate;
    });

    // Total generations
    const totalGenerations = filteredGenerations.length;

    // Total users
    const totalUsers = users.length;

    // Average generations per user
    const averageGenerationsPerUser = totalUsers > 0 ? totalGenerations / totalUsers : 0;

    // Daily generations
    const dailyGenerationsMap = new Map<string, number>();
    filteredGenerations.forEach((gen) => {
      const createdAt = gen.createdAt instanceof Date 
        ? gen.createdAt 
        : (gen.createdAt && typeof gen.createdAt.toDate === "function" 
          ? gen.createdAt.toDate() 
          : new Date(0));
      const dateKey = createdAt.toISOString().split("T")[0];
      dailyGenerationsMap.set(dateKey, (dailyGenerationsMap.get(dateKey) || 0) + 1);
    });
    
    const dailyGenerations = Array.from(dailyGenerationsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days

    // Popular styles
    const styleCounts = new Map<string, number>();
    filteredGenerations.forEach((gen) => {
      if (gen.styleName) {
        styleCounts.set(gen.styleName, (styleCounts.get(gen.styleName) || 0) + 1);
      }
    });
    
    const popularStyles = Array.from(styleCounts.entries())
      .map(([styleName, count]) => ({ styleName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    // Top users
    const topUsers = users
      .sort((a, b) => (b.totalGenerations || 0) - (a.totalGenerations || 0))
      .slice(0, 10)
      .map((user) => ({
        userId: user.id,
        email: user.email || user.id.substring(0, 8) + "...",
        count: user.totalGenerations || 0,
      }));

    // User locations (from generations - if location data exists)
    const locationCounts = new Map<string, number>();
    filteredGenerations.forEach((gen) => {
      if (gen.location?.country) {
        const country = gen.location.country;
        locationCounts.set(country, (locationCounts.get(country) || 0) + 1);
      }
    });
    
    const userLocations = Array.from(locationCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 countries
    
    // Calculate growth rate (comparing last period with previous period)
    const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const previousPeriodGenerations = generations.filter((gen) => {
      const createdAt = gen.createdAt instanceof Date 
        ? gen.createdAt 
        : (gen.createdAt && typeof gen.createdAt.toDate === "function" 
          ? gen.createdAt.toDate() 
          : new Date(0));
      return createdAt >= previousPeriodStart && createdAt < startDate;
    }).length;
    
    const growthRate = previousPeriodGenerations > 0 
      ? ((totalGenerations - previousPeriodGenerations) / previousPeriodGenerations) * 100 
      : 0;

    return {
      totalGenerations,
      totalUsers,
      averageGenerationsPerUser,
      dailyGenerations,
      popularStyles,
      topUsers,
      userLocations,
      growthRate,
    };
  } catch (error: any) {
    console.error("Error getting analytics data:", error);
    throw error;
  }
};

// Get user location from IP (this would be called server-side)
export const getUserLocationFromIP = async (ip: string): Promise<{ country: string; city?: string } | null> => {
  try {
    // Using free IP geolocation API
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      country: data.country_name || "Unknown",
      city: data.city || undefined,
    };
  } catch (error) {
    console.error("Error getting user location:", error);
    return null;
  }
};

