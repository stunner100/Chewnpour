const usage = `Usage:
  node scripts/convex-self-hosted-smoke.mjs --url <convex-api-url>

Env fallback:
  CONVEX_SELF_HOSTED_URL
`;

const parseArgs = (argv) => {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') parsed.url = argv[++i];
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
};

const sanitize = (value) => String(value || '').trim().replace(/\/+$/, '');

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }

  const baseUrl = sanitize(args.url || process.env.CONVEX_SELF_HOSTED_URL);
  if (!baseUrl) {
    throw new Error(`Missing Convex API URL.\n\n${usage}`);
  }

  const response = await fetch(`${baseUrl}/version`);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Convex smoke failed: HTTP ${response.status}\n${bodyText}`);
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`Convex smoke failed: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }

  if (!payload || (!payload.version && !payload.git_sha && !payload.gitSha)) {
    throw new Error(`Convex smoke failed: unexpected version payload\n${bodyText}`);
  }

  console.log('convex-self-hosted-smoke.mjs passed');
  console.log(JSON.stringify(payload, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
