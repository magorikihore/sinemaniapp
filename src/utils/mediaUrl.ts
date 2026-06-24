import { STORAGE_URL } from '../constants/config';

const PLACEHOLDER = 'https://via.placeholder.com/130x195/1a1a2e/666';

/** Upgrade http:// to https:// for Google Play network security compliance. */
export function ensureHttps(url: string): string {
    if (url.startsWith('http://')) {
        return `https://${url.slice(7)}`;
    }
    return url;
}

/** Resolve stream/video URLs — returns null when path is empty. */
export function resolveStreamUrl(path: string | null | undefined): string | null {
    if (!path) {
        return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
        return ensureHttps(path);
    }

    const base = STORAGE_URL.replace(/\/$/, '');
    return `${base}/${path.replace(/^\//, '')}`;
}

    path: string | null | undefined,
    fallback: string = PLACEHOLDER,
): string {
    if (!path) {
        return fallback;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
        return ensureHttps(path);
    }

    const base = STORAGE_URL.replace(/\/$/, '');
    return `${base}/${path.replace(/^\//, '')}`;
}
