import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Loader2, AlertCircle } from 'lucide-react';

const statusOptions = ['Active', 'Inactive'];

const discountTypeOptions = [
  { label: 'Percentage (%)', value: 'Percentage (%)' },
  { label: 'Fixed Amount (SAR)', value: 'Fixed Amount (SAR)' },
];

const safeArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.results)) return response.results;

  return [];
};

const randomCode = () => {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
};

const toDateTimeLocal = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
};

const toDateOnly = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
};

const normalizeOption = (item, fallbackPrefix) => {
  const id =
    item?.id ||
    item?._id ||
    item?.value ||
    `${fallbackPrefix}-${Math.random().toString(36).slice(2)}`;

  const label =
    item?.label ||
    item?.name ||
    item?.title ||
    item?.code ||
    item?.sku ||
    item?.branchName ||
    item?.zoneName ||
    `${fallbackPrefix} ${id}`;

  return {
    ...item,
    id: String(id),
    value: String(item?.value || id),
    label,
    realId: String(item?.realId || id),
  };
};

const normalizePromoCode = (item) => {
  const statusRaw = String(
    item?.status || (item?.isActive === false ? 'inactive' : 'active')
  ).toLowerCase();

  const statusMap = {
    active: 'Active',
    inactive: 'Inactive',
    expired: 'Expired',
  };

  return {
    ...item,
    id: String(item?.id || item?._id || Date.now()),
    code: item?.code || '-',
    promotion:
      item?.promotion_name ||
      item?.promotionName ||
      item?.promotion ||
      item?.description ||
      '',
    promotionId: item?.promotion_id || item?.promotionId || '',
    discountType: item?.discount_type || item?.discountType || 'percentage',
    discountValue: item?.discount_value ?? item?.discountValue ?? 0,
    minPurchase:
      item?.min_purchase_amount ??
      item?.minPurchaseAmount ??
      item?.minOrderAmount ??
      0,
    maxUsage:
      item?.max_usage_count ??
      item?.maxUsageCount ??
      item?.usageLimit ??
      0,
    currentUsage:
      item?.current_usage_count ??
      item?.currentUsageCount ??
      item?.usageCount ??
      0,
    validFrom: item?.valid_from || item?.validFrom || '',
    validUntil: item?.valid_until || item?.validTo || '',
    showSavings: Boolean(item?.show_on_invoice ?? item?.showOnInvoice ?? false),
    notes: item?.notes || item?.description || '',
    status: statusMap[statusRaw] || 'Active',
  };
};

const mapDiscountTypeToBackend = (value) => {
  const raw = String(value || '').toLowerCase();

  if (raw.includes('fixed') || raw.includes('sar')) return 'fixed_amount';

  return 'percentage';
};

const mapDiscountTypeToUi = (value) => {
  const raw = String(value || '').toLowerCase();

  if (raw.includes('fixed')) return 'Fixed Amount (SAR)';

  return 'Percentage (%)';
};

const mapStatusToIsActive = (value) => {
  const raw = String(value || '').toLowerCase();

  return raw !== 'inactive';
};

const SelectField = ({ value, onChange, options }) => {
  return (
    <div className="mk-code-select-wrap">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mk-code-input mk-code-select"
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>

      <ChevronDown size={14} strokeWidth={2} className="mk-code-select-icon" />
    </div>
  );
};

const PromotionSelect = ({ value, onChange, options, loading, error }) => {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, []);

  const selected = useMemo(() => {
    return options.find((item) => item.id === value) || null;
  }, [options, value]);

  return (
    <div className="mk-code-form-group mk-code-dd-wrap" ref={wrapRef}>
      <label className="mk-code-label">Link to Promotion (optional)</label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`mk-code-dd-btn ${open ? 'open' : ''}`}
      >
        <span>
          {loading ? 'Loading...' : selected?.label || 'Select promotion...'}
        </span>
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div className="mk-code-dd-menu">
          <div className="mk-code-dd-list no-search">
            {loading ? (
              <div className="mk-code-dd-empty">
                <Loader2 size={14} className="mk-code-spin" />
                Loading promotions...
              </div>
            ) : error ? (
              <div className="mk-code-dd-empty error">
                <AlertCircle size={14} />
                {error}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={`mk-code-dd-option ${value === '' ? 'selected' : ''}`}
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  Select promotion...
                </button>

                {options.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`mk-code-dd-option ${
                      value === item.id ? 'selected' : ''
                    }`}
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Toggle = ({ checked, onChange, label }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="mk-code-toggle-btn"
    >
      <span className={checked ? 'mk-code-toggle active' : 'mk-code-toggle'}>
        <span />
      </span>

      {label}
    </button>
  );
};
export {
  statusOptions,
  discountTypeOptions,
  safeArray,
  randomCode,
  toDateTimeLocal,
  toDateOnly,
  normalizeOption,
  normalizePromoCode,
  mapDiscountTypeToBackend,
  mapDiscountTypeToUi,
  mapStatusToIsActive,
  SelectField,
  PromotionSelect,
  Toggle,
};
