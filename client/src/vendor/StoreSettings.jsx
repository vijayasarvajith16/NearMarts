'use strict';

import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';
import { Store, Check, RefreshCw, Truck, Power } from 'lucide-react';

export default function StoreSettings({ vendorStore, onUpdateStore }) {
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
    city: 'bengaluru',
    category: 'bakery',
    isActive: true,
    selfDelivery: false,
    line1: '',
    pincode: '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (vendorStore) {
      setFormData({
        storeName: vendorStore.storeName || '',
        description: vendorStore.description || '',
        city: vendorStore.city || 'bengaluru',
        category: vendorStore.category || 'bakery',
        isActive: vendorStore.isActive ?? true,
        selfDelivery: vendorStore.selfDelivery ?? false,
        line1: vendorStore.address?.line1 || '',
        pincode: vendorStore.address?.pincode || '',
      });
    }
  }, [vendorStore]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        storeName: formData.storeName.trim(),
        description: formData.description.trim(),
        city: formData.city.toLowerCase().trim(),
        category: formData.category,
        isActive: formData.isActive,
        selfDelivery: formData.selfDelivery,
        address: {
          line1: formData.line1.trim(),
          city: formData.city.trim(),
          pincode: formData.pincode.trim(),
        },
      };

      const res = await vendorAPI.updateMe(payload);
      const updated = res.vendor || res;
      if (onUpdateStore) onUpdateStore(updated);
      setMessage({ type: 'success', text: 'Store settings updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update store profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/10 text-white flex items-center justify-center font-bold">
          <Store size={20} />
        </div>
        <div>
          <h2 className="heading-xl text-white">Store Profile & Operating Settings</h2>
          <p className="text-xs text-slate-400">Configure visibility, self-delivery & business information</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-slate-900 border-emerald text-emerald'
              : 'bg-slate-900 border-rose text-rose'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Operating Status Card */}
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operating Status</h3>

          {/* Active Status Switch */}
          <div className="nm-toggle-wrapper">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-white">
                <Power size={17} />
              </div>
              <div>
                <span className="font-semibold text-white block text-sm">Store Active & Accepting Orders</span>
                <span className="text-xs text-slate-400">
                  {formData.isActive ? 'Your store is visible in buyer nearby search.' : 'Your store is currently paused.'}
                </span>
              </div>
            </div>

            <label className="nm-toggle">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span className="nm-toggle-slider"></span>
            </label>
          </div>

          {/* Self Delivery Switch */}
          <div className="nm-toggle-wrapper">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-white">
                <Truck size={17} />
              </div>
              <div>
                <span className="font-semibold text-white block text-sm">Self Delivery Enabled</span>
                <span className="text-xs text-slate-400">Deliver orders directly with your own team.</span>
              </div>
            </div>

            <label className="nm-toggle">
              <input
                type="checkbox"
                checked={formData.selfDelivery}
                onChange={(e) => setFormData({ ...formData, selfDelivery: e.target.checked })}
              />
              <span className="nm-toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Business Details Card */}
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Details</h3>

          <div>
            <label className="input-label">Store Name *</label>
            <input
              type="text"
              required
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="input-label">Store Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Street Address</label>
              <input
                type="text"
                value={formData.line1}
                onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
                className="input-field"
                placeholder="123 Main Street"
              />
            </div>

            <div>
              <label className="input-label">Pincode</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="input-field"
                placeholder="560001"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-aloe w-full py-3 text-sm font-bold"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
          Save Store Profile Settings
        </button>
      </form>
    </div>
  );
}
