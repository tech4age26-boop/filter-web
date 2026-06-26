import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

export const EXPENSE_PROOF_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function readExpenseProofFile(file, { onReady, onError } = {}) {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
        onError?.('Please choose an image file (JPEG, PNG, or WebP).');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => onReady?.(reader.result);
    reader.onerror = () => onError?.('Could not read image.');
    reader.readAsDataURL(file);
}

export default function ExpenseProofPicker({
    preview,
    onChange,
    label = 'Expense proof *',
    id = 'expense-proof',
    disabled = false,
}) {
    const inputRef = useRef(null);

    const handlePick = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        readExpenseProofFile(file, {
            onReady: (dataUrl) => onChange?.(dataUrl),
            onError: (msg) => window.alert(msg),
        });
    };

    return (
        <div className="form-group form-group-full">
            <label className="form-label" htmlFor={id}>{label}</label>
            <input
                id={id}
                ref={inputRef}
                type="file"
                accept={EXPENSE_PROOF_ACCEPT}
                style={{ display: 'none' }}
                disabled={disabled}
                onChange={handlePick}
            />
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && !preview && inputRef.current?.click()}
                onKeyDown={(e) => {
                    if (!disabled && !preview && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                style={{
                    border: `1.5px dashed ${preview ? '#16a34a' : '#cbd5e1'}`,
                    borderRadius: 10,
                    padding: preview ? 8 : 16,
                    background: preview ? '#fff' : '#FAFBFC',
                    cursor: disabled ? 'not-allowed' : preview ? 'default' : 'pointer',
                    minHeight: preview ? 120 : 88,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}
            >
                {preview ? (
                    <>
                        <img
                            src={preview}
                            alt="Expense proof preview"
                            style={{
                                maxWidth: '100%',
                                maxHeight: 160,
                                objectFit: 'contain',
                                borderRadius: 6,
                            }}
                        />
                        {!disabled ? (
                            <button
                                type="button"
                                aria-label="Remove proof"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange?.(null);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    border: 'none',
                                    background: 'rgba(15,23,42,0.75)',
                                    color: '#fff',
                                    borderRadius: 999,
                                    width: 28,
                                    height: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={14} />
                            </button>
                        ) : null}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                        <ImagePlus size={22} style={{ marginBottom: 6, opacity: 0.7 }} />
                        <div>Tap to upload receipt or proof photo</div>
                        <div style={{ fontSize: '0.75rem', marginTop: 4 }}>JPEG, PNG, or WebP</div>
                    </div>
                )}
            </div>
        </div>
    );
}
