import type { ReactNode } from 'react';

interface PlaceholderProps {
    title: string;
    description: string;
    icon: ReactNode;
}

export function PlaceholderPage({ title, description, icon }: PlaceholderProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease',
        }}>
            <div style={{
                width: 80,
                height: 80,
                borderRadius: '16px',
                background: 'var(--primary-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                marginBottom: 24,
            }}>
                {icon}
            </div>
            <h1 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 8,
                letterSpacing: '-0.02em',
            }}>
                {title}
            </h1>
            <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                maxWidth: 400,
                lineHeight: 1.6,
            }}>
                {description}
            </p>
            <div style={{
                marginTop: 32,
                padding: '10px 24px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--text-muted)',
            }}>
                🚧 Halaman ini sedang dalam pengembangan
            </div>
        </div>
    );
}
