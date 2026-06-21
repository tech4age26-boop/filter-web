import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Tag,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  marketingDeletePromoCode,
  marketingListPromoCodes,
} from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  mapDiscountTypeToUi,
  normalizePromoCode,
  safeArray,
} from './promoCodeShared';
import './MarketingUniversal.css';

export const PromoCodes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'promo-codes');

  const [codes, setCodes] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter((item) => {
      if (!q) return true;
      return (
        String(item.code || '').toLowerCase().includes(q) ||
        String(item.promotion || '').toLowerCase().includes(q)
      );
    });
  }, [codes, search]);

  const loadCodes = async () => {
    try {
      setLoadingCodes(true);
      setPageError('');
      const data = await marketingListPromoCodes({ limit: 200, offset: 0, status: 'all' });
      setCodes(safeArray(data, ['promoCodes', 'items', 'data']).map(normalizePromoCode));
    } catch (error) {
      setPageError(error?.message || 'Promo codes API load nahi hui.');
      setCodes([]);
    } finally {
      setLoadingCodes(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      alert('Code copied');
    } catch {
      alert('Could not copy code');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promo code?')) return;
    try {
      await marketingDeletePromoCode(id);
      await loadCodes();
      setSuccessMessage('Promo code delete ho gaya.');
    } catch (error) {
      alert(error?.message || 'Promo code delete nahi hua.');
    }
  };

  return (
    <div className="mk-page mk-code-page">
      <div className="mk-code-header">
        <div>
          <h1 className="mk-code-title">Promo Codes</h1>
          <p className="mk-code-subtitle">
            Generate and validate promo codes — codes appear on POS and invoices
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`${listPath}/new`)}
          className="mk-code-new-btn"
        >
          <Plus size={15} strokeWidth={2.5} />
          Generate Code
        </button>
      </div>

      {successMessage ? (
        <div className="mk-code-success-banner">
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      ) : null}

      {pageError ? (
        <div className="mk-code-error-banner">
          <AlertCircle size={16} />
          {pageError}
        </div>
      ) : null}

      <div className="mk-code-filters">
        <label className="mk-code-search">
          <Search size={13} strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or promotion..."
          />
        </label>
      </div>

      <div className="mk-code-content-area">
        {loadingCodes ? (
          <div className="mk-code-empty-state">
            <Loader2 size={34} className="mk-code-spin" />
            <div>Loading promo codes...</div>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="mk-code-empty-state">
            <Tag size={41} strokeWidth={1.8} />
            <div>No promo codes yet</div>
          </div>
        ) : (
          <div className="mk-code-table-wrap">
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Promotion</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map((item) => (
                  <tr key={item.id}>
                    <td className="mk-code-td-strong">{item.code}</td>
                    <td>{item.promotion || '-'}</td>
                    <td>{mapDiscountTypeToUi(item.discountType)}</td>
                    <td>{item.discountValue || '-'}</td>
                    <td>
                      {item.currentUsage || 0}
                      {item.maxUsage ? ` / ${item.maxUsage}` : ''}
                    </td>
                    <td>
                      <span
                        className={`mk-code-status-badge status-${String(item.status)
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="mk-code-actions">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.code)}
                          className="mk-code-copy-btn"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="mk-code-delete-btn"
                        >
                          <Trash2 size={13} strokeWidth={2} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromoCodes;
