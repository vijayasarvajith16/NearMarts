'use strict';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Store, ArrowRight, Sparkles, Filter, Package } from 'lucide-react';
import { vendorAPI, productAPI } from '../services/api';

const CITY_COORDINATES = {
  bengaluru: { lng: 77.5946, lat: 12.9716, name: 'Bengaluru' },
  mumbai:    { lng: 72.8777, lat: 19.0760, name: 'Mumbai' },
  delhi:     { lng: 77.2090, lat: 28.6139, name: 'Delhi' },
  chennai:   { lng: 80.2707, lat: 13.0827, name: 'Chennai' },
  hyderabad: { lng: 78.4867, lat: 17.3850, name: 'Hyderabad' },
  kolkata:   { lng: 88.3639, lat: 22.5726, name: 'Kolkata' },
};

export default function DiscoveryScreen({ onSelectStore, onSelectVendor, onCityChange }) {
  const [selectedCityKey, setSelectedCityKey] = useState('bengaluru');
  const [coords, setCoords] = useState(CITY_COORDINATES.bengaluru);
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vendors, setVendors] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Browser Geolocation on Mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lng: position.coords.longitude,
            lat: position.coords.latitude,
          });
        },
        (err) => {
          console.warn('[Discovery] Geolocation unavailable, using fallback city:', err.message);
        }
      );
    }
  }, []);

  // 2. Fetch Nearby Vendors
  const fetchNearbyVendors = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorAPI.getNearby(coords.lng, coords.lat, category);
      setVendors(data.vendors || []);
      setSearchResults(null);
    } catch (err) {
      setError(err.message || 'Failed to load nearby vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNearbyVendors();
  }, [coords, category]);

  // Handle Manual City Change
  const handleCitySelect = (cityKey) => {
    setSelectedCityKey(cityKey);
    const selected = CITY_COORDINATES[cityKey];
    if (selected) {
      setCoords({ lng: selected.lng, lat: selected.lat });
      if (onCityChange) onCityChange(selected.name);
    }
  };

  // Product Text Search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await productAPI.search(searchQuery, selectedCityKey, category);
      setSearchResults(data.products || []);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorClick = (vendorId) => {
    const fn = onSelectStore || onSelectVendor;
    if (fn) fn(vendorId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Cinematic Shopify-Style Hero Section (DESIGN-shopify.md) */}
      <div className="card-cinematic p-8 sm:p-12 relative overflow-hidden" style={{ border: '1px solid rgba(255, 255, 255, 0.12)' }}>
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2">
            <span className="pill-tag-aloe">
              <Sparkles size={13} /> HYPERLOCAL COMMERCE
            </span>
          </div>

          <h1 className="display-xxl text-white">
            Artisans & Merchants. <br />
            <span style={{ color: 'var(--color-shade-40)' }}>Right in Your Neighborhood.</span>
          </h1>

          <p className="text-slate-400 text-base max-w-xl" style={{ lineHeight: 1.6 }}>
            Direct ordering from neighborhood bakeries, indie roasters, urban growers, and artisan makers. Fresh, immediate delivery.
          </p>

          {/* Unified Shopify Search Pill */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="nm-search-container">
              <Search size={18} className="nm-search-icon" />
              <input
                type="text"
                placeholder="Search products (sourdough, artisan coffee, plants)..."
                className="nm-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn-aloe text-xs py-2 px-6 shrink-0">
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Filter Bar: Category Pills & City Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1 shrink-0">
            <Filter size={13} /> Filter:
          </span>
          {['all', 'bakery', 'handmade', 'produce', 'plants', 'other'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`nm-category-pill ${category === cat ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* City Selector Pill */}
        <div className="nm-city-pill">
          <MapPin size={14} className="text-aloe" />
          <span className="text-slate-400 text-xs">City:</span>
          <select
            className="nm-city-select"
            value={selectedCityKey}
            onChange={(e) => handleCitySelect(e.target.value)}
          >
            {Object.entries(CITY_COORDINATES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.name}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Content Section: Product Search Results or Nearby Vendors Grid */}
      {searchResults ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="heading-xl text-white">
              Results for "{searchQuery}" ({searchResults.length})
            </h2>
            <button onClick={() => setSearchResults(null)} className="btn-secondary text-xs">
              Clear Search
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="card-glass p-12 text-center text-slate-400 space-y-3 rounded-xl">
              <Package size={36} className="mx-auto text-slate-500" />
              <p className="text-base font-semibold text-white">No products found matching "{searchQuery}"</p>
              <p className="text-xs">Try searching for other items or browse all nearby merchant stores.</p>
              <button onClick={() => setSearchResults(null)} className="btn-primary text-xs mt-2">
                Browse All Stores
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {searchResults.map((prod) => (
                <div key={prod._id} className="card-glass p-5 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="w-full h-44 rounded-lg bg-slate-900 border border-white/10 overflow-hidden mb-3">
                      <img
                        src={prod.images?.[0] || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80'}
                        alt={prod.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="pill-tag-shade mb-2">
                      {prod.category}
                    </span>
                    <h3 className="font-bold text-white text-base mt-1">{prod.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{prod.description}</p>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-4">
                    <span className="font-bold text-emerald text-base">
                      ₹{((prod.price || 0) / 100).toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleVendorClick(prod.vendorId)}
                      className="btn-aloe text-xs py-1.5 px-3"
                    >
                      Visit Store
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Nearby Merchants Section */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="heading-xl text-white">Nearby Verified Merchants</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Local stores within your delivery perimeter in <span className="capitalize text-white font-medium">{selectedCityKey}</span>
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {vendors.length} {vendors.length === 1 ? 'store' : 'stores'} found
            </span>
          </div>

          {loading ? (
            <div className="card-glass p-16 text-center text-slate-400 rounded-xl space-y-3">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto" />
              <p className="text-sm">Scanning hyperlocal radius for verified merchants...</p>
            </div>
          ) : vendors.length === 0 ? (
            /* Clean Fresh Platform Empty State */
            <div className="card-glass p-12 text-center text-slate-400 space-y-4 rounded-xl" style={{ border: '1px dashed rgba(255, 255, 255, 0.15)' }}>
              <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center text-aloe mx-auto">
                <Store size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No Stores Currently Active in {CITY_COORDINATES[selectedCityKey]?.name || 'this city'}</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  This is a fresh platform installation. You can onboard new artisan stores through the Seller Hub or switch to another city.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => handleCitySelect('bengaluru')}
                  className="btn-secondary text-xs"
                >
                  Switch City
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map((vendor) => (
                <div
                  key={vendor._id}
                  onClick={() => handleVendorClick(vendor._id)}
                  className="card-glass p-6 rounded-xl flex flex-col justify-between cursor-pointer group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-11 h-11 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-white">
                        <Store size={20} />
                      </div>
                      <span className="pill-tag-aloe">
                        {vendor.category || 'Bakery'}
                      </span>
                    </div>

                    <div>
                      <h3 className="heading-md text-white group-hover:text-aloe transition-colors">
                        {vendor.storeName}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {vendor.description || 'Authentic local artisan specialties prepared fresh daily.'}
                      </p>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-1 pt-1">
                      <MapPin size={12} className="text-aloe" />
                      <span className="capitalize">{vendor.city}</span>
                      {vendor.address?.line1 && (
                        <span>• {vendor.address.line1}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-5">
                    <div className="flex items-center gap-1 text-amber text-xs font-bold">
                      <Star size={13} className="fill-amber" />
                      <span>{vendor.rating?.average?.toFixed(1) || '4.9'}</span>
                      <span className="text-slate-500 font-normal">({vendor.rating?.count || 12})</span>
                    </div>
                    
                    <span className="btn-secondary text-xs py-1.5 px-3.5 group-hover:bg-white group-hover:text-black">
                      View Menu <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
