import "server-only";
import { StorageAdapter } from "./interface";
import { fakeStorageAdapter } from "./fake";

export function getStorageAdapter(): StorageAdapter {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[Storage Provider] FakeStorageAdapter cannot be used in production. A production cloud storage adapter (S3/GCS) must be configured."
    );
  }
  return fakeStorageAdapter;
}

export * from "./interface";
export { fakeStorageAdapter } from "./fake";
