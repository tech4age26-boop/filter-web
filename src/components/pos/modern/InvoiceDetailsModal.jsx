import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import CashierTaxInvoiceView from './CashierTaxInvoiceView';
import './CashierTaxInvoiceView.css';

/**
 * Modal wrapper for the bilingual simplified tax invoice (Flutter CashierInvoicePreview).
 * @param {'pos'|'corporate'} footerVariant — corporate shows Print + Cancel only.
 */
export default function InvoiceDetailsModal({
  invoice,
  isOpen,
  onClose,
  onPrint,
  footerVariant = 'pos',
}) {
  const scrollRef = useRef(null);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint(invoice);
      return;
    }
    window.print();
  };

  const isCorporate = footerVariant === 'corporate';

  return (
    <div className="modal-overlay-modern invoice-modal-root" onClick={onClose}>
      <div
        className="invoice-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Simplified Tax Invoice"
      >
        <button type="button" className="invoice-modal-close-fab" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="invoice-scroll" ref={scrollRef}>
          <CashierTaxInvoiceView invoice={invoice} />
        </div>

        <div className="invoice-actions">
          <button type="button" className="invoice-btn invoice-btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print
          </button>
          {isCorporate ? (
            <button type="button" className="invoice-btn invoice-btn-primary" onClick={onClose}>
              Cancel
            </button>
          ) : (
            <button type="button" className="invoice-btn invoice-btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>

      <style>{`
        .invoice-modal-root {
          padding: 16px;
          align-items: flex-start;
        }
        .invoice-modal-card {
          position: relative;
          width: 100%;
          max-width: 940px;
          max-height: calc(100vh - 32px);
          background: #ffffff;
          border: 1px solid #23262d;
          border-radius: 14px;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.18);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: auto;
        }
        .invoice-modal-close-fab {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 5;
          background: rgba(35, 38, 45, 0.85);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 6px;
          cursor: pointer;
        }
        .invoice-modal-close-fab:hover {
          background: #23262d;
        }
        .invoice-scroll {
          overflow-y: auto;
          padding: 14px 14px 8px;
        }
        .invoice-actions {
          display: flex;
          gap: 10px;
          padding: 12px 14px 14px;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }
        .invoice-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border: none;
          border-radius: 10px;
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
        }
        .invoice-btn-secondary {
          background: #2e3237;
          color: #fff;
        }
        .invoice-btn-primary {
          background: #fcc247;
          color: #23262d;
        }
        @media print {
          .invoice-modal-root {
            position: absolute !important;
            inset: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .invoice-modal-card {
            max-width: none !important;
            max-height: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .invoice-modal-close-fab,
          .invoice-actions {
            display: none !important;
          }
          .invoice-scroll {
            overflow: visible !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
