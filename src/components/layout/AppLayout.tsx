import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../ui';
import styles from './layout.module.css';

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
                    <Outlet />
                </main>
            </div>
            <ToastContainer />
        </div>
    );
}
