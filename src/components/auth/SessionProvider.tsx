import { createContext, useContext, type ReactNode } from 'react';
import { useSession } from '../../lib/auth-client';

/**
 * Session shape as better-auth returns it, narrowed to what the app reads.
 * `role`/`unit`/`status` live on the user object added by the server plugin.
 */
export interface CurrentUser {
    id: string;
    name: string;
    email: string;
    role?: string;
    unit?: string;
    status?: string;
}

interface SessionContextValue {
    user: CurrentUser | null;
    isPending: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Single `useSession()` call for the whole app. Wrap the tree once (App.tsx);
 * every consumer reads the same context instead of subscribing separately.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
    const { data: session, isPending, isRefetching } = useSession();

    const user = session?.user
        ? {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: (session.user as Record<string, unknown>).role as string | undefined,
            unit: (session.user as Record<string, unknown>).unit as string | undefined,
            status: (session.user as Record<string, unknown>).status as string | undefined,
        }
        : null;

    // LoginPage navigates as soon as sign-in resolves, so a route guard can read this
    // before the session query settles. Reporting null there would bounce the user
    // straight back to /login, so an in-flight refetch counts as pending: guards keep
    // showing their loading state instead of redirecting on a not-yet-updated session.
    const pending = isPending || (user === null && isRefetching);

    return <SessionContext.Provider value={{ user, isPending: pending }}>{children}</SessionContext.Provider>;
}

/** Current authenticated user + pending flag. Requires <SessionProvider> above. */
export function useCurrentUser(): SessionContextValue {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useCurrentUser must be used inside <SessionProvider>');
    return ctx;
}
