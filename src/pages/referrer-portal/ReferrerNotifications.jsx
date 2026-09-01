import React, { useState } from 'react';
import { Bell, CheckCheck, DollarSign, CreditCard, RefreshCw, Car } from 'lucide-react';
import {
  referrerGetNotifications,
  referrerMarkNotificationRead,
  referrerMarkAllNotificationsRead,
  formatDate,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { EmptyState, ReferrerState } from './ReferrerStates';

/** Icon and accent per notification type, so the feed is scannable. */
const STYLE = {
  referrer_code_redeemed: { icon: Car, color: '#10b981' },
  referrer_commission_matured: { icon: DollarSign, color: '#3b82f6' },
  referrer_payout_approved: { icon: CreditCard, color: '#3b82f6' },
  referrer_payout_paid: { icon: CreditCard, color: '#10b981' },
  referrer_payout_rejected: { icon: CreditCard, color: '#dc2626' },
  referrer_code_reissued: { icon: RefreshCw, color: '#f59e0b' },
};

export default function ReferrerNotifications() {
  const req = useReferrerData(referrerGetNotifications, []);
  const [busy, setBusy] = useState(false);

  const notifications = req.data?.notifications ?? [];
  const unreadCount = req.data?.unreadCount ?? 0;

  const markRead = async (id) => {
    setBusy(true);
    try {
      await referrerMarkNotificationRead(id);
      await req.reload();
    } finally {
      setBusy(false);
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await referrerMarkAllNotificationsRead();
      await req.reload();
    } finally {
      setBusy(false);
    }
  };

  const showPlaceholder = req.loading || req.error || req.notLinked;

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Notifications</h1>
          <p>
            {unreadCount > 0
              ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}.`
              : 'Updates about your referrals and commissions.'}
          </p>
        </div>
      </header>

      {showPlaceholder ? (
        <ReferrerState
          loading={req.loading}
          error={req.error}
          notLinked={req.notLinked}
          onRetry={req.reload}
          loadingLabel="Loading your notifications…"
        />
      ) : (
        <>
          {unreadCount > 0 && (
            <div className="rf-actions-bar">
              <button className="rf-btn-outline" onClick={markAll} disabled={busy}>
                <CheckCheck size={18} />
                Mark all as read
              </button>
            </div>
          )}

          <div className="rf-card">
            {notifications.length === 0 ? (
              <EmptyState message="No notifications yet. You'll be told here whenever your code is used." />
            ) : (
              <div className="rf-notif-list">
                {notifications.map((n) => {
                  const style = STYLE[n.type] || { icon: Bell, color: '#6b7280' };
                  const Icon = style.icon;
                  return (
                    <div
                      key={n.id}
                      className="rf-notif-item"
                      onClick={() => n.isUnread && markRead(n.id)}
                      style={{
                        display: 'flex',
                        gap: '0.9rem',
                        alignItems: 'flex-start',
                        cursor: n.isUnread ? 'pointer' : 'default',
                        // Unread is tinted rather than badged: the whole row is the
                        // click target for marking it read.
                        background: n.isUnread ? 'rgba(255, 214, 0, 0.06)' : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          flexShrink: 0,
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${style.color}15`,
                          color: style.color,
                        }}
                      >
                        <Icon size={17} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="rf-notif-title" style={{ fontWeight: n.isUnread ? 700 : 600 }}>
                          {n.title}
                        </p>
                        <p className="rf-notif-text">{n.body}</p>
                        <p className="rf-notif-date">{formatDate(n.createdAt)}</p>
                      </div>

                      {n.isUnread && (
                        <span
                          aria-label="unread"
                          style={{
                            flexShrink: 0,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            marginTop: 6,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
