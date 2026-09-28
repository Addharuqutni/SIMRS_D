import axios from 'axios';

export const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Sends an expired/lost session back to the login screen once, preserving the
 * page the user was on. Guards against hard-reloading during background polls:
 * only consulted for 401s, never touches the page when already on /login.
 */
function redirectToLogin() {
    const { pathname, search } = window.location;
    if (pathname === '/login') return;
    const next = encodeURIComponent(pathname + search);
    window.location.assign(`/login?next=${next}`);
}

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            redirectToLogin();
        }
        return Promise.reject(error);
    }
);
