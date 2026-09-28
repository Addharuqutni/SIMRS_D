import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../ui';
import styles from './layout.module.css';

/**
 * Catches render errors in the page area so a crash shows a readable message
 * with a reload action instead of a blank screen. The sidebar/topbar stay usable.
 */
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state: { error: Error | null } = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Render error in page content:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '64px 24px', textAlign: 'center' }}>
                <TriangleAlert size={40} style={{ color: 'var(--danger)' }} />
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Terjadi kesalahan saat menampilkan halaman</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '520px' }}>
                        {this.state.error.message || 'Kesalahan tidak dikenal.'}
                    </p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', borderRadius: 'var(--radius-md)',
                        background: 'var(--primary)', color: '#fff', border: 'none',
                        fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    <RefreshCw size={16} /> Muat Ulang Halaman
                </button>
            </div>
        );
    }
}

export function AppLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggleSidebar = () => {
        if (window.innerWidth < 768) {
            setMobileOpen(!mobileOpen);
        } else {
            setCollapsed(!collapsed);
        }
    };

    const closeMobile = () => setMobileOpen(false);

    return (
        <div className={styles.layout}>
            <Sidebar
                collapsed={collapsed}
                mobileOpen={mobileOpen}
                onCloseMobile={closeMobile}
            />
            {mobileOpen && (
                <div
                    className={`${styles.sidebarOverlay} ${styles.visible}`}
                    onClick={closeMobile}
                />
            )}
            <div className={styles.mainArea}>
                <Topbar onToggleSidebar={toggleSidebar} />
                <main className={styles.content}>
                    <PageErrorBoundary>
                        <Outlet />
                    </PageErrorBoundary>
                </main>
            </div>
            <ToastContainer />
        </div>
    );
}
