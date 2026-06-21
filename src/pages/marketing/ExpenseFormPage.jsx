import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  marketingCreateExpense,
  marketingGetExpense,
  marketingListCampaigns,
  marketingUpdateExpense,
} from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  categoryOptions,
  extractCampaigns,
  extractExpenses,
  humanizeLower,
  initialForm,
  SelectField,
} from './expenseShared';
import './MarketingUniversal.css';

export default function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'referral-types-rules');

  const [form, setForm] = useState({
    ...initialForm,
    expenseDate: new Date().toISOString().slice(0, 10),
  });
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const goBack = () => navigate(listPath);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLinkedCampaign = (campaignId) => {
    const selected = campaigns.find((item) => item.id === campaignId);
    setForm((prev) => ({
      ...prev,
      campaignId,
      campaignName: selected?.name || '',
    }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCampaignsLoading(true);
        const res = await marketingListCampaigns({ limit: 100, offset: 0, status: 'all' });
        if (!cancelled) setCampaigns(extractCampaigns(res));
      } catch {
        if (!cancelled) setCampaigns([]);
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingPage(true);
        setPageError('');
        const res = await marketingGetExpense(id);
        const row =
          res?.expense ||
          res?.data ||
          res?.item ||
          extractExpenses(res)[0] ||
          res;
        if (!row?.id) throw new Error('Expense not found.');
        if (!cancelled) {
          setForm({
            id: String(row.id),
            campaignId: row.campaignId || '',
            campaignName: row.campaignName === '—' ? '' : row.campaignName || '',
            expenseCategory: row.expenseCategory || 'other',
            vendorName: row.vendorName === '—' ? '' : row.vendorName || '',
            description: row.description || '',
            amount: String(row.amount || ''),
            expenseDate: row.expenseDate ? String(row.expenseDate).slice(0, 10) : '',
            receiptUrl: row.receiptUrl || '',
            notes: row.notes || '',
            status: row.status || '',
          });
        }
      } catch (err) {
        if (!cancelled) setPageError(err?.message || 'Failed to load expense.');
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const buildPayload = () => {
    const payload = {
      campaignId: form.campaignId || undefined,
      campaignName: form.campaignName.trim() || undefined,
      expenseCategory: form.expenseCategory,
      vendorName: form.vendorName.trim() || undefined,
      description: form.description.trim() || undefined,
      amount: Number(form.amount || 0),
      expenseDate: form.expenseDate || undefined,
      receiptUrl: form.receiptUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (!isEdit) payload.status = 'pending_approval';
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.expenseCategory) {
      alert('Expense category is required.');
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter valid amount.');
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload();
      if (isEdit) {
        await marketingUpdateExpense(form.id, payload);
      } else {
        await marketingCreateExpense(payload);
        alert('Expense request has been sent to Admin Approvals.');
      }
      goBack();
    } catch (err) {
      alert(err?.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const campaignOptions = campaigns.map((c) => ({ value: c.id, label: c.name }));

  return (
    <MarketingFormShell
      title={isEdit ? 'Edit Marketing Expense' : 'New Marketing Expense'}
      subtitle="Submit marketing expenses for admin approval."
      backLabel="Back to Expenses"
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {pageError ? <div className="mk-error-text">{pageError}</div> : null}

      {loadingPage ? (
        <div className="mk-panel-empty">Loading expense...</div>
      ) : (
        <form onSubmit={handleSubmit} className="mkp-form-page-body">
          <div className="mk-expense-form-group">
            <label className="mk-expense-label">Category</label>
            <SelectField
              value={form.expenseCategory}
              onChange={(value) => updateForm('expenseCategory', value)}
              options={categoryOptions}
            />
          </div>

          <div className="mk-expense-form-group">
            <label className="mk-expense-label">Vendor Name</label>
            <input
              className="mk-expense-input"
              value={form.vendorName}
              onChange={(e) => updateForm('vendorName', e.target.value)}
              maxLength={160}
            />
          </div>

          <div className="mk-expense-form-group">
            <label className="mk-expense-label">Description</label>
            <input
              className="mk-expense-input"
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="mk-expense-form-grid">
            <div className="mk-expense-form-group">
              <label className="mk-expense-label">Amount (SAR)</label>
              <input
                type="number"
                min="1"
                className="mk-expense-input"
                value={form.amount}
                onChange={(e) => updateForm('amount', e.target.value)}
              />
            </div>
            <div className="mk-expense-form-group">
              <label className="mk-expense-label">Date</label>
              <input
                type="date"
                className="mk-expense-input"
                value={form.expenseDate}
                onChange={(e) => updateForm('expenseDate', e.target.value)}
              />
            </div>
          </div>

          <div className="mk-expense-form-group">
            <label className="mk-expense-label">Linked Campaign (optional)</label>
            <SelectField
              value={form.campaignId}
              onChange={updateLinkedCampaign}
              options={campaignOptions}
              placeholder={
                campaignsLoading ? 'Loading campaigns...' : 'Select campaign...'
              }
            />
          </div>

          <div className="mkp-form-page-footer">
            <button
              type="button"
              className="mk-expense-cancel-btn"
              onClick={goBack}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="mk-expense-submit-btn" disabled={saving}>
              {saving
                ? 'Submitting...'
                : isEditingLabel(isEdit)}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}

function isEditingLabel(isEdit) {
  return isEdit ? 'Update Expense' : 'Submit for Approval';
}
