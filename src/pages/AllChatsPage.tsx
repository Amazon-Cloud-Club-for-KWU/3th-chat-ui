import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChatRoom } from '../types';
import useWebSocket from '../hooks/useWebSocket';

const AllChatsPage: React.FC = () => {
  const [allChatRooms, setAllChatRooms] = useState<ChatRoom[]>([]);
  const [allRoomsLoading, setAllRoomsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  
  // WebSocket Hook 사용
  const { connected, connect, publish } = useWebSocket();

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

  const connectWebSocket = useCallback(async () => {
    if (!selectedServer || !accessToken) return;
    
    try {
      await connect(selectedServer.url, accessToken);
      console.log('AllChatsPage WebSocket 연결 완료');
    } catch (error) {
      console.error('AllChatsPage WebSocket 연결 실패:', error);
    }
  }, [selectedServer, accessToken, connect]);

  const joinChatRoom = async (roomId: number) => {
    if (!connected) {
      alert('WebSocket 연결이 필요합니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      publish(`/pub/chat/join/${roomId}`, {}, {
        'Authorization': `Bearer ${accessToken}`
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

    const initializeData = async () => {
      await fetchAllChatRooms();
      await connectWebSocket();
    };

    initializeData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!accessToken || !selectedServer) {
    return null;
  }

  return (
    <div className="page-container chat-list-page">
      <div className="elegant-header">
        <div className="header-left">
          <Link to="/my-chats" className="elegant-back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
            내 채팅방
          </Link>
        </div>
        <div className="header-center">
          <h1 className="elegant-title">
            <span className="title-icon">🌐</span>
            모든 채팅방
            <span className="chat-count">({allChatRooms.length})</span>
          </h1>
        </div>
        <div className="header-right">
          <div className={`elegant-connection-status ${connected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot"></div>
            <span>{connected ? '온라인' : '연결 중...'}</span>
          </div>
        </div>
      </div>

      <div className="elegant-create-section">
        <button 
          className="elegant-create-button" 
          onClick={() => setShowCreateModal(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8m-4-4h8" />
          </svg>
          <span>새 채팅방 만들기</span>
        </button>
      </div>

      {allRoomsLoading ? (
        <div className="loading">모든 채팅방을 불러오는 중...</div>
      ) : (
        <>
          {allChatRooms.length === 0 ? (
            <div className="elegant-empty-state">
              <div className="empty-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>사용 가능한 채팅방이 없어요</h3>
              <p>첫 번째 채팅방을 만들어보세요!</p>
            </div>
          ) : (
            <div className="elegant-chat-room-list">
              {allChatRooms.map((room, index) => (
                <div 
                  key={room.id} 
                  className="elegant-chat-room-item all-rooms clickable"
                  style={{'--animation-delay': `${index * 0.1}s`} as React.CSSProperties}
                  onClick={() => handleChatRoomClick(room)}
                >
                  <div className="room-avatar">
                    <div className="avatar-placeholder">
                      {room.name.charAt(0).toUpperCase()}
                    </div>
                    {room.unreadCount && room.unreadCount > 0 && (
                      <div className="elegant-unread-badge">{room.unreadCount}</div>
                    )}
                  </div>
                  
                  <div className="room-content">
                    <div className="room-header">
                      <h3 className="room-title">{room.name}</h3>
                      {room.lastMessage && (
                        <span className="message-time">
                          {new Date(room.lastMessage.createdAt).toLocaleDateString('ko-KR') === 
                           new Date().toLocaleDateString('ko-KR') 
                            ? new Date(room.lastMessage.createdAt).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : new Date(room.lastMessage.createdAt).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric'
                              })}
                        </span>
                      )}
                    </div>
                    
                    <div className="room-preview">
                      {room.lastMessage ? (
                        <>
                          <span className="sender-name">{room.lastMessage.sender.username}</span>
                          <span className="message-preview">{room.lastMessage.content}</span>
                        </>
                      ) : (
                        <span className="no-messages">아직 메시지가 없습니다</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="room-indicator">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>

                  <div className="join-hint" onClick={(e) => {
                    e.stopPropagation();
                    joinChatRoom(room.id);
                  }}>
                    <button className="subtle-join-button" title="채팅방에 참여">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <div className="elegant-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="elegant-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <path d="M12 7v6m-3-3h6" />
                </svg>
              </div>
              <h2>새 채팅방 만들기</h2>
              <p>새로운 대화 공간을 만들어보세요</p>
            </div>
            
            <form onSubmit={createChatRoom} className="elegant-form">
              <div className="input-group">
                <label htmlFor="roomName">채팅방 이름</label>
                <input
                  id="roomName"
                  type="text"
                  placeholder="예: 일반 대화, 프로젝트 회의..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                  required
                  className="elegant-input"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="elegant-button secondary"
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
                  className="elegant-button primary"
                  disabled={creating || !newRoomName.trim()}
                >
                  {creating ? (
                    <>
                      <div className="loading-spinner"></div>
                      만드는 중...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                      만들기
                    </>
                  )}
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