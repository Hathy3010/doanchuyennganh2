/**
 * WebSocket Manager Service
 * Handles WebSocket connections with exponential backoff reconnection and heartbeat.
 * 
 * Requirements: 9.2, 9.5
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { WS_URL } from "../config/api";

// Reconnection config
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const RECONNECT_MULTIPLIER = 2;

// Heartbeat config
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10000; // 10 seconds to wait for pong

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";
type MessageHandler = (data: any) => void;

interface WebSocketConfig {
  endpoint: string;
  userId: string;
  onMessage?: MessageHandler;
  onStatusChange?: (status: ConnectionStatus) => void;
  autoReconnect?: boolean;
}

class WebSocketConnection {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private status: ConnectionStatus = "disconnected";
  private reconnectAttempts = 0;
  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private lastPongTime = 0;
  private messageQueue: any[] = [];
  private isManualClose = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      autoReconnect: true,
      ...config,
    };
  }

  // ==================== Connection Management ====================

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    this.isManualClose = false;
    this.setStatus("connecting");

    const url = `${WS_URL}${this.config.endpoint}/${this.config.userId}`;
    console.log(`🔌 Connecting to WebSocket: ${url}`);

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.handleDisconnect();
    }
  }

  disconnect(): void {
    this.isManualClose = true;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, "Manual disconnect");
      this.ws = null;
    }
    
    this.setStatus("disconnected");
    console.log("📴 WebSocket manually disconnected");
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("✅ WebSocket connected");
      this.setStatus("connected");
      this.reconnectAttempts = 0;
      this.reconnectDelay = INITIAL_RECONNECT_DELAY;
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle pong response
        if (data.type === "pong") {
          this.lastPongTime = Date.now();
          this.clearHeartbeatTimeout();
          return;
        }

        // Forward to handler
        if (this.config.onMessage) {
          this.config.onMessage(data);
        }
      } catch (error) {
        console.warn("WebSocket message parse error:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = (event) => {
      console.log(`📴 WebSocket closed: code=${event.code}, reason=${event.reason}`);
      this.handleDisconnect();
    };
  }

  private handleDisconnect(): void {
    this.cleanup();
    this.setStatus("disconnected");

    if (!this.isManualClose && this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  // ==================== Reconnection with Exponential Backoff ====================

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.setStatus("reconnecting");
    this.reconnectAttempts++;

    console.log(`🔄 Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (max)
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_MULTIPLIER,
      MAX_RECONNECT_DELAY
    );
  }

  // ==================== Heartbeat ====================

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    // Send first heartbeat immediately
    this.sendHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clearHeartbeatTimeout();
  }

  private sendHeartbeat(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    try {
      this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
      
      // Set timeout for pong response
      this.heartbeatTimeout = setTimeout(() => {
        console.warn("⚠️ Heartbeat timeout - no pong received");
        this.ws?.close(4000, "Heartbeat timeout");
      }, HEARTBEAT_TIMEOUT);
    } catch (error) {
      console.error("Heartbeat send error:", error);
    }
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  // ==================== Message Sending ====================

  send(message: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error("WebSocket send error:", error);
        return false;
      }
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      console.log("📥 Message queued (WebSocket not connected)");
      return false;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send queued message:", error);
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  // ==================== Utilities ====================

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      if (this.config.onStatusChange) {
        this.config.onStatusChange(status);
      }
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// ==================== WebSocket Manager (Singleton) ====================

class WebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map();
  private statusListeners: ((endpoint: string, status: ConnectionStatus) => void)[] = [];

  /**
   * Create or get a WebSocket connection
   */
  getConnection(
    endpoint: string,
    userId: string,
    onMessage?: MessageHandler
  ): WebSocketConnection {
    const key = `${endpoint}_${userId}`;
    
    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    const connection = new WebSocketConnection({
      endpoint,
      userId,
      onMessage,
      onStatusChange: (status) => {
        this.notifyStatusListeners(endpoint, status);
      },
    });

    this.connections.set(key, connection);
    return connection;
  }

  /**
   * Connect to document WebSocket
   */
  async connectDocuments(onMessage?: MessageHandler): Promise<WebSocketConnection | null> {
    const userId = await AsyncStorage.getItem("user_id");
    if (!userId) {
      console.warn("Cannot connect: no user_id");
      return null;
    }

    const connection = this.getConnection("/ws/documents", userId, onMessage);
    connection.connect();
    return connection;
  }

  /**
   * Connect to attendance WebSocket
   */
  async connectAttendance(onMessage?: MessageHandler): Promise<WebSocketConnection | null> {
    const userId = await AsyncStorage.getItem("user_id");
    if (!userId) {
      console.warn("Cannot connect: no user_id");
      return null;
    }

    const connection = this.getConnection("/ws/attendance", userId, onMessage);
    connection.connect();
    return connection;
  }

  /**
   * Disconnect a specific connection
   */
  disconnect(endpoint: string, userId: string): void {
    const key = `${endpoint}_${userId}`;
    const connection = this.connections.get(key);
    
    if (connection) {
      connection.disconnect();
      this.connections.delete(key);
    }
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    this.connections.forEach((connection) => {
      connection.disconnect();
    });
    this.connections.clear();
  }

  /**
   * Add status change listener
   */
  addStatusListener(listener: (endpoint: string, status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatusListeners(endpoint: string, status: ConnectionStatus): void {
    this.statusListeners.forEach((listener) => {
      listener(endpoint, status);
    });
  }

  /**
   * Get all connection statuses
   */
  getStatuses(): Map<string, ConnectionStatus> {
    const statuses = new Map<string, ConnectionStatus>();
    this.connections.forEach((connection, key) => {
      statuses.set(key, connection.getStatus());
    });
    return statuses;
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
export { WebSocketConnection, ConnectionStatus };
export default wsManager;
