export const frontendUrls = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : [];

export const devOrigins = [
    'http://localhost:5173', 'http://localhost:5174',
    'http://localhost:5175', 'http://localhost:5176',
    'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
];
