import { Navigate, useLocation } from 'react-router-dom';
import { canAccessRoute, defaultRouteFor } from '../../../shared/access';
import { useCurrentUser } from './SessionProvider';

interface RoleGuardProps {
    children: React.ReactNode;
}

/**
 * Route-level role guard. Checks if the current user's role
 * has permission to access the current route path.
 * Redirects to their default page if not authorized.
 */
export function RoleGuard({ children }: RoleGuardProps) {
    const { user, isPending } = useCurrentUser();
    const location = useLocation();

    if (isPending) {
        return (
            <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>
                Memeriksa sesi...
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;

    // Check RBAC
    if (!canAccessRoute(user.role, location.pathname)) {
        return <Navigate to={defaultRouteFor(user.role ?? null)} replace />;
    }

    return <>{children}</>;
}
