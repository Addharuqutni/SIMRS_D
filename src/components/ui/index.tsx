import { useState, useEffect, type ReactNode } from 'react';
import styles from './ui.module.css';

export { Printable } from './Printable';

/* ========== StatCard ========== */
interface StatCardProps {
    icon: ReactNode;
    value: string | number;
    label: string;
    trend?: { value: string; direction: 'up' | 'down' };
    color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
    style?: React.CSSProperties;
}

export function StatCard({ icon, value, label, trend, color = 'blue', style }: StatCardProps) {
    return (
        <div className={styles.statCard} style={style}>
            <div className={`${styles.statIcon} ${styles[color]}`}>{icon}</div>
            <div className={styles.statContent}>
                <div className={styles.statValue}>{value}</div>
                <div className={styles.statLabel}>{label}</div>
                {trend && (
                    <span className={`${styles.statTrend} ${styles[trend.direction]}`}>
                        {trend.direction === 'up' ? '▲' : '▼'} {trend.value}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ========== StatusBadge ========== */
interface StatusBadgeProps {
    variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    children: ReactNode;
    dot?: boolean;
}

export function StatusBadge({ variant, children, dot = true }: StatusBadgeProps) {
    return (
        <span className={`${styles.badge} ${styles[variant]}`}>
            {dot && <span className={styles.badgeDot} />}
            {children}
        </span>
    );
}

/* ========== Card ========== */
interface CardProps {
    title?: string;
    icon?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export function Card({ title, icon, action, children, className = '', style }: CardProps) {
    return (
        <div className={`${styles.card} ${className}`} style={style}>
            {title && (
                <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                        {icon}
                        {title}
                    </div>
                    {action}
                </div>
            )}
            <div className={styles.cardBody}>{children}</div>
        </div>
    );
}

/* ========== Button ========== */
interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    type?: 'button' | 'submit';
    title?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
}

export function Button({ variant = 'primary', size = 'md', children, onClick, className = '', type = 'button', title, style, disabled }: ButtonProps) {
    const variantClass = {
        primary: styles.btnPrimary,
        secondary: styles.btnSecondary,
        danger: styles.btnDanger,
        ghost: styles.btnGhost,
    }[variant];

    const sizeClass = {
        sm: styles.btnSm,
        md: '',
        lg: styles.btnLg,
    }[size];

    return (
        <button
            type={type}
            className={`${styles.btn} ${variantClass} ${sizeClass} ${className}`}
            onClick={onClick}
            title={title}
            style={style}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

/* ========== FilterTabs ========== */
interface FilterTabsProps {
    tabs: { label: string; value: string; count?: number }[];
    active: string;
    onChange: (value: string) => void;
}

export function FilterTabs({ tabs, active, onChange }: FilterTabsProps) {
    return (
        <div className={styles.filterTabs}>
            {tabs.map((tab) => (
                <button
                    key={tab.value}
                    className={`${styles.filterTab} ${active === tab.value ? styles.active : ''}`}
                    onClick={() => onChange(tab.value)}
                >
                    {tab.label}
                    {tab.count !== undefined && ` (${tab.count})`}
                </button>
            ))}
        </div>
    );
}

/* ========== SearchBar ========== */
interface SearchBarProps {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
}

export function SearchBar({ placeholder = 'Cari...', value, onChange }: SearchBarProps) {
    return (
        <div className={styles.searchWrapper}>
            <svg className={styles.searchInputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
            </svg>
            <input
                type="text"
                className={styles.searchInput}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

/* ========== Pagination ========== */
interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, totalItems, onPageChange }: PaginationProps) {
    const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1);

    return (
        <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
                Total: {totalItems} data
            </span>
            <div className={styles.paginationBtns}>
                <button
                    className={styles.pageBtn}
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                >
                    ‹
                </button>
                {pages.map((p) => (
                    <button
                        key={p}
                        className={`${styles.pageBtn} ${currentPage === p ? styles.active : ''}`}
                        onClick={() => onPageChange(p)}
                    >
                        {p}
                    </button>
                ))}
                {totalPages > 5 && <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>}
                <button
                    className={styles.pageBtn}
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                >
                    ›
                </button>
            </div>
        </div>
    );
}

/* ========== Modal ========== */
interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    icon?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: ReactNode;
    footer?: ReactNode;
}

export function Modal({ open, onClose, title, icon, size = 'md', children, footer }: ModalProps) {
    if (!open) return null;

    const sizeClass = {
        sm: styles.modalSm,
        md: styles.modalMd,
        lg: styles.modalLg,
        xl: styles.modalXl,
    }[size];

    return (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`${styles.modalDialog} ${sizeClass}`}>
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitle}>
                        {icon}
                        {title}
                    </div>
                    <button className={styles.modalClose} onClick={onClose}>✕</button>
                </div>
                <div className={styles.modalBody}>{children}</div>
                {footer && <div className={styles.modalFooter}>{footer}</div>}
            </div>
        </div>
    );
}

/* ========== ConfirmDialog ========== */
interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'success';
    confirmLabel?: string;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, variant = 'danger', confirmLabel = 'Ya, Lanjutkan' }: ConfirmDialogProps) {
    if (!open) return null;

    const iconVariantClass = {
        danger: styles.confirmIconDanger,
        warning: styles.confirmIconWarning,
        success: styles.confirmIconSuccess,
    }[variant];

    const iconMap = { danger: '⚠', warning: '❓', success: '✓' };

    return (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`${styles.modalDialog} ${styles.modalSm}`}>
                <div className={styles.modalBody} style={{ paddingTop: '32px', paddingBottom: '8px' }}>
                    <div className={`${styles.confirmIcon} ${iconVariantClass}`}>
                        <span style={{ fontSize: '24px' }}>{iconMap[variant]}</span>
                    </div>
                    <div className={styles.confirmTitle}>{title}</div>
                    <div className={styles.confirmMessage}>{message}</div>
                </div>
                <div className={styles.modalFooter} style={{ justifyContent: 'center' }}>
                    <Button variant="secondary" onClick={onClose}>Batal</Button>
                    <Button variant={variant === 'success' ? 'primary' : 'danger'} onClick={() => { onConfirm(); onClose(); }}>
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ========== Toast ========== */
interface ToastItem {
    id: number;
    message: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
}

let toastListeners: ((toasts: ToastItem[]) => void)[] = [];
let toastList: ToastItem[] = [];
let toastId = 0;

export function showToast(message: string, variant: ToastItem['variant'] = 'success') {
    const id = ++toastId;
    toastList = [...toastList, { id, message, variant }];
    toastListeners.forEach(l => l(toastList));
    setTimeout(() => {
        toastList = toastList.filter(t => t.id !== id);
        toastListeners.forEach(l => l(toastList));
    }, 3000);
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        toastListeners.push(setToasts);
        return () => { toastListeners = toastListeners.filter(l => l !== setToasts); };
    }, []);

    if (toasts.length === 0) return null;

    const variantClass = {
        success: styles.toastSuccess,
        danger: styles.toastDanger,
        warning: styles.toastWarning,
        info: styles.toastInfo,
    };

    const iconMap = { success: '✓', danger: '✕', warning: '⚠', info: 'ℹ' };
    const colorMap = { success: 'var(--success)', danger: 'var(--danger)', warning: 'var(--warning)', info: 'var(--primary)' };

    return (
        <div className={styles.toastContainer}>
            {toasts.map(t => (
                <div key={t.id} className={`${styles.toast} ${variantClass[t.variant]}`}>
                    <span className={styles.toastIcon} style={{ color: colorMap[t.variant], fontSize: '18px', fontWeight: 700 }}>
                        {iconMap[t.variant]}
                    </span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}

export { styles as uiStyles };
