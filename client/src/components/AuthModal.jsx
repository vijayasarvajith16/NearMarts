import React, { useState } from 'react';
import { X, User, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { login, signup, loading } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('buyer'); // 'buyer' | 'vendor'
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else {
        await signup({ ...formData, role });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="nm-modal-overlay">
      <div className="nm-modal-card">
        <div className="flex justify-between items-center mb-4">
          <span className="pill-tag-aloe">{mode === 'login' ? 'Welcome Back' : 'Join NearMart'}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <h2 className="heading-lg text-white mb-2">
          {mode === 'login' ? 'Sign in to your account' : 'Create your NearMart account'}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          {mode === 'login' ? 'Access local neighborhood commerce' : 'Order local artisan goods with direct hyper-local delivery'}
        </p>

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <>
              {/* Role selector */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setRole('buyer')}
                  className={role === 'buyer' ? 'btn-aloe text-xs py-2' : 'btn-secondary text-xs py-2'}
                >
                  <User size={15} /> Buyer
                </button>
                <button
                  type="button"
                  onClick={() => setRole('vendor')}
                  className={role === 'vendor' ? 'btn-aloe text-xs py-2' : 'btn-secondary text-xs py-2'}
                >
                  <Shield size={15} /> Merchant
                </button>
              </div>

              <div>
                <label className="input-label">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </>
          )}

          <div>
            <label className="input-label">Email Address</label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              className="input-field"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="input-label">Phone (+91...)</label>
              <input
                type="tel"
                required
                placeholder="+919876543210"
                className="input-field"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="input-label">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="input-field"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-aloe w-full py-3 mt-2">
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <span onClick={() => setMode('signup')} style={{ color: 'var(--color-aloe-10)', fontWeight: 700, cursor: 'pointer' }}>
                Sign Up
              </span>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <span onClick={() => setMode('login')} style={{ color: 'var(--color-aloe-10)', fontWeight: 700, cursor: 'pointer' }}>
                Sign In
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
