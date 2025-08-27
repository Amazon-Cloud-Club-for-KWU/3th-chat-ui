import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getSockJSUrl, ENV } from '../config/env';

class WebSocketManager {
  private static instance: WebSocketManager;
  private client: Client | null = null;
  private subscriptions: Map<string, any> = new Map();
  private connected: boolean = false;
  private connecting: boolean = false;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private messageListeners: Map<string, Set<(message: any) => void>> = new Map();

  private constructor() {}

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  connect(serverUrl: string, accessToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 이미 연결되어 있는 경우
      if (this.connected) {
        console.log('WebSocket already connected, skipping connection');
        resolve();
        return;
      }

      // 연결 시도 중인 경우
      if (this.connecting) {
        console.log('WebSocket connection in progress, waiting...');
        const checkConnection = setInterval(() => {
          if (this.connected) {
            clearInterval(checkConnection);
            resolve();
          } else if (!this.connecting) {
            clearInterval(checkConnection);
            reject(new Error('Connection failed'));
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkConnection);
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        return;
      }

      console.log('Creating new WebSocket connection to:', serverUrl);
      this.connecting = true;
      
      // 기존 연결이 있다면 정리
      this.disconnect();

      const sockJsUrl = getSockJSUrl(serverUrl);
      const socket = new SockJS(`${sockJsUrl}/ws-chat`);
      
      this.client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {
          'Authorization': `Bearer ${accessToken}`
        },
        debug: (str) => {
          if (ENV.DEBUG) {
            console.log('STOMP Debug:', str);
          }
        },
        onConnect: () => {
          console.log('WebSocket connected successfully');
          this.connected = true;
          this.connecting = false;
          this.notifyConnectionListeners(true);
          resolve();
        },
        onDisconnect: () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          this.connecting = false;
          this.notifyConnectionListeners(false);
        },
        onStompError: (frame) => {
          console.error('STOMP error:', frame);
          this.connected = false;
          this.connecting = false;
          this.notifyConnectionListeners(false);
          reject(new Error(`STOMP error: ${frame.body}`));
        },
        onWebSocketError: (error) => {
          console.error('WebSocket error:', error);
          this.connected = false;
          this.connecting = false;
          this.notifyConnectionListeners(false);
          reject(error);
        }
      });

      this.client.activate();
    });
  }

  disconnect(): void {
    console.log('Disconnecting WebSocket');
    
    // 모든 구독 해제
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
    this.messageListeners.clear();

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    
    this.connected = false;
    this.connecting = false;
    this.notifyConnectionListeners(false);
  }

  subscribe(destination: string, callback: (message: any) => void): string {
    if (!this.client || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    const subscriptionKey = destination;
    
    // 이미 구독 중인 경우 리스너만 추가
    if (this.subscriptions.has(subscriptionKey)) {
      if (!this.messageListeners.has(subscriptionKey)) {
        this.messageListeners.set(subscriptionKey, new Set());
      }
      this.messageListeners.get(subscriptionKey)!.add(callback);
      return subscriptionKey;
    }

    console.log('Subscribing to:', destination);
    
    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const parsedMessage = JSON.parse(message.body);
        
        // 해당 구독의 모든 리스너에게 메시지 전달
        const listeners = this.messageListeners.get(subscriptionKey);
        if (listeners) {
          listeners.forEach(listener => listener(parsedMessage));
        }
      } catch (error) {
        console.error('Message parsing error:', error);
      }
    });

    this.subscriptions.set(subscriptionKey, subscription);
    
    if (!this.messageListeners.has(subscriptionKey)) {
      this.messageListeners.set(subscriptionKey, new Set());
    }
    this.messageListeners.get(subscriptionKey)!.add(callback);

    return subscriptionKey;
  }

  unsubscribe(subscriptionKey: string, callback?: (message: any) => void): void {
    if (callback) {
      // 특정 콜백만 제거
      const listeners = this.messageListeners.get(subscriptionKey);
      if (listeners) {
        listeners.delete(callback);
        
        // 리스너가 없으면 구독 완전히 해제
        if (listeners.size === 0) {
          this.messageListeners.delete(subscriptionKey);
          const subscription = this.subscriptions.get(subscriptionKey);
          if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(subscriptionKey);
            console.log('Unsubscribed from:', subscriptionKey);
          }
        }
      }
    } else {
      // 전체 구독 해제
      console.log('Unsubscribing from:', subscriptionKey);
      
      const subscription = this.subscriptions.get(subscriptionKey);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionKey);
      }
      
      this.messageListeners.delete(subscriptionKey);
    }
  }

  publish(destination: string, body: any, headers?: any): void {
    if (!this.client || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.client.publish({
      destination,
      body: JSON.stringify(body),
      headers: headers || {}
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  addConnectionListener(listener: (connected: boolean) => void): void {
    this.connectionListeners.add(listener);
  }

  removeConnectionListener(listener: (connected: boolean) => void): void {
    this.connectionListeners.delete(listener);
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => listener(connected));
  }

  // 디버깅용 메소드
  getConnectionInfo() {
    return {
      connected: this.connected,
      subscriptions: Array.from(this.subscriptions.keys()),
      listeners: Array.from(this.messageListeners.keys()).map(key => ({
        destination: key,
        listenerCount: this.messageListeners.get(key)?.size || 0
      }))
    };
  }
}

export default WebSocketManager;