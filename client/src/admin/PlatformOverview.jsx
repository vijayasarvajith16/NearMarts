'use strict';

import React, { useState, useEffect } from 'react';
import { orderAPI, vendorAPI } from '../services/api';
import { BarChart3, TrendingUp, ShoppingBag, Store, ShieldCheck, RefreshCw, Clock } from 'lucide-react';

export default function PlatformOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    gmvPaise: 0,
    pendingVendorsCount: 0,
    approvedVendorsCount: 0,
    ordersByStatus: {},
  });

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders List
      const ordersRes = await orderAPI.listAllOrders().catch(() => ({ orders: [] }));
      const orders = Array.isArray(ordersRes.orders) ? ordersRes.orders : [];

      const totalOrders = orders.length;
      const gmvPaise = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const statusMap = {};
      orders.forEach((o) => {
        statusMap[o.status] = (statusMap[o.status] || 0) + 1;
      });

      // 2. Fetch Vendors Info
      const pendingRes = await vendorAPI.getPending().catch(() => ({ vendors: [] }));
      const pendingVendorsCount = (pendingRes.vendors || []).length;

      const nearbyRes = await vendorAPI.getNearby(77.5946, 12.9716, '', 500000).catch(() => ({ vendors: [] }));
      const approvedVendorsCount = (nearbyRes.vendors || []).length;

      setStats({
        totalOrders,
        gmvPaise,
        pendingVendorsCount,
        approvedVendorsCount,
        ordersByStatus: statusMap,
      });
    } catch (err) {
      console.warn('[PlatformOverview] Data aggregation failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="heading-xl text-white flex items-center gap-2">
            <BarChart3 size={22} className="text-aloe" /> Platform Metrics & Analytics
          </h2>
          <p className="text-xs text-slate-400">Hyperlocal marketplace transactions and merchant status</p>
        </div>

        <button onClick={fetchOverviewData} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Metrics
        </button>
      </div>

      {loading ? (
        <div className="card-glass p-12 text-center text-slate-400 rounded-xl space-y-2">
          <RefreshCw className="animate-spin mx-auto text-white" size={24} />
          <p className="text-xs">Aggregating platform metrics...</p>
        </div>
      ) : (
        <>
          {/* Key Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total GMV */}
            <div className="card-glass p-6 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Gross Merchandise Value</span>
                <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 text-aloe flex items-center justify-center font-bold">
                  ₹
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                ₹{((stats.gmvPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-aloe flex items-center gap-1">
                <TrendingUp size={12} /> Live platform transaction volume
              </div>
            </div>

            {/* Total Orders */}
            <div className="card-glass p-6 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Orders Placed</span>
                <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 text-white flex items-center justify-center">
                  <ShoppingBag size={14} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                {stats.totalOrders}
              </div>
              <div className="text-[11px] text-slate-400">
                Across all registered cities
              </div>
            </div>

            {/* Active Merchants */}
            <div className="card-glass p-6 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Verified Active Stores</span>
                <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 text-emerald flex items-center justify-center">
                  <Store size={14} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                {stats.approvedVendorsCount}
              </div>
              <div className="text-[11px] text-emerald flex items-center gap-1">
                <ShieldCheck size={12} /> KYC verified and listed
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="card-glass p-6 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Pending Approvals</span>
                <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 text-amber flex items-center justify-center">
                  <Clock size={14} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                {stats.pendingVendorsCount}
              </div>
              <div className="text-[11px] text-amber">
                Requires admin verification
              </div>
            </div>
          </div>

          {/* Orders Breakdown */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h3 className="heading-md text-white">Order Pipeline Status Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <span className="pill-tag-amber">PLACED</span>
                <div className="text-xl font-bold text-white pt-1">{stats.ordersByStatus['PLACED'] || 0}</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <span className="pill-tag-shade">PREPARING</span>
                <div className="text-xl font-bold text-white pt-1">{stats.ordersByStatus['PREPARING'] || 0}</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <span className="pill-tag-shade">OUT FOR DELIVERY</span>
                <div className="text-xl font-bold text-white pt-1">{stats.ordersByStatus['OUT_FOR_DELIVERY'] || 0}</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <span className="pill-tag-emerald">DELIVERED</span>
                <div className="text-xl font-bold text-white pt-1">{stats.ordersByStatus['DELIVERED'] || 0}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
