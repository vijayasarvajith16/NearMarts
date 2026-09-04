'use strict';

import React from 'react';
import { useCart } from '../context/CartContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export default function CartDrawer({ onCheckout }) {
  const { cart, isDrawerOpen, setIsDrawerOpen, updateQuantity, removeFromCart, clearCart } = useCart();

  if (!isDrawerOpen) return null;

  return (
    <div className="nm-drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
      <div className="nm-drawer-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-aloe" />
              <h2 className="heading-md text-white">Your Cart</h2>
              <span className="text-xs text-slate-400">({cart.totalItems} items)</span>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="text-slate-400 hover:text-white p-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
            {cart.items.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <ShoppingBag size={40} className="mx-auto text-slate-600" />
                <p className="text-sm font-semibold text-white">Your cart is empty</p>
                <p className="text-xs text-slate-500">Add fresh local products from neighborhood merchants.</p>
              </div>
            ) : (
              cart.items.map((item) => (
                <div
                  key={item.productId}
                  className="p-3.5 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-800 border border-white/10 overflow-hidden shrink-0">
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=150&q=80'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{item.name}</h4>
                    <div className="text-xs text-emerald font-bold mt-0.5">
                      ₹{((item.price * item.quantity) / 100).toFixed(2)}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 bg-black px-2 py-1 rounded-full border border-white/10">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="text-slate-400 hover:text-white p-0.5"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold text-white px-1.5">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="text-slate-400 hover:text-white p-0.5"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-slate-500 hover:text-rose p-1"
                    title="Remove item"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Drawer Footer Checkout CTA */}
        {cart.items.length > 0 && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-xl font-extrabold text-white font-display">
                ₹{((cart.subtotalAmount || 0) / 100).toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => {
                setIsDrawerOpen(false);
                if (onCheckout) onCheckout();
              }}
              className="btn-aloe w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={clearCart}
              className="btn-secondary w-full text-xs py-1.5"
            >
              Clear Cart
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
