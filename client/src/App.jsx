'use strict';

import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import DiscoveryScreen from './components/DiscoveryScreen';
import StorePage from './components/StorePage';
import CheckoutScreen from './components/CheckoutScreen';
import OrderTrackingScreen from './components/OrderTrackingScreen';
import OrderHistoryScreen from './components/OrderHistoryScreen';
import VendorDashboard from './vendor/VendorDashboard';
import AdminDashboard from './admin/AdminDashboard';

function MainApp() {
  const [currentScreen, setCurrentScreen] = useState('discovery'); // 'discovery' | 'store' | 'checkout' | 'tracking' | 'orders' | 'vendor' | 'admin'
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleSelectVendor = (vendorId) => {
    setSelectedVendorId(vendorId);
    setCurrentScreen('store');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToCheckout = () => {
    setIsCartOpen(false);
    setCurrentScreen('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderCreated = (orderId) => {
    setSelectedOrderId(orderId);
    setCurrentScreen('tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrderId(orderId);
    setCurrentScreen('tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas-night text-white">
      {/* Top Header Navbar */}
      <Navbar
        activeTab={currentScreen}
        setActiveTab={setCurrentScreen}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenOrders={() => setCurrentScreen('orders')}
        onNavigateHome={() => setCurrentScreen('discovery')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentScreen === 'discovery' && (
          <DiscoveryScreen onSelectVendor={handleSelectVendor} />
        )}

        {currentScreen === 'store' && (
          <StorePage
            vendorId={selectedVendorId}
            onBack={() => setCurrentScreen('discovery')}
            onGoToCheckout={handleGoToCheckout}
          />
        )}

        {currentScreen === 'checkout' && (
          <CheckoutScreen
            onOrderCreated={handleOrderCreated}
            onBack={() => setCurrentScreen(selectedVendorId ? 'store' : 'discovery')}
          />
        )}

        {currentScreen === 'tracking' && (
          <OrderTrackingScreen
            orderId={selectedOrderId}
            onBack={() => setCurrentScreen('orders')}
          />
        )}

        {currentScreen === 'orders' && (
          <OrderHistoryScreen
            onSelectOrder={handleSelectOrder}
            onBack={() => setCurrentScreen('discovery')}
          />
        )}

        {currentScreen === 'vendor' && <VendorDashboard />}

        {currentScreen === 'admin' && <AdminDashboard />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>NearMart © 2026 — Local Hyperlocal Commerce Platform</p>
      </footer>

      {/* Overlays / Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={handleGoToCheckout}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainApp />
      </CartProvider>
    </AuthProvider>
  );
}
