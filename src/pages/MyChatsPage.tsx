import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { ChatRoom, User } from '../types';
import { getWebSocketUrl, getSockJSUrl, ENV } from '../config/env';

const MyChatsPage: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [connected, setConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [chatRoomsLoading, setChatRoomsLoading] = useState(false);
  const stompClient = useRef<Client | null>(null);
  const subscriptions = useRef<{[roomId: string]: any}>({});
  const navigate = useNavigate();

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

  const connectWebSocket = useCallback(() => {
    if (!selectedServer || !accessToken) return;
    
    const sockJsUrl = getSockJSUrl(selectedServer.url);
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
      onConnect: () => {
        setConnected(true);
        setTimeout(() => subscribeToAllRooms(), 500);
      },
      onDisconnect: () => setConnected(false),
      onStompError: (frame) => {
        console.error('STOMP 에러:', frame);
        setConnected(false);
      }
    });
    
    client.activate();
    stompClient.current = client;
  }, [selectedServer, accessToken]);

  const subscribeToAllRooms = useCallback(() => {
    if (!stompClient.current?.connected || chatRooms.length === 0) return;
    
    chatRooms.forEach((room) => {
      if (!subscriptions.current[room.id.toString()]) {
        try {
          const subscription = stompClient.current!.subscribe(`/sub/chat/room/${room.id}`, (message) => {
            try {
              const receivedMessage = JSON.parse(message.body);
              
              setChatRooms(prev => {
                const updatedRooms = prev.map(chatRoom => {
                  if (chatRoom.id === room.id) {
                    if (chatRoom.lastMessage?.id === receivedMessage.id) {
                      return chatRoom;
                    }
                    
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
                
                return updatedRooms.sort((a, b) => {
                  const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
                  const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
                  return bTime - aTime;
                });
              });
              
              if (Notification.permission === 'granted') {
                new Notification(`${room.name}에서 새 메시지`, {
                  body: `${receivedMessage.sender?.username}: ${receivedMessage.content}`,
                  tag: `chat-room-${room.id}`
                });
              }
            } catch (error) {
              console.error('메시지 파싱 오류:', error);
            }
          });
          
          subscriptions.current[room.id.toString()] = subscription;
        } catch (error) {
          console.error(`채팅방 ${room.id} 구독 실패:`, error);
        }
      }
    });
  }, [chatRooms, currentUser]);

  const disconnectWebSocket = useCallback(() => {
    Object.values(subscriptions.current).forEach(subscription => {
      subscription.unsubscribe();
    });
    subscriptions.current = {};
    
    if (stompClient.current) {
      stompClient.current.deactivate();
      stompClient.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!accessToken || !selectedServer) return;

    const initializeData = async () => {
      await fetchCurrentUser();
      await fetchChatRooms();
      connectWebSocket();
    };

    initializeData();

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => disconnectWebSocket();
  }, []);

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