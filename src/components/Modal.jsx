import React from 'react';
import { X } from 'lucide-react';

/**
 * Reusable modal: title, body (children), footer (actions).
 * Uses modal-overlay, modal-content from AdminLayout.css
 */
export default function Modal({
    title, onClose, children, footer, className = '', contentClassName = '', width, hideCloseButton = false,
}) {
    return (
        <div className={`modal-overlay ${className}`} onClick={onClose}>
            <div
                className={contentClassName || "modal-content"}
                style={width ? { width, maxWidth: 'none' } : {}}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header-content">
                    <h3>{title}</h3>
                    {!hideCloseButton && (
                        <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
                            <X size={20} />
                        </button>
                    )}
                </div>
                <div className="modal-body-content">
                    {children}
                </div>
                {footer && <div className="modal-footer-content">{footer}</div>}
            </div>
        </div>
    );
}
