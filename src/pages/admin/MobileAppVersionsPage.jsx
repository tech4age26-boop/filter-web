import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Smartphone } from 'lucide-react';
import {
    getMobileAppVersions,
    updateMobileAppVersion,
} from '../../services/superAdminApi';
import '../../styles/admin/MobileAppMenuPage.css';

const APP_LABELS = {
    softpos: 'Filter SoftPOS',
    filter_hub: 'Filter Hub',
};

const CHANNELS = [
    { id: 'sandbox', title: 'Sandbox', hint: 'Railway / test builds' },
    { id: 'production', title: 'Production', hint: 'Live customer builds' },
];

function emptyDraft(row) {
    return {
        latestVersion: row.latestVersion || '',
        minVersion: row.minVersion || '',
        storeUrl: row.storeUrl || '',
        messageEn: row.messageEn || '',
        messageAr: row.messageAr || '',
        forceUpdate: row.forceUpdate === true,
    };
}

export default function MobileAppVersionsPage() {
    const [rows, setRows] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState('');
    const [error, setError] = useState('');
    const [savedKey, setSavedKey] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getMobileAppVersions();
            const list = Array.isArray(res?.data) ? res.data : [];
            const next = {};
            for (const row of list) {
                next[`${row.appKey}:${row.channel}`] = emptyDraft(row);
            }
            setRows(list);
            setDrafts(next);
        } catch (err) {
            setError(err?.message || 'Could not load app versions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const patchDraft = (key, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
        setSavedKey('');
    };

    const save = async (row) => {
        const key = `${row.appKey}:${row.channel}`;
        const draft = drafts[key];
        if (!draft) return;
        setSavingKey(key);
        setError('');
        setSavedKey('');
        try {
            await updateMobileAppVersion({
                appKey: row.appKey,
                channel: row.channel,
                latestVersion: draft.latestVersion.trim(),
                minVersion: draft.minVersion.trim(),
                storeUrl: draft.storeUrl.trim(),
                messageEn: draft.messageEn.trim(),
                messageAr: draft.messageAr.trim(),
                forceUpdate: draft.forceUpdate,
            });
            setSavedKey(key);
            await load();
        } catch (err) {
            setError(err?.message || 'Could not save this version');
        } finally {
            setSavingKey('');
        }
    };

    return (
        <div className="mobile-app-menu-page">
            <header className="mobile-app-menu-header">
                <div>
                    <h1>Mobile app versions</h1>
                    <p>
                        Sandbox and production are separate. SoftPOS checks its own
                        channel when the app opens. Raise the minimum version, or turn
                        on force update, to block older builds.
                    </p>
                </div>
            </header>

            {error ? <div className="mobile-app-menu-error" style={{ marginTop: 16 }}>{error}</div> : null}

            {loading ? (
                <div className="mobile-app-menu-card" style={{ marginTop: 20 }}>
                    <Loader2 className="animate-spin" size={22} />
                </div>
            ) : (
                CHANNELS.map((channel) => (
                    <section key={channel.id} style={{ marginTop: 22 }}>
                        <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 800 }}>
                            {channel.title}
                        </h2>
                        <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '0.9rem' }}>
                            {channel.hint}
                        </p>
                        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                            {rows
                                .filter((row) => row.channel === channel.id)
                                .map((row) => {
                                    const key = `${row.appKey}:${row.channel}`;
                                    const draft = drafts[key] || emptyDraft(row);
                                    const busy = savingKey === key;
                                    return (
                                        <form
                                            key={key}
                                            className="mobile-app-menu-card"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                save(row);
                                            }}
                                            style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <Smartphone size={18} />
                                                <strong>{APP_LABELS[row.appKey] || row.appKey}</strong>
                                            </div>
                                            <label className="mobile-app-menu-field">
                                                <span>Latest version</span>
                                                <input
                                                    value={draft.latestVersion}
                                                    onChange={(e) => patchDraft(key, 'latestVersion', e.target.value)}
                                                    placeholder="77.0.0"
                                                />
                                            </label>
                                            <label className="mobile-app-menu-field">
                                                <span>Minimum version</span>
                                                <input
                                                    value={draft.minVersion}
                                                    onChange={(e) => patchDraft(key, 'minVersion', e.target.value)}
                                                    placeholder="1.0.0"
                                                />
                                            </label>
                                            <label className="mobile-app-menu-field">
                                                <span>Download link</span>
                                                <input
                                                    value={draft.storeUrl}
                                                    onChange={(e) => patchDraft(key, 'storeUrl', e.target.value)}
                                                    placeholder="https://"
                                                />
                                            </label>
                                            <label className="mobile-app-menu-field">
                                                <span>Message (English)</span>
                                                <input
                                                    value={draft.messageEn}
                                                    onChange={(e) => patchDraft(key, 'messageEn', e.target.value)}
                                                />
                                            </label>
                                            <label className="mobile-app-menu-field">
                                                <span>Message (Arabic)</span>
                                                <input
                                                    value={draft.messageAr}
                                                    onChange={(e) => patchDraft(key, 'messageAr', e.target.value)}
                                                    dir="rtl"
                                                />
                                            </label>
                                            <label className="mobile-app-menu-switch-wrap" style={{ margin: '10px 0 14px' }}>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={draft.forceUpdate}
                                                    className={`mobile-app-menu-switch${draft.forceUpdate ? ' is-on' : ''}`}
                                                    onClick={() => patchDraft(key, 'forceUpdate', !draft.forceUpdate)}
                                                >
                                                    <span className="mobile-app-menu-switch-thumb" />
                                                </button>
                                                <span className="mobile-app-menu-switch-label">
                                                    {draft.forceUpdate ? 'Force update on' : 'Force update off'}
                                                </span>
                                            </label>
                                            <button type="submit" className="mobile-app-menu-save-btn" disabled={busy}>
                                                {busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                {savedKey === key ? 'Saved' : 'Save'}
                                            </button>
                                        </form>
                                    );
                                })}
                        </div>
                    </section>
                ))
            )}
        </div>
    );
}
