import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCircle2, XCircle, ClipboardList, Ticket, Target, PlusCircle,
  Megaphone, Rocket, PartyPopper, Laptop, Package, AlertTriangle,
  Wallet, Ban, FileEdit, Banknote, BellRing,
} from 'lucide-react';
import api from '../../utils/api';

const TYPE_CFG = {
  LEAVE_APPROVED:      { Icon: CheckCircle2,  color: '#16a34a' },
  LEAVE_REJECTED:      { Icon: XCircle,       color: '#dc2626' },
  LEAVE_REQUEST:       { Icon: ClipboardList, color: '#2563eb' },
  TICKET_UPDATE:       { Icon: Ticket,        color: '#7c3aed' },
  TICKET_ASSIGNED:     { Icon: Target,        color: '#ea580c' },
  TICKET_NEW:          { Icon: PlusCircle,    color: '#0891b2' },
  ANNOUNCEMENT:        { Icon: Megaphone,     color: '#2563eb' },
  ONBOARDING_ASSIGNED: { Icon: Rocket,        color: '#7c3aed' },
  ONBOARDING_COMPLETE: { Icon: PartyPopper,   color: '#16a34a' },
  ASSET_ASSIGNED:      { Icon: Laptop,        color: '#0891b2' },
  ASSET_RETURNED:      { Icon: Package,       color: '#6b7280' },
  WARNING_ISSUED:      { Icon: AlertTriangle, color: '#d97706' },
  EXPENSE_APPROVED:    { Icon: Wallet,        color: '#16a34a' },
  EXPENSE_REJECTED:    { Icon: Ban,           color: '#dc2626' },
  RESIGNATION_UPDATE:  { Icon: FileEdit,      color: '#9333ea' },
  SALARY_UPDATE:       { Icon: Banknote,      color: '#059669' },
  GENERAL:             { Icon: BellRing,      color: '#6b7280' },
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
    <div ref={ref} className="notification-bell-wrap" style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="notification-bell-btn"
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 44, minHeight: 44,
        }}
        aria-label="Notifications"
      >
        <Bell size={22} strokeWidth={2} color="#374151" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9,
            background: '#dc2626', color: '#fff', fontSize: '0.7rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
            lineHeight: 1, border: '2px solid #fff',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown" style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 380, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(480px, 75vh)',
          background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e5e7eb',
        }}>
          {/* Header */}
          <div className="notification-dropdown-header" style={{
            padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
              Notifications {unreadCount > 0 && <span style={{ color: '#dc2626' }}>({unreadCount})</span>}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="notification-dropdown-action">
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button type="button" onClick={clearAll} className="notification-dropdown-action notification-dropdown-action--muted">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="notification-dropdown-list" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: '0.88rem' }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                  <BellRing size={32} strokeWidth={1.5} color="#d1d5db" />
                </div>
                <p style={{ color: '#9ca3af', fontSize: '0.88rem', margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleClick(n)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick(n); }}
                  className="notification-dropdown-item"
                  style={{
                    padding: '14px 16px', display: 'flex', gap: 10, cursor: n.link ? 'pointer' : 'default',
                    background: n.isRead ? '#fff' : '#f0f7ff', borderBottom: '1px solid #f3f4f6',
                    transition: 'background 0.15s', minHeight: 56,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = n.isRead ? '#f9fafb' : '#e0effe'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = n.isRead ? '#fff' : '#f0f7ff'; }}
                >
                  <span style={{
                    flexShrink: 0, marginTop: 2, width: 32, height: 32, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: (TYPE_CFG[n.type]?.color || '#6b7280') + '14',
                  }}>
                    {(() => { const cfg = TYPE_CFG[n.type] || TYPE_CFG.GENERAL; return <cfg.Icon size={16} strokeWidth={2} color={cfg.color} />; })()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="notification-dropdown-item-title" style={{
                      margin: 0, fontWeight: n.isRead ? 500 : 700, fontSize: '0.85rem',
                      color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis',
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
