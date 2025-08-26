import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ChatMessage } from '../types';
import { getSockJSUrl, ENV } from '../config/env';

interface WebSocketContextType {
  isConnected: boolean;
  joinChatRoom: (roomId: number, onMessage: (message: ChatMessage) => void) => void;
  leaveChatRoom: (roomId: number) => void;
  sendMessage: (roomId: number, content: string) => void;
  sendJoinMessage: (roomId: number) => void;
  sendLeaveMessage: (roomId: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  serverUrl: string;
  accessToken: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  serverUrl, 
  accessToken 
}) => {
  const stompClient = useRef<Client | null>(null);
  const subscriptions = useRef<Map<number, { subscription: any, onMessage: (message: ChatMessage) => void }>>(new Map());
  const isConnected = useRef<boolean>(false);
  const [connected, setConnected] = React.useState(false);

  const connectWebSocket = useCallback(() => {
    if (stompClient.current && isConnected.current) {
      return;
    }

    const sockJsUrl = getSockJSUrl(serverUrl);
    
    console.log('WebSocket 연결 시도:', {
      serverUrl,
      sockJsUrl,
      currentProtocol: window.location.protocol,
      userAgent: navigator.userAgent
    });
    
    const socket = new SockJS(`${sockJsUrl}/ws-chat`);
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        'Authorization': `Bearer ${accessToken}`
      },
      debug: (str) => {
        if (ENV.DEBUG) {
          console.log('STOMP Debug:', str);
        }
      },
      onConnect: (frame) => {
        console.log('WebSocket 연결됨:', frame);
        isConnected.current = true;
        setConnected(true);
      },
      onDisconnect: () => {
        console.log('WebSocket 연결 끊어짐');
        isConnected.current = false;
        setConnected(false);
        subscriptions.current.clear();
      },
      onStompError: (frame) => {
        console.error('STOMP 오류:', frame);
        isConnected.current = false;
        setConnected(false);
      },
      onWebSocketError: (error) => {
        console.error('WebSocket 오류:', error);
        isConnected.current = false;
        setConnected(false);
      }
    });
    
    client.activate();
    stompClient.current = client;
  }, [serverUrl, accessToken]);

  const joinChatRoom = useCallback((roomId: number, onMessage: (message: ChatMessage) => void) => {
    if (!stompClient.current || !isConnected.current) {
      console.warn('WebSocket not connected, attempting to connect...');
      connectWebSocket();
      return;
    }

    // 이미 해당 채팅방을 구독하고 있는지 확인
    if (subscriptions.current.has(roomId)) {
      console.log('이미 구독 중인 채팅방, 콜백 업데이트:', roomId);
      // 기존 구독은 유지하고 콜백만 업데이트
      const existing = subscriptions.current.get(roomId)!;
      existing.onMessage = onMessage;
      return;
    }

    try {
      const subscription = stompClient.current.subscribe(`/sub/chat/room/${roomId}`, (message) => {
        try {
          const receivedMessage = JSON.parse(message.body);
          console.log('WebSocket에서 메시지 수신:', receivedMessage);
          const sub = subscriptions.current.get(roomId);
          if (sub) {
            sub.onMessage(receivedMessage);
            console.log('onMessage 콜백 호출됨');
          }
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      });
      
      subscriptions.current.set(roomId, { subscription, onMessage });
      console.log('채팅방 구독 완료:', roomId);
    } catch (error) {
      console.error('채팅방 구독 실패:', error);
    }
  }, [connectWebSocket]);

  const leaveChatRoom = useCallback((roomId: number) => {
    const sub = subscriptions.current.get(roomId);
    if (sub) {
      sub.subscription.unsubscribe();
      subscriptions.current.delete(roomId);
      console.log('채팅방 구독 해제:', roomId);
    }
  }, []);

  const sendMessage = useCallback((roomId: number, content: string) => {
    if (!stompClient.current || !isConnected.current) {
      console.error('WebSocket이 연결되지 않았습니다.');
      return;
    }

    const messageToSend = {
      chatRoomId: roomId,
      content: content.trim()
    };

    try {
      stompClient.current.publish({
        destination: '/pub/chat/send',
        body: JSON.stringify(messageToSend),
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('메시지 전송됨:', messageToSend);
    } catch (error) {
      console.error('메시지 전송 실패:', error);
    }
  }, [accessToken]);

  const sendJoinMessage = useCallback((roomId: number) => {
    if (!stompClient.current || !isConnected.current) {
      console.error('WebSocket이 연결되지 않았습니다.');
      return;
    }

    try {
      stompClient.current.publish({
        destination: `/pub/chat/join/${roomId}`,
        body: JSON.stringify({}),
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      console.log('채팅방 입장 메시지 전송:', roomId);
    } catch (error) {
      console.error('채팅방 입장 실패:', error);
    }
  }, [accessToken]);

  const sendLeaveMessage = useCallback((roomId: number) => {
    if (!stompClient.current || !isConnected.current) {
      console.error('WebSocket이 연결되지 않았습니다.');
      return;
    }

    try {
      stompClient.current.publish({
        destination: `/pub/chat/leave/${roomId}`,
        body: JSON.stringify({}),
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      console.log('채팅방 퇴장 메시지 전송:', roomId);
    } catch (error) {
      console.error('채팅방 퇴장 실패:', error);
    }
  }, [accessToken]);

  // 컴포넌트 마운트 시 WebSocket 연결
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (stompClient.current) {
        // 모든 구독 해제
        subscriptions.current.forEach((sub) => {
          sub.subscription.unsubscribe();
        });
        subscriptions.current.clear();
        
        stompClient.current.deactivate();
        stompClient.current = null;
        isConnected.current = false;
        setConnected(false);
      }
    };
  }, [connectWebSocket]);

  const contextValue: WebSocketContextType = {
    isConnected: connected,
    joinChatRoom,
    leaveChatRoom,
    sendMessage,
    sendJoinMessage,
    sendLeaveMessage
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};