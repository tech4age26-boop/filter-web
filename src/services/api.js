export const BASE_URL = 'http://192.168.1.108:3000';

// export const BASE_URL = 'https://filterbackend-production.up.railway.app';




export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('filter_auth_token');
    const customHeaders = options.headers || {};
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            'accept': '*/*',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...customHeaders,
        },
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'accept': '*/*',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...customHeaders,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = {
            path,
            method: options.method || 'GET',
            status: res.status,
            statusText: res.statusText,
            response: err,
            requestBody: options.body ? safeJsonParse(options.body) : undefined,
        };
        // Keep a full object log to make backend debugging easier.
        console.error('[apiFetch] Request failed', detail);
        throw new Error(
            err.message ||
                err.error ||
                `Request failed: ${res.status} ${res.statusText} (${options.method || 'GET'} ${path})`,
        );
    }
    return res.json();
}

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}
