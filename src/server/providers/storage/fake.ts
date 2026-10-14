import "server-only";
import { StorageAdapter, UploadIntent } from "./interface";
import { logger } from "../../observability/logger";

class FakeStorageAdapter implements StorageAdapter {
  private uploadedObjects = new Set<string>();

  async createUploadIntent(key: string, contentType: string, maxBytes: number): Promise<UploadIntent> {
    logger.debug({ key, contentType, maxBytes }, "Fake storage adapter generated upload intent");

    return {
      uploadUrl: `https://storage.local.ind64.com/upload/${encodeURIComponent(key)}`,
      storageKey: key,
      expiresInSeconds: 900, // 15 mins
    };
  }

  simulateUpload(key: string, _data?: Buffer): void {
    this.uploadedObjects.add(key);
  }


  async verifyObject(key: string): Promise<boolean> {
    return this.uploadedObjects.has(key);
  }

  getPublicUrl(key: string): string {
    return `https://media.ind64.com/${encodeURIComponent(key)}`;
  }

  clear(): void {
    this.uploadedObjects.clear();
  }
}

export const fakeStorageAdapter = new FakeStorageAdapter();
