import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../lib/auth-client';
import { canAccess, getDefaultRoute } from '../../lib/rbac';

interface RoleGuardProps {
    children: React.ReactNode;
}

/**
 * Route-level role guard. Checks if the current user's role
 * has permission to access the current route path.
 * Redirects to their default page if not authorized.
 */
export function RoleGuard({ children }: RoleGuardProps) {
    const { data: session } = useSession();
    const location = useLocation();
    const userRole = (session?.user as Record<string, any>)?.role || 'user';

    // If session is still loading, show nothing (prevents flash)
    if (!session) return null;

    // Check RBAC
    if (!canAccess(userRole, location.pathname)) {
        const fallback = getDefaultRoute(userRole);
        return <Navigate to={fallback} replace />;
    }

    return <>{children}</>;
}
