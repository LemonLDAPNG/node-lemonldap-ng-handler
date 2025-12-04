import {
  LLNG_Session,
  Session_Accessor,
  Backend_Options,
} from "@lemonldap-ng/types";
import { LimitedCache, LimitedCacheInstance } from "limited-cache";
import nodePersist from "node-persist";
import path from "path";
import os from "os";

type Session_Args = {
  storageModule: string;
  storageModuleOptions: Backend_Options;
  cacheModule?: string;
  cacheModuleOptions?: Backend_Options;
};

class Session {
  backend: Session_Accessor | undefined;
  inMemoryCache: LimitedCacheInstance<LLNG_Session>;
  localCache: typeof nodePersist | undefined;
  ready: Promise<boolean>;

  constructor(opts: Session_Args) {
    this.ready = new Promise((gresolve, greject) => {
      Promise.all([
        new Promise((resolve, reject) => {
          import(`@lemonldap-ng/session-${this.aliases(opts.storageModule)}`)
            .then((mod) => {
              const cl = mod.default;
              this.backend = new cl(opts.storageModuleOptions);
              resolve(true);
            })
            .catch((e) => {
              reject(`Unable to load ${opts.storageModule}: ${e}`);
            });
        }),
        new Promise((resolve) => {
          if (opts.cacheModule) {
            const dir =
              opts.cacheModuleOptions && opts.cacheModuleOptions.cache_root
                ? opts.cacheModuleOptions.cache_root + ".node-llng-cache"
                : path.join(os.tmpdir(), "node-llng-cache");
            nodePersist
              .init({
                dir,
                ttl:
                  opts.cacheModuleOptions &&
                  opts.cacheModuleOptions.default_expires_in
                    ? // @ts-ignore: opts.cacheModuleOptions.default_expires_in is a number
                      opts.cacheModuleOptions.default_expires_in * 1000
                    : 600000,
              })
              .then(() => {
                this.localCache = nodePersist;
                resolve(true);
              });
          } else resolve(true);
        }),
      ])
        .then(() => gresolve(true))
        // istanbul ignore next
        .catch((e) => greject(e));
    });
    this.inMemoryCache = LimitedCache<LLNG_Session>({
      maxCacheSize: 100,
      maxCacheTime: 120000,
    });
  }

  aliases(type: string) {
    return type
      .toLowerCase()
      .replace(/.*apache::session::(?:browseable::)?/, "")
      .replace(/(?:pghstore|pgjson)/, "postgres");
  }

  get(id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      if (this.backend === undefined)
        // istanbul ignore next
        return reject("Please wait for initialization");
      const backendGet = (
        id: string,
        resolve: Function,
        reject: Function,
      ): void => {
        // @ts-ignore: this.backend is defined
        this.backend
          .get(id)
          .then((session) => {
            this.inMemoryCache.set(id, session);
            if (this.localCache) this.localCache.set(id, session);
            resolve(session);
          })
          .catch((e) => {
            reject(e);
          });
      };
      const lsession = this.inMemoryCache.get(id);
      if (lsession) {
        resolve(lsession);
      } else {
        if (this.localCache) {
          this.localCache.get(id).then((res) => {
            if (res) {
              resolve(res);
            } else backendGet(id, resolve, reject);
          });
        } else backendGet(id, resolve, reject);
      }
    });
  }

  update(data: LLNG_Session): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (this.backend === undefined)
        // istanbul ignore next
        return reject("Please wait for initialization");
      this.backend
        .update(data)
        .then((res) => {
          this.inMemoryCache.set(data._session_id, data);
          if (this.localCache) this.localCache.set(data._session_id, data);
          resolve(res);
        })
        .catch((e) => {
          // istanbul ignore next
          reject(e);
        });
    });
  }

  /**
   * Clear in-memory cache for specific session
   * @param id - Session ID to clear from memory cache
   */
  clearMemoryCache(id: string): void {
    this.inMemoryCache.remove(id);
  }

  /**
   * Clear all in-memory cache entries
   */
  clearAllMemoryCache(): void {
    this.inMemoryCache.reset();
  }

  /**
   * Clear local file cache for specific session
   * @param id - Session ID to clear from local cache
   */
  async clearLocalCache(id: string): Promise<void> {
    if (this.localCache) {
      try {
        await this.localCache.removeItem(id);
      } catch {
        // Ignore errors - cache entry may not exist
      }
    }
  }

  /**
   * Clear session from all caches (memory and local)
   * @param id - Session ID to clear
   */
  async clearAllCaches(id: string): Promise<void> {
    this.clearMemoryCache(id);
    await this.clearLocalCache(id);
  }

  /**
   * Close the session storage and stop all background processes
   * Call this in tests' afterAll to allow Jest to exit cleanly
   */
  async close(): Promise<void> {
    // Stop node-persist intervals if using local cache
    if (this.localCache) {
      // Cast to any to access internal node-persist methods
      const cache = this.localCache as any;
      if (typeof cache.stopExpiredKeysInterval === "function") {
        cache.stopExpiredKeysInterval();
      }
      if (typeof cache.stopWriteQueueInterval === "function") {
        cache.stopWriteQueueInterval();
      }
    }
    // Clear in-memory cache
    this.inMemoryCache.reset();
  }
}

export default Session;
