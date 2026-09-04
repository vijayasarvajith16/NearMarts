'use strict';

import React, { useState, useEffect } from 'react';
import { orderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VendorChat from './VendorChat';
import { Package, Clock, Truck, CheckCircle2, ArrowLeft, RefreshCw, MessageSquare, MapPin } from 'lucide-react';
import { io } from 'socket.io-client';

const STATUS_STEPS = [
  { key: 'PLACED', label: 'Order Placed', icon: Clock },
  { key: 'PREPARING', label: 'Preparing', icon: Package },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
];

export default function OrderTrackingScreen({ orderId, onBack }) {
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // 1. Fetch Order Info
  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const data = await orderAPI.getById(orderId);
      setOrder(data.order);
    } catch (err) {
      console.warn('[OrderTracking] Failed to load order:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // 2. Real-time WebSocket setup directly to realtime-service (port 4007)
  useEffect(() => {
    if (!orderId) return;

    const token = localStorage.getItem('nearmart_token');
    const socket = io('http://localhost:4007', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setSocketStatus('Live Connection Active');
      socket.emit('order:track', { orderId });
    });

    socket.on('order:status_updated', (data) => {
      if (data.orderId === orderId) {
        setOrder((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    });

    socket.on('connect_error', () => {
      setSocketStatus('Polling fallback');
    });

    // Also poll every 10s as reliability fallback
    const interval = setInterval(fetchOrder, 10000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [orderId]);

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order?.status);

  if (loading) {
    return (
      <div className="container-3xl py-20 text-center text-slate-400 space-y-3">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto" />
        <p className="text-xs">Connecting to order tracking service...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-3xl py-20 text-center text-slate-400 space-y-4">
        <h2 className="heading-xl text-white">Order Not Found</h2>
        <p className="text-xs text-slate-500">The requested order details could not be loaded.</p>
        <button onClick={onBack} className="btn-secondary text-xs">
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="container-5xl py-8 space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-secondary text-xs py-1.5 px-3">
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="heading-xl text-white">Order #{order.orderNumber}</h1>
            <span className="text-xs text-slate-400">
              Placed on {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold text-aloe flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            {socketStatus}
          </span>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="btn-aloe text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <MessageSquare size={14} />
            <span>{isChatOpen ? 'Hide Chat' : 'Chat with Vendor'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Stepper Progress (Shopify Pure Vanilla CSS) */}
      <div className="nm-stepper-card">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Status Timeline</span>
          <span className="pill-tag-aloe">{order.status}</span>
        </div>

        <div className="nm-stepper-row">
          <div className="nm-stepper-line">
            <div
              className="nm-stepper-line-fill"
              style={{
                width: `${Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)}%`,
              }}
            />
          </div>

          {STATUS_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            let circleClass = 'nm-step-circle';
            if (isCompleted) circleClass += ' completed';
            else if (isCurrent) circleClass += ' active';

            return (
              <div key={step.key} className="nm-stepper-node">
                <div className={circleClass}>
                  <Icon size={18} />
                </div>
                <span
                  className={`text-xs mt-1 ${
                    isCurrent
                      ? 'font-bold text-white'
                      : isCompleted
                      ? 'font-medium text-aloe'
                      : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Details and Live Chat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Order Items & Summary */}
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h2 className="heading-md text-white border-b border-white/10 pb-3">
            Purchased Items
          </h2>

          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="text-slate-500 block">Quantity: {item.quantity}</span>
                </div>
                <span className="font-bold text-emerald">
                  ₹{((item.price * item.quantity) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Delivery Address</span>
              <span className="text-white text-right max-w-xs">
                {order.deliveryAddress?.line1}, {order.deliveryAddress?.city}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Payment Mode</span>
              <span className="text-white font-medium">{order.paymentMethod}</span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 flex justify-between items-center">
            <span className="font-semibold text-slate-300 text-sm">Total Paid</span>
            <span className="text-xl font-bold text-white font-display">
              ₹{((order.totalAmount || 0) / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Vendor Chat or Live Tracking Help */}
        <div>
          {isChatOpen ? (
            <VendorChat
              orderId={order._id}
              vendorId={order.vendorId}
              currentUserId={user?.id}
            />
          ) : (
            <div className="card-glass p-8 rounded-xl text-center space-y-3 flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-aloe">
                <MessageSquare size={22} />
              </div>
              <h3 className="heading-md text-white">Direct Merchant Messaging</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Have special instructions or questions about your order? Connect directly with the store via live WebSocket chat.
              </p>
              <button
                onClick={() => setIsChatOpen(true)}
                className="btn-aloe text-xs py-2 px-5 mt-2"
              >
                Open Merchant Chat
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
