export class InMemoryRateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();
  private windowMs: number;
  private maxRequests: number;
  private maxKeys: number; // Batas maksimal IP di memori

  private cleanupTimer: Timer | null = null;

  constructor(windowMs = 60000, maxRequests = 10, maxKeys = 10000) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxKeys = maxKeys;

    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    // jangan block process exit di test / bun
    // @ts-ignore - Bun/Node Timer has unref
    if (
      this.cleanupTimer &&
      typeof (this.cleanupTimer as any).unref === 'function'
    ) {
      (this.cleanupTimer as any).unref();
    }
  }

  public stop() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  public check(ip: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    let record = this.cache.get(ip);

    if (!record || now > record.resetTime) {
      // Cegah Map terlalu penuh jika diserang IP random
      if (this.cache.size >= this.maxKeys) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }

      this.cache.set(ip, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, retryAfter: 0 };
    }

    if (record.count >= this.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }

    record.count++;
    return { allowed: true, retryAfter: 0 };
  }

  private cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.cache.entries()) {
      if (now > record.resetTime) this.cache.delete(ip);
    }
  }
}
