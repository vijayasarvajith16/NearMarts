'use strict';

import React, { useState, useEffect } from 'react';
import { reviewAPI } from '../services/api';
import { Star, MessageSquare, Send, RefreshCw } from 'lucide-react';

export default function ReviewManagement({ vendorStore }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyTextMap, setReplyTextMap] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  const fetchReviews = async () => {
    if (!vendorStore?._id) return;
    setLoading(true);
    try {
      const data = await reviewAPI.getVendorReviews(vendorStore._id);
      setReviews(data.reviews || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.warn('Failed to load reviews:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [vendorStore]);

  const handleReplyChange = (reviewId, text) => {
    setReplyTextMap((prev) => ({ ...prev, [reviewId]: text }));
  };

  const handleSendResponse = async (e, reviewId) => {
    e.preventDefault();
    const text = replyTextMap[reviewId]?.trim();
    if (!text) return;

    setSubmittingId(reviewId);
    try {
      const res = await reviewAPI.addResponse(reviewId, text);
      const updatedReview = res.review || res;
      setReviews((prev) => prev.map((r) => (r._id === reviewId ? { ...r, ...updatedReview } : r)));
      setReplyTextMap((prev) => ({ ...prev, [reviewId]: '' }));
    } catch (err) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Rating Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="heading-xl text-white flex items-center gap-2">
            <Star size={22} className="text-amber fill-amber" /> Customer Reviews & Ratings
          </h2>
          <p className="text-xs text-slate-400">Read verified buyer feedback and publish responses</p>
        </div>

        {summary && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900 border border-white/10">
            <div className="text-xl font-bold text-amber flex items-center gap-1">
              <Star size={18} className="fill-amber" />
              {summary.avgRating?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-xs text-slate-400">
              <div>Average Rating</div>
              <div>{summary.totalReviews || 0} reviews</div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card-glass p-12 text-center text-slate-400 rounded-xl">
          <RefreshCw className="animate-spin mx-auto mb-2 text-white" size={24} />
          <p className="text-xs">Loading customer reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card-glass p-12 text-center text-slate-400 space-y-2 rounded-xl">
          <MessageSquare size={36} className="mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-white">No customer reviews yet</p>
          <p className="text-xs text-slate-500">Reviews will appear here once customers receive their orders.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div key={rev._id} className="card-glass p-5 rounded-xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= rev.rating ? 'text-amber fill-amber' : 'text-slate-600'}
                      />
                    ))}
                    <span className="text-xs font-bold text-slate-200 ml-2">{rev.rating}.0 / 5.0</span>
                  </div>
                  <p className="text-sm text-slate-200">{rev.comment}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(rev.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Existing Vendor Response */}
              {rev.vendorResponse && (
                <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                  <div className="text-[11px] font-bold text-aloe uppercase tracking-wider">Your Response</div>
                  <p className="text-xs text-slate-300">{rev.vendorResponse.text}</p>
                  <span className="text-[10px] text-slate-500">
                    {new Date(rev.vendorResponse.respondedAt).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Reply Form if not replied */}
              {!rev.vendorResponse && (
                <form onSubmit={(e) => handleSendResponse(e, rev._id)} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Write a public reply to this customer..."
                    value={replyTextMap[rev._id] || ''}
                    onChange={(e) => handleReplyChange(rev._id, e.target.value)}
                    className="input-field py-1.5 px-3 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={submittingId === rev._id || !replyTextMap[rev._id]?.trim()}
                    className="btn-aloe text-xs py-1.5 px-3 shrink-0"
                  >
                    {submittingId === rev._id ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
                    Reply
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
