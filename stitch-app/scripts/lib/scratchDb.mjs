// A throwaway Postgres database with every migration applied, for tests that
// run the real generation job. Uses the local test database server from
// scripts/dev-local-db.mjs (docker: pgvector/pgvector:pg17 on 127.0.0.1:54329,
// or LOCAL_DATABASE_URL). Points DATABASE_URL at the scratch database, so
// import server modules after createScratchDb().
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER_URL = process.env.LOCAL_DATABASE_URL || 'postgres://postgres:localdev@127.0.0.1:54329/postgres';

const supabaseStubs = () => {
    const source = fs.readFileSync(path.join(root, 'scripts', 'dev-local-db.mjs'), 'utf8');
    return source.match(/const SUPABASE_STUBS = `([\s\S]*?)`;/)[1];
};

export const createScratchDb = async (label) => {
    const server = new URL(SERVER_URL);
    if (!['127.0.0.1', 'localhost'].includes(server.hostname)) {
        throw new Error(`Refusing to use a non-local database server: ${server.hostname}`);
    }
    const name = `test_${label}_${process.pid}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const admin = new pg.Client({ connectionString: SERVER_URL });
    try {
        await admin.connect();
    } catch (error) {
        throw new Error(`This test needs the local test database (see scripts/dev-local-db.mjs): ${error.message}`);
    }
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
    const url = new URL(SERVER_URL);
    url.pathname = `/${name}`;
    const db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    await db.query(supabaseStubs());
    const dir = path.join(root, 'supabase', 'migrations');
    for (const file of fs.readdirSync(dir).filter((entry) => entry.endsWith('.sql')).sort()) {
        await db.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    }
    await db.end();
    process.env.DATABASE_URL = url.toString();
    process.env.DATABASE_SSL = 'false';
    process.env.PG_POOL_MAX = '5';
    return {
        url: url.toString(),
        drop: async () => {
            await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
            await admin.end();
        },
    };
};

// A user with an extracted upload and its course, not yet generated.
export const seedCourse = async (db, { id, extractedText, fileName = 'notes.pdf' }) => {
    const userId = `user_${id}`;
    await db.query(
        `INSERT INTO "user" (id, name, email) VALUES ($1, 'Test student', $2) ON CONFLICT DO NOTHING`,
        [userId, `${userId}@example.test`],
    );
    await db.query(
        `INSERT INTO uploads (id, user_id, file_name, file_type, storage_bucket, storage_path, status,
                              extraction_status, extracted_text, processing_step)
         VALUES ($1, $2, $3, 'pdf', 'test', $1, 'ready', 'complete', $4, 'ready')`,
        [`upload_${id}`, userId, fileName, extractedText],
    );
    await db.query(
        `INSERT INTO courses (id, user_id, upload_id, title, status) VALUES ($1, $2, $3, 'Test course', 'generating')`,
        [`course_${id}`, userId, `upload_${id}`],
    );
    return { userId, uploadId: `upload_${id}`, courseId: `course_${id}` };
};
