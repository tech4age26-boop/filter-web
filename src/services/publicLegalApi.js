import { apiFetch } from './api';

export function getPublicLegalPage(slug) {
    return apiFetch(`/public/legal-pages/${encodeURIComponent(slug)}`);
}

export function listPublicLegalPages() {
    return apiFetch('/public/legal-pages');
}
