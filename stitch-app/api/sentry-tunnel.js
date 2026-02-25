const SENTRY_HOST_ALLOWLIST = [
    'sentry.io',
    '.ingest.sentry.io',
    '.ingest.us.sentry.io',
    '.ingest.de.sentry.io',
];

const isAllowedSentryHost = (host) => {
    if (!host) return false;
    return SENTRY_HOST_ALLOWLIST.some((allowedHost) => {
        if (allowedHost.startsWith('.')) {
            return host.endsWith(allowedHost);
        }
        return host === allowedHost;
    });
};

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

const parseEnvelopeDsn = (envelope) => {
    const firstNewlineIndex = envelope.indexOf('\n');
    if (firstNewlineIndex <= 0) return null;

    try {
        const envelopeHeader = JSON.parse(envelope.slice(0, firstNewlineIndex));
        if (typeof envelopeHeader?.dsn !== 'string') return null;
        return envelopeHeader.dsn.trim();
    } catch {
        return null;
    }
};

const getSentryEnvelopeUrl = (dsn) => {
    try {
        const parsedDsn = new URL(dsn);
        if (parsedDsn.protocol !== 'https:' || !isAllowedSentryHost(parsedDsn.host)) {
            return null;
        }

        const projectId = parsedDsn.pathname.replace(/^\/+/, '').split('/')[0];
        if (!projectId) return null;

        return `${parsedDsn.protocol}//${parsedDsn.host}/api/${projectId}/envelope/`;
    } catch {
        return null;
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const envelope = await readRequestBody(req);
    if (!envelope) {
        return res.status(400).json({ error: 'Missing envelope body' });
    }

    const dsn = parseEnvelopeDsn(envelope);
    if (!dsn) {
        return res.status(400).json({ error: 'Missing DSN in envelope header' });
    }

    const sentryEnvelopeUrl = getSentryEnvelopeUrl(dsn);
    if (!sentryEnvelopeUrl) {
        return res.status(400).json({ error: 'Invalid DSN host' });
    }

    try {
        const upstreamResponse = await fetch(sentryEnvelopeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-sentry-envelope',
            },
            body: envelope,
        });

        const responseBody = await upstreamResponse.text();
        const responseType = upstreamResponse.headers.get('content-type') || 'text/plain';
        res.status(upstreamResponse.status);
        res.setHeader('Content-Type', responseType);
        return res.send(responseBody || '');
    } catch {
        return res.status(502).json({ error: 'Failed to forward Sentry envelope' });
    }
}
