'use strict';

import React, { useState, useEffect } from 'react';
import { orderAPI } from '../services/api';
import { Inbox, Clock, RefreshCw, ChevronRight } from 'lucide-react';

const KANBAN_COLUMNS = [
  { key: 'PLACED', title: 'New Orders', badgeClass: 'pill-tag-amber', nextStatus: 'PREPARING', nextLabel: 'Start Preparing' },
  { key: 'PREPARING', title: 'In Preparation', badgeClass: 'pill-tag-shade', nextStatus: 'OUT_FOR_DELIVERY', nextLabel: 'Send Out for Delivery' },
  { key: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', badgeClass: 'pill-tag-shade', nextStatus: 'DELIVERED', nextLabel: 'Mark Delivered' },
  { key: 'DELIVERED', title: 'Completed', badgeClass: 'pill-tag-emerald', nextStatus: null, nextLabel: null },
];

export default function OrderInbox({ vendorStore }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = async () => {
    if (!vendorStore?._id) return;
    try {
      const data = await orderAPI.listVendorOrders(vendorStore._id);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      console.warn('[OrderInbox] Failed to fetch vendor orders:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [vendorStore]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const updated = await orderAPI.updateStatus(orderId, newStatus);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status: updated.status } : o)));
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="heading-xl text-white flex items-center gap-2">
            <Inbox size={22} className="text-aloe" /> Live Order Inbox & Kanban
          </h2>
          <p className="text-xs text-slate-400">Incoming buyer requests & status progression</p>
        </div>

        <button onClick={fetchOrders} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Orders
        </button>
      </div>

      {loading ? (
        <div className="card-glass p-12 text-center text-slate-400 rounded-xl">
          <RefreshCw className="animate-spin mx-auto mb-2 text-white" size={24} />
          <p className="text-xs">Fetching vendor order inbox...</p>
        </div>
      ) : (
        /* Kanban Columns Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const columnOrders = orders.filter((o) => o.status === col.key);

            return (
              <div key={col.key} className="nm-kanban-col">
                {/* Column Header */}
                <div className="nm-kanban-col-header">
                  <span className={col.badgeClass}>{col.title}</span>
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold">
                    {columnOrders.length}
                  </span>
                </div>

                {/* Orders Stack */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {columnOrders.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-lg">
                      No orders
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <div key={order._id} className="nm-kanban-card space-y-2">
                        <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                          <span className="font-bold text-white">#{order.orderNumber}</span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock size={11} /> {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Customer & Address */}
                        <div className="text-xs text-slate-300">
                          <span className="text-white font-medium">{order.deliveryAddress?.line1 || 'Local Pickup'}</span>
                          {order.deliveryAddress?.city && <span>, {order.deliveryAddress.city}</span>}
                        </div>

                        {/* Order Items */}
                        <div className="text-xs text-slate-400 space-y-0.5">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{item.quantity}x {item.name}</span>
                              <span className="text-slate-300">₹{((item.price * item.quantity) / 100).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Order Total & Status Progression CTA */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="font-bold text-emerald text-sm">
                            ₹{((order.totalAmount || 0) / 100).toFixed(2)}
                          </span>

                          {col.nextStatus && (
                            <button
                              disabled={updatingId === order._id}
                              onClick={() => handleUpdateStatus(order._id, col.nextStatus)}
                              className="btn-aloe text-[11px] py-1 px-3"
                            >
                              {updatingId === order._id ? (
                                <RefreshCw className="animate-spin" size={12} />
                              ) : (
                                <>
                                  <span>{col.nextLabel}</span>
                                  <ChevronRight size={12} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
