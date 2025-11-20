import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  getCountFromServer,
  orderBy,
} from "firebase/firestore";
import { getUsers } from "./users";
import { getGenerations } from "./generations";
import { getActiveStyles } from "./styles";
import { getTodayVisitorsCount, getActiveVisitorsCount } from "./visitors";

export interface DashboardStats {
  totalUsers: number;
  dailyGenerations: number;
  activeStyles: number;
  activeVisitors: number;
  todayVisitors: number;
  totalGenerations: number;
  conversionRate: number;
}

// Get dashboard statistics
export const getDashboardStats = async (): Promise<DashboardStats> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    // Get all data in parallel
    const [users, generations, styles, activeVisitors, todayVisitors] = await Promise.all([
      getUsers(),
      getGenerations(),
      getActiveStyles(),
      getActiveVisitorsCount(),
      getTodayVisitorsCount(),
    ]);

    // Calculate today's generations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayGenerations = generations.filter((gen) => {
      const createdAt = gen.createdAt instanceof Date
        ? gen.createdAt
        : (gen.createdAt && typeof gen.createdAt.toDate === "function"
          ? gen.createdAt.toDate()
          : new Date(0));
      return createdAt >= today;
    });

    // Calculate conversion rate (users who generated / total visitors today)
    const conversionRate =
      todayVisitors > 0 ? (todayGenerations.length / todayVisitors) * 100 : 0;

    return {
      totalUsers: users.length,
      dailyGenerations: todayGenerations.length,
      activeStyles: styles.length,
      activeVisitors: activeVisitors,
      todayVisitors: todayVisitors,
      totalGenerations: generations.length,
      conversionRate: Math.round(conversionRate * 10) / 10, // Round to 1 decimal
    };
  } catch (error: any) {
    console.error("Error getting dashboard stats:", error);
    throw error;
  }
};

// Get recent generations (last 10)
export const getRecentGenerations = async (limitCount: number = 10) => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generationsRef = collection(db, "generations");
    // Get all and sort client-side to avoid index requirement
    const snapshot = await getDocs(generationsRef);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentGenerations = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt instanceof Date
          ? data.createdAt
          : (data.createdAt && typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate()
            : new Date(0));
        return {
          id: doc.id,
          userId: data.userId || "",
          styleName: data.styleName || "",
          createdAt: createdAt,
        };
      })
      .filter((gen) => gen.createdAt >= sevenDaysAgo)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limitCount);

    return recentGenerations;
  } catch (error: any) {
    console.error("Error getting recent generations:", error);
    return [];
  }
};

// Get popular styles (top 5 by generation count)
export const getPopularStyles = async (limitCount: number = 5) => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generations = await getGenerations();
    const styleCounts = new Map<string, { name: string; count: number }>();

    generations.forEach((gen) => {
      const styleName = gen.styleName || "Unknown";
      const current = styleCounts.get(gen.styleId) || { name: styleName, count: 0 };
      styleCounts.set(gen.styleId, {
        name: styleName,
        count: current.count + 1,
      });
    });

    return Array.from(styleCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limitCount);
  } catch (error: any) {
    console.error("Error getting popular styles:", error);
    return [];
  }
};

