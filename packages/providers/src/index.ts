export interface NotificationProvider {
  send(input: {
    recipient: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<{ id: string }>;
}
export interface ObjectStorageProvider {
  put(input: {
    key: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<{ url: string }>;
}
