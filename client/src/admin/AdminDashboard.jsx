'use strict';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PendingVendorsQueue from './PendingVendorsQueue';
import PlatformOverview from './PlatformOverview';
import { ShieldCheck, Clock, BarChart3, Lock } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'overview'

  if (!user || user.role !== 'admin') {
    return (
      <div className="py-20 px-4 max-w-md mx-auto text-center">
        <div className="card-glass p-8 rounded-xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center mx-auto text-rose">
            <Lock size={22} />
          </div>
          <h2 className="heading-lg text-white">Access Restricted</h2>
          <p className="text-xs text-slate-400">
            Admin privileges are required to access the city admin control panel.
          </p>
        </div>
      </div>
    );
  }

  const adminScopeCity = user.adminScope?.city;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Header */}
      <div className="card-glass p-6 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center font-bold text-xl">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="heading-xl text-white">Admin Control Panel</h1>
              <span className="pill-tag-aloe">
                {adminScopeCity ? `CITY ADMIN (${adminScopeCity.toUpperCase()})` : 'SUPER ADMIN'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Logged in as <span className="text-white font-medium">{user.name}</span> ({user.email})
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('pending')}
          className={`nm-category-pill ${activeTab === 'pending' ? 'active' : ''}`}
        >
          <Clock size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> Pending Vendor Queue
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`nm-category-pill ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <BarChart3 size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> Platform Overview
        </button>
      </div>

      {/* Active Tab Panel */}
      <div>
        {activeTab === 'pending' && <PendingVendorsQueue />}
        {activeTab === 'overview' && <PlatformOverview />}
      </div>
    </div>
  );
}
