import { createClient, type RedisClientType } from "redis";

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export interface SnapshotCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(keys: string[]): Promise<void>;
  clearMemory(): void;
  backend(): "memory" | "redis";
}

export function createSnapshotCache(redisUrl = ""): SnapshotCache {
  const memory = new Map<string, MemoryEntry>();
  let client: RedisClientType | null = null;
  let redisReady = false;
  let retryAfter = 0;

  async function redis(): Promise<RedisClientType | null> {
    if (!redisUrl || Date.now() < retryAfter) return null;
    if (client?.isReady) return client;
    try {
      if (!client) {
        client = createClient({
          url: redisUrl,
          socket: {
            connectTimeout: 1_500,
            reconnectStrategy: false,
          },
        });
        client.on("error", () => {
          redisReady = false;
        });
      }
      if (!client.isOpen) await client.connect();
      redisReady = client.isReady;
      return redisReady ? client : null;
    } catch {
      redisReady = false;
      retryAfter = Date.now() + 30_000;
      if (client?.isOpen) await client.disconnect().catch(() => undefined);
      client = null;
      return null;
    }
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      const local = memory.get(key);
      if (local && local.expiresAt > Date.now()) return local.value as T;
      if (local) memory.delete(key);
      const remote = await redis();
      if (!remote) return null;
      try {
        const serialized = await remote.get(key);
        if (!serialized) return null;
        const value = JSON.parse(serialized) as T;
        memory.set(key, { value, expiresAt: Date.now() + 60_000 });
        return value;
      } catch {
        return null;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
      const remote = await redis();
      if (!remote) return;
      try {
        await remote.set(key, JSON.stringify(value), { EX: ttlSeconds });
        redisReady = true;
      } catch {
        redisReady = false;
      }
    },

    async delete(keys: string[]): Promise<void> {
      for (const key of keys) memory.delete(key);
      if (!keys.length) return;
      const remote = await redis();
      if (!remote) return;
      try {
        await remote.del(keys);
      } catch {
        redisReady = false;
      }
    },

    clearMemory(): void {
      memory.clear();
    },

    backend(): "memory" | "redis" {
      return redisReady ? "redis" : "memory";
    },
  };
}
