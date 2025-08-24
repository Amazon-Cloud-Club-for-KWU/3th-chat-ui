import React, { useState, useEffect, useCallback } from 'react';
import { ChatRoom } from '../types';

interface AllChatRoomsPageProps {
  serverUrl: string;
  accessToken: string;
  onSelectChatRoom: (chatRoom: ChatRoom, unsubscribeFromRoom: (roomId: number) => void) => void;
  onBack: () => void;
}

const AllChatRoomsPage: React.FC<AllChatRoomsPageProps> = ({ 
  serverUrl, 
  accessToken, 
  onSelectChatRoom, 
  onBack 
}) => {
  const [allChatRooms, setAllChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 모든 채팅방 조회 (참여 여부와 관계없이)
  const fetchAllChatRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${serverUrl}/api/chats`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('모든 채팅방 조회 성공:', data);
        
        const rooms = data.nodes || [];
        // 마지막 메시지 시간 기준으로 정렬
        const sortedRooms = rooms.sort((a: ChatRoom, b: ChatRoom) => {
          const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return bTime - aTime; // 최신 메시지가 있는 방이 위로
        });
        
        console.log(`모든 채팅방 ${sortedRooms.length}개 로드 완료`);
        setAllChatRooms(sortedRooms);
      } else if (response.status === 401 || response.status === 403) {
        alert('인증이 만료되었습니다. 다시 로그인해주세요.');
        onBack();
      } else {
        alert('채팅방 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('채팅방 목록 조회 오류:', error);
      alert(`서버 연결 실패`);
    } finally {
      setLoading(false);
    }
  }, [serverUrl, accessToken, onBack]);

  // 검색 필터링
  const filteredRooms = allChatRooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 채팅방 참여 함수
  const joinChatRoom = async (roomId: number) => {
    try {
      const response = await fetch(`${serverUrl}/api/chats/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        alert('채팅방에 참여했습니다!');
        // 채팅방 목록 새로고침
        await fetchAllChatRooms();
      } else if (response.status === 409) {
        alert('이미 참여 중인 채팅방입니다.');
      } else {
        alert('채팅방 참여에 실패했습니다.');
      }
    } catch (error) {
      console.error('채팅방 참여 오류:', error);
      alert('채팅방 참여 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchAllChatRooms();
  }, [fetchAllChatRooms]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">모든 채팅방을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* 헤더 */}
      <div className="page-header">
        <button className="back-button" onClick={onBack}>
          ← 뒤로
        </button>
        <h1>모든 채팅방</h1>
        <div className="header-actions">
          <span className="room-count">총 {allChatRooms.length}개</span>
        </div>
      </div>

      {/* 검색 바 */}
      <div className="search-container">
        <input
          type="text"
          placeholder="채팅방 이름으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button 
          onClick={() => setSearchTerm('')}
          className="clear-search"
          disabled={!searchTerm}
        >
          ✕
        </button>
      </div>

      {/* 채팅방 목록 */}
      {filteredRooms.length === 0 ? (
        <div className="no-rooms">
          {searchTerm ? '검색 결과가 없습니다.' : '채팅방이 없습니다.'}
        </div>
      ) : (
        <div className="chat-room-list">
          {filteredRooms.map((room) => (
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

              {/* 액션 버튼들 */}
              <div className="room-actions">
                <button 
                  className="action-button join-button"
                  onClick={() => joinChatRoom(room.id)}
                >
                  참여하기
                </button>
                <button 
                  className="action-button view-button"
                  onClick={() => onSelectChatRoom(room, () => {})}
                >
                  보기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllChatRoomsPage;
