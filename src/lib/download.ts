import { api } from './axios';

/** Fetches a server-generated file (CSV export) with the session cookie and saves it. */
export async function downloadFile(path: string, filename: string, params?: Record<string, unknown>): Promise<void> {
    const res = await api.get<Blob>(path, { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
