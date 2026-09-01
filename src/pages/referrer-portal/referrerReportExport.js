import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Referrer performance report export.
 *
 * Follows the autoTable convention already used elsewhere in this codebase
 * (see pages/supplier/storage-facility/storageFacilityTimelineExport.js) rather
 * than introducing a second PDF approach.
 *
 * Everything exported is the data currently on screen for the selected range —
 * the export never re-queries, so a PDF always matches what the referrer was
 * looking at when they pressed the button.
 */

const MARGIN = 40;
const COLORS = {
  ink: [31, 41, 55],
  muted: [107, 114, 128],
  border: [229, 231, 235],
  headerBg: [249, 250, 251],
  accent: [234, 179, 8],
};

const money = (v) =>
  Number(v ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const shortDate = (v) => (v ? String(v).slice(0, 10) : '—');

/** Human label for the selected window, used in the header and the filename. */
export function rangeLabel(range) {
  if (range?.from && range?.to) return `${range.from} to ${range.to}`;
  if (range?.from) return `From ${range.from}`;
  if (range?.to) return `Up to ${range.to}`;
  return 'All time';
}

function drawHeader(doc, referrer, range, pageWidth) {
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text('Referrer Performance Report', MARGIN, 52);

  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `${referrer?.name ?? 'Referrer'}  ·  code ${referrer?.referralCode ?? '—'}`,
    MARGIN,
    70,
  );
  doc.text(`Period: ${rangeLabel(range)}`, MARGIN, 84);
  doc.text(
    `Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    pageWidth - MARGIN,
    84,
    { align: 'right' },
  );

  doc.setDrawColor(...COLORS.border);
  doc.line(MARGIN, 94, pageWidth - MARGIN, 94);
}

/** Page numbers are stamped at the end, when the total page count is known. */
function stampFooters(doc) {
  const pages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      'Amounts in SAR. Pending commissions are not yet payable.',
      MARGIN,
      pageHeight - 24,
    );
    doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, pageHeight - 24, {
      align: 'right',
    });
  }
}

export function exportReferrerReportPdf({ referrer, range, summary, commissions, redemptions }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(doc, referrer, range, pageWidth);

  autoTable(doc, {
    startY: 112,
    head: [['Summary', 'Value']],
    body: [
      ['Total earned', `${money(summary.totalEarned)} SAR`],
      ['Paid', `${money(summary.paid)} SAR`],
      ['Available (matured, unpaid)', `${money(summary.available)} SAR`],
      ['Pending (not yet payable)', `${money(summary.pending)} SAR`],
      ['Commission lines', String(summary.commissionCount)],
      ['Code uses', String(summary.redemptionCount)],
      ['Vehicles reached', String(summary.uniquePlates)],
      ['Average commission', `${money(summary.averageCommission)} SAR`],
    ],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.5,
    },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.ink, fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { cellWidth: 220 }, 1: { halign: 'right', fontStyle: 'bold' } },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 24,
    head: [['Date', 'Description', 'Status', 'Amount (SAR)']],
    body: commissions.length
      ? commissions.map((c) => [
          shortDate(c.createdAt),
          c.description || '—',
          c.status,
          money(c.amount),
        ])
      : [['—', 'No commissions in this period', '—', '0.00']],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.5,
      overflow: 'linebreak',
    },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.ink, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 66 },
      3: { cellWidth: 78, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      // A table spilling onto a new page must not start under the header area.
      if (data.pageNumber > 1) data.settings.margin.top = MARGIN;
    },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 24,
    head: [['Date', 'Vehicle', 'Customer Spend', 'You Earned', 'Status']],
    body: redemptions.length
      ? redemptions.map((r) => [
          shortDate(r.createdAt),
          r.plate || '—',
          r.amount === null || r.amount === undefined ? '—' : money(r.amount),
          r.commissionAmount === null || r.commissionAmount === undefined
            ? '—'
            : money(r.commissionAmount),
          r.commissionStatus || '—',
        ])
      : [['—', 'No code uses in this period', '—', '—', '—']],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.5,
    },
    headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.ink, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 88, halign: 'right' },
      3: { cellWidth: 78, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 66 },
    },
  });

  stampFooters(doc);

  const safeName = String(referrer?.referralCode || 'referrer').replace(/[^A-Za-z0-9-]/g, '');
  doc.save(`referrer-report-${safeName}-${rangeLabel(range).replace(/\s+/g, '-')}.pdf`);
}

/** Same content as the PDF, as a spreadsheet, for anyone who wants the numbers. */
export function exportReferrerReportExcel({ referrer, range, summary, commissions, redemptions }) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Referrer Performance Report'],
      ['Referrer', referrer?.name ?? ''],
      ['Code', referrer?.referralCode ?? ''],
      ['Period', rangeLabel(range)],
      ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ')],
      [],
      ['Total earned (SAR)', Number(summary.totalEarned ?? 0)],
      ['Paid (SAR)', Number(summary.paid ?? 0)],
      ['Available (SAR)', Number(summary.available ?? 0)],
      ['Pending (SAR)', Number(summary.pending ?? 0)],
      ['Commission lines', summary.commissionCount],
      ['Code uses', summary.redemptionCount],
      ['Vehicles reached', summary.uniquePlates],
      ['Average commission (SAR)', Number(summary.averageCommission ?? 0)],
    ]),
    'Summary',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      commissions.map((c) => ({
        Date: shortDate(c.createdAt),
        Description: c.description || '',
        Status: c.status,
        'Amount (SAR)': Number(c.amount ?? 0),
      })),
    ),
    'Commissions',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      redemptions.map((r) => ({
        Date: shortDate(r.createdAt),
        Vehicle: r.plate || '',
        'Customer Spend (SAR)': r.amount ?? '',
        'You Earned (SAR)': r.commissionAmount ?? '',
        Status: r.commissionStatus || '',
      })),
    ),
    'Code Usage',
  );

  const safeName = String(referrer?.referralCode || 'referrer').replace(/[^A-Za-z0-9-]/g, '');
  XLSX.writeFile(wb, `referrer-report-${safeName}-${rangeLabel(range).replace(/\s+/g, '-')}.xlsx`);
}
