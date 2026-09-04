'use strict';

import React, { useState, useEffect } from 'react';
import { orderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, ArrowLeft, Clock, ChevronRight, RefreshCw } from 'lucide-react';

export default function OrderHistoryScreen({ onSelectOrder, onBack }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    orderAPI
      .listBuyerOrders(user.id)
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to list orders:', err);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="container-5xl py-8 space-y-6 animate-fade-in">
      <button onClick={onBack} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
        <ArrowLeft size={14} /> Back to Store
      </button>

      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/10 text-white flex items-center justify-center font-bold">
          <ShoppingBag size={20} />
        </div>
        <div>
          <h1 className="heading-xl text-white">My Purchases</h1>
          <p className="text-xs text-slate-400">Track current & past hyperlocal orders</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <RefreshCw className="animate-spin mx-auto text-white" size={24} />
          <p className="text-xs">Fetching your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-glass p-12 text-center text-slate-400 rounded-xl space-y-3">
          <ShoppingBag size={36} className="mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-white">You haven't placed any orders yet.</p>
          <p className="text-xs text-slate-500">Explore neighborhood merchants and place your first order.</p>
          <button onClick={onBack} className="btn-primary text-xs mt-2">
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order._id}
              onClick={() => onSelectOrder(order._id)}
              className="card-glass p-5 rounded-xl cursor-pointer hover:border-white/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base">#{order.orderNumber}</span>
                  <span className="pill-tag-aloe">
                    {order.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <Clock size={12} /> {new Date(order.createdAt).toLocaleString()}
                </div>
                <div className="text-xs text-slate-300">
                  {order.items?.length || 0} items • ₹{((order.totalAmount || 0) / 100).toFixed(2)} ({order.paymentMethod})
                </div>
              </div>

              <div className="btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-1.5 self-end sm:self-center">
                <span>Track Order</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
