import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChatRoom, User } from '../types';
import useWebSocket from '../hooks/useWebSocket';

const MyChatsPage: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [chatRoomsLoading, setChatRoomsLoading] = useState(false);
  const subscriptions = useRef<Map<string, (message: any) => void>>(new Map());
  const navigate = useNavigate();
  
  // WebSocket Hook 사용
  const { connected, connect, subscribe, unsubscribe, getConnectionInfo } = useWebSocket();

  // localStorage에서 데이터 가져오기
  const accessToken = localStorage.getItem('chat_access_token');
  const selectedServer = JSON.parse(localStorage.getItem('chat_selected_server') || 'null');

  useEffect(() => {
    if (!accessToken || !selectedServer) {
      navigate('/login');
      return;
    }
  }, [accessToken, selectedServer, navigate]);

  const fetchCurrentUser = useCallback(async () => {
    if (userLoading || !selectedServer || !accessToken) return null;

    setUserLoading(true);
    try {
      const response = await fetch(`${selectedServer.url}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        return userData;
      } else {
        console.error('사용자 정보 조회 실패:', response.status);
        return null;
      }
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      return null;
    } finally {
      setUserLoading(false);
    }
  }, [selectedServer, accessToken, userLoading]);

  const fetchChatRooms = useCallback(async () => {
    if (chatRoomsLoading || !selectedServer || !accessToken) return;

    setChatRoomsLoading(true);
    try {
      const response = await fetch(`${selectedServer.url}/api/users/chat-rooms`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setChatRooms(data || []);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        navigate('/login');
      } else {
        alert('채팅방 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('채팅방 목록 조회 오류:', error);
      alert('서버 연결 실패');
    } finally {
      setChatRoomsLoading(false);
    }
  }, [selectedServer, accessToken, chatRoomsLoading, navigate]);

  const connectWebSocket = useCallback(async () => {
    if (!selectedServer || !accessToken) return;
    
    try {
      await connect(selectedServer.url, accessToken);
      console.log('WebSocket connected, subscribing to rooms...');
      setTimeout(() => subscribeToAllRooms(), 500);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }, [selectedServer, accessToken, connect]);

  const subscribeToAllRooms = useCallback(() => {
    if (!connected || chatRooms.length === 0) {
      console.log('구독 조건 미충족:', { connected, chatRoomsLength: chatRooms.length });
      return;
    }
    
    console.log(`채팅방 구독 시작: ${chatRooms.length}개`);
    
    chatRooms.forEach((room) => {
      const roomId = room.id.toString();
      
      // 이미 구독 중인지 확인
      if (subscriptions.current.has(roomId)) {
        return;
      }
      
      const messageHandler = (receivedMessage: any) => {
        console.log(`새 메시지 수신: ${room.name} - ${receivedMessage.content?.substring(0, 20)}...`);
        
        setChatRooms(prev => {
          const updatedRooms = prev.map(chatRoom => {
            if (chatRoom.id === room.id) {
              // 중복 메시지 확인
              if (chatRoom.lastMessage && chatRoom.lastMessage.id === receivedMessage.id) {
                return chatRoom;
              }
              
              // 내가 보낸 메시지가 아닌 경우 unreadCount 증가
              const isMyMessage = currentUser && receivedMessage.sender?.id === currentUser.id;
              const newUnreadCount = isMyMessage ? 0 : (chatRoom.unreadCount || 0) + 1;
              
              return { 
                ...chatRoom, 
                lastMessage: receivedMessage,
                unreadCount: newUnreadCount
              };
            }
            return chatRoom;
          });
          
          // 마지막 메시지 시간 기준으로 정렬
          return updatedRooms.sort((a, b) => {
            const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
          });
        });
        
        // 브라우저 알림
        if (Notification.permission === 'granted') {
          new Notification(`${room.name}에서 새 메시지`, {
            body: `${receivedMessage.sender?.username || '알 수 없음'}: ${receivedMessage.content || '새 메시지가 도착했습니다.'}`,
            icon: '/favicon.ico',
            tag: `chat-room-${room.id}`
          });
        }
      };
      
      try {
        subscribe(`/sub/chat/room/${room.id}`, messageHandler);
        subscriptions.current.set(roomId, messageHandler);
        console.log(`구독 완료: ${room.name}`);
      } catch (error) {
        console.error(`채팅방 ${room.id} 구독 실패:`, error);
      }
    });
    
    console.log(`구독 완료: ${subscriptions.current.size}개 채팅방`);
  }, [chatRooms, connected, currentUser, subscribe]);

  const disconnectWebSocket = useCallback(() => {
    console.log('구독 해제 시작');
    
    // 모든 구독 해제
    subscriptions.current.forEach((messageHandler, roomId) => {
      unsubscribe(`/sub/chat/room/${roomId}`, messageHandler);
    });
    subscriptions.current.clear();
    
    console.log('모든 구독 해제 완료');
  }, [unsubscribe]);

  useEffect(() => {
    if (!accessToken || !selectedServer) return;

    const initializeData = async () => {
      await fetchCurrentUser();
      await fetchChatRooms();
      await connectWebSocket();
    };

    initializeData();

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => disconnectWebSocket();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (connected && chatRooms.length > 0) {
      subscribeToAllRooms();
    }
  }, [connected, chatRooms, subscribeToAllRooms]);

  const handleChatRoomClick = (room: ChatRoom) => {
    setChatRooms(prev => prev.map(r => 
      r.id === room.id ? { ...r, unreadCount: 0 } : r
    ));
    navigate(`/chats/${encodeURIComponent(room.name)}`, { 
      state: { chatRoom: room } 
    });
  };

  const handleLogout = () => {
    disconnectWebSocket();
    localStorage.clear();
    navigate('/login');
  };

  if (!accessToken || !selectedServer) {
    return null;
  }

  return (
    <div className="page-container">
      <div className="chat-rooms-header">
        <button className="back-button" onClick={handleLogout}>← 로그아웃</button>
        <h1>내 채팅방</h1>
        <div className="header-right">
          <Link to="/all-chats" className="nav-link">모든 채팅방</Link>
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢' : '🔴'}
          </div>
        </div>
      </div>

      {chatRooms.length === 0 ? (
        <div className="empty-state">
          <p>참여한 채팅방이 없습니다.</p>
          <Link to="/all-chats" className="create-first-room-button">
            채팅방 둘러보기
          </Link>
        </div>
      ) : (
        <div className="chat-room-list">
          {chatRooms.map((room) => (
            <button
              key={room.id}
              className="chat-room-item"
              onClick={() => handleChatRoomClick(room)}
            >
              <div className="room-header">
                <div className="room-name-container">
                  <div className="room-name">{room.name}</div>
                  {room.unreadCount && room.unreadCount > 0 && (
                    <span className="unread-badge">{room.unreadCount}</span>
                  )}
                </div>
                {room.lastMessage && (
                  <div className="last-message-time">
                    {new Date(room.lastMessage.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
              {room.lastMessage && (
                <div className="last-message">
                  <span className="sender-name">{room.lastMessage.sender.username}</span>: {room.lastMessage.content}
                </div>
              )}
              {!room.lastMessage && (
                <div className="last-message no-message">메시지가 없습니다</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyChatsPage;