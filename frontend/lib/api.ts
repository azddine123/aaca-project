/**
 * Centralized API client.
 *
 * Single place for URL building, JSON encoding and error parsing — FastAPI
 * returns `detail` either as a string or as a validation-error array, and
 * every screen used to re-implement this by hand.
 *
 * Usage:
 *   const data = await apiFetch('/auth/login', { method: 'POST', body: form });
 *   const data = await apiFetch('/auth/verify-email', { method: 'POST', json: { email, code } });
 *
 * Errors are thrown as ApiError with `.status` (HTTP code) and a
 * user-displayable French `.message`.
 */
import { API_URL } from '@/config/api';

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

function parseDetail(data: any, fallback: string): string {
    const detail = data?.detail;
    if (Array.isArray(detail)) {
        const msg = detail.map((e: any) => e?.msg ?? '').filter(Boolean).join(', ');
        return msg || fallback;
    }
    if (typeof detail === 'string' && detail) return detail;
    return fallback;
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
    /** Object to send as JSON (sets Content-Type: application/json). */
    json?: any;
    /** Raw body (FormData, etc.) — Content-Type left to the runtime. */
    body?: BodyInit | null;
    /** Message shown when the server does not provide a usable `detail`. */
    fallbackError?: string;
}

export async function apiFetch<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
    const { json, fallbackError = 'Une erreur est survenue.', headers, ...init } = options;

    const h = new Headers(headers);
    let body: BodyInit | null | undefined = init.body;
    if (json !== undefined) {
        h.set('Content-Type', 'application/json');
        body = JSON.stringify(json);
    }

    const res = await fetch(`${API_URL}${path}`, { ...init, headers: h, body });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new ApiError(parseDetail(data, fallbackError), res.status);
    }
    return data as T;
}
