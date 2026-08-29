import React from 'react';
import { EmptyState } from './ReferrerStates';

/**
 * Referrer notifications.
 *
 * There is no notification feed for referrers yet — no model, no endpoint. This
 * screen previously rendered a fixed list ("You earned SAR 5,000 from Ahmed
 * Hassan's franchise referral") that was identical for every account. Announcing
 * money that was never earned is worse than an empty screen, so it says nothing
 * until there is something real to say.
 */
export default function ReferrerNotifications() {
  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Notifications</h1>
          <p>Updates about your referrals and commissions.</p>
        </div>
      </header>

      <div className="rf-card">
        <EmptyState message="No notifications yet." />
      </div>
    </div>
  );
}
