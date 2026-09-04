'use strict';

import React from 'react';
import { ShoppingBag, User, LogOut, Store, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar({ currentCity, activeTab, setActiveTab, onOpenAuthModal, onOpenAuth, onOpenCart, onOpenOrders, onNavigateHome }) {
  const { user, logout } = useAuth();
  const { cart, setIsDrawerOpen } = useCart();

  const handleLogoClick = () => {
    if (onNavigateHome) onNavigateHome();
    else if (setActiveTab) setActiveTab('discovery');
  };

  const handleOrdersClick = () => {
    if (onOpenOrders) onOpenOrders();
    else if (setActiveTab) setActiveTab('orders');
  };

  const handleCartClick = () => {
    if (onOpenCart) onOpenCart();
    setIsDrawerOpen(true);
  };

  const handleAuthClick = () => {
    if (onOpenAuth) onOpenAuth();
    else if (onOpenAuthModal) onOpenAuthModal();
  };

  return (
    <header className="sticky top-0 z-50 bg-canvas-night border-b border-white/10" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Tagline */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="36" height="36" fill="none">
              <rect width="48" height="48" rx="14" fill="#000000"/>
              <rect x="1" y="1" width="46" height="46" rx="13" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"/>
              <path d="M12 21L24 13L36 21V33C36 34.1 35.1 35 34 35H14C12.9 35 12 34.1 12 33V21Z" fill="#111111" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 21.5L24 28.5L36 21.5" stroke="#c1fbd4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="24" cy="20.5" r="3" fill="#c1fbd4"/>
              <path d="M21 35V28H27V35" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white font-display">
              NearMart
            </span>
            <span className="pill-tag-aloe">
              HYPERLOCAL
            </span>
          </div>
        </div>

        {/* Action Navigation Pill Buttons */}
        <div className="flex items-center gap-2">
          
          {/* My Orders button if logged in */}
          {user && (
            <button
              onClick={handleOrdersClick}
              className={`btn-secondary text-xs ${activeTab === 'orders' ? 'border-white text-white' : ''}`}
            >
              My Orders
            </button>
          )}

          {/* Seller Hub button */}
          {user && (user.role === 'vendor' || user.role === 'buyer') && (
            <button
              onClick={() => setActiveTab && setActiveTab('vendor')}
              className={`btn-secondary text-xs ${activeTab === 'vendor' ? 'border-white text-white' : ''}`}
            >
              <Store size={13} /> Seller Hub
            </button>
          )}

          {/* Admin Panel button for admins */}
          {user && user.role === 'admin' && (
            <button
              onClick={() => setActiveTab && setActiveTab('admin')}
              className={`btn-secondary text-xs ${activeTab === 'admin' ? 'border-white text-white' : ''}`}
            >
              <ShieldCheck size={13} /> Admin Panel
            </button>
          )}

          {/* Cart Trigger Pill */}
          <button
            onClick={handleCartClick}
            className="btn-aloe text-xs py-2 px-4 relative flex items-center gap-1.5"
          >
            <ShoppingBag size={15} />
            <span>Cart</span>
            {cart?.totalItems > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">
                {cart.totalItems}
              </span>
            )}
          </button>

          {/* User Auth Profile Pill */}
          {user ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-white/10 text-xs">
              <User size={13} className="text-slate-400" />
              <span className="font-semibold text-slate-200">{user.name?.split(' ')[0]}</span>
              <button
                onClick={logout}
                title="Logout"
                className="text-slate-400 hover:text-rose transition-all p-0.5 ml-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button onClick={handleAuthClick} className="btn-secondary text-xs">
              Sign In
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
