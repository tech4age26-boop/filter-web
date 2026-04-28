import { BASE_URL } from './api';

export async function adminLogin(email, password) {
    const res = await fetch(`${BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Login failed: ${res.status}`);
    }
    return data; // contains token
}

export async function corporateLogin(email, password) {
    const res = await fetch(`${BASE_URL}/auth/corporate/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Corporate Login failed: ${res.status}`);
    }
    return data;
}

export async function workshopLogin(email, password) {
    const res = await fetch(`${BASE_URL}/auth/workshop/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Workshop Login failed: ${res.status}`);
    }
    return data;
}

export async function cashierLogin(email, password) {
    const res = await fetch(`${BASE_URL}/auth/cashier/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Cashier Login failed: ${res.status}`);
    }
    return data;
}

export async function technicianLogin(email, password) {
    const res = await fetch(`${BASE_URL}/auth/technician/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Technician login failed: ${res.status}`);
    }
    return data;
}

export async function supplierLogin(mobileOrEmail, password) {
    const res = await fetch(`${BASE_URL}/auth/supplier/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': '*/*' },
        body: JSON.stringify({ mobileOrEmail, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Supplier Login failed: ${res.status}`);
    }
    return data;
}
