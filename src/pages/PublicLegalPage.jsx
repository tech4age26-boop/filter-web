import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getPublicLegalPage } from '../services/publicLegalApi';
import './PublicLegalPage.css';

function pickLocalized(page, locale) {
    const isAr = locale === 'ar';
    return {
        title: (isAr && page.titleAr?.trim()) ? page.titleAr : (page.titleEn || 'Legal'),
        body: (isAr && page.bodyAr?.trim()) ? page.bodyAr : (page.bodyEn || ''),
    };
}

export default function PublicLegalPage({ slug, defaultLocale = 'en' }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(null);
    const [locale, setLocale] = useState(defaultLocale);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getPublicLegalPage(slug);
                if (!mounted) return;
                setPage(res?.page ?? null);
            } catch (e) {
                if (!mounted) return;
                setError(e?.message || 'This page is not available yet.');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [slug]);

    const content = useMemo(() => {
        if (!page) return { title: '', body: '' };
        return pickLocalized(page, locale);
    }, [page, locale]);

    const updatedLabel = page?.updatedAt
        ? new Date(page.updatedAt).toLocaleDateString()
        : null;

    return (
        <div className="public-legal-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <header className="public-legal-header">
                <div className="public-legal-brand">
                    <span className="public-legal-logo">Filter</span>
                    <span className="public-legal-tag">Car Services</span>
                </div>
                <div className="public-legal-lang">
                    <button
                        type="button"
                        className={locale === 'en' ? 'is-active' : ''}
                        onClick={() => setLocale('en')}
                    >
                        EN
                    </button>
                    <button
                        type="button"
                        className={locale === 'ar' ? 'is-active' : ''}
                        onClick={() => setLocale('ar')}
                    >
                        عربي
                    </button>
                </div>
            </header>

            <main className="public-legal-main">
                {loading ? (
                    <div className="public-legal-state">
                        <Loader2 className="spin" size={28} />
                        <span>Loading…</span>
                    </div>
                ) : error ? (
                    <div className="public-legal-state public-legal-error">
                        <AlertTriangle size={28} />
                        <h1>Page unavailable</h1>
                        <p>{error}</p>
                        <Link to="/" className="public-legal-home-link">Back to home</Link>
                    </div>
                ) : (
                    <article className="public-legal-article">
                        <h1>{content.title}</h1>
                        {updatedLabel && (
                            <p className="public-legal-updated">Last updated: {updatedLabel}</p>
                        )}
                        {content.body?.trim() ? (
                            <div
                                className="public-legal-body"
                                dangerouslySetInnerHTML={{ __html: content.body }}
                            />
                        ) : (
                            <p className="public-legal-empty">Content will be published soon.</p>
                        )}
                    </article>
                )}
            </main>

            <footer className="public-legal-footer">
                <Link to="/privacy-policy">Privacy Policy</Link>
                <span>·</span>
                <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
            </footer>
        </div>
    );
}
