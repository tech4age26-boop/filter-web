import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Percent, Calculator, FileText, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import '../../styles/admin/TaxCodePage.css';

const TaxCodePage = () => {
    const [vatRate, setVatRate] = useState(15);
    const [taxes, setTaxes] = useState([
        { id: 1, name: 'Service Tax', percent: 5 },
        { id: 2, name: 'Municipal Tax', percent: 2.5 }
    ]);
    const [newName, setNewName] = useState('');
    const [newPercent, setNewPercent] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const handleAddTax = (e) => {
        e.preventDefault();
        if (!newName || !newPercent) return;

        const newTax = {
            id: Date.now(),
            name: newName,
            percent: parseFloat(newPercent)
        };

        setTaxes([...taxes, newTax]);
        setNewName('');
        setNewPercent('');
    };

    const handleDeleteTax = (id) => {
        setTaxes(taxes.filter(t => t.id !== id));
    };

    const handleSaveAll = () => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    return (
        <div className="tax-codes-page">
            <header className="tax-header">
                <div>
                    <h2 className="tax-title">Tax Configuration</h2>
                    <p className="tax-subtitle">Manage VAT and additional operational taxes</p>
                </div>
                <button
                    className={`tax-save-btn ${showSuccess ? 'success' : ''}`}
                    onClick={handleSaveAll}
                >
                    {showSuccess ? (
                        <><CheckCircle2 size={18} /> SETTINGS SAVED</>
                    ) : (
                        <><Save size={18} /> SAVE CONFIGURATION</>
                    )}
                </button>
            </header>

            <div className="tax-grid">
                {/* Primary VAT Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="tax-card primary-vat"
                >
                    <div className="tax-card-header">
                        <div className="tax-card-icon vat-icon">
                            <Percent size={24} />
                        </div>
                        <div className="tax-card-info">
                            <h3>Primary VAT</h3>
                            <p>Global Value Added Tax rate</p>
                        </div>
                    </div>

                    <div className="vat-input-wrapper">
                        <input
                            type="number"
                            className="vat-input"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                            step="0.01"
                            placeholder="0.00"
                        />
                        <span className="vat-symbol">%</span>
                    </div>

                    <div className="vat-hint">
                        <AlertCircle size={14} />
                        <span>This rate applies to all retail and corporate invoices by default.</span>
                    </div>
                </motion.div>

                {/* Calculation Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="tax-card calc-preview"
                >
                    <div className="tax-card-header">
                        <div className="tax-card-icon calculator-icon">
                            <Calculator size={24} />
                        </div>
                        <div className="tax-card-info">
                            <h3>Live Preview</h3>
                            <p>Calculated total for SAR 1,000.00</p>
                        </div>
                    </div>

                    <div className="preview-rows">
                        <div className="preview-row">
                            <span>Subtotal</span>
                            <span>SAR 1,000.00</span>
                        </div>
                        <div className="preview-row">
                            <span>VAT ({vatRate}%)</span>
                            <span>SAR {(1000 * vatRate / 100).toFixed(2)}</span>
                        </div>
                        {taxes.map(tax => (
                            <div key={tax.id} className="preview-row additional">
                                <span>{tax.name} ({tax.percent}%)</span>
                                <span>SAR {(1000 * tax.percent / 100).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="preview-divider"></div>
                        <div className="preview-row grand-total">
                            <span>Grand Total</span>
                            <span>
                                SAR {(1000 + (1000 * vatRate / 100) + taxes.reduce((acc, t) => acc + (1000 * t.percent / 100), 0)).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Additional Taxes List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="tax-card full-width"
                >
                    <div className="tax-card-header">
                        <div className="tax-card-icon list-icon">
                            <FileText size={24} />
                        </div>
                        <div className="tax-card-info">
                            <h3>Additional Tax Codes</h3>
                            <p>Configure custom taxes for specific operations</p>
                        </div>
                    </div>

                    <form className="add-tax-form" onSubmit={handleAddTax}>
                        <div className="tax-form-group">
                            <label>Tax Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Municipal Tax"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="tax-form-group">
                            <label>Percent</label>
                            <div className="input-with-symbol">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newPercent}
                                    onChange={(e) => setNewPercent(e.target.value)}
                                />
                                <span>%</span>
                            </div>
                        </div>
                        <button type="submit" className="add-btn">
                            <Plus size={18} /> ADD TAX
                        </button>
                    </form>

                    <div className="tax-table-wrapper">
                        <table className="tax-table">
                            <thead>
                                <tr>
                                    <th>TAX NAME</th>
                                    <th>PERCENTAGE</th>
                                    <th>STATUS</th>
                                    <th className="text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence mode="popLayout">
                                    {taxes.map((tax) => (
                                        <motion.tr
                                            key={tax.id}
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className="tax-row"
                                        >
                                            <td>
                                                <div className="tax-name-cell">
                                                    <span className="dot"></span>
                                                    {tax.name}
                                                </div>
                                            </td>
                                            <td className="tax-percent-val">{tax.percent}%</td>
                                            <td>
                                                <span className="tax-status-badge">Active</span>
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    className="delete-tax-btn"
                                                    onClick={() => handleDeleteTax(tax.id)}
                                                    title="Delete Tax"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                                {taxes.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="empty-tax-message">
                                            No additional taxes configured.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default TaxCodePage;
