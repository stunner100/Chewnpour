import crypto from 'node:crypto';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const readRequestBody = async (req) => {
    if (typeof req.body === 'string') {
        return req.body;
    }
    if (Buffer.isBuffer(req.body)) {
        return req.body.toString('utf8');
    }
    if (req.body && typeof req.body === 'object') {
        return JSON.stringify(req.body);
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
};

const readHeader = (req, key) => {
    if (!req?.headers) return '';
    const value = req.headers[key] || req.headers[key.toLowerCase()];
    if (Array.isArray(value)) return value[0] || '';
    return typeof value === 'string' ? value : '';
};

const secureCompare = (a, b) => {
    const aBuffer = Buffer.from(String(a || ''), 'utf8');
    const bBuffer = Buffer.from(String(b || ''), 'utf8');
    if (aBuffer.length !== bBuffer.length) return false;
    return crypto.timingSafeEqual(aBuffer, bBuffer);
};

const normalizePaidAtMs = (value) => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : Date.now();
};

let convexClient = null;
const getConvexClient = () => {
    const convexUrl = String(process.env.CONVEX_URL || '').trim();
    if (!convexUrl) {
        throw new Error('CONVEX_URL is not configured.');
    }

    if (!convexClient) {
        convexClient = new ConvexHttpClient(convexUrl);
    }
    return convexClient;
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const paystackSecretKey = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
    const forwardSecret = String(process.env.PAYSTACK_WEBHOOK_FORWARD_SECRET || '').trim();
    if (!paystackSecretKey || !forwardSecret) {
        return res.status(500).json({ error: 'Webhook configuration is incomplete.' });
    }

    const rawBody = await readRequestBody(req);
    if (!rawBody) {
        return res.status(400).json({ error: 'Missing webhook payload.' });
    }

    const signature = readHeader(req, 'x-paystack-signature');
    if (!signature) {
        return res.status(401).json({ error: 'Missing signature header.' });
    }

    const expectedSignature = crypto
        .createHmac('sha512', paystackSecretKey)
        .update(rawBody)
        .digest('hex');

    if (!secureCompare(signature, expectedSignature)) {
        return res.status(401).json({ error: 'Invalid signature.' });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return res.status(400).json({ error: 'Invalid JSON payload.' });
    }

    const eventType = String(payload?.event || '').trim();
    const paymentData = payload?.data || {};
    const reference = String(paymentData?.reference || '').trim();
    const amountMinor = Number(paymentData?.amount || 0);
    const currency = String(paymentData?.currency || '').toUpperCase();
    const customerEmail = typeof paymentData?.customer?.email === 'string'
        ? paymentData.customer.email.trim()
        : '';
    const paidAtMs = normalizePaidAtMs(paymentData?.paid_at);
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    try {
        const client = getConvexClient();
        const result = await client.mutation(api.subscriptions.processPaystackWebhookEvent, {
            forwardSecret,
            eventType,
            reference,
            amountMinor: Number.isFinite(amountMinor) ? amountMinor : 0,
            currency,
            customerEmail: customerEmail || undefined,
            paidAtMs,
            payloadHash,
        });

        return res.status(200).json({ ok: true, result });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not process webhook.';
        return res.status(500).json({ error: message });
    }
}
