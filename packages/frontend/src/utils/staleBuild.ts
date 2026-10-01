/**
 * After a deploy, a tab still running the previous version asks for page
 * files that no longer exist ("Failed to fetch dynamically imported
 * module"). Reloading picks up the new version. Done once: a reload within
 * the last 30 seconds means it didn't help, so we stop rather than loop.
 */
const KEY = 'stale-build-reload-at';

export const isStaleBuildError = (error: unknown): boolean =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk [\w-]+ failed/i.test(
    String((error as any)?.message || error || '')
  );

/** Reload to the new version, unless we just did. Returns whether it's reloading. */
export const reloadForNewVersion = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage blocked: reload anyway, once per page view
  }
  window.location.reload();
  return true;
};
