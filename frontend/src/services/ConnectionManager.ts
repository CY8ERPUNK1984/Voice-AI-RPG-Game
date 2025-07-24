import { io, Socket } from 'socket.io-client';

export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';
  lastConnected?: Date;
  reconnectAttempts: number;
  latency?: number;
  quality: 'excellent' | 'good' | 'poor' | 'critical';
}

export interface ConnectionHealth {
  isConnected: boolean;
  lastPing: Date;
  latency: number;
  reconnectCount: number;
  errorCount: number;
  uptime: number;
  quality: 'excellent' | 'good' | 'poor' | 'critical';
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  heartbeatInterval: number;
}

export interface ConnectionManagerEvents {
  stateChange: (state: ConnectionState) => void;
  message: (event: string, data: any) => void;
  error: (error: Error) => void;
  reconnected: () => void;
}

export class ConnectionManager {
  private socket: Socket | null = null;
  private state: ConnectionState;
  private health: ConnectionHealth;
  private retryConfig: RetryConfig;
  private eventListeners: Partial<ConnectionManagerEvents> = {};
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionStartTime: Date | null = null;
  private lastPingTime: Date | null = null;

  constructor(
    private socketUrl: string,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.retryConfig = {
      maxAttempts: 10,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      heartbeatInterval: 30000,
      ...retryConfig
    };

    this.state = {
      status: 'disconnected',
      reconnectAttempts: 0,
      quality: 'critical'
    };

    this.health = {
      isConnected: false,
      lastPing: new Date(),
      latency: 0,
      reconnectCount: 0,
      errorCount: 0,
      uptime: 0,
      quality: 'critical'
    };

    // Restore connection state from localStorage if available
    this.restoreConnectionState();
  }

  public async connect(): Promise<void> {
    if (this.state.status === 'connected' || this.state.status === 'connecting') {
      return;
    }

    this.updateState({ status: 'connecting' });
    this.connectionStartTime = new Date();

    try {
      await this.createSocket();
    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  public disconnect(): void {
    this.clearTimers();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.updateState({ 
      status: 'disconnected',
      reconnectAttempts: 0 
    });

    this.updateHealth({ 
      isConnected: false,
      uptime: 0 
    });
  }

  public getConnectionState(): ConnectionState {
    return { ...this.state };
  }

  public getConnectionHealth(): ConnectionHealth {
    return { ...this.health };
  }

  public onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.eventListeners.stateChange = callback;
    return () => {
      delete this.eventListeners.stateChange;
    };
  }

  public onMessage(callback: (event: string, data: any) => void): () => void {
    this.eventListeners.message = callback;
    return () => {
      delete this.eventListeners.message;
    };
  }

  public onError(callback: (error: Error) => void): () => void {
    this.eventListeners.error = callback;
    return () => {
      delete this.eventListeners.error;
    };
  }

  public onReconnected(callback: () => void): () => void {
    this.eventListeners.reconnected = callback;
    return () => {
      delete this.eventListeners.reconnected;
    };
  }

  public async sendMessage(event: string, data: any): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(event, data, (response: any) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  public enableHeartbeat(interval?: number): void {
    const heartbeatInterval = interval || this.retryConfig.heartbeatInterval;
    
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, heartbeatInterval);
  }

  private async createSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: false // We handle reconnection manually
      });

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        this.handleConnectionSuccess();
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        clearTimeout(connectTimeout);
        this.handleDisconnection(reason);
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        reject(error);
      });

      this.socket.on('pong', (latency) => {
        this.handlePongResponse(latency);
      });

      // Forward all other events to listeners
      this.socket.onAny((event, ...args) => {
        if (this.eventListeners.message) {
          this.eventListeners.message(event, args[0]);
        }
      });
    });
  }

  private handleConnectionSuccess(): void {
    const wasReconnecting = this.state.status === 'reconnecting';
    
    this.updateState({
      status: 'connected',
      lastConnected: new Date(),
      reconnectAttempts: 0,
      quality: 'excellent'
    });

    this.updateHealth({
      isConnected: true,
      reconnectCount: wasReconnecting ? this.health.reconnectCount + 1 : this.health.reconnectCount,
      errorCount: 0
    });

    this.enableHeartbeat();
    this.persistConnectionState();

    if (wasReconnecting && this.eventListeners.reconnected) {
      this.eventListeners.reconnected();
    }
  }

  private handleDisconnection(reason: string): void {
    this.clearTimers();
    
    this.updateState({ 
      status: 'disconnected',
      quality: 'critical' 
    });

    this.updateHealth({ 
      isConnected: false,
      uptime: this.calculateUptime()
    });

    // Only attempt reconnection for certain disconnect reasons
    if (this.shouldAttemptReconnection(reason)) {
      this.scheduleReconnection();
    }
  }

  private handleConnectionError(error: Error): void {
    this.health.errorCount++;
    
    if (this.eventListeners.error) {
      this.eventListeners.error(error);
    }

    if (this.state.reconnectAttempts < this.retryConfig.maxAttempts) {
      this.scheduleReconnection();
    } else {
      this.updateState({ 
        status: 'failed',
        quality: 'critical' 
      });
    }
  }

  private scheduleReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.calculateBackoffDelay();
    
    this.updateState({ 
      status: 'reconnecting',
      reconnectAttempts: this.state.reconnectAttempts + 1 
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.createSocket();
      } catch (error) {
        this.handleConnectionError(error as Error);
      }
    }, delay);
  }

  private calculateBackoffDelay(): number {
    const exponentialDelay = this.retryConfig.baseDelay * 
      Math.pow(this.retryConfig.backoffMultiplier, this.state.reconnectAttempts);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelay);
  }

  private shouldAttemptReconnection(reason: string): boolean {
    // Don't reconnect for certain reasons
    const noReconnectReasons = ['io server disconnect', 'io client disconnect'];
    return !noReconnectReasons.includes(reason);
  }

  private performHeartbeat(): void {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    this.lastPingTime = new Date();
    this.socket.emit('ping');
  }

  private handlePongResponse(latency: number): void {
    const now = new Date();
    const actualLatency = this.lastPingTime ? 
      now.getTime() - this.lastPingTime.getTime() : latency;

    this.updateHealth({
      lastPing: now,
      latency: actualLatency,
      uptime: this.calculateUptime()
    });

    // Update connection quality based on latency
    this.updateConnectionQuality(actualLatency);
  }

  private updateConnectionQuality(latency: number): void {
    let quality: ConnectionHealth['quality'];
    
    if (latency < 100) {
      quality = 'excellent';
    } else if (latency < 300) {
      quality = 'good';
    } else if (latency < 1000) {
      quality = 'poor';
    } else {
      quality = 'critical';
    }

    this.updateState({ quality });
    this.updateHealth({ quality });
  }

  private calculateUptime(): number {
    if (!this.connectionStartTime || !this.health.isConnected) {
      return 0;
    }
    
    return Date.now() - this.connectionStartTime.getTime();
  }

  private updateState(updates: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...updates };
    
    if (this.eventListeners.stateChange) {
      this.eventListeners.stateChange(this.state);
    }
  }

  private updateHealth(updates: Partial<ConnectionHealth>): void {
    this.health = { ...this.health, ...updates };
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private persistConnectionState(): void {
    try {
      const stateToSave = {
        lastConnected: this.state.lastConnected,
        reconnectCount: this.health.reconnectCount
      };
      localStorage.setItem('connectionState', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to persist connection state:', error);
    }
  }

  private restoreConnectionState(): void {
    try {
      const saved = localStorage.getItem('connectionState');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state.lastConnected = parsed.lastConnected ? new Date(parsed.lastConnected) : undefined;
        this.health.reconnectCount = parsed.reconnectCount || 0;
      }
    } catch (error) {
      console.warn('Failed to restore connection state:', error);
    }
  }
}