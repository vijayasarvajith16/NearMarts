'use strict';

import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import OrderInbox from './OrderInbox';
import ProductManagement from './ProductManagement';
import StoreSettings from './StoreSettings';
import ReviewManagement from './ReviewManagement';
import { Store, Inbox, Package, Settings, Star, RefreshCw, Plus, Clock } from 'lucide-react';

export default function VendorDashboard() {
  const { user } = useAuth();
  const [vendorStore, setVendorStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'products' | 'settings' | 'reviews'

  // Register Form State if store not found
  const [regData, setRegData] = useState({
    storeName: '',
    description: '',
    city: 'bengaluru',
    category: 'bakery',
    line1: '',
    pincode: '560001',
  });
  const [regSubmitting, setRegSubmitting] = useState(false);

  const fetchStoreProfile = async () => {
    setLoading(true);
    try {
      const res = await vendorAPI.getMe();
      setVendorStore(res.vendor || null);
    } catch (err) {
      console.warn('Vendor store not found:', err.message);
      setVendorStore(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreProfile();
  }, []);

  const handleRegisterStore = async (e) => {
    e.preventDefault();
    setRegSubmitting(true);
    try {
      const payload = {
        storeName: regData.storeName.trim(),
        description: regData.description.trim(),
        city: regData.city.toLowerCase().trim(),
        category: regData.category,
        address: {
          line1: regData.line1.trim(),
          city: regData.city.trim(),
          pincode: regData.pincode.trim(),
        },
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716],
        },
      };

      const res = await vendorAPI.createStore(payload);
      setVendorStore(res.vendor || res);
    } catch (err) {
      alert(err.message || 'Failed to register store profile');
    } finally {
      setRegSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 space-y-3">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto" />
        <p className="text-sm">Loading Merchant Workspace...</p>
      </div>
    );
  }

  if (!vendorStore) {
    return (
      <div className="py-12 px-4 max-w-2xl mx-auto">
        <div className="card-glass p-8 rounded-xl space-y-6">
          <div className="w-14 h-14 rounded-full bg-slate-900 border border-white/10 text-white flex items-center justify-center mx-auto">
            <Store size={26} />
          </div>
          <div className="text-center space-y-1.5">
            <h2 className="heading-xl text-white">Welcome to NearMart Seller Hub</h2>
            <p className="text-xs text-slate-400">
              Register your local store to begin accepting orders from neighborhood customers.
            </p>
          </div>

          <form onSubmit={handleRegisterStore} className="space-y-4 pt-4 border-t border-white/10">
            <div>
              <label className="input-label">Store / Brand Name *</label>
              <input
                type="text"
                required
                value={regData.storeName}
                onChange={(e) => setRegData({ ...regData, storeName: e.target.value })}
                className="input-field"
                placeholder="e.g. Green Leaf Organic Bakery"
              />
            </div>

            <div>
              <label className="input-label">Description</label>
              <textarea
                rows={3}
                value={regData.description}
                onChange={(e) => setRegData({ ...regData, description: e.target.value })}
                className="input-field"
                placeholder="Tell customers what makes your artisan products unique..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Category *</label>
                <select
                  value={regData.category}
                  onChange={(e) => setRegData({ ...regData, category: e.target.value })}
                  className="input-field"
                >
                  <option value="bakery">Bakery</option>
                  <option value="handmade">Handmade</option>
                  <option value="produce">Produce</option>
                  <option value="plants">Plants</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="input-label">City *</label>
                <input
                  type="text"
                  required
                  value={regData.city}
                  onChange={(e) => setRegData({ ...regData, city: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Street Address</label>
                <input
                  type="text"
                  value={regData.line1}
                  onChange={(e) => setRegData({ ...regData, line1: e.target.value })}
                  className="input-field"
                  placeholder="123 Main Road"
                />
              </div>

              <div>
                <label className="input-label">Pincode</label>
                <input
                  type="text"
                  value={regData.pincode}
                  onChange={(e) => setRegData({ ...regData, pincode: e.target.value })}
                  className="input-field"
                  placeholder="560001"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={regSubmitting}
              className="btn-aloe w-full py-3 text-sm font-bold mt-2"
            >
              {regSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
              Register Store Profile
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner Status */}
      <div className="card-glass p-6 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 text-white flex items-center justify-center font-bold text-xl">
            <Store size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="heading-xl text-white">{vendorStore.storeName}</h1>
              <span
                className={
                  vendorStore.approvalStatus === 'approved'
                    ? 'pill-tag-emerald'
                    : 'pill-tag-amber'
                }
              >
                {vendorStore.approvalStatus === 'approved' ? 'VERIFIED STORE' : 'PENDING APPROVAL'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Category: <span className="capitalize text-white">{vendorStore.category}</span> • City: <span className="capitalize text-white">{vendorStore.city}</span>
            </p>
          </div>
        </div>

        {vendorStore.approvalStatus === 'pending' && (
          <div className="px-3.5 py-1.5 rounded-full bg-slate-900 border border-amber text-amber text-xs flex items-center gap-2">
            <Clock size={14} /> Awaiting Admin Verification for Nearby Discovery
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`nm-category-pill ${activeTab === 'inbox' ? 'active' : ''}`}
        >
          <Inbox size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> Order Inbox
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`nm-category-pill ${activeTab === 'products' ? 'active' : ''}`}
        >
          <Package size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> Products
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`nm-category-pill ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <Settings size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> Store Settings
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`nm-category-pill ${activeTab === 'reviews' ? 'active' : ''}`}
        >
          <Star size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> Reviews
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'inbox' && <OrderInbox vendorStore={vendorStore} />}
        {activeTab === 'products' && <ProductManagement vendorStore={vendorStore} />}
        {activeTab === 'settings' && <StoreSettings vendorStore={vendorStore} onUpdateStore={setVendorStore} />}
        {activeTab === 'reviews' && <ReviewManagement vendorStore={vendorStore} />}
      </div>
    </div>
  );
}
