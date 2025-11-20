"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import {
  getUserById,
  getUsersWithGenerationCount,
  User,
} from "@/lib/users";
import {
  getUserTokens,
  getUserTokenData,
  addUserTokens,
  setUserTokens,
  UserTokenData,
} from "@/lib/tokens";
import { getInitialTokens, saveInitialTokens, getTokenCostPerGenerate, saveTokenCostPerGenerate, getMaxAnonymousGenerations, saveMaxAnonymousGenerations } from "@/lib/settings";
import { isBetaTester } from "@/lib/beta-tester";

interface UserWithTokens extends User {
  tokens?: number;
  tokenData?: UserTokenData;
  isBetaTester?: boolean;
}

export default function AdminBillingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserWithTokens[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithTokens[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editTokens, setEditTokens] = useState<number>(0);
  const [addTokensAmount, setAddTokensAmount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [initialTokens, setInitialTokens] = useState<number>(100);
  const [savingInitialTokens, setSavingInitialTokens] = useState(false);
  const [tokenCostPerGenerate, setTokenCostPerGenerate] = useState<number>(10);
  const [savingTokenCost, setSavingTokenCost] = useState(false);
  const [maxAnonymousGenerations, setMaxAnonymousGenerations] = useState<number>(1);
  const [savingMaxAnonymous, setSavingMaxAnonymous] = useState(false);

  // Load initial tokens and token cost settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const tokens = await getInitialTokens();
        setInitialTokens(tokens);
        const cost = await getTokenCostPerGenerate();
        setTokenCostPerGenerate(cost);
        const maxAnonymous = await getMaxAnonymousGenerations();
        setMaxAnonymousGenerations(maxAnonymous);
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  // Load users with token data
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const usersData = await getUsersWithGenerationCount();

        // Load token data and beta tester status for each user
        const usersWithTokens = await Promise.all(
          usersData.map(async (user) => {
            try {
              const tokens = await getUserTokens(user.id);
              const tokenData = await getUserTokenData(user.id);
              const betaTesterStatus = await isBetaTester(user.id);
              return {
                ...user,
                tokens: tokens,
                tokenData: tokenData || undefined,
                isBetaTester: betaTesterStatus,
              };
            } catch (error) {
              console.error(`Error loading tokens for user ${user.id}:`, error);
              return {
                ...user,
                tokens: 0,
                tokenData: undefined,
                isBetaTester: false,
              };
            }
          })
        );

        setUsers(usersWithTokens);
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

  // Handle add tokens
  const handleAddTokens = async (userId: string) => {
    if (!addTokensAmount || addTokensAmount <= 0) {
      setError("Please enter a valid token amount");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await addUserTokens(userId, addTokensAmount);

      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId
            ? {
                ...user,
                tokens: (user.tokens || 0) + addTokensAmount,
              }
            : user
        )
      );

      setSuccess(`Successfully added ${addTokensAmount} tokens to user`);
      setAddTokensAmount(0);
      setEditingUserId(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error adding tokens:", err);
      setError(err.message || "Failed to add tokens");
    } finally {
      setSaving(false);
    }
  };

  // Handle set tokens
  const handleSetTokens = async (userId: string) => {
    if (editTokens < 0) {
      setError("Token amount cannot be negative");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await setUserTokens(userId, editTokens);

      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId
            ? {
                ...user,
                tokens: editTokens,
              }
            : user
        )
      );

      setSuccess(`Successfully set tokens to ${editTokens} for user`);
      setEditTokens(0);
      setEditingUserId(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error setting tokens:", err);
      setError(err.message || "Failed to set tokens");
    } finally {
      setSaving(false);
    }
  };

  // Handle save initial tokens
  const handleSaveInitialTokens = async () => {
    if (initialTokens < 0) {
      setError("Initial tokens cannot be negative");
      return;
    }

    try {
      setSavingInitialTokens(true);
      setError(null);
      setSuccess(null);
      await saveInitialTokens(initialTokens);
      setSuccess(`Initial tokens updated to ${initialTokens}. New users will receive ${initialTokens} tokens.`);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error saving initial tokens:", err);
      setError(err.message || "Failed to save initial tokens");
    } finally {
      setSavingInitialTokens(false);
    }
  };

  // Handle save token cost per generate
  const handleSaveTokenCost = async () => {
    if (tokenCostPerGenerate < 0) {
      setError("Token cost cannot be negative");
      return;
    }

    try {
      setSavingTokenCost(true);
      setError(null);
      setSuccess(null);
      await saveTokenCostPerGenerate(tokenCostPerGenerate);
      setSuccess(`Token cost per generate updated to ${tokenCostPerGenerate}. Each generation will cost ${tokenCostPerGenerate} tokens.`);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error saving token cost:", err);
      setError(err.message || "Failed to save token cost");
    } finally {
      setSavingTokenCost(false);
    }
  };

  // Handle save max anonymous generations
  const handleSaveMaxAnonymous = async () => {
    if (maxAnonymousGenerations < 0) {
      setError("Max anonymous generations cannot be negative");
      return;
    }

    try {
      setSavingMaxAnonymous(true);
      setError(null);
      setSuccess(null);
      await saveMaxAnonymousGenerations(maxAnonymousGenerations);
      setSuccess(`Max anonymous generations updated to ${maxAnonymousGenerations}. Anonymous users can generate ${maxAnonymousGenerations} image${maxAnonymousGenerations !== 1 ? 's' : ''} before requiring login.`);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error saving max anonymous generations:", err);
      setError(err.message || "Failed to save max anonymous generations");
    } finally {
      setSavingMaxAnonymous(false);
    }
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US");
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="Billing Management" onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex-1 p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
            <h3 className="text-2xl font-bold text-white">User Billing & Tokens</h3>
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

          {/* Token Settings */}
          <div className="mb-6 rounded-xl border border-white/10 bg-[#242424]/40 p-4">
            <h4 className="text-base font-semibold text-white mb-4">Token Settings</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Initial Tokens */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/70">
                  Initial Tokens
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={initialTokens}
                    onChange={(e) => setInitialTokens(parseInt(e.target.value) || 0)}
                    className="flex-1 rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-3 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                    disabled={savingInitialTokens}
                  />
                  <button
                    onClick={handleSaveInitialTokens}
                    disabled={savingInitialTokens || initialTokens < 0}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                  >
                    {savingInitialTokens ? "..." : "Save"}
                  </button>
                </div>
              </div>

              {/* Token Cost Per Generate */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/70">
                  Cost Per Generate
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={tokenCostPerGenerate}
                    onChange={(e) => setTokenCostPerGenerate(parseInt(e.target.value) || 0)}
                    className="flex-1 rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-3 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                    disabled={savingTokenCost}
                  />
                  <button
                    onClick={handleSaveTokenCost}
                    disabled={savingTokenCost || tokenCostPerGenerate < 0}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                  >
                    {savingTokenCost ? "..." : "Save"}
                  </button>
                </div>
              </div>

              {/* Max Anonymous Generations */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/70">
                  Max Anonymous
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={maxAnonymousGenerations}
                    onChange={(e) => setMaxAnonymousGenerations(parseInt(e.target.value) || 0)}
                    className="flex-1 rounded-lg border border-white/10 bg-[#1A1A1A] py-2 px-3 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                    disabled={savingMaxAnonymous}
                  />
                  <button
                    onClick={handleSaveMaxAnonymous}
                    disabled={savingMaxAnonymous || maxAnonymousGenerations < 0}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                  >
                    {savingMaxAnonymous ? "..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 rounded-xl border border-green-500/50 bg-green-500/20 p-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

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
                <p className="text-white/70">Loading users...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
                account_balance_wallet
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
                      <th className="p-4 text-sm font-semibold text-white/70 text-right">
                        Tokens
                      </th>
                      <th className="p-4 text-sm font-semibold text-white/70 text-right">
                        Generations
                      </th>
                      <th className="p-4 text-sm font-semibold text-white/70 text-center">
                        Actions
                      </th>
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
                        <td className="p-4 text-sm text-white/90 text-right">
                          <span className="font-semibold text-primary">
                            {formatNumber(user.tokens || 0)}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-white/90 text-right">
                          {formatNumber(user.totalGenerations || 0)}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center items-center gap-2">
                            {editingUserId === user.id ? (
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Add tokens"
                                    value={addTokensAmount || ""}
                                    onChange={(e) =>
                                      setAddTokensAmount(parseInt(e.target.value) || 0)
                                    }
                                    className="flex-1 rounded-lg border border-white/10 bg-[#1A1A1A] py-1.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                                    disabled={saving}
                                  />
                                  <button
                                    onClick={() => handleAddTokens(user.id)}
                                    disabled={saving || !addTokensAmount || addTokensAmount <= 0}
                                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    Add
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Set tokens"
                                    value={editTokens || ""}
                                    onChange={(e) =>
                                      setEditTokens(parseInt(e.target.value) || 0)
                                    }
                                    className="flex-1 rounded-lg border border-white/10 bg-[#1A1A1A] py-1.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                                    disabled={saving}
                                  />
                                  <button
                                    onClick={() => handleSetTokens(user.id)}
                                    disabled={saving || editTokens < 0}
                                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    Set
                                  </button>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingUserId(null);
                                    setAddTokensAmount(0);
                                    setEditTokens(0);
                                  }}
                                  disabled={saving}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 text-xs font-medium hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setAddTokensAmount(0);
                                  setEditTokens(user.tokens || 0);
                                }}
                                disabled={saving}
                                className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">
                                  edit
                                </span>
                                <span>Manage Tokens</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-4 text-sm text-white/70 border-t border-white/10">
                <div>
                  Showing {filteredUsers.length} of {users.length} user
                  {users.length !== 1 ? "s" : ""}
                </div>
                <div className="text-xs text-white/50">
                  New users receive {initialTokens} tokens • Generation cost: {tokenCostPerGenerate} tokens
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

