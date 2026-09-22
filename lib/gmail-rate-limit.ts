interface GmailErrorShape {
  code?: number | string;
  message?: string;
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
        errors?: Array<{ reason?: string }>;
      };
    };
  };
}

export interface GmailRetryNotice {
  operation: string;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  reason: string;
}

export interface GmailRequestControllerOptions {
  requestsPerSecond: number;
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (notice: GmailRetryNotice) => void;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorDetails(error: unknown): {
  status: number | null;
  reasons: string[];
  message: string;
} {
  const candidate = (error && typeof error === "object" ? error : {}) as GmailErrorShape;
  const numericCode = Number(candidate.code);
  const status = candidate.response?.status ??
    (Number.isFinite(numericCode) ? numericCode : null);
  const reasons = (candidate.response?.data?.error?.errors || [])
    .map((entry) => entry.reason || "")
    .filter(Boolean);
  const message =
    candidate.response?.data?.error?.message ||
    candidate.message ||
    String(error);
  return { status, reasons, message };
}

export function isRetryableGmailError(error: unknown): boolean {
  const details = errorDetails(error);
  if (details.status === 429) return true;
  if (details.status != null && details.status >= 500 && details.status <= 504) {
    return true;
  }
  if (details.status !== 403) return false;

  const retryableReasons = new Set([
    "rateLimitExceeded",
    "userRateLimitExceeded",
    "backendError",
  ]);
  if (details.reasons.some((reason) => retryableReasons.has(reason))) return true;
  return /quota exceeded|rate limit|user-rate limit/i.test(details.message);
}

export class GmailRequestController {
  private readonly intervalMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly onRetry: ((notice: GmailRetryNotice) => void) | undefined;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;
  private nextStartAt = 0;
  private cooldownUntil = 0;
  private reservation: Promise<void> = Promise.resolve();

  constructor(options: GmailRequestControllerOptions) {
    if (!Number.isFinite(options.requestsPerSecond) || options.requestsPerSecond <= 0) {
      throw new Error("requestsPerSecond must be greater than zero");
    }
    this.intervalMs = Math.ceil(1_000 / options.requestsPerSecond);
    this.maxRetries = options.maxRetries;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 60_000;
    this.onRetry = options.onRetry;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  private async waitForTurn(): Promise<void> {
    const turn = this.reservation.then(async () => {
      while (true) {
        const waitUntil = Math.max(this.nextStartAt, this.cooldownUntil);
        const waitMs = Math.max(0, waitUntil - this.now());
        if (waitMs <= 0) break;
        await this.sleep(waitMs);
      }
      this.nextStartAt = this.now() + this.intervalMs;
    });
    this.reservation = turn.catch(() => undefined);
    await turn;
  }

  async run<T>(operation: string, request: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      await this.waitForTurn();
      try {
        return await request();
      } catch (error) {
        if (attempt >= this.maxRetries || !isRetryableGmailError(error)) {
          throw error;
        }
        const jitterMs = Math.floor(this.random() * 1_000);
        const delayMs = Math.min(
          this.maxDelayMs,
          this.baseDelayMs * 2 ** attempt + jitterMs,
        );
        const details = errorDetails(error);
        this.onRetry?.({
          operation,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          delayMs,
          reason: details.message,
        });
        this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + delayMs);
      }
    }
  }
}
