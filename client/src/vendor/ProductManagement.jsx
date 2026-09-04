'use strict';

import React, { useState, useEffect } from 'react';
import { productAPI } from '../services/api';
import { Plus, Edit2, Trash2, Package, X, RefreshCw } from 'lucide-react';

export default function ProductManagement({ vendorStore }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'bakery',
    price: '', // in Rupees
    stock: 10,
    unit: 'piece',
    imageUrl: '',
    tags: '',
  });

  const fetchProducts = async () => {
    if (!vendorStore?._id) return;
    setLoading(true);
    try {
      const data = await productAPI.getByVendor(vendorStore._id);
      setProducts(Array.isArray(data.products) ? data.products : []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [vendorStore]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      category: vendorStore?.category || 'bakery',
      price: '',
      stock: 20,
      unit: 'piece',
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
      tags: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name || '',
      description: prod.description || '',
      category: prod.category || 'bakery',
      price: prod.price ? (prod.price / 100).toString() : '',
      stock: prod.stock ?? 10,
      unit: prod.unit || 'piece',
      imageUrl: prod.images?.[0] || '',
      tags: Array.isArray(prod.tags) ? prod.tags.join(', ') : '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await productAPI.delete(id);
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      alert('Product name and price are required');
      return;
    }

    setSubmitting(true);
    try {
      const pricePaise = Math.round(parseFloat(formData.price) * 100);
      const tagsArray = formData.tags
        ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        price: pricePaise,
        stock: parseInt(formData.stock, 10) || 0,
        unit: formData.unit || 'piece',
        images: formData.imageUrl ? [formData.imageUrl.trim()] : [],
        tags: tagsArray,
      };

      if (editingProduct) {
        const updated = await productAPI.update(editingProduct._id, payload);
        setProducts((prev) => prev.map((p) => (p._id === editingProduct._id ? updated.product || updated : p)));
      } else {
        const created = await productAPI.create(payload);
        setProducts((prev) => [created.product || created, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="heading-xl text-white flex items-center gap-2">
            <Package size={22} className="text-aloe" /> Product Catalog & Inventory
          </h2>
          <p className="text-xs text-slate-400">Manage item pricing, stock levels & menu offerings</p>
        </div>

        <button onClick={handleOpenCreateModal} className="btn-aloe text-xs py-2 px-4 flex items-center gap-1.5">
          <Plus size={15} /> Add New Product
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-slate-900 border border-rose text-rose text-xs">
          {error}
        </div>
      )}

      {/* Product Table */}
      <div className="nm-table-wrapper">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="animate-spin mx-auto text-white" size={24} />
            <p className="text-xs">Loading product catalog...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Package size={36} className="mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-white">No products in your catalog yet.</p>
            <p className="text-xs text-slate-500">Add your first artisan product to start selling.</p>
            <button onClick={handleOpenCreateModal} className="btn-primary text-xs py-2 px-4 mt-2">
              <Plus size={13} /> Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="nm-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => (
                  <tr key={prod._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/10 overflow-hidden shrink-0">
                          <img
                            src={prod.images?.[0] || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80'}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{prod.name}</div>
                          <div className="text-xs text-slate-400">{prod.description?.substring(0, 50)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="pill-tag-shade">
                        {prod.category}
                      </span>
                    </td>
                    <td className="font-bold text-emerald text-sm">
                      ₹{((prod.price || 0) / 100).toFixed(2)}
                    </td>
                    <td>
                      <span className={prod.stock > 5 ? 'pill-tag-emerald' : 'pill-tag-amber'}>
                        {prod.stock} {prod.unit || 'units'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(prod)}
                          className="btn-secondary text-xs py-1 px-2.5"
                          title="Edit Product"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod._id)}
                          className="btn-danger text-xs py-1 px-2.5"
                          title="Delete Product"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="nm-modal-overlay">
          <div className="nm-modal-card space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="heading-md text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Sourdough Artisan Loaf"
                />
              </div>

              <div>
                <label className="input-label">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  placeholder="Describe ingredients, taste or craft..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="input-label">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input-field"
                    placeholder="250.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="input-label">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="input-field"
                    placeholder="piece, kg, box"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Image URL</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-aloe text-xs"
                >
                  {submitting ? <RefreshCw className="animate-spin" size={13} /> : null}
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
