import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { marketingCreateLoyaltyProgram } from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  buildLoyaltyPayload,
  EMPTY_LOYALTY_FORM,
  PointsRuleField,
  SelectField,
  statusOptions,
  tierMeta,
  TierConfigCard,
} from './loyaltyProgramShared';
import './MarketingUniversal.css';

export default function LoyaltyProgramFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'loyalty-programs');

  const [form, setForm] = useState(EMPTY_LOYALTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const goBack = () => navigate(listPath);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateTierField = (tierKey, field, value) => {
    setForm((prev) => ({
      ...prev,
      [tierKey]: { ...prev[tierKey], [field]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Program Name is required.');
      return;
    }

    try {
      setSubmitting(true);
      await marketingCreateLoyaltyProgram(buildLoyaltyPayload(form));
      goBack();
    } catch (error) {
      alert(error?.message || 'Loyalty program save nahi hua.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingFormShell
      title="New Loyalty Program"
      subtitle="Configure points rules and tiers. Sent to Super Admin for approval before activation."
      backLabel="Back to Loyalty Programs"
      onBack={goBack}
      className="mk-page mk-loyalty-page mkp-form-page"
    >
      <form onSubmit={handleSubmit} className="mkp-form-page-body mk-loyalty-modal-form">
        <div className="mk-loyalty-form-group">
          <label className="mk-loyalty-label">Program Name *</label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. FILTER Rewards"
            className="mk-loyalty-input mk-loyalty-focus-input"
          />
        </div>

        <div className="mk-loyalty-form-group">
          <label className="mk-loyalty-label">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="mk-loyalty-textarea"
          />
        </div>

        <div className="mk-loyalty-section-heading">Points Rules</div>
        <div className="mk-loyalty-points-grid">
          <PointsRuleField
            label="Points earned per SAR spent"
            value={form.pointsPerSar}
            onChange={(value) => updateField('pointsPerSar', value)}
          />
          <PointsRuleField
            label="Points needed per SAR discount"
            value={form.pointsForDiscount}
            onChange={(value) => updateField('pointsForDiscount', value)}
          />
          <PointsRuleField
            label="Minimum points to redeem"
            value={form.minRedeemPoints}
            onChange={(value) => updateField('minRedeemPoints', value)}
          />
        </div>

        <div className="mk-loyalty-section-heading">Tier Configuration</div>
        {tierMeta.map((tier) => (
          <TierConfigCard
            key={tier.key}
            tier={tier}
            values={form[tier.key]}
            onChange={updateTierField}
          />
        ))}

        <div className="mk-loyalty-form-group">
          <label className="mk-loyalty-label">Status</label>
          <SelectField
            value={form.status}
            onChange={(value) => updateField('status', value)}
            options={statusOptions}
          />
        </div>

        <div className="mk-loyalty-approval-note">
          <AlertTriangle size={14} strokeWidth={2} />
          <span>
            This program will be sent to <b>Super Admin</b> for approval before activation.
          </span>
        </div>

        <div className="mkp-form-page-footer">
          <button
            type="button"
            onClick={goBack}
            className="mk-loyalty-cancel-btn"
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="mk-loyalty-submit-btn" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={14} className="mk-loyalty-spin" />
                Submitting...
              </>
            ) : (
              'Submit for Approval'
            )}
          </button>
        </div>
      </form>
    </MarketingFormShell>
  );
}
