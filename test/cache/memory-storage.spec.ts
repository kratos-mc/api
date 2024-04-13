import { describe, expect, test } from "bun:test";
import {
  CacheQueue,
  MemoryStorage,
} from "../../src/storage/memory-cache-storage";

async function mockSimulateFetch(timeout: number) {
  return new Promise<void>((res) => {
    setTimeout(() => {
      res();
    }, timeout);
  });
}

describe(`[Memory Cache Storage]`, () => {
  describe(`[Queue]`, () => {
    test(`should work as a queue`, () => {
      const queue = new CacheQueue<number>();
      // Initial queue
      expect(queue.size()).toEqual(0);
      expect(queue.dequeue()).toBeUndefined();
      // Enqueue and peek check
      queue.enqueue(5);
      expect(queue.peek()).toStrictEqual(5);
      expect(queue.size()).toStrictEqual(1);

      // Dequeue
      let v = queue.dequeue();
      expect(v).toStrictEqual(5);
      expect(queue.size()).toEqual(0);
    });
  });

  describe("[Storage]", () => {
    test(`should test with in the delay`, async (done) => {
      const storage = new MemoryStorage<number>({});
      await storage.append("a", 1);
      await mockSimulateFetch(20);

      expect(await storage.get("a")).toBe(1);
      expect(storage.isOutdated("a")).resolves.toBeFalse();
      expect(storage.isStorageFull()).resolves.toBeFalse();
      expect(storage.has("a")).resolves.toBeTrue();

      done();
    });

    test(`should test with long delay`, async (done) => {
      const storage = new MemoryStorage<number>({ expiration: 20 });
      await storage.append("a", 1);

      expect(await storage.get("a")).toBe(1);
      expect(storage.isOutdated("a")).resolves.toBeFalse();
      expect(storage.isStorageFull()).resolves.toBeFalse();
      expect(storage.has("a")).resolves.toBeTrue();

      await mockSimulateFetch(50);
      expect(storage.get("a")).rejects.toThrowError(
        "The item a is out of date."
      );
      done();
    });

    test(`should purge cache storage`, async (done) => {
      const storage = new MemoryStorage<number>({
        storageSize: 10,
        verbose: true,
      });

      for (let i = 0; i < 10; i++) {
        await storage.append(i.toString(), i);
      }

      expect(storage.isStorageFull()).resolves.toBeTrue();
      expect(await storage.append("a", 1)).not.fail();
      expect(storage.append("a", 1)).rejects.toThrowError(
        `Unable to append an exists value. Use set instead.`
      );
      await storage.set("a", 2);
      expect(await storage.get("a")).toEqual(2);
      await storage.append("b", 4);

      done();
    });
  });
});
