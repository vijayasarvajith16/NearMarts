'use strict';

import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Check, X, MapPin, RefreshCw, Clock, Building2 } from 'lucide-react';

export default function PendingVendorsQueue() {
  const { user } = useAuth();
  const [pendingVendors, setPendingVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [actionId, setActionId] = useState(null);

  // Reject Modal State
  const [rejectingVendor, setRejectingVendor] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchPendingQueue = async () => {
    setLoading(true);
    try {
      const data = await vendorAPI.getPending(cityFilter);
      setPendingVendors(data.vendors || []);
    } catch (err) {
      console.error('Failed to fetch pending vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingQueue();
  }, [cityFilter]);

  const handleApprove = async (id) => {
    setActionId(id);
    try {
      await vendorAPI.approve(id);
      setPendingVendors((prev) => prev.filter((v) => v._id !== id));
      alert('Vendor approved successfully! Store is now visible in nearby discovery.');
    } catch (err) {
      alert(err.message || 'Failed to approve vendor');
    } finally {
      setActionId(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason');
      return;
    }

    setActionId(rejectingVendor._id);
    try {
      await vendorAPI.reject(rejectingVendor._id, rejectionReason.trim());
      setPendingVendors((prev) => prev.filter((v) => v._id !== rejectingVendor._id));
      setRejectingVendor(null);
      setRejectionReason('');
    } catch (err) {
      alert(err.message || 'Failed to reject vendor');
    } finally {
      setActionId(null);
    }
  };

  const adminCityScope = user?.adminScope?.city || null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="heading-xl text-white flex items-center gap-2">
            <Clock size={22} className="text-amber" /> Pending Vendor Queue
          </h2>
          <p className="text-xs text-slate-400">
            {adminCityScope
              ? `Review store registration applications for ${adminCityScope.toUpperCase()}`
              : 'Review and verify merchant KYC applications across all cities'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!adminCityScope && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="input-field py-1.5 px-3 text-xs w-auto"
            >
              <option value="">All Cities</option>
              <option value="bengaluru">Bengaluru</option>
              <option value="mumbai">Mumbai</option>
              <option value="delhi">Delhi</option>
              <option value="chennai">Chennai</option>
              <option value="hyderabad">Hyderabad</option>
            </select>
          )}

          <button onClick={fetchPendingQueue} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Queue
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card-glass p-12 text-center text-slate-400 rounded-xl space-y-2">
          <RefreshCw className="animate-spin mx-auto text-white" size={24} />
          <p className="text-xs">Loading pending verification queue...</p>
        </div>
      ) : pendingVendors.length === 0 ? (
        <div className="card-glass p-12 text-center text-slate-400 space-y-2 rounded-xl">
          <ShieldCheck size={36} className="mx-auto text-emerald opacity-60" />
          <p className="text-sm font-semibold text-white">No Pending Applications</p>
          <p className="text-xs text-slate-500">All vendor store registrations in your city scope have been reviewed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {pendingVendors.map((vendor) => (
            <div
              key={vendor._id}
              className="card-glass p-6 rounded-xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="pill-tag-amber">
                    {vendor.category}
                  </span>
                  <h3 className="heading-md text-white mt-2">{vendor.storeName}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {vendor.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-300 border-t border-white/5 pt-3">
                <div className="flex items-center gap-2">
                  <Building2 size={13} className="text-aloe" />
                  <span>City:</span>
                  <span className="font-semibold capitalize text-white">{vendor.city}</span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-aloe" />
                  <span>Address:</span>
                  <span className="text-slate-300">
                    {vendor.address?.line1 || 'N/A'}, {vendor.address?.pincode || ''}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex gap-3">
                <button
                  disabled={actionId === vendor._id}
                  onClick={() => handleApprove(vendor._id)}
                  className="flex-1 btn-aloe text-xs py-2"
                >
                  {actionId === vendor._id ? (
                    <RefreshCw className="animate-spin" size={13} />
                  ) : (
                    <>
                      <Check size={13} /> Approve Store
                    </>
                  )}
                </button>

                <button
                  disabled={actionId === vendor._id}
                  onClick={() => setRejectingVendor(vendor)}
                  className="btn-danger text-xs py-2 px-4"
                >
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingVendor && (
        <div className="nm-modal-overlay">
          <div className="nm-modal-card space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="heading-md text-white">
                Reject Application: {rejectingVendor.storeName}
              </h3>
              <button
                onClick={() => setRejectingVendor(null)}
                className="text-slate-400 hover:text-white"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="input-label">
                  Rejection Reason (Sent to Vendor) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Incomplete business address or outside service perimeter..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setRejectingVendor(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionId === rejectingVendor._id}
                  className="btn-danger text-xs"
                >
                  {actionId === rejectingVendor._id ? <RefreshCw className="animate-spin" size={13} /> : <X size={13} />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
