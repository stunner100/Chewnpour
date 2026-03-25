const STAGING_HOSTS = new Set([
  'staging.chewnpour.com',
  'stitch-app-git-staging-stunner100s-projects.vercel.app',
]);

export const isStagingRuntime = (hostname) => {
  const normalizedHostname = String(hostname || '').trim().toLowerCase();
  if (!normalizedHostname) return false;
  if (STAGING_HOSTS.has(normalizedHostname)) return true;
  return normalizedHostname.endsWith('.vercel.app') && normalizedHostname.includes('-git-staging-');
};
