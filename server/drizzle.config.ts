import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

// Schema is applied with `npm run db:push` (see README): the schema files are
// the single source of truth, so no migration snapshots are kept in the repo.
export default defineConfig({
    schema: "./src/db/schemas/*",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
