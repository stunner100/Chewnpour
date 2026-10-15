// Isolated local database for click-through testing (never production).
//
//   docker run -d --name chewnpour-localdb -e POSTGRES_PASSWORD=localdev \
//     -p 127.0.0.1:54329:5432 pgvector/pgvector:pg17
//   node scripts/dev-local-db.mjs        # migrate + seed, writes .env.localdb
//   DEV_ENV_FILE=.env.localdb npm run dev:auth   # local API on the local DB
//   npm run dev                                   # app on http://localhost:5173
//
// .env.localdb (gitignored via .env.*) holds the local DB URL, a generated
// test admin login, and blanks for remote services so nothing leaves the
// machine: storage, email, and Google sign-in are disabled.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_DB_URL =
    process.env.LOCAL_DATABASE_URL || "postgres://postgres:localdev@127.0.0.1:54329/postgres";
const ENV_FILE = path.join(root, ".env.localdb");

const url = new URL(LOCAL_DB_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`Refusing to touch a non-local database: ${url.hostname}`);
}

// Stand-ins for what Supabase provides, so the real migrations apply as-is.
const SUPABASE_STUBS = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);
CREATE TABLE IF NOT EXISTS public.local_migrations (name TEXT PRIMARY KEY);
`;

const pool = new pg.Pool({ connectionString: LOCAL_DB_URL });

const migrate = async () => {
    await pool.query(SUPABASE_STUBS);
    const dir = path.join(root, "supabase", "migrations");
    const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
        const done = await pool.query("SELECT 1 FROM local_migrations WHERE name = $1", [file]);
        if (done.rowCount) continue;
        const sql = await fs.readFile(path.join(dir, file), "utf8");
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query("INSERT INTO local_migrations (name) VALUES ($1)", [file]);
            await client.query("COMMIT");
            console.log(`applied ${file}`);
        } catch (error) {
            await client.query("ROLLBACK");
            throw new Error(`${file}: ${error.message}`);
        } finally {
            client.release();
        }
    }
};

const readEnvFile = async () => {
    try {
        const text = await fs.readFile(ENV_FILE, "utf8");
        return Object.fromEntries(
            text.split("\n").filter((line) => line.includes("=")).map((line) => {
                const index = line.indexOf("=");
                return [line.slice(0, index), line.slice(index + 1)];
            }),
        );
    } catch {
        return {};
    }
};

const writeEnvFile = async (values) => {
    const lines = [
        "# Local-only test environment written by scripts/dev-local-db.mjs.",
        ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
    ];
    await fs.writeFile(ENV_FILE, `${lines.join("\n")}\n`, { mode: 0o600 });
};

const ensureEnvFile = async () => {
    const existing = await readEnvFile();
    const values = {
        DATABASE_URL: LOCAL_DB_URL,
        DATABASE_SSL: "false",
        PG_POOL_MAX: "4",
        BETTER_AUTH_URL: "http://localhost:5173",
        BETTER_AUTH_SECRET: existing.BETTER_AUTH_SECRET || crypto.randomBytes(32).toString("hex"),
        // Blank remote services so the local stack cannot reach them.
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        RESEND_API_KEY: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        LOCAL_ADMIN_EMAIL: existing.LOCAL_ADMIN_EMAIL || "local-admin@chewnpour.test",
        LOCAL_ADMIN_PASSWORD: existing.LOCAL_ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url"),
        ADMIN_USER_IDS: existing.ADMIN_USER_IDS || "",
    };
    await writeEnvFile(values);
    return values;
};

const seed = async (env) => {
    for (const [key, value] of Object.entries(env)) process.env[key] = value;
    const { auth } = await import("../server/auth.js");
    const { getPool } = await import("../server/db.js");

    let admin = (await pool.query(`SELECT id FROM "user" WHERE email = $1`, [env.LOCAL_ADMIN_EMAIL])).rows[0];
    if (!admin) {
        const result = await auth.api.signUpEmail({
            body: { email: env.LOCAL_ADMIN_EMAIL, password: env.LOCAL_ADMIN_PASSWORD, name: "Local Admin" },
        });
        admin = { id: result.user.id };
    }
    if (env.ADMIN_USER_IDS !== admin.id) {
        await writeEnvFile({ ...env, ADMIN_USER_IDS: admin.id });
    }

    const already = await pool.query(`SELECT 1 FROM "user" WHERE email LIKE 'student%@chewnpour.test' LIMIT 1`);
    if (!already.rowCount) {
        const days = [0, 0, 1, 3, 3, 3, 5, 9];
        for (let i = 0; i < days.length; i += 1) {
            const userId = `seed-student-${i}`;
            await pool.query(
                `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, NOW() - make_interval(days => $5), NOW())`,
                [userId, `Student ${i}`, `student${i}@chewnpour.test`, i % 2 === 0, days[i]],
            );
            await pool.query(
                `INSERT INTO profiles (user_id, full_name, onboarding_completed) VALUES ($1, $2, $3)
                 ON CONFLICT (user_id) DO NOTHING`,
                [userId, `Student ${i}`, i < 5],
            );
            await pool.query(
                `INSERT INTO uploads (id, user_id, file_name, file_type, file_size, storage_bucket, storage_path, status)
                 VALUES ($1, $2, $3, 'pdf', 204800, 'study-uploads', $4, $5)`,
                [`seed-upload-${i}`, userId, `Biology notes ${i}.pdf`, `${userId}/notes.pdf`, i === 7 ? "error" : "ready"],
            );
            await pool.query(
                `INSERT INTO courses (id, user_id, upload_id, title, status) VALUES ($1, $2, $3, $4, 'ready')`,
                [`seed-course-${i}`, userId, `seed-upload-${i}`, `Biology ${i}`],
            );
            await pool.query(
                `INSERT INTO topics (id, user_id, course_id, title, content, sort_order) VALUES ($1, $2, $3, 'Cells', 'Cells are the unit of life.', 0)`,
                [`seed-topic-${i}`, userId, `seed-course-${i}`],
            );
            if (i < 4) {
                await pool.query(
                    `INSERT INTO topic_chat_messages (id, user_id, topic_id, role, content, created_at)
                     VALUES ($1, $2, $3, 'user', 'What is a cell?', NOW() - make_interval(days => $4)),
                            ($5, $2, $3, 'assistant', 'The basic unit of life.', NOW() - make_interval(days => $4))`,
                    [`seed-chat-${i}-a`, userId, `seed-topic-${i}`, i, `seed-chat-${i}-b`],
                );
            }
            if (i < 3) {
                await pool.query(
                    `INSERT INTO exam_attempts (id, user_id, course_id, total_questions, started_at, ends_at, status, submitted_at)
                     VALUES ($1, $2, $3, 10, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', $4, $5)`,
                    [`seed-exam-${i}`, userId, `seed-course-${i}`, i === 0 ? "in_progress" : "submitted", i === 0 ? null : new Date()],
                );
            }
        }
        await pool.query(
            `INSERT INTO past_papers (id, institution, course_code, course_title, year, semester, level,
                file_name, file_type, file_size, content_type, storage_bucket, storage_path, status)
             VALUES
             ('seedpaper000000000001', 'University of Ghana', 'BIOL 101', 'Cell Biology', 2024, 'First semester', '100',
              'biol101.pdf', 'pdf', 102400, 'application/pdf', 'past-papers', 'seedpaper000000000001/biol101.pdf', 'published'),
             ('seedpaper000000000002', 'KNUST', 'MATH 151', 'Algebra', 2023, 'Second semester', '100',
              'math151.jpg', 'jpg', 51200, 'image/jpeg', 'past-papers', 'seedpaper000000000002/math151.jpg', 'draft')`,
        );
        console.log("seeded sample students, uploads, courses, chats, exams, past papers");
    }
    await getPool().end();
};

try {
    await migrate();
    const env = await ensureEnvFile();
    await seed(env);
    console.log(`ready: ${path.relative(root, ENV_FILE)} written (local admin: ${env.LOCAL_ADMIN_EMAIL})`);
} finally {
    await pool.end();
}
