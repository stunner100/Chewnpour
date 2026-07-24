import { Pool } from "pg";

const resolveDatabaseUrl = () => {
    const url = String(process.env.DATABASE_URL || "").trim();
    if (!url) {
        throw new Error(
            "DATABASE_URL is required (Supabase Postgres connection string).",
        );
    }
    return url;
};

let pool;

export const getPool = () => {
    if (!pool) {
        pool = new Pool({
            connectionString: resolveDatabaseUrl(),
            max: Number(process.env.PG_POOL_MAX || 1),
            ssl: process.env.DATABASE_SSL === "false"
                ? false
                : { rejectUnauthorized: false },
        });
    }
    return pool;
};
