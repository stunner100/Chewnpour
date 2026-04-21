import process from 'node:process';

const parseArgs = (argv) => {
  const args = { siteUrl: '', callbackUrl: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--site-url') {
      args.siteUrl = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--callback-url') {
      args.callbackUrl = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
};

const printHelp = () => {
  console.log(
    [
      'Usage: node scripts/google-oauth-redirect-smoke.test.mjs --site-url <url> [--callback-url <url>]',
      '',
      'Checks that Better Auth starts Google OAuth with the expected callback URI',
      'and that Google does not reject the redirect URI immediately.',
    ].join('\n')
  );
};

const normalizeUrl = (value, flagName) => {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error(`Missing required ${flagName}.`);
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid ${flagName}: ${raw}`);
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed;
};

const tryDecodeGoogleAuthError = (encoded) => {
  if (!encoded) return '';
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
  try {
    return Buffer.from(`${normalized}${'='.repeat(paddingLength)}`, 'base64').toString('utf8');
  } catch {
    return '';
  }
};

const decodeGoogleAuthError = (location) => {
  try {
    const parsed = new URL(location);
    const encoded = parsed.searchParams.get('authError');
    if (!encoded) return '';
    return tryDecodeGoogleAuthError(decodeURIComponent(encoded)) || decodeURIComponent(encoded);
  } catch {
    return '';
  }
};

const summarizeGoogleFailure = (location) => {
  const decodedError = decodeGoogleAuthError(location);
  if (!decodedError) return '';
  if (decodedError.includes('redirect_uri_mismatch')) {
    return 'Google rejected the OAuth request with redirect_uri_mismatch.';
  }
  return decodedError.split('\n').slice(0, 3).join(' ').trim();
};

const { help, siteUrl, callbackUrl } = parseArgs(process.argv.slice(2));
if (help) {
  printHelp();
  process.exit(0);
}

const siteOrigin = normalizeUrl(siteUrl || process.env.AUTH_SITE_URL || process.env.SITE_URL, '--site-url');
const appCallbackUrl = normalizeUrl(
  callbackUrl || process.env.AUTH_CALLBACK_URL || new URL('/dashboard', siteOrigin).toString(),
  '--callback-url'
);

const signInResponse = await fetch(new URL('/api/auth/sign-in/social', siteOrigin), {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    provider: 'google',
    callbackURL: appCallbackUrl.toString(),
  }),
});

if (!signInResponse.ok) {
  throw new Error(
    `Failed to start Google OAuth (${signInResponse.status}) at ${siteOrigin.toString()}.`
  );
}

const signInBody = await signInResponse.json();
const googleUrl = String(signInBody?.url || '').trim();
if (!signInBody?.redirect || !googleUrl) {
  throw new Error('Better Auth did not return a Google redirect URL.');
}

const googleAuthUrl = new URL(googleUrl);
const actualRedirectUri = googleAuthUrl.searchParams.get('redirect_uri');
const expectedRedirectUri = new URL('/api/auth/callback/google', siteOrigin).toString();

if (actualRedirectUri !== expectedRedirectUri) {
  throw new Error(
    `Expected Google redirect_uri "${expectedRedirectUri}" but got "${actualRedirectUri || '<missing>'}".`
  );
}

const providerResponse = await fetch(googleAuthUrl, {
  redirect: 'manual',
  headers: {
    'user-agent': 'chewnpour-google-oauth-smoke/1.0',
  },
});

const providerLocation = providerResponse.headers.get('location') || '';
const failureSummary = summarizeGoogleFailure(providerLocation);
if (failureSummary) {
  throw new Error(
    `${failureSummary} Add "${expectedRedirectUri}" to the Google OAuth client authorized redirect URIs.`
  );
}

console.log(
  `google-oauth-redirect-smoke.test.mjs passed for ${siteOrigin.toString()} -> ${expectedRedirectUri}`
);
