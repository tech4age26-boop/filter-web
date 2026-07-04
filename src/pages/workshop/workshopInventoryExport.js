import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

function safeFileSlug(s) {
    const t = String(s || 'export')
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80);
    return t || 'export';
}

function stamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function fmtQtyPlain(value, isInfiniteQty = false) {
    if (isInfiniteQty) return 'Unlimited';
    if (value == null || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return String(n.toFixed(3)).replace(/\.?0+$/, '');
}

function inventoryUomLabel(item) {
    if (item?.uomProfileName) return String(item.uomProfileName);
    const rule = String(item?.conversionRule || '').trim();
    if (rule && rule !== '—') return rule;
    return String(item?.workshopUnit || item?.unit || 'pcs');
}

function inventoryStockLabel(item) {
    if (item?.stockDisplayPrimary) {
        const secondary = item.stockDisplaySecondary;
        return secondary != null && String(secondary).trim() !== ''
            ? `${item.stockDisplayPrimary} (${secondary})`
            : String(item.stockDisplayPrimary);
    }
    if (item?.isInfiniteQty) return 'Unlimited';
    return fmtQtyPlain(item?.qty, false);
}

function inventoryStatusLabel(item) {
    if (item?.status === 'Requested') return 'Requested';
    if (item?.isInfiniteQty) return 'Unlimited';
    const qty = Number(item?.qty) || 0;
    const crit = Number(item?.critical_level) || 0;
    if (qty <= 0) return 'Out of Stock';
    if (crit > 0 && qty <= crit) return 'Low Stock';
    return 'In Stock';
}

export function workshopInventoryLineValueSar(item) {
    if (item?.isInfiniteQty) return 0;
    const qty = Number(item?.qty) || 0;
    const price = Number(item?.purchasePrice) || 0;
    return qty * price;
}

function inventoryRowsForExport(items) {
    return (items || []).map((item) => {
        const opening =
            item.openingQty != null && item.openingQty !== ''
                ? fmtQtyPlain(item.openingQty)
                : '';
        const critical =
            Number(item.critical_level) > 0 ? fmtQtyPlain(item.critical_level) : '';
        const purchasePrice = Number(item.purchasePrice) || 0;
        const lineValue = workshopInventoryLineValueSar(item);
        return [
            item.name || '',
            item.sku || '',
            item.departmentName || '',
            item.categoryName || '',
            opening,
            inventoryStockLabel(item),
            critical,
            inventoryUomLabel(item),
            purchasePrice,
            inventoryStatusLabel(item),
            lineValue,
            item.branchName || '',
        ];
    });
}

const EXPORT_HEADERS = [
    'Product',
    'SKU',
    'Department',
    'Category',
    'Opening (adoption)',
    'Current stock',
    'Critical level',
    'UOM',
    'Purchase price (SAR)',
    'Status',
    'Line value (SAR)',
    'Branch',
];

function downloadTablePdf({ title, subtitle, headers, colWidthsPt, rows, filenameBase }) {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 36;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const lineH = 13;
    let y = margin;

    const drawHeaderBlock = () => {
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, margin, y);
        y += lineH + 4;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        if (subtitle) {
            const subLines = pdf.splitTextToSize(subtitle, pageW - margin * 2);
            pdf.text(subLines, margin, y);
            y += subLines.length * (lineH - 2) + 6;
        } else {
            y += 4;
        }
    };

    drawHeaderBlock();

    const sumW = colWidthsPt.reduce((a, b) => a + b, 0);
    const scale = sumW > pageW - margin * 2 ? (pageW - margin * 2) / sumW : 1;
    const colW = colWidthsPt.map((w) => w * scale);

    const drawColumnHeaders = () => {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        let x = margin;
        headers.forEach((h, i) => {
            const lines = pdf.splitTextToSize(String(h), colW[i] - 4);
            pdf.text(lines, x + 2, y + lineH - 3);
            x += colW[i];
        });
        y += lineH + 2;
        pdf.setFont('helvetica', 'normal');
    };

    drawColumnHeaders();

    for (const row of rows) {
        const cells = row.map((c) => (c == null ? '' : String(c)));
        const wrapped = cells.map((text, i) => pdf.splitTextToSize(text, colW[i] - 4));
        const rowH = Math.max(lineH, ...wrapped.map((lines) => lines.length * (lineH - 2)));

        if (y + rowH > pageH - margin) {
            pdf.addPage();
            y = margin;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${title} (continued)`, margin, y);
            y += lineH + 6;
            pdf.setFont('helvetica', 'normal');
            drawColumnHeaders();
        }

        let x = margin;
        pdf.setFontSize(7.5);
        wrapped.forEach((lines, i) => {
            pdf.text(lines, x + 2, y + lineH - 3);
            x += colW[i];
        });
        y += rowH + 2;
    }

    pdf.save(`${safeFileSlug(filenameBase)}-${stamp()}.pdf`);
}

/**
 * @param {Record<string, unknown>[]} items — selected workshop inventory rows
 * @param {{ branchName?: string; subtitle?: string }} [meta]
 * @param {string} [filenameBase]
 */
export function exportWorkshopInventoryExcel(
    items,
    meta = {},
    filenameBase = 'workshop-inventory',
) {
    const rows = inventoryRowsForExport(items);
    const metaRows = [
        ['Branch', meta.branchName || '—'],
        ['Exported', new Date().toLocaleString()],
        ['Products', String(rows.length)],
        [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...metaRows, EXPORT_HEADERS, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

/**
 * @param {Record<string, unknown>[]} items
 * @param {{ branchName?: string; subtitle?: string }} [meta]
 * @param {string} [filenameBase]
 */
export function exportWorkshopInventoryPdf(
    items,
    meta = {},
    filenameBase = 'workshop-inventory',
) {
    const rows = inventoryRowsForExport(items).map((row) =>
        row.map((cell, idx) => {
            if (idx === 8 || idx === 10) {
                const n = Number(cell);
                return Number.isFinite(n) ? n.toFixed(2) : '—';
            }
            return cell == null || cell === '' ? '—' : String(cell);
        }),
    );
    const headers = EXPORT_HEADERS;
    const colW = [118, 58, 72, 72, 52, 72, 48, 58, 58, 52, 58, 64];
    const subtitle =
        meta.subtitle ||
        `Branch: ${meta.branchName || '—'} · ${rows.length} product(s) · line value = current stock × purchase price`;
    downloadTablePdf({
        title: 'Workshop inventory',
        subtitle,
        headers,
        colWidthsPt: colW,
        rows,
        filenameBase,
    });
}

/** Products with on-hand stock > 0, or unlimited-stock mode. */
export function workshopInventoryHasStock(item) {
    if (!item) return false;
    if (item.isInfiniteQty) return true;
    return (Number(item.qty) || 0) > 0;
}
