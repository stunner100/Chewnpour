import { createClient } from "@supabase/supabase-js";

let adminClient;

export const getStorageBucket = () =>
    String(process.env.SUPABASE_STORAGE_BUCKET || "study-uploads").trim() ||
    "study-uploads";

export const getSupabaseAdmin = () => {
    if (adminClient) return adminClient;

    const url = String(process.env.SUPABASE_URL || "").trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!url || !serviceRoleKey) {
        throw new Error(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for storage.",
        );
    }

    adminClient = createClient(url, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    return adminClient;
};

export const ensureStudyUploadsBucket = async () => {
    const supabase = getSupabaseAdmin();
    const bucket = getStorageBucket();
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        throw new Error(`Failed to list storage buckets: ${listError.message}`);
    }
    if ((buckets || []).some((item) => item.name === bucket || item.id === bucket)) {
        return bucket;
    }

    const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
    });
    if (createError && !/already exists/i.test(createError.message || "")) {
        throw new Error(`Failed to create storage bucket: ${createError.message}`);
    }
    return bucket;
};

export const createSignedUpload = async ({ path, upsert = false }) => {
    const supabase = getSupabaseAdmin();
    const bucket = await ensureStudyUploadsBucket();
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path, { upsert });
    if (error) {
        throw new Error(`Failed to create signed upload URL: ${error.message}`);
    }
    return {
        bucket,
        path: data.path || path,
        token: data.token,
        signedUrl: data.signedUrl,
    };
};

export const downloadUploadObject = async ({ bucket, path }) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
        throw new Error(`Failed to download upload: ${error.message}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
};

export const deleteUploadObject = async ({ bucket, path }) => {
    const supabase = getSupabaseAdmin();
    const targetBucket = bucket || getStorageBucket();
    const { error } = await supabase.storage.from(targetBucket).remove([path]);
    if (error) {
        throw new Error(`Failed to delete upload object: ${error.message}`);
    }
    return { deleted: true, bucket: targetBucket, path };
};

export const uploadObject = async ({ path, body, contentType = "application/octet-stream" }) => {
    const supabase = getSupabaseAdmin();
    const bucket = await ensureStudyUploadsBucket();
    const { error } = await supabase.storage.from(bucket).upload(path, body, {
        contentType,
        upsert: true,
    });
    if (error) {
        throw new Error(`Failed to upload object: ${error.message}`);
    }
    return { bucket, path };
};

export const createSignedDownloadUrl = async ({ path, expiresIn = 3600 }) => {
    const supabase = getSupabaseAdmin();
    const bucket = await ensureStudyUploadsBucket();
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
    if (error) {
        throw new Error(`Failed to create signed download URL: ${error.message}`);
    }
    return {
        bucket,
        path,
        signedUrl: data?.signedUrl || "",
    };
};
