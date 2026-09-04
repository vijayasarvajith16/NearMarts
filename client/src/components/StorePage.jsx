'use strict';

import React, { useState, useEffect } from 'react';
import { vendorAPI, productAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { ArrowLeft, Star, MapPin, ShoppingBag, Check, Plus, RefreshCw, Store } from 'lucide-react';

export default function StorePage({ vendorId, onBack, onGoToCheckout }) {
  const { cart, addToCart } = useCart();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedMap, setAddedMap] = useState({});

  useEffect(() => {
    if (!vendorId) return;

    let isMounted = true;
    setLoading(true);

    Promise.all([
      vendorAPI.getById(vendorId).catch(() => null),
      productAPI.getByVendor(vendorId).catch(() => ({ products: [] })),
    ])
      .then(([vendorRes, productRes]) => {
        if (!isMounted) return;
        setVendor(vendorRes?.vendor || null);
        setProducts(productRes?.products || []);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load store:', err);
        setError(err.message || 'Failed to load store profile');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [vendorId]);

  const handleAddToCart = async (prod) => {
    try {
      await addToCart(prod._id, 1);
      setAddedMap((prev) => ({ ...prev, [prod._id]: true }));
      setTimeout(() => {
        setAddedMap((prev) => ({ ...prev, [prod._id]: false }));
      }, 1500);
    } catch (err) {
      alert(err.message || 'Failed to add item to cart');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400 space-y-3">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto" />
        <p className="text-sm">Opening store catalog...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Back & Sticky Cart Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-2">
          <ArrowLeft size={15} /> Back to Merchant Search
        </button>

        {cart?.totalItems > 0 && (
          <button onClick={onGoToCheckout} className="btn-aloe text-xs py-2 px-4 font-bold flex items-center gap-2">
            <span>Checkout ({cart.totalItems} items)</span>
            <ShoppingBag size={15} />
          </button>
        )}
      </div>

      {/* Merchant Hero Banner (DESIGN-shopify.md Level 1 Elevation) */}
      <div className="card-cinematic p-8 sm:p-10 relative overflow-hidden">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="pill-tag-aloe">{vendor?.category || 'General'}</span>
            <div className="flex items-center gap-1 text-xs font-bold text-amber px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/10">
              <Star size={13} className="fill-amber" /> {vendor?.trustScore?.toFixed(1) || '4.9'} Verified
            </div>
          </div>

          <h1 className="display-xl text-white font-light">
            {vendor?.storeName || 'Merchant Store'}
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            {vendor?.description || 'Authentic local artisan specialties prepared fresh daily.'}
          </p>

          <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
            <MapPin size={14} className="text-aloe" />
            <span>{vendor?.address?.line1 || vendor?.city}, <span className="capitalize">{vendor?.city}</span></span>
          </div>
        </div>
      </div>

      {/* Catalog Grid Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="heading-xl text-white flex items-center gap-2">
            <Store size={22} className="text-aloe" /> Merchant Catalog ({products.length} Items)
          </h2>
          <span className="text-xs text-slate-400">Fresh daily items</span>
        </div>

        {products.length === 0 ? (
          <div className="card-glass p-16 text-center text-slate-400 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-white">This merchant currently has no available products.</p>
            <p className="text-xs text-slate-500">Check back soon for freshly listed inventory.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((prod) => {
              const isAdded = addedMap[prod._id];

              return (
                <div
                  key={prod._id}
                  className="card-glass p-5 rounded-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="h-44 rounded-lg bg-slate-900 mb-3 overflow-hidden relative border border-white/10">
                      <img
                        src={prod.images?.[0] || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80'}
                        alt={prod.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950 text-slate-200 border border-white/10">
                        {prod.stock > 0 ? `${prod.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>

                    <span className="pill-tag-shade mb-2">
                      {prod.category}
                    </span>

                    <h3 className="font-bold text-white text-base mt-1">
                      {prod.name}
                    </h3>
                    <p className="text-slate-400 text-xs line-clamp-2 mt-1">
                      {prod.description}
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex items-center justify-between gap-2 mt-4">
                    <span className="text-base font-bold text-emerald">
                      ₹{((prod.price || 0) / 100).toFixed(2)}
                    </span>

                    <button
                      onClick={() => handleAddToCart(prod)}
                      disabled={prod.stock <= 0}
                      className="btn-aloe py-1.5 px-3.5 text-xs font-bold"
                    >
                      {isAdded ? (
                        <>
                          <Check size={13} /> Added
                        </>
                      ) : (
                        <>
                          <Plus size={13} /> Add to Cart
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
