// Shared HTTP helpers with timeout/retry and normalized errors.
export interface FetchRetryOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  retryOnStatus?: number[];
}

export class NetworkError extends Error {
  url: string;
  status?: number;
  code?: string;
  attempt: number;

  constructor(message: string, opts: {url: string; status?: number; code?: string; attempt: number}) {
    super(message);
    this.name = 'NetworkError';
    this.url = opts.url;
    this.status = opts.status;
    this.code = opts.code;
    this.attempt = opts.attempt;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number, retryOnStatus: number[]): boolean {
  return retryOnStatus.includes(status);
}

export async function fetchWithRetry(
    url: string,
    init?: RequestInit,
    opts?: FetchRetryOptions
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const retries = opts?.retries ?? 2;
  const backoffMs = opts?.backoffMs ?? 300;
  const retryOnStatus = opts?.retryOnStatus ?? [429, 500, 502, 503, 504];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {...init, signal: controller.signal});
      if (response.ok) return response;

      if (attempt <= retries && shouldRetryStatus(response.status, retryOnStatus)) {
        await sleep(backoffMs * attempt);
        continue;
      }

      const rate = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');
      const rateHint = rate !== null || reset !== null
        ? ` (rate=${rate ?? 'n/a'}, reset=${reset ?? 'n/a'})`
        : '';
      throw new NetworkError(`HTTP ${response.status}${rateHint}`, {
        url,
        status: response.status,
        attempt
      });
    } catch (err) {
      const e = err as Error & {cause?: unknown};
      const cause = e?.cause as {code?: string; message?: string} | undefined;
      const code = cause?.code;
      const msgParts = [e?.message ?? String(err)];
      if (code) msgParts.push(`code=${code}`);
      if (cause?.message) msgParts.push(`cause=${cause.message}`);
      lastError = new NetworkError(msgParts.join(' | '), {url, code, attempt});
      if (attempt <= retries) {
        await sleep(backoffMs * attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new NetworkError('fetch failed', {url, attempt: retries + 1});
}

