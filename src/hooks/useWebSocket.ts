import { useState, useEffect, useCallback, useRef } from 'react';
import WebSocketManager from '../services/WebSocketManager';

export const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const wsManager = useRef(WebSocketManager.getInstance());
  
  useEffect(() => {
    const connectionListener = (isConnected: boolean) => {
      setConnected(isConnected);
    };

    wsManager.current.addConnectionListener(connectionListener);
    setConnected(wsManager.current.isConnected());

    return () => {
      wsManager.current.removeConnectionListener(connectionListener);
    };
  }, []);

  const connect = useCallback(async (serverUrl: string, accessToken: string) => {
    try {
      await wsManager.current.connect(serverUrl, accessToken);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    wsManager.current.disconnect();
  }, []);

  const subscribe = useCallback((destination: string, callback: (message: any) => void) => {
    if (!wsManager.current.isConnected()) {
      console.warn('Attempting to subscribe while not connected');
      return null;
    }
    
    try {
      return wsManager.current.subscribe(destination, callback);
    } catch (error) {
      console.error('Subscribe failed:', error);
      return null;
    }
  }, []);

  const unsubscribe = useCallback((subscriptionKey: string, callback?: (message: any) => void) => {
    wsManager.current.unsubscribe(subscriptionKey, callback);
  }, []);

  const publish = useCallback((destination: string, body: any, headers?: any) => {
    try {
      wsManager.current.publish(destination, body, headers);
    } catch (error) {
      console.error('Publish failed:', error);
      throw error;
    }
  }, []);

  const getConnectionInfo = useCallback(() => {
    return wsManager.current.getConnectionInfo();
  }, []);

  return {
    connected,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    getConnectionInfo
  };
};

export default useWebSocket;