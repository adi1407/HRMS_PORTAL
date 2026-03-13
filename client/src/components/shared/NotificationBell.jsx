import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../../utils/api';

const TYPE_ICONS = {
  LEAVE_APPROVED: '✅', LEAVE_REJECTED: '❌', LEAVE_REQUEST: '📋',
  TICKET_UPDATE: '🎫', TICKET_ASSIGNED: '🎯', TICKET_NEW: '🆕',
  ANNOUNCEMENT: '📢',
  ONBOARDING_ASSIGNED: '🚀', ONBOARDING_COMPLETE: '🎉',
  ASSET_ASSIGNED: '💻', ASSET_RETURNED: '📦',
  WARNING_ISSUED: '⚠️',
  EXPENSE_APPROVED: '💰', EXPENSE_REJECTED: '🚫',
  RESIGNATION_UPDATE: '📝',
  SALARY_UPDATE: '💵',
  GENERAL: '🔔',
};

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  return day === 1 ? 'yesterday' : `${day}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.data.count);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/my?limit=20');
      setNotifications(data.data.notifications);
      setUnreadCount(data.data.unreadCount);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true, readAt: new Date() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  };

  const handleClick = (notif) => {
    if (!notif.isRead) markRead(notif._id);
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={2} color="#374151" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8,
            background: '#dc2626', color: '#fff', fontSize: '0.65rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
            lineHeight: 1, border: '2px solid #fff',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 380, maxWidth: 'calc(100vw - 32px)', maxHeight: 480,
          background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e5e7eb',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
              Notifications {unreadCount > 0 && <span style={{ color: '#dc2626' }}>({unreadCount})</span>}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{
                  background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600,
                }}>Mark all read</button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} style={{
                  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600,
                }}>Clear all</button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: '0.88rem' }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔔</div>
                <p style={{ color: '#9ca3af', fontSize: '0.88rem', margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '12px 16px', display: 'flex', gap: 10, cursor: n.link ? 'pointer' : 'default',
                    background: n.isRead ? '#fff' : '#f0f7ff', borderBottom: '1px solid #f3f4f6',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = n.isRead ? '#f9fafb' : '#e0effe'}
                  onMouseLeave={e => e.currentTarget.style.background = n.isRead ? '#fff' : '#f0f7ff'}
                >
                  <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: 2 }}>
                    {TYPE_ICONS[n.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontWeight: n.isRead ? 500 : 700, fontSize: '0.85rem',
                      color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{n.title}</p>
                    <p style={{
                      margin: '2px 0 0', fontSize: '0.78rem', color: '#6b7280',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{n.message}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, background: '#2563eb', flexShrink: 0, marginTop: 6,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
