/** NDJSON ingest + Metro `[RAPHA_DBG]` lines (device-safe evidence when ingest URL is unreachable). */
export function dbgIngestLog(payload: Record<string, unknown>) {
  const body = { sessionId: 'd90aac', timestamp: Date.now(), ...payload };
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[RAPHA_DBG]', JSON.stringify(body));
  }
  fetch('http://127.0.0.1:7889/ingest/b65fff1d-83ff-4aa1-9e61-afb69ca06a52', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd90aac' },
    body: JSON.stringify(body),
  }).catch(() => {});
}
