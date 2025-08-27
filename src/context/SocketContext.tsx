import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Client, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// 소켓 연결 상태 타입
export type SocketConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

// 채팅방 구독 정보 타입
export interface ChatRoomSubscription {
  roomId: number;
  subscription: StompSubscription;
  unsubscribe: () => void;
}

// Context 타입 정의
interface SocketContextType {
  // 연결 상태
  connectionStatus: SocketConnectionStatus;

  // 클라이언트 인스턴스
  client: Client | null;

  // 연결 관리
  connect: (serverUrl: string, accessToken: string) => Promise<void>;
  disconnect: () => void;

  // 채팅방 구독 관리
  subscribeToRoom: (
    roomId: number,
    onMessage: (message: any) => void
  ) => Promise<void>;
  unsubscribeFromRoom: (roomId: number) => void;
  resubscribeToRoom: (
    roomId: number,
    onMessage: (message: any) => void
  ) => Promise<void>;

  // 구독된 채팅방 목록
  subscribedRooms: ChatRoomSubscription[];

  // 에러 상태
  error: string | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Provider Props
interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<SocketConnectionStatus>("disconnected");
  const [subscribedRooms, setSubscribedRooms] = useState<
    ChatRoomSubscription[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  // 소켓 연결
  const connect = useCallback(
    async (serverUrl: string, accessToken: string) => {
      try {
        setConnectionStatus("connecting");
        setError(null);

        // 기존 연결이 있다면 정리
        if (client) {
          client.deactivate();
        }

        // SockJS 연결 생성
        const sockJsUrl = `${serverUrl}/ws-chat`;
        const socket = new SockJS(sockJsUrl);

        // STOMP 클라이언트 생성
        const newClient = new Client({
          webSocketFactory: () => socket,
          connectHeaders: {
            Authorization: `Bearer ${accessToken}`,
          },
          debug: (str) => {
            console.log("STOMP Debug:", str);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        // 연결 이벤트 핸들러
        newClient.onConnect = () => {
          console.log("STOMP 연결 성공");
          setConnectionStatus("connected");
          setError(null);
        };

        newClient.onDisconnect = () => {
          console.log("STOMP 연결 해제");
          setConnectionStatus("disconnected");
          setSubscribedRooms([]);
        };

        newClient.onStompError = (frame) => {
          console.error("STOMP 에러:", frame);
          setConnectionStatus("error");
          setError(frame.headers.message || "소켓 연결 에러가 발생했습니다.");
        };

        // 클라이언트 활성화
        await newClient.activate();
        setClient(newClient);
      } catch (err) {
        console.error("소켓 연결 실패:", err);
        setConnectionStatus("error");
        setError(
          err instanceof Error ? err.message : "소켓 연결에 실패했습니다."
        );
      }
    },
    [client]
  );

  // 소켓 연결 해제
  const disconnect = useCallback(() => {
    if (client) {
      // 모든 구독 해제
      subscribedRooms.forEach((room) => room.unsubscribe());
      setSubscribedRooms([]);

      // 클라이언트 비활성화
      client.deactivate();
      setClient(null);
      setConnectionStatus("disconnected");
    }
  }, [client, subscribedRooms]);

  // 채팅방 구독
  const subscribeToRoom = useCallback(
    async (roomId: number, onMessage: (message: any) => void) => {
      if (!client || connectionStatus !== "connected") {
        throw new Error("소켓이 연결되지 않았습니다.");
      }

      try {
        // 이미 구독 중인지 확인
        const existingSubscription = subscribedRooms.find(
          (room) => room.roomId === roomId
        );
        if (existingSubscription) {
          console.log(`채팅방 ${roomId}는 이미 구독 중입니다.`);
          return;
        }

        // 구독 생성
        const subscription = client.subscribe(
          `/topic/chat/${roomId}`,
          (message) => {
            try {
              const messageData = JSON.parse(message.body);
              onMessage(messageData);
            } catch (err) {
              console.error("메시지 파싱 에러:", err);
            }
          }
        );

        // 구독 정보 저장
        const roomSubscription: ChatRoomSubscription = {
          roomId,
          subscription,
          unsubscribe: () => {
            subscription.unsubscribe();
            setSubscribedRooms((prev) =>
              prev.filter((room) => room.roomId !== roomId)
            );
          },
        };

        setSubscribedRooms((prev) => [...prev, roomSubscription]);
        console.log(`채팅방 ${roomId} 구독 시작`);
      } catch (err) {
        console.error(`채팅방 ${roomId} 구독 실패:`, err);
        throw err;
      }
    },
    [client, connectionStatus, subscribedRooms]
  );

  // 채팅방 구독 해제
  const unsubscribeFromRoom = useCallback(
    (roomId: number) => {
      const roomSubscription = subscribedRooms.find(
        (room) => room.roomId === roomId
      );
      if (roomSubscription) {
        roomSubscription.unsubscribe();
        console.log(`채팅방 ${roomId} 구독 해제`);
      }
    },
    [subscribedRooms]
  );

  // 채팅방 재구독 (백그라운드에서)
  const resubscribeToRoom = useCallback(
    async (roomId: number, onMessage: (message: any) => void) => {
      try {
        await subscribeToRoom(roomId, onMessage);
        console.log(`채팅방 ${roomId} 재구독 완료`);
      } catch (err) {
        console.error(`채팅방 ${roomId} 재구독 실패:`, err);
      }
    },
    [subscribeToRoom]
  );

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value: SocketContextType = {
    connectionStatus,
    client,
    connect,
    disconnect,
    subscribeToRoom,
    unsubscribeFromRoom,
    resubscribeToRoom,
    subscribedRooms,
    error,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

// Hook
export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}

export default SocketContext;
