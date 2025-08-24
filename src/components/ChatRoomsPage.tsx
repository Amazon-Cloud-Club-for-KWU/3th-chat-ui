import React, { useState, useEffect, useCallback, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { ChatRoom, User } from '../types';

interface ChatRoomsPageProps {
  serverUrl: string;
  accessToken: string;
  onSelectChatRoom: (chatRoom: ChatRoom, unsubscribeFromRoom: (roomId: number) => void) => void;
  onChatPageReturn?: (resubscribeToRoom: (roomId: number) => void) => void;
  onBack: () => void;
}

const ChatRoomsPage: React.FC<ChatRoomsPageProps> = ({ serverUrl, accessToken, onSelectChatRoom, onChatPageReturn, onBack }) => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const stompClient = useRef<Client | null>(null);
  const subscriptions = useRef<{[roomId: string]: any}>({});

  // 현재 사용자 정보 가져오기
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('현재 사용자 정보:', userData);
        setCurrentUser(userData);
        return userData;
      } else {
        console.error('사용자 정보 조회 실패:', response.status);
        return null;
      }
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      return null;
    }
  }, [serverUrl, accessToken]);

  const fetchChatRooms = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/api/users/chat-rooms`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('내가 가입한 채팅방 목록 조회 성공:', data);
        
        // 이미 서버에서 마지막 메시지 시간 기준으로 정렬되어 옴
        const rooms = data || [];
        
        console.log(`내가 가입한 채팅방 ${rooms.length}개 로드 완료`);
        
        setChatRooms(rooms);
      } else if (response.status === 401 || response.status === 403) {
        alert('인증이 만료되었습니다. 다시 로그인해주세요.');
        onBack();
      } else {
        alert('채팅방 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        alert(`CORS 또는 네트워크 오류: 서버가 실행 중인지 확인해주세요. (${serverUrl})`);
      } else {
        alert(`서버 연결 실패`);
      }
    } finally {
      setLoading(false);
    }
  }, [serverUrl, accessToken]); // onBack 제거하여 무한 루프 방지

  const connectWebSocket = useCallback(() => {
    
    const socket = new SockJS(`${serverUrl}/ws-chat`);
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        'Authorization': `Bearer ${accessToken}`
      },
      debug: () => {
        // 디버그 로깅 비활성화
      },
      onConnect: (frame) => {
        console.log('WebSocket STOMP 연결 성공:', frame);
        setConnected(true);
        
        // 연결 완료 후 잠시 기다린 다음 구독 시작
        setTimeout(() => {
          console.log('구독 시작 시도...');
          subscribeToAllRooms();
        }, 500); // 더 긴 대기 시간
      },
      onDisconnect: (frame) => {
        console.log('WebSocket STOMP 연결 해제:', frame);
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error('STOMP 에러:', frame);
        setConnected(false);
      },
      onWebSocketError: (event) => {
        console.error('WebSocket 에러:', event);
        setConnected(false);
      }
    });
    
    client.activate();
    stompClient.current = client;
  }, [serverUrl, accessToken]);

  const subscribeToAllRooms = useCallback(() => {
    console.log('구독 조건 체크:', {
      stompClient: !!stompClient.current,
      connected,
      stompConnected: stompClient.current?.connected,
      chatRoomsLength: chatRooms.length
    });
    
    if (!stompClient.current || !stompClient.current.connected) {
      console.log('구독 조건 미충족: STOMP 클라이언트 없거나 미연결');
      return;
    }
    
    if (chatRooms.length === 0) {
      console.log('구독 조건 미충족: 채팅방이 없음');
      return;
    }
    
    // 모든 채팅방 구독 시작
    
    console.log(`채팅방 구독 시작: ${chatRooms.length}개`);
    
    chatRooms.forEach((room) => {
      if (!subscriptions.current[room.id.toString()]) {
        
        try {
          const subscription = stompClient.current!.subscribe(`/sub/chat/room/${room.id}`, (message) => {
          try {
            const receivedMessage = JSON.parse(message.body);
            console.log(`새 메시지 수신: ${room.name} - ${receivedMessage.content?.substring(0, 20)}...`);
            
            // 채팅방 목록의 lastMessage 업데이트 및 정렬
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
                  
                  console.log(`메시지 수신: ${room.name}, 내 메시지: ${isMyMessage}, 읽지 않은 수: ${newUnreadCount}`);
                  
                  return { 
                    ...chatRoom, 
                    lastMessage: receivedMessage,
                    unreadCount: newUnreadCount
                  };
                }
                return chatRoom;
              });
              
              // 마지막 메시지 시간 기준으로 채팅방 정렬 (최신 메시지가 있는 방이 위로)
              return updatedRooms.sort((a, b) => {
                const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
                const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
                return bTime - aTime; // 내림차순 정렬 (최신이 위)
              });
            });
            
            // 브라우저 알림 (채팅방 페이지에 있을 때만)
            if (Notification.permission === 'granted') {
              new Notification(`${room.name}에서 새 메시지`, {
                body: `${receivedMessage.sender?.username || '알 수 없음'}: ${receivedMessage.content || '새 메시지가 도착했습니다.'}`,
                icon: '/favicon.ico',
                tag: `chat-room-${room.id}` // 같은 채팅방의 중복 알림 방지
              });
            }
          } catch (error) {
            console.error(`채팅방 ${room.id} 메시지 파싱 오류:`, error);
            console.error('원본 메시지:', message.body);
          }
        });
        
        subscriptions.current[room.id.toString()] = subscription;
        } catch (error) {
          console.error(`채팅방 ${room.id} 구독 실패:`, error);
        }
      }
    });
    
    console.log(`구독 완료: ${Object.keys(subscriptions.current).length}개 채팅방`);
  }, [chatRooms, connected]);

  // 특정 채팅방 구독 해제 함수 추가
  const unsubscribeFromRoom = useCallback((roomId: number) => {
    const roomIdStr = roomId.toString();
    if (subscriptions.current[roomIdStr]) {
      subscriptions.current[roomIdStr].unsubscribe();
      delete subscriptions.current[roomIdStr];
    }
  }, []);

  // 특정 채팅방 구독 재개 함수 추가
  const resubscribeToRoom = useCallback((roomId: number) => {
    if (!stompClient.current || !connected || !stompClient.current.connected) {
      return;
    }

    const roomIdStr = roomId.toString();
    const room = chatRooms.find(r => r.id === roomId);
    
    if (room && !subscriptions.current[roomIdStr]) {
      
      try {
        const subscription = stompClient.current.subscribe(`/sub/chat/room/${roomId}`, (message) => {
          try {
            const receivedMessage = JSON.parse(message.body);
            console.log(`=== 재구독 채팅방 ${roomId}(${room.name})에서 새 메시지 수신 ===`);
            console.log('수신된 메시지:', receivedMessage);
            
            // 채팅방 목록의 lastMessage 업데이트 및 정렬
            setChatRooms(prev => {
              const updatedRooms = prev.map(chatRoom => {
                if (chatRoom.id === roomId) {
                  // 중복 메시지 확인
                  if (chatRoom.lastMessage && chatRoom.lastMessage.id === receivedMessage.id) {
                    console.log(`중복 메시지 무시: ${receivedMessage.id}`);
                    return chatRoom;
                  }
                  
                  // 내가 보낸 메시지가 아닌 경우 unreadCount 증가
                  const isMyMessage = currentUser && receivedMessage.sender?.id === currentUser.id;
                  const newUnreadCount = isMyMessage ? 0 : (chatRoom.unreadCount || 0) + 1;
                  
                  console.log(`재구독 메시지 수신: ${chatRoom.name}, 내 메시지: ${isMyMessage}, 읽지 않은 수: ${newUnreadCount}`);
                  
                  return { 
                    ...chatRoom, 
                    lastMessage: receivedMessage,
                    unreadCount: newUnreadCount
                  };
                }
                return chatRoom;
              });
              
              // 마지막 메시지 시간 기준으로 채팅방 정렬
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
                tag: `chat-room-${roomId}`
              });
            }
          } catch (error) {
            console.error(`재구독 채팅방 ${roomId} 메시지 파싱 오류:`, error);
            console.error('원본 메시지:', message.body);
          }
        });
        
        subscriptions.current[roomIdStr] = subscription;
      } catch (error) {
        console.error(`채팅방 ${roomId} 구독 재개 실패:`, error);
      }
    }
  }, [chatRooms, connected]);

  const disconnectWebSocket = useCallback(() => {
    console.log('모든 채팅방 구독 해제');
    
    // 모든 구독 해제
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
    const initializeData = async () => {
      console.log('ChatRoomsPage 초기화 시작');
      
      // 1. 현재 사용자 정보 가져오기
      await fetchCurrentUser();
      
      // 2. 내가 가입한 채팅방 목록 가져오기
      await fetchChatRooms();
      
      console.log('ChatRoomsPage 초기화 완료');
    };
    
    initializeData();
    
    // 브라우저 알림 권한 요청
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('알림 권한:', permission);
      });
    }
  }, []); // 의존성 배열을 비워서 컴포넌트 마운트 시에만 실행

  // onChatPageReturn 함수 전달은 별도 useEffect로 분리
  useEffect(() => {
    if (onChatPageReturn) {
      onChatPageReturn(resubscribeToRoom);
    }
  }, [onChatPageReturn]); // resubscribeToRoom 제거하여 무한 루프 방지



  // 채팅방 목록이 로드되면 자동으로 WebSocket 연결
  useEffect(() => {
    if (chatRooms.length > 0 && (!stompClient.current || !stompClient.current.connected)) {
      console.log('채팅방 로드 완료 - WebSocket 연결 시도');
      connectWebSocket();
    } else if (chatRooms.length > 0 && stompClient.current?.connected) {
      console.log('WebSocket 이미 연결됨 - 구독 재시도');
      setTimeout(() => {
        subscribeToAllRooms();
      }, 100);
    }
  }, [chatRooms, connectWebSocket, subscribeToAllRooms]);

  // 컴포넌트 언마운트 시 연결 해제
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  const createChatRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      alert('채팅방 이름을 입력해주세요.');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${serverUrl}/api/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: newRoomName.trim()
        })
      });

      if (response.ok) {
        const newRoom = await response.json();
        console.log('채팅방 생성 성공:', newRoom);
        
        // 채팅방 목록 새로고침
        await fetchChatRooms();
        
        // 모달 닫기 및 초기화
        setShowCreateModal(false);
        setNewRoomName('');
        
        alert('채팅방이 생성되었습니다.');
      } else if (response.status === 401) {
        alert('인증이 만료되었습니다. 다시 로그인해주세요.');
        onBack();
      } else {
        const errorText = await response.text();
        alert(`채팅방 생성에 실패했습니다: ${errorText || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('채팅방 생성 오류:', error);
      alert('서버 연결에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="page-container">로딩 중...</div>;
  }

  return (
    <div className="page-container">
      <div className="chat-rooms-header">
        <button className="back-button" onClick={onBack}>← 로그아웃</button>
        <h1>채팅방 목록</h1>
        <div className="header-right">
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 실시간 연결됨' : '🔴 연결 중...'}
          </div>
          <button 
            className="create-room-button" 
            onClick={() => setShowCreateModal(true)}
          >
            + 채팅방 생성
          </button>
        </div>
      </div>
      
      {chatRooms.length === 0 ? (
        <div className="empty-state">
          <p>채팅방이 없습니다.</p>
          <button 
            className="create-first-room-button"
            onClick={() => setShowCreateModal(true)}
          >
            첫 번째 채팅방 만들기
          </button>
        </div>
      ) : (
        <div className="chat-room-list">
          {chatRooms.map((room) => (
            <button
              key={room.id}
              className="chat-room-item"
              onClick={() => {
                // 읽지 않은 메시지 수를 0으로 리셋
                setChatRooms(prev => prev.map(r => 
                  r.id === room.id ? { ...r, unreadCount: 0 } : r
                ));
                console.log(`채팅방 ${room.name} 선택 - 읽지 않은 메시지 수 리셋`);
                onSelectChatRoom(room, unsubscribeFromRoom);
              }}
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

      {/* 채팅방 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>새 채팅방 만들기</h2>
            <form onSubmit={createChatRoom}>
              <input
                type="text"
                placeholder="채팅방 이름을 입력하세요"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                autoFocus
                required
              />
              <div className="modal-buttons">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewRoomName('');
                  }}
                  disabled={creating}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="create-button"
                  disabled={creating || !newRoomName.trim()}
                >
                  {creating ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoomsPage;
