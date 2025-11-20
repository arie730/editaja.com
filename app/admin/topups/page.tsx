"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/admin/components/Sidebar";
import Header from "@/app/admin/components/Header";
import { getAllTopupTransactions, TopupTransaction } from "@/lib/topups";

export default function AdminTopupsPage() {
  const [transactions, setTransactions] = useState<TopupTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TopupTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Load transactions from Firestore
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        const transactionsData = await getAllTopupTransactions(500);
        setTransactions(transactionsData);
      } catch (err: any) {
        console.error("Error loading transactions:", err);
        setError(err.message || "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, []);

  // Filter transactions based on search query and status
  useEffect(() => {
    let filtered = transactions;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    // Filter by search query (orderId, userId, userEmail)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.orderId.toLowerCase().includes(query) ||
          t.userId.toLowerCase().includes(query) ||
          (t.userEmail && t.userEmail.toLowerCase().includes(query))
      );
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page when filter changes
  }, [transactions, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Format date
  const formatDate = (date: Date | any) => {
    if (!date) return "N/A";
    try {
      // Handle Firestore Timestamp
      if (date && typeof date.toDate === "function") {
        const d = date.toDate();
        return d.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      // Handle regular Date
      if (date instanceof Date) {
        return date.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return "Invalid date";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "settlement":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "expire":
      case "cancel":
      case "deny":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "refund":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      default:
        return "bg-white/10 text-white/70 border-white/20";
    }
  };

  // Calculate statistics
  const stats = {
    total: transactions.length,
    pending: transactions.filter((t) => t.status === "pending").length,
    settlement: transactions.filter((t) => t.status === "settlement").length,
    totalRevenue: transactions
      .filter((t) => t.status === "settlement")
      .reduce((sum, t) => sum + t.price, 0),
  };

  return (
    <div className="flex min-h-screen w-full bg-[#101022]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header title="Top-up Management" onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex-1 p-4 md:p-6 lg:p-10">
          {/* Stats Cards - Compact for mobile */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="flex flex-col gap-1 md:gap-2 rounded-lg md:rounded-xl bg-[#242424]/40 p-3 md:p-6 border border-white/10">
              <p className="text-white/70 text-xs md:text-base font-medium">Total</p>
              <p className="text-white tracking-light text-lg md:text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="flex flex-col gap-1 md:gap-2 rounded-lg md:rounded-xl bg-[#242424]/40 p-3 md:p-6 border border-white/10">
              <p className="text-white/70 text-xs md:text-base font-medium">Pending</p>
              <p className="text-yellow-400 tracking-light text-lg md:text-2xl font-bold">{stats.pending}</p>
            </div>
            <div className="flex flex-col gap-1 md:gap-2 rounded-lg md:rounded-xl bg-[#242424]/40 p-3 md:p-6 border border-white/10">
              <p className="text-white/70 text-xs md:text-base font-medium">Completed</p>
              <p className="text-green-400 tracking-light text-lg md:text-2xl font-bold">{stats.settlement}</p>
            </div>
            <div className="flex flex-col gap-1 md:gap-2 rounded-lg md:rounded-xl bg-[#242424]/40 p-3 md:p-6 border border-white/10 col-span-2 lg:col-span-1">
              <p className="text-white/70 text-xs md:text-base font-medium">Revenue</p>
              <p className="text-primary tracking-light text-sm md:text-2xl font-bold truncate">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
          </div>

          {/* Filters - Compact for mobile */}
          <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search Order ID, User ID, Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#242424]/40 py-2 md:py-2.5 pl-4 pr-10 text-sm text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
              />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-lg">
                search
              </span>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[160px]">
              <select
                className="appearance-none w-full rounded-lg border border-white/10 bg-[#242424]/40 py-2 md:py-2.5 pl-4 pr-10 text-sm text-white focus:border-primary focus:ring-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="settlement">Settlement</option>
                <option value="expire">Expired</option>
                <option value="cancel">Cancelled</option>
                <option value="deny">Denied</option>
                <option value="refund">Refunded</option>
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                expand_more
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Transactions - Card view for mobile, Table for desktop */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <p>No transactions found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {paginatedTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-lg border border-white/10 bg-[#242424]/40 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/50 mb-1">Order ID</p>
                        <p className="text-sm text-white font-mono truncate">{transaction.orderId}</p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ml-2 ${getStatusBadgeColor(
                          transaction.status
                        )}`}
                      >
                        {transaction.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-white/50 mb-1">User</p>
                        <p className="text-sm text-white truncate">
                          {transaction.userEmail || transaction.userId.substring(0, 12) + "..."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 mb-1">Package</p>
                        <p className="text-sm text-white">
                          {transaction.diamonds} 💎
                          {transaction.bonus && (
                            <span className="text-primary ml-1">+{transaction.bonus}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-white/50 mb-1">Amount</p>
                        <p className="text-sm font-semibold text-white">{formatCurrency(transaction.price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 mb-1">Payment</p>
                        <p className="text-sm text-white/70 truncate">
                          {transaction.paymentMethod || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-white/50 mb-1">Date</p>
                      <p className="text-xs text-white/70">{formatDate(transaction.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-white/10 bg-[#242424]/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Order ID
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Package
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Payment
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {paginatedTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-white/5">
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white font-mono">
                              {transaction.orderId}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">
                              {transaction.userEmail || transaction.userId}
                            </div>
                            <div className="text-xs text-white/50 font-mono">
                              {transaction.userId.substring(0, 8)}...
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">
                              {transaction.diamonds} diamonds
                              {transaction.bonus && (
                                <span className="text-primary ml-1">+{transaction.bonus} bonus</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">
                              {formatCurrency(transaction.price)}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                                transaction.status
                              )}`}
                            >
                              {transaction.status}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white/70">
                              {transaction.paymentMethod || "N/A"}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white/70">
                              {formatDate(transaction.createdAt)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 md:mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-white/70">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of{" "}
                    {filteredTransactions.length} transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-[#242424]/40 text-white text-sm font-medium hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === pageNum
                                ? "bg-primary text-white"
                                : "border border-white/10 bg-[#242424]/40 text-white/70 hover:bg-white/5"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-[#242424]/40 text-white text-sm font-medium hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
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
