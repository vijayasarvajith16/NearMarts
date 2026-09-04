'use strict';

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderAPI, paymentAPI } from '../services/api';
import { ArrowLeft, CreditCard, Banknote, ShieldCheck, MapPin, Check, RefreshCw, ShoppingBag } from 'lucide-react';

export default function CheckoutScreen({ onOrderCreated, onBack }) {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();

  const [address, setAddress] = useState({
    line1: '',
    city: 'bengaluru',
    pincode: '',
    phone: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('ONLINE'); // 'ONLINE' | 'COD'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const deliveryFee = 3000; // ₹30 in paise
  const finalTotal = (cart?.subtotalAmount || 0) + deliveryFee;

  const handleCreateOrder = async (e) => {
    e.preventDefault();

    if (!cart?.vendorId || cart.items.length === 0) {
      alert('Your cart is empty or invalid');
      return;
    }

    if (!address.line1.trim() || !address.phone.trim()) {
      alert('Please fill in complete delivery address details');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create order in order-service
      const orderPayload = {
        vendorId: cart.vendorId,
        items: cart.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
        })),
        deliveryAddress: {
          line1: address.line1.trim(),
          city: address.city.trim().toLowerCase(),
          pincode: address.pincode.trim(),
        },
        deliveryFeePaise: deliveryFee,
        paymentMethod: paymentMethod,
      };

      const orderRes = await orderAPI.create(orderPayload);
      const order = orderRes.order;

      // 2. Handle Payment Flow
      if (paymentMethod === 'ONLINE' && order.razorpayOrderId) {
        // Razorpay Checkout.js Integration
        if (typeof window.Razorpay === 'undefined') {
          // If script not loaded, auto-simulate verify
          try {
            await paymentAPI.verify({
              razorpayOrderId: order.razorpayOrderId,
              razorpayPaymentId: 'pay_mock_' + Date.now(),
              razorpaySignature: 'mock_sig_pass',
            });
          } catch (verErr) {
            console.warn('[Checkout] Verification fallback:', verErr.message);
          }
        } else {
          // Real modal trigger
          const options = {
            key: 'rzp_test_mockkey',
            amount: finalTotal,
            currency: 'INR',
            name: 'NearMart Commerce',
            description: `Order #${order.orderNumber}`,
            order_id: order.razorpayOrderId,
            handler: async function (response) {
              await paymentAPI.verify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
            },
            prefill: {
              name: user?.name || 'Valued Customer',
              email: user?.email || 'customer@example.com',
              contact: address.phone,
            },
            theme: { color: '#c1fbd4' },
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      }

      await clearCart();
      if (onOrderCreated) {
        onOrderCreated(order._id);
      }
    } catch (err) {
      console.error('[Checkout] Error creating order:', err);
      setError(err.message || 'Failed to complete order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-3xl py-20 text-center text-slate-400 space-y-4">
        <ShoppingBag size={48} className="mx-auto text-slate-600" />
        <h2 className="heading-xl text-white">Your Cart is Empty</h2>
        <p className="text-xs text-slate-500">Add items from nearby merchants before proceeding to checkout.</p>
        <button onClick={onBack} className="btn-primary text-xs mt-2">
          Back to Stores
        </button>
      </div>
    );
  }

  return (
    <div className="container-5xl py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-secondary text-xs py-1.5 px-3">
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="heading-xl text-white">Order Checkout</h1>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-slate-900 border border-rose text-rose text-xs">
          {error}
        </div>
      )}

      {/* Checkout Grid */}
      <div className="lg-checkout-grid">
        
        {/* Left Column: Delivery Details & Payment */}
        <form onSubmit={handleCreateOrder} className="space-y-6">
          {/* Address Details Card */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="heading-md text-white flex items-center gap-2">
              <MapPin size={18} className="text-aloe" /> 1. Delivery Address
            </h2>

            <div>
              <label className="input-label">Street Address & Landmark *</label>
              <input
                type="text"
                required
                placeholder="e.g. Flat 302, Palm Grove, 4th Cross"
                value={address.line1}
                onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">City *</label>
                <input
                  type="text"
                  required
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Pincode *</label>
                <input
                  type="text"
                  required
                  placeholder="560001"
                  value={address.pincode}
                  onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Contact Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {/* Payment Method Toggle Card */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="heading-md text-white flex items-center gap-2">
              <CreditCard size={18} className="text-aloe" /> 2. Payment Method
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {/* Online Razorpay Pill */}
              <div
                onClick={() => setPaymentMethod('ONLINE')}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  paymentMethod === 'ONLINE'
                    ? 'bg-slate-900 border-white text-white'
                    : 'bg-black border-white/10 text-slate-400 hover:border-white/30'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <CreditCard size={20} className={paymentMethod === 'ONLINE' ? 'text-aloe' : 'text-slate-500'} />
                  {paymentMethod === 'ONLINE' && <Check size={16} className="text-aloe" />}
                </div>
                <div>
                  <span className="font-bold text-sm block text-white">Online Payment</span>
                  <span className="text-[11px] text-slate-400">UPI, Cards, Netbanking</span>
                </div>
              </div>

              {/* COD Option */}
              <div
                onClick={() => setPaymentMethod('COD')}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  paymentMethod === 'COD'
                    ? 'bg-slate-900 border-white text-white'
                    : 'bg-black border-white/10 text-slate-400 hover:border-white/30'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <Banknote size={20} className={paymentMethod === 'COD' ? 'text-aloe' : 'text-slate-500'} />
                  {paymentMethod === 'COD' && <Check size={16} className="text-aloe" />}
                </div>
                <div>
                  <span className="font-bold text-sm block text-white">Cash on Delivery</span>
                  <span className="text-[11px] text-slate-400">Pay when delivered</span>
                </div>
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-aloe w-full py-3.5 text-base font-bold shadow-lg"
          >
            {submitting ? (
              <>
                <RefreshCw className="animate-spin" size={18} /> Processing...
              </>
            ) : (
              `Place Order • ₹${(finalTotal / 100).toFixed(2)}`
            )}
          </button>
        </form>

        {/* Right Column: Order Summary Card */}
        <div>
          <div className="card-glass p-6 rounded-xl space-y-4 sticky top-24">
            <h2 className="heading-md text-white border-b border-white/10 pb-3">
              Order Summary
            </h2>

            {/* Items */}
            <div className="space-y-3">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex justify-between text-xs">
                  <div className="flex-1 pr-2">
                    <span className="text-white font-medium">{item.name}</span>
                    <span className="text-slate-500 block">Qty: {item.quantity}</span>
                  </div>
                  <span className="font-bold text-white">
                    ₹{((item.price * item.quantity) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Items Subtotal</span>
                <span>₹{((cart.subtotalAmount || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Delivery Fee</span>
                <span>₹{(deliveryFee / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-300">Total Amount</span>
              <span className="text-xl font-extrabold text-emerald font-display">
                ₹{(finalTotal / 100).toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-white/5 flex items-center gap-2 text-xs text-slate-400 mt-2">
              <ShieldCheck size={16} className="text-aloe shrink-0" />
              <span>Direct delivery from local verified artisan merchant.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
