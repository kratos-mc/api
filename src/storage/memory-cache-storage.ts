import type { IStorageCluster, Storage } from "./interface";

type MemoryStorageOptions = {
  /**
   * The storage size after purging.
   * Default storage size is 100 elements
   */
  storageSize?: number;
  /**
   * Expiration count in millisecond.
   * Default to 2000 ms
   */
  expiration?: number;

  verbose?: boolean;
};

class CacheQueue<T> {
  private arr: Array<T>;
  private length: number = 0;
  private left: number = 0;
  private right: number = 0;

  constructor(size?: number) {
    this.arr = size !== undefined ? new Array(size) : [];
  }

  public enqueue(ele: T) {
    this.arr.push(ele);
    this.length++;
    this.right++;

    return ele;
  }

  public dequeue(): T | undefined {
    let value = this.arr[this.left];
    delete this.arr[this.left];
    if (value !== undefined) {
      this.left++;
      this.length--;
    }
    return value;
  }

  public peek() {
    return this.arr[this.left];
  }

  public size() {
    return this.length;
  }

  public toJsonObject() {
    return {
      array: this.arr,
      left: this.left,
      right: this.right,
      length: this.length,
    };
  }
}

class MemoryStorage<T> implements Storage<T> {
  private map: Map<string, IStorageCluster<T>> = new Map<
    string,
    IStorageCluster<T>
  >();
  private maxStackSize: number;
  private verbose: boolean;

  // The stack that capture all append data
  private cacheQueue: CacheQueue<string>;
  private expirationAsMillisecond: number;

  constructor(options?: MemoryStorageOptions) {
    this.cacheQueue = new CacheQueue();
    this.maxStackSize = (options && options.storageSize) || 100;
    this.expirationAsMillisecond = (options && options.expiration) || 2000;
    this.verbose = (options && options.verbose) || false;
  }

  async has(url: string): Promise<boolean> {
    return this.map.has(url);
  }

  async get(url: string): Promise<T | undefined> {
    if (await this.isOutdated(url)) {
      throw new Error(`The item ${url} is out of date.`);
    }

    let clusterData = this.map.get(url);
    return clusterData === undefined ? undefined : clusterData.data;
  }

  private setMapData(url: string, data: T) {
    this.map.set(url, {
      data: data,
      url,
      receivedAt: Date.now(),
    });
  }

  async append(url: string, data: T): Promise<void> {
    if (await this.has(url)) {
      throw new Error(`Unable to append an exists value. Use set instead.`);
    }
    // If the cache storage is full, clean out memory
    if (await this.isStorageFull()) {
      await this.purgeStorage();
    }

    // Append a new one after purge
    this.setMapData(url, data);
    this.cacheQueue.enqueue(url);
  }

  async set(url: string, data: T): Promise<void> {
    // If the item has not found on the map
    if (!(await this.has(url))) {
      await this.append(url, data);
    }

    this.setMapData(url, data);
  }

  /**
   * Check if the url is out of date.
   *
   * @returns a promise that resolve when the supply url is out of date.
   */
  async isOutdated(url: string): Promise<boolean> {
    const cachedData = this.map.get(url);
    if (cachedData === undefined || cachedData === null) {
      return false;
    }

    const isExpired =
      Date.now() - (cachedData.receivedAt + this.expirationAsMillisecond) >= 0;
    return isExpired;
  }

  async isStorageFull(): Promise<boolean> {
    const storageCacheSize = this.cacheQueue.size() >= this.maxStackSize;

    return storageCacheSize;
  }

  getPurgeChunkSize() {
    return Math.round(this.maxStackSize / 10);
  }

  async purgeStorage(): Promise<void> {
    const purgeChunkSize = this.getPurgeChunkSize();

    for (let i = 0; i < purgeChunkSize; i++) {
      let id = this.cacheQueue.dequeue();
      if (this.verbose) {
        console.log(`[MemoryStorage] Purge element with id: ${id}`);
        console.log(`[MemoryStorage] `, this.cacheQueue.toJsonObject());
      }
      if (id !== undefined) {
        this.map.delete(id);
      }
    }
  }
}

export { CacheQueue, MemoryStorage };
