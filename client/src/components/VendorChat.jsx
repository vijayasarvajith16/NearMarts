'use strict';

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, RefreshCw } from 'lucide-react';
import { realtimeAPI } from '../services/api';
import { io } from 'socket.io-client';

export default function VendorChat({ orderId, vendorId, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Initial messages fetch via REST
  useEffect(() => {
    if (!orderId) return;

    realtimeAPI
      .getMessages(orderId)
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load chat history:', err.message);
        setLoading(false);
      });
  }, [orderId]);

  // 2. Connect directly to Socket.io port 4007
  useEffect(() => {
    const token = localStorage.getItem('nearmart_token');
    const s = io('http://localhost:4007', {
      auth: { token },
      transports: ['websocket'],
    });

    s.on('connect', () => {
      s.emit('order:track', { orderId });
    });

    s.on('vendor:message', (msg) => {
      if (msg.orderId === orderId) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [orderId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || !socket) return;

    const payload = {
      orderId,
      toUserId: vendorId,
      text: text.trim(),
    };

    socket.emit('vendor:message', payload);
    setText('');
  };

  return (
    <div className="nm-chat-box">
      {/* Header */}
      <div className="nm-chat-header">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-aloe" />
          <span className="text-xs font-bold text-white">Merchant Live Messaging</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Socket.io Connected</span>
      </div>

      {/* Messages List */}
      <div className="nm-chat-list">
        {loading ? (
          <div className="text-center py-10 text-slate-400">
            <RefreshCw className="animate-spin mx-auto text-white mb-2" size={18} />
            <span className="text-xs">Loading message thread...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No messages yet. Send a note to the store.
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.fromUserId === currentUserId;
            return (
              <div
                key={m._id || idx}
                className={`nm-chat-bubble ${isMe ? 'me' : 'them'}`}
              >
                <div>{m.text}</div>
                <div
                  className={`text-[9px] mt-1 ${
                    isMe ? 'text-slate-600 text-right' : 'text-slate-400 text-left'
                  }`}
                >
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2 bg-slate-900">
        <input
          type="text"
          placeholder="Type message to merchant..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input-field py-1.5 px-3 text-xs"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="btn-aloe text-xs py-1.5 px-3 shrink-0"
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}
