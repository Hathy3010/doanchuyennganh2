/**
 * Offline Manager Service
 * Handles document caching, offline queue, and sync on reconnect.
 * 
 * Requirements: 10.1, 10.3, 10.4, 10.5
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { API_URL } from "../config/api";

// Storage keys
const STORAGE_KEYS = {
  OFFLINE_QUEUE: "offline_queue",
  CACHED_DOCUMENTS: "cached_documents",
  CACHE_METADATA: "cache_metadata",
};

// Cache limits
const MAX_CACHE_SIZE_MB = 50;
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;

// Queue action types
type QueueActionType = "highlight" | "note" | "view";
type QueueAction = "create" | "update" | "delete";

interface QueueItem {
  id: string;
  type: QueueActionType;
  action: QueueAction;
  data: any;
  created_at: string;
  synced: boolean;
  retryCount: number;
}

interface CachedDocument {
  id: string;
  title: string;
  content: string;
  file_type: string;
  cached_at: string;
  size_bytes: number;
}

interface CacheMetadata {
  total_size_bytes: number;
  document_ids: string[];
  last_cleanup: string;
}

class OfflineManager {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private listeners: ((isOnline: boolean) => void)[] = [];

  constructor() {
    this.initNetworkListener();
  }

  // ==================== Network Monitoring ====================

  private initNetworkListener() {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? true;

      // Notify listeners
      this.listeners.forEach((listener) => listener(this.isOnline));

      // Sync when coming back online
      if (wasOffline && this.isOnline) {
        console.log("📡 Network restored - syncing offline queue");
        this.syncOfflineQueue();
      }
    });
  }

  addNetworkListener(listener: (isOnline: boolean) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  // ==================== Offline Queue ====================

  async addToQueue(
    type: QueueActionType,
    action: QueueAction,
    data: any
  ): Promise<void> {
    const queue = await this.getQueue();

    const item: QueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      action,
      data,
      created_at: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    };

    queue.push(item);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    console.log(`📥 Added to offline queue: ${type}/${action}`);
  }

  async getQueue(): Promise<QueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading offline queue:", error);
      return [];
    }
  }

  async clearSyncedItems(): Promise<void> {
    const queue = await this.getQueue();
    const unsyncedItems = queue.filter((item) => !item.synced);
    await AsyncStorage.setItem(
      STORAGE_KEYS.OFFLINE_QUEUE,
      JSON.stringify(unsyncedItems)
    );
  }

  async syncOfflineQueue(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress || !this.isOnline) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let success = 0;
    let failed = 0;

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        this.syncInProgress = false;
        return { success: 0, failed: 0 };
      }

      const queue = await this.getQueue();
      const unsyncedItems = queue.filter((item) => !item.synced);

      console.log(`🔄 Syncing ${unsyncedItems.length} offline items`);

      for (const item of unsyncedItems) {
        try {
          const synced = await this.syncItem(item, token);
          if (synced) {
            item.synced = true;
            success++;
          } else {
            item.retryCount++;
            failed++;
          }
        } catch (error) {
          console.error(`Sync failed for item ${item.id}:`, error);
          item.retryCount++;
          failed++;
        }
      }

      // Update queue
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));

      // Clear synced items
      await this.clearSyncedItems();

      console.log(`✅ Sync complete: ${success} success, ${failed} failed`);
    } finally {
      this.syncInProgress = false;
    }

    return { success, failed };
  }

  private async syncItem(item: QueueItem, token: string): Promise<boolean> {
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      switch (item.type) {
        case "highlight":
          return await this.syncHighlight(item, headers);
        case "note":
          return await this.syncNote(item, headers);
        case "view":
          return await this.syncView(item, headers);
        default:
          console.warn(`Unknown queue item type: ${item.type}`);
          return false;
      }
    } catch (error) {
      console.error(`Error syncing ${item.type}:`, error);
      return false;
    }
  }

  private async syncHighlight(
    item: QueueItem,
    headers: Record<string, string>
  ): Promise<boolean> {
    const { action, data } = item;

    if (action === "create") {
      const res = await fetch(
        `${API_URL}/highlights?document_id=${data.document_id}&text_content=${encodeURIComponent(data.text_content)}&start_position=${data.start_position}&end_position=${data.end_position}&color=${data.color}`,
        { method: "POST", headers }
      );
      return res.ok;
    } else if (action === "delete") {
      const res = await fetch(`${API_URL}/highlights/${data.highlight_id}`, {
        method: "DELETE",
        headers,
      });
      return res.ok;
    }

    return false;
  }

  private async syncNote(
    item: QueueItem,
    headers: Record<string, string>
  ): Promise<boolean> {
    const { action, data } = item;

    if (action === "create") {
      const res = await fetch(
        `${API_URL}/notes?document_id=${data.document_id}&content=${encodeURIComponent(data.content)}&position=${data.position}`,
        { method: "POST", headers }
      );
      return res.ok;
    } else if (action === "update") {
      const res = await fetch(
        `${API_URL}/notes/${data.note_id}?content=${encodeURIComponent(data.content)}`,
        { method: "PUT", headers }
      );
      return res.ok;
    } else if (action === "delete") {
      const res = await fetch(`${API_URL}/notes/${data.note_id}`, {
        method: "DELETE",
        headers,
      });
      return res.ok;
    }

    return false;
  }

  private async syncView(
    item: QueueItem,
    headers: Record<string, string>
  ): Promise<boolean> {
    const { data } = item;

    const res = await fetch(`${API_URL}/documents/${data.document_id}/view`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reading_position: data.reading_position }),
    });

    return res.ok;
  }

  // ==================== Document Caching ====================

  async cacheDocument(document: CachedDocument): Promise<boolean> {
    try {
      const metadata = await this.getCacheMetadata();
      const contentSize = new Blob([document.content]).size;

      // Check if we need to free up space
      if (metadata.total_size_bytes + contentSize > MAX_CACHE_SIZE_BYTES) {
        await this.cleanupCache(contentSize);
      }

      // Get current cached documents
      const cachedDocs = await this.getCachedDocuments();

      // Remove existing version if present
      const existingIndex = cachedDocs.findIndex((d) => d.id === document.id);
      if (existingIndex >= 0) {
        metadata.total_size_bytes -= cachedDocs[existingIndex].size_bytes;
        cachedDocs.splice(existingIndex, 1);
      }

      // Add new document
      document.size_bytes = contentSize;
      document.cached_at = new Date().toISOString();
      cachedDocs.push(document);

      // Update metadata
      metadata.total_size_bytes += contentSize;
      if (!metadata.document_ids.includes(document.id)) {
        metadata.document_ids.push(document.id);
      }

      // Save
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_DOCUMENTS,
        JSON.stringify(cachedDocs)
      );
      await this.saveCacheMetadata(metadata);

      console.log(`📦 Cached document: ${document.title} (${this.formatBytes(contentSize)})`);
      return true;
    } catch (error) {
      console.error("Error caching document:", error);
      return false;
    }
  }

  async getCachedDocument(documentId: string): Promise<CachedDocument | null> {
    try {
      const cachedDocs = await this.getCachedDocuments();
      return cachedDocs.find((d) => d.id === documentId) || null;
    } catch (error) {
      console.error("Error getting cached document:", error);
      return null;
    }
  }

  async getCachedDocuments(): Promise<CachedDocument[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_DOCUMENTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading cached documents:", error);
      return [];
    }
  }

  async removeCachedDocument(documentId: string): Promise<void> {
    try {
      const cachedDocs = await this.getCachedDocuments();
      const metadata = await this.getCacheMetadata();

      const index = cachedDocs.findIndex((d) => d.id === documentId);
      if (index >= 0) {
        metadata.total_size_bytes -= cachedDocs[index].size_bytes;
        metadata.document_ids = metadata.document_ids.filter((id) => id !== documentId);
        cachedDocs.splice(index, 1);

        await AsyncStorage.setItem(
          STORAGE_KEYS.CACHED_DOCUMENTS,
          JSON.stringify(cachedDocs)
        );
        await this.saveCacheMetadata(metadata);
      }
    } catch (error) {
      console.error("Error removing cached document:", error);
    }
  }

  private async getCacheMetadata(): Promise<CacheMetadata> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_METADATA);
      return data
        ? JSON.parse(data)
        : {
            total_size_bytes: 0,
            document_ids: [],
            last_cleanup: new Date().toISOString(),
          };
    } catch (error) {
      return {
        total_size_bytes: 0,
        document_ids: [],
        last_cleanup: new Date().toISOString(),
      };
    }
  }

  private async saveCacheMetadata(metadata: CacheMetadata): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.CACHE_METADATA,
      JSON.stringify(metadata)
    );
  }

  private async cleanupCache(neededBytes: number): Promise<void> {
    console.log(`🧹 Cleaning up cache to free ${this.formatBytes(neededBytes)}`);

    const cachedDocs = await this.getCachedDocuments();
    const metadata = await this.getCacheMetadata();

    // Sort by cached_at (oldest first)
    cachedDocs.sort(
      (a, b) =>
        new Date(a.cached_at).getTime() - new Date(b.cached_at).getTime()
    );

    let freedBytes = 0;
    const docsToRemove: string[] = [];

    for (const doc of cachedDocs) {
      if (
        metadata.total_size_bytes - freedBytes + neededBytes <=
        MAX_CACHE_SIZE_BYTES
      ) {
        break;
      }

      freedBytes += doc.size_bytes;
      docsToRemove.push(doc.id);
    }

    // Remove old documents
    for (const docId of docsToRemove) {
      await this.removeCachedDocument(docId);
    }

    metadata.last_cleanup = new Date().toISOString();
    await this.saveCacheMetadata(metadata);

    console.log(`🧹 Freed ${this.formatBytes(freedBytes)} from cache`);
  }

  async getCacheStats(): Promise<{
    totalSize: string;
    documentCount: number;
    maxSize: string;
    usagePercent: number;
  }> {
    const metadata = await this.getCacheMetadata();
    return {
      totalSize: this.formatBytes(metadata.total_size_bytes),
      documentCount: metadata.document_ids.length,
      maxSize: `${MAX_CACHE_SIZE_MB}MB`,
      usagePercent: Math.round(
        (metadata.total_size_bytes / MAX_CACHE_SIZE_BYTES) * 100
      ),
    };
  }

  async clearAllCache(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_DOCUMENTS);
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHE_METADATA);
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    console.log("🗑️ All cache cleared");
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();
export default offlineManager;
