interface IStorageCluster<T> {
  url: string;
  data: T;
  receivedAt: number;
}

/**
 * Represents a storage for caching data to reduce
 * multiple fetching issues.
 */
interface Storage<T> {
  get(url: string): Promise<T | undefined>;
  set(url: string, data: T): Promise<void>;
  isOutdated(url: string): Promise<boolean>;
  has(url: string): Promise<boolean>;
  append(url: string, data: T): Promise<void>;

  isStorageFull(): Promise<boolean>;
  purgeStorage(): Promise<void>;
}

export type { IStorageCluster, Storage };
