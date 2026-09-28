import { NavLink, useLocation } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { canAccessRoute } from '../../../shared/access';
import { useCurrentUser } from '../auth/SessionProvider';
import { NAV_GROUPS, type NavGroup } from './nav';
import styles from './layout.module.css';

interface SidebarProps {
    collapsed: boolean;
    mobileOpen: boolean;
    onCloseMobile: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
    const location = useLocation();

    const sidebarClasses = [
        styles.sidebar,
        collapsed ? styles.collapsed : '',
        mobileOpen ? styles.mobileOpen : '',
    ]
        .filter(Boolean)
        .join(' ');

    const { user } = useCurrentUser();
    const userRole = user?.role;

    // Filter nav groups and items using the centralized RBAC config
    const renderNavGroups = NAV_GROUPS
        .map(group => {
            const filteredItems = group.items.filter(item => canAccessRoute(userRole, item.path));
            if (filteredItems.length === 0) return null;
            return { ...group, items: filteredItems };
        })
        .filter(Boolean) as NavGroup[];

    return (
        <aside className={sidebarClasses}>
            <div className={styles.sidebarHeader}>
                <img src="/logo.jpg" alt="SIMRS Logo" style={{ height: '36px', width: 'auto', mixBlendMode: 'multiply' }} />
                <span className={styles.sidebarTitle}>SIMRS</span>
            </div>

            <nav className={styles.sidebarNav}>
                {renderNavGroups.map((group) => (
                    <div key={group.label} className={styles.sidebarGroup}>
                        <div className={styles.sidebarGroupLabel}>{group.label}</div>
                        {group.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onCloseMobile}
                                className={({ isActive }) => {
                                    const activeClass = isActive || location.pathname.startsWith(item.path + '/') ? styles.active : '';
                                    return `${styles.sidebarItem} ${activeClass}`;
                                }}
                            >
                                <span className={styles.sidebarItemIcon}>{item.icon}</span>
                                <span className={styles.sidebarItemLabel}>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className={styles.sidebarFooter}>
                <button className={styles.sidebarToggle} style={{ display: 'none' }}>
                    {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
                    {!collapsed && <span>Collapse</span>}
                </button>
            </div>
        </aside>
    );
}
