import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { ChatRoom } from '../types';
import { getWebSocketUrl, getSockJSUrl, ENV } from '../config/env';

const AllChatsPage: React.FC = () => {
  const [allChatRooms, setAllChatRooms] = useState<ChatRoom[]>([]);
  const [allRoomsLoading, setAllRoomsLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const stompClient = useRef<Client | null>(null);
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

  const fetchAllChatRooms = useCallback(async () => {
    if (!selectedServer || !accessToken) return;
    
    try {
      setAllRoomsLoading(true);
      const response = await fetch(`${selectedServer.url}/api/chats`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const rooms = data.nodes || [];
        const sortedRooms = rooms.sort((a: ChatRoom, b: ChatRoom) => {
          const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return bTime - aTime;
        });
        setAllChatRooms(sortedRooms);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        navigate('/login');
      } else {
        alert('채팅방 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('모든 채팅방 목록 조회 오류:', error);
      alert('서버 연결 실패');
    } finally {
      setAllRoomsLoading(false);
    }
  }, [selectedServer, accessToken, navigate]);

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
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
      onStompError: (frame) => {
        console.error('STOMP 에러:', frame);
        setConnected(false);
      }
    });
    
    client.activate();
    stompClient.current = client;
  }, [selectedServer, accessToken]);

  const joinChatRoom = async (roomId: number) => {
    if (!stompClient.current?.connected) {
      alert('WebSocket 연결이 필요합니다. 잠시 후 다시 시도해주세요.');
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

      alert('채팅방 입장 요청이 전송되었습니다!');
    } catch (error) {
      console.error('채팅방 입장 오류:', error);
      alert('채팅방 입장 중 오류가 발생했습니다.');
    }
  };

  const createChatRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      alert('채팅방 이름을 입력해주세요.');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${selectedServer.url}/api/chats`, {
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
        setAllChatRooms(prev => [newRoom, ...prev]);
        setShowCreateModal(false);
        setNewRoomName('');
        alert('채팅방이 생성되었습니다.');
      } else if (response.status === 401) {
        localStorage.clear();
        navigate('/login');
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

  const handleChatRoomClick = (room: ChatRoom) => {
    navigate(`/chats/${encodeURIComponent(room.name)}`, { 
      state: { chatRoom: room } 
    });
  };

  useEffect(() => {
    if (!accessToken || !selectedServer) return;

    fetchAllChatRooms();
    connectWebSocket();

    return () => {
      if (stompClient.current) {
        stompClient.current.deactivate();
        stompClient.current = null;
      }
    };
  }, []);

  if (!accessToken || !selectedServer) {
    return null;
  }

  return (
    <div className="page-container">
      <div className="chat-rooms-header">
        <Link to="/my-chats" className="back-button">← 내 채팅방</Link>
        <h1>모든 채팅방</h1>
        <div className="header-right">
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢' : '🔴'}
          </div>
        </div>
      </div>

      <div className="create-room-section">
        <button 
          className="create-room-button" 
          onClick={() => setShowCreateModal(true)}
        >
          + 새 채팅방 만들기
        </button>
      </div>

      {allRoomsLoading ? (
        <div className="loading">모든 채팅방을 불러오는 중...</div>
      ) : (
        <>
          {allChatRooms.length === 0 ? (
            <div className="no-rooms">
              채팅방이 없습니다.
            </div>
          ) : (
            <div className="chat-room-list">
              {allChatRooms.map((room) => (
                <div key={room.id} className="chat-room-item all-rooms">
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

                  <div className="room-actions">
                    <button 
                      className="action-button join-button"
                      onClick={() => joinChatRoom(room.id)}
                    >
                      참여하기
                    </button>
                    <button 
                      className="action-button view-button"
                      onClick={() => handleChatRoomClick(room)}
                    >
                      보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

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

export default AllChatsPage;