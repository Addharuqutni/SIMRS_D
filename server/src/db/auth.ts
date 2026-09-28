import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, createAccessControl } from "better-auth/plugins";
import { db } from "./index";
import * as schema from "./schemas";
import { frontendUrls, devOrigins } from "../utils/origins";
import { ROLES } from "../../../shared/access";

// Access-control statements for the admin plugin endpoints (e.g. setUserPassword).
const auditAc = createAccessControl({
    user: ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"],
    session: ["list", "revoke", "delete"],
});

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    trustedOrigins: [...frontendUrls, ...devOrigins],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
        },
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        admin({
            // Superadmin is this app's admin role (capability 'admin' in shared/access.ts)
            adminRoles: [ROLES.SUPERADMIN],
            roles: {
                [ROLES.SUPERADMIN]: auditAc.newRole({
                    user: ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"],
                    session: ["list", "revoke", "delete"],
                }),
            },
        }),
    ],
    user: {
        // Expose custom fields in session response
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "user",
                input: false, // not settable via signUp
            },
            unit: {
                type: "string",
                defaultValue: "",
                input: false,
            },
            status: {
                type: "string",
                defaultValue: "aktif",
                input: false,
            },
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
    }
});
