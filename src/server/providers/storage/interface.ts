export interface UploadIntent {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface StorageAdapter {
  createUploadIntent(key: string, contentType: string, maxBytes: number): Promise<UploadIntent>;
  verifyObject(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
}
