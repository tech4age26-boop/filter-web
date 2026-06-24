import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Hourglass, Loader2 } from 'lucide-react';
import {
  marketingCreatePromoCode,
  marketingGetPromoCode,
  marketingListPromotions,
  marketingUpdatePromoCode,
} from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import './MarketingUniversal.css';

// Re-use list helpers from PromoCodes
import {
  discountTypeOptions,
  mapDiscountTypeToBackend,
  mapDiscountTypeToUi,
  normalizeOption,
  normalizePromoCode,
  PromotionSelect,
  randomCode,
  safeArray,
  SelectField,
  Toggle,
  toDateOnly,
  toDateTimeLocal,
} from './promoCodeShared';

export default function PromoCodeFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const listPath = marketingSectionPath(location.pathname, 'promo-codes');

  const [promotions, setPromotions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(isEdit);
  const [optionsError, setOptionsError] = useState('');
  const [recordError, setRecordError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    code: '',
    promotionId: '',
    promotionName: '',
    discountType: 'Percentage (%)',
    discountValue: '',
    minPurchase: '0',
    maxUsage: '0',
    validFrom: '',
    validUntil: '',
    status: 'Pending Approval',
    showSavings: true,
    notes: '',
  });

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const goBack = () => navigate(listPath);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingOptions(true);
        setOptionsError('');
        const data = await marketingListPromotions({
          limit: 200,
          offset: 0,
          status: 'all',
        });
        if (cancelled) return;
        const promotionOptions = safeArray(data, ['promotions']).map((item) => {
          const option = normalizeOption(item, 'Promotion');
          return {
            ...option,
            discountType: item.discountType || item.discount_type || '',
            discountValue: item.discountValue ?? item.discount_value ?? '',
            validFrom: item.validFrom || item.valid_from || item.startAt || '',
            validTo: item.validTo || item.valid_until || item.endAt || '',
          };
        });
        setPromotions(promotionOptions);
      } catch (error) {
        if (!cancelled) {
          setOptionsError(error?.message || 'Options load nahi huay.');
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return undefined;

    let cancelled = false;

    (async () => {
      try {
        setLoadingRecord(true);
        setRecordError('');
        const data = await marketingGetPromoCode(id);
        if (cancelled) return;

        const item = normalizePromoCode(
          data?.promoCode || data?.data || data?.item || data
        );

        setForm({
          code: item.code || '',
          promotionId: item.promotionId || '',
          promotionName: item.promotion || '',
          discountType: mapDiscountTypeToUi(item.discountType),
          discountValue: String(item.discountValue ?? ''),
          minPurchase: String(item.minPurchase ?? '0'),
          maxUsage: String(item.maxUsage ?? '0'),
          validFrom: item.validFrom ? toDateTimeLocal(item.validFrom) : '',
          validUntil: item.validUntil ? toDateTimeLocal(item.validUntil) : '',
          status: item.status || 'Pending Approval',
          showSavings: Boolean(item.showSavings),
          notes: item.notes || '',
        });
      } catch (error) {
        if (!cancelled) {
          setRecordError(error?.message || 'Promo code load nahi hua.');
        }
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const handlePromotionChange = (promotionId) => {
    const selected = promotions.find((item) => item.id === promotionId);
    setForm((prev) => ({
      ...prev,
      promotionId,
      promotionName: selected?.label || '',
      discountType: selected?.discountType
        ? mapDiscountTypeToUi(selected.discountType)
        : prev.discountType,
      discountValue:
        selected?.discountValue !== undefined && selected?.discountValue !== null
          ? String(selected.discountValue)
          : prev.discountValue,
      validFrom: selected?.validFrom
        ? toDateTimeLocal(selected.validFrom)
        : prev.validFrom,
      validUntil: selected?.validTo
        ? toDateTimeLocal(selected.validTo)
        : prev.validUntil,
    }));
  };

  const buildPayload = () => {
    const descriptionParts = [];
    if (form.promotionName) descriptionParts.push(`Promotion: ${form.promotionName}`);
    if (form.notes) descriptionParts.push(form.notes);

    return {
      code: form.code.trim().toUpperCase(),
      promotionId: form.promotionId || null,
      promotion_id: form.promotionId || null,
      promotionName: form.promotionName || null,
      promotion_name: form.promotionName || null,
      discountType: mapDiscountTypeToBackend(form.discountType),
      discount_type: mapDiscountTypeToBackend(form.discountType),
      discountValue: Number(form.discountValue || 0),
      discount_value: Number(form.discountValue || 0),
      minOrderAmount: Number(form.minPurchase || 0),
      minPurchaseAmount: Number(form.minPurchase || 0),
      min_purchase_amount: Number(form.minPurchase || 0),
      usageLimit: Number(form.maxUsage || 0),
      maxUsageCount: Number(form.maxUsage || 0),
      max_usage_count: Number(form.maxUsage || 0),
      validFrom: toDateOnly(form.validFrom),
      valid_from: toDateOnly(form.validFrom),
      validTo: toDateOnly(form.validUntil),
      valid_until: toDateOnly(form.validUntil),
      description: descriptionParts.join(' | ') || null,
      notes: form.notes || null,
      showOnInvoice: form.showSavings,
      show_on_invoice: form.showSavings,
    };
  };

  const createPayload = () => ({
    ...buildPayload(),
    status: 'pending_approval',
    isActive: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.code.trim()) {
      alert('Promo code is required.');
      return;
    }
    if (!form.discountValue) {
      alert('Discount value is required.');
      return;
    }
    if (!form.validFrom || !form.validUntil) {
      alert('Valid from and valid until are required.');
      return;
    }
    if (new Date(form.validUntil) < new Date(form.validFrom)) {
      alert('Valid until must be after valid from.');
      return;
    }

    try {
      setSubmitting(true);
      if (isEdit) {
        await marketingUpdatePromoCode(id, buildPayload());
        navigate(listPath, {
          state: { successMessage: 'Promo code updated successfully.' },
        });
      } else {
        await marketingCreatePromoCode(createPayload());
        navigate(listPath, {
          state: {
            successMessage:
              'Promo code submitted for Super Admin approval. It will appear on POS after approval.',
          },
        });
      }
    } catch (error) {
      alert(error?.message || 'Promo code save nahi hua.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? 'Edit Promo Code' : 'Generate Promo Code'}
      subtitle={
        isEdit
          ? 'Update promo code details. POS activation is controlled from the list page.'
          : 'Create a promo code for POS and invoices. It will be sent for Super Admin approval.'
      }
      backLabel="Back to Promo Codes"
      onBack={goBack}
      className="mk-page mk-code-page mkp-form-page"
    >
      {loadingRecord ? (
        <div className="mk-code-empty-state">
          <Loader2 size={28} className="mk-code-spin" />
          <div>Loading promo code...</div>
        </div>
      ) : recordError ? (
        <div className="mk-code-error-banner">{recordError}</div>
      ) : (
      <form onSubmit={handleSubmit} className="mkp-form-page-body mk-code-modal-form">
        <div className="mk-code-form-group">
          <label className="mk-code-label">Promo Code *</label>
          <div className="mk-code-row">
            <input
              autoFocus
              value={form.code}
              onChange={(e) => update('code', e.target.value.toUpperCase())}
              placeholder="e.g. RAMADAN50"
              className="mk-code-input mk-code-focus-input mk-code-flex-input"
              readOnly={isEdit}
            />
            {!isEdit ? (
            <button
              type="button"
              onClick={() => update('code', randomCode())}
              className="mk-code-auto-btn"
            >
              Auto
            </button>
            ) : null}
          </div>
        </div>

        <PromotionSelect
          value={form.promotionId}
          onChange={handlePromotionChange}
          options={promotions}
          loading={loadingOptions}
          error={optionsError}
        />

        <div className="mk-code-two-col">
          <div className="mk-code-form-group">
            <label className="mk-code-label">Discount Type</label>
            <SelectField
              value={form.discountType}
              onChange={(value) => update('discountType', value)}
              options={discountTypeOptions}
            />
          </div>
          <div className="mk-code-form-group">
            <label className="mk-code-label">Discount Value</label>
            <input
              value={form.discountValue}
              onChange={(e) => update('discountValue', e.target.value)}
              className="mk-code-input"
            />
          </div>
        </div>

        <div className="mk-code-two-col">
          <div className="mk-code-form-group">
            <label className="mk-code-label">Min. Purchase (SAR)</label>
            <input
              type="number"
              value={form.minPurchase}
              onChange={(e) => update('minPurchase', e.target.value)}
              className="mk-code-input"
            />
          </div>
          <div className="mk-code-form-group">
            <label className="mk-code-label">Max Usage (0=unlimited)</label>
            <input
              type="number"
              value={form.maxUsage}
              onChange={(e) => update('maxUsage', e.target.value)}
              className="mk-code-input"
            />
          </div>
        </div>

        <div className="mk-code-two-col">
          <div className="mk-code-form-group">
            <label className="mk-code-label">Valid From</label>
            <input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => update('validFrom', e.target.value)}
              className="mk-code-input"
            />
          </div>
          <div className="mk-code-form-group">
            <label className="mk-code-label">Valid Until</label>
            <input
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => update('validUntil', e.target.value)}
              className="mk-code-input"
            />
          </div>
        </div>

        <div className="mk-code-form-group">
          <label className="mk-code-label">Activation</label>
          <div className="mk-code-input" style={{ background: '#f8fafc', color: '#64748b' }}>
            {isEdit
              ? `${form.status} — use the list page toggle after Super Admin approval`
              : 'Pending Super Admin approval (required before POS use)'}
          </div>
        </div>

        <div className="mk-code-form-group">
          <Toggle
            checked={form.showSavings}
            onChange={(value) => update('showSavings', value)}
            label="Show code savings on invoice"
          />
        </div>

        <div className="mk-code-form-group">
          <label className="mk-code-label">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Internal notes..."
            className="mk-code-textarea"
          />
        </div>

        {!isEdit ? (
        <div className="mk-code-approval-note">
          <Hourglass size={14} strokeWidth={2} />
          <span>
            This code will be sent to <b>Super Admin for approval</b> before activation.
          </span>
        </div>
        ) : null}

        <div className="mkp-form-page-footer">
          <button type="button" onClick={goBack} className="mk-code-cancel-btn" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="mk-code-submit-btn" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={14} className="mk-code-spin" />
                {isEdit ? 'Saving...' : 'Submitting...'}
              </>
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Submit for Approval'
            )}
          </button>
        </div>
      </form>
      )}
    </MarketingFormShell>
  );
}
