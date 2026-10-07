// Waits until the web host has loaded a newly uploaded config.php. The host caches compiled PHP, so a new
// config.php (and new API code) takes effect only minutes after it is uploaded (seen: 2 to 9 minutes).
// health.php reports the config_id of the settings the server is running with; this asks until that is
// the one just uploaded, or until `limit` seconds have passed.
//
// `health` returns { status, data?, raw? } as in deploy.mjs. The clock and the pause are passed in, so the
// waiting can be tested without waiting.

// What the server said last, for a person reading the deploy output.
export function describeState(state) {
  if (state?.data) return `it answers with config ${state.data.config_id ?? 'from before config_id existed'}`;
  return `health.php gave HTTP ${state?.status ?? 0}${state?.raw ? `: ${String(state.raw).replace(/\s+/g, ' ').slice(0, 80)}` : ''}`;
}

export async function waitForConfig({ configId, health, limit, every = 15, now = () => Date.now(), sleep = (s) => new Promise((ok) => setTimeout(ok, s * 1000)), log = () => {} }) {
  const since = now();
  let told = 0;
  for (;;) {
    const state = await health();
    const seconds = Math.round((now() - since) / 1000);
    if (state?.data?.config_id === configId) return { state, seconds, loaded: true };
    if (seconds >= limit) return { state, seconds, loaded: false };
    const minutes = Math.floor(seconds / 60);
    if (minutes > told) log(`  … the server has not loaded the new settings yet (${(told = minutes)} min; ${describeState(state)})`);
    await sleep(every);
  }
}
