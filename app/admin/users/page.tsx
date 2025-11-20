"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import { getUsersWithGenerationCount, deleteUser, User } from "@/lib/users";
import { isBetaTester } from "@/lib/beta-tester";

interface UserWithBetaTester extends User {
  isBetaTester?: boolean;
}

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserWithBetaTester[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithBetaTester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load users from Firestore
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const usersData = await getUsersWithGenerationCount();
        
        // Check beta tester status for each user
        const usersWithBetaTester = await Promise.all(
          usersData.map(async (user) => {
            const betaTesterStatus = await isBetaTester(user.id);
            return { ...user, isBetaTester: betaTesterStatus };
          })
        );
        
        setUsers(usersWithBetaTester);
      } catch (err: any) {
        console.error("Error loading users:", err);
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Filter users based on search query
  useEffect(() => {
    let filtered = users;

    // Filter by search query (email or user ID)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery]);

  // Format date
  const formatDate = (date: Date | any) => {
    if (!date) return "N/A";
    try {
      // Handle Firestore Timestamp
      if (date && typeof date.toDate === "function") {
        const d = date.toDate();
        return d.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      // Handle regular Date
      if (date instanceof Date) {
        return date.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      return "Invalid date";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US");
  };

  // Handle delete user
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      setDeletingUserId(userId);
      setError(null);
      setSuccess(null);
      
      // Delete all user data (generations, favorites, tokens, images)
      await deleteUser(userId);
      
      // Revoke user session (logout user if they're logged in)
      try {
        await fetch("/api/admin/revoke-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        });
      } catch (revokeError) {
        console.error("Error revoking user session:", revokeError);
        // Continue even if revoke fails
      }
      
      // Remove from state
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      setFilteredUsers((prev) => prev.filter((user) => user.id !== userId));
      setDeleteConfirm(null);
      setSuccess(`User "${userEmail || userId}" and all their data deleted successfully. User has been logged out if they were logged in.`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError(err.message || "Failed to delete user");
      setDeleteConfirm(null);
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="All Users" onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="flex-1 p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
            <h3 className="text-2xl font-bold text-white">All Users</h3>
            <div className="relative w-full md:w-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                search
              </span>
              <input
                className="w-full md:w-80 rounded-lg border border-white/10 bg-[#242424]/40 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                placeholder="Search by User ID or Email..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/20 p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 rounded-xl border border-green-500/50 bg-green-500/20 p-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-white/70">Loading users...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                group
              </span>
              <p className="text-white/70 text-lg mb-2">No users found</p>
              <p className="text-white/50 text-sm">
                {users.length === 0
                  ? "No users have registered yet."
                  : "Try adjusting your search query."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#242424]/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-white/10">
                    <tr>
                      <th className="p-4 text-sm font-semibold text-white/70">User ID</th>
                      <th className="p-4 text-sm font-semibold text-white/70">Email</th>
                      <th className="p-4 text-sm font-semibold text-white/70">Registration Date</th>
                      <th className="p-4 text-sm font-semibold text-white/70 text-right">
                        Total Generations
                      </th>
                      <th className="p-4 text-sm font-semibold text-white/70 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-4 text-sm text-white/90 font-mono">
                          {user.id.substring(0, 8)}...
                        </td>
                        <td className="p-4 text-sm text-white/90">
                          <div className="flex items-center gap-2">
                            <span>{user.email || "N/A"}</span>
                            {user.isBetaTester && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/50 text-xs font-semibold text-purple-300">
                                <span className="material-symbols-outlined text-xs">science</span>
                                Beta
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-white/90">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="p-4 text-sm text-white/90 text-right">
                          {formatNumber(user.totalGenerations || 0)}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center items-center gap-2">
                            <Link
                              href={`/admin/gallery?userId=${user.id}`}
                              className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">
                                visibility
                              </span>
                              <span>View Generations</span>
                            </Link>
                            <button
                              onClick={() => setDeleteConfirm(user.id)}
                              disabled={deletingUserId === user.id}
                              className="flex items-center gap-2 rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete user"
                            >
                              {deletingUserId === user.id ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent"></div>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-base">
                                    delete
                                  </span>
                                  <span>Delete</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-4 text-sm text-white/70 border-t border-white/10">
                <div>
                  Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="rounded-lg border border-white/10 bg-[#242424] p-6 max-w-md w-full">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Delete User?
                </h3>
                <div className="mb-4 text-sm text-white/70">
                  <p className="mb-2">
                    Are you sure you want to delete this user? This action cannot be undone. All user data including:
                  </p>
                  <ul className="list-disc list-inside mt-2 mb-2 space-y-1 text-white/60">
                    <li>User account</li>
                    <li>All generations (original and generated images)</li>
                    <li>All favorites</li>
                    <li>Token balance</li>
                  </ul>
                  <p>
                    The user will also be automatically logged out if they are currently logged in.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const user = users.find((u) => u.id === deleteConfirm);
                      if (user) {
                        handleDeleteUser(user.id, user.email);
                      }
                    }}
                    disabled={deletingUserId === deleteConfirm}
                    className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingUserId === deleteConfirm ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deletingUserId === deleteConfirm}
                    className="flex-1 rounded-lg border border-white/10 bg-[#242424]/40 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
