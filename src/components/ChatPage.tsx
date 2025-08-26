import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChatRoom, ChatMessage, User, PaginationResponse } from '../types';
import { useWebSocket } from '../contexts/WebSocketContext';


interface ChatPageProps {
  chatRoom: ChatRoom;
  serverUrl: string;
  accessToken: string;
  user: User;
  onBack: () => void;
}

const ChatPage: React.FC<ChatPageProps> = ({ chatRoom, serverUrl, accessToken, user, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  
  const { isConnected, joinChatRoom, leaveChatRoom, sendMessage: sendWebSocketMessage, sendJoinMessage, sendLeaveMessage } = useWebSocket();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async (page: number = 0, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    }
    
    try {
      const response = await fetch(`${serverUrl}/api/chats/${chatRoom.id}/messages?page=${page}&size=20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data: PaginationResponse<ChatMessage> = await response.json();
        console.log(`메시지 조회 - 페이지: ${page}, 추가모드: ${append}, 메시지 개수: ${data.nodes?.length || 0}`);
        
        const newMessages = data.nodes || [];
        const totalCount = data.totalCount || 0;
        const pageSize = data.size || 20;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        setTotalPages(totalPages);
        setCurrentPage(page);
        setHasMore(page < totalPages - 1);
        
        if (append && page > 0) {
          console.log(`과거 메시지 추가: 기존 ${messages.length}개 + 새 ${newMessages.length}개`);
          
          // 서버에서 내림차순(최신순)으로 오므로, 과거 메시지를 앞에 추가할 때는 순서를 뒤집어야 함
          setMessages(prev => {
            const orderedNewMessages = [...newMessages].reverse();
            return [...orderedNewMessages, ...prev];
          });
        } else {
          console.log(`초기 로딩: ${newMessages.length}개 메시지`);
          // 초기 로딩 시에는 서버에서 온 순서를 뒤집어서 시간순으로 정렬
          setMessages([...newMessages].reverse());
        }
      } else if (response.status === 401) {
        alert('인증이 만료되었습니다. 다시 로그인해주세요.');
        onBack();
      } else {
        console.error('메시지 조회 실패:', response.status);
        alert('메시지를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('메시지 조회 오류:', error);
      alert(`서버 연결 실패: ${serverUrl}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [serverUrl, chatRoom.id, accessToken, onBack]);

  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingMore || !hasMore) return;

    // 상단에서 100px 이내로 스크롤했을 때 과거 메시지 로드
    if (container.scrollTop <= 100) {
      const nextPage = currentPage + 1;
      console.log(`과거 메시지 로딩: 페이지 ${nextPage}`);
      
      // 현재 스크롤 위치 저장
      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;
      
      await fetchMessages(nextPage, true);
      
      // 메시지 로딩 후 스크롤 위치 복원
      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const scrollOffset = newScrollHeight - scrollHeight;
          container.scrollTop = scrollTop + scrollOffset;
        }
      }, 100);
    }
  }, [loadingMore, hasMore, currentPage, fetchMessages]);

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    const nextPage = currentPage + 1;
    console.log(`더보기 버튼: 페이지 ${nextPage} 로딩`);
    
    const container = messagesContainerRef.current;
    let scrollHeight = 0;
    let scrollTop = 0;
    
    if (container) {
      scrollHeight = container.scrollHeight;
      scrollTop = container.scrollTop;
    }
    
    await fetchMessages(nextPage, true);
    
    // 스크롤 위치 복원
    setTimeout(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const scrollOffset = newScrollHeight - scrollHeight;
        container.scrollTop = scrollTop + scrollOffset;
      }
    }, 50);
  }, [loadingMore, hasMore, currentPage, fetchMessages]);

  const handleMessage = useCallback((receivedMessage: ChatMessage) => {
    console.log('ChatPage에서 메시지 처리 시작:', receivedMessage);
    // 중복 메시지 방지: 이미 존재하는 메시지 ID인지 확인
    setMessages(prev => {
      const isAlreadyExists = prev.some(msg => msg.id === receivedMessage.id);
      if (isAlreadyExists) {
        console.log('중복 메시지 무시:', receivedMessage.id);
        return prev; // 중복 메시지는 추가하지 않음
      }
      console.log('새 메시지 추가, 기존 메시지 수:', prev.length);
      // 새 메시지는 항상 끝에 추가 (시간순)
      const newMessages = [...prev, receivedMessage];
      console.log('업데이트된 메시지 수:', newMessages.length);
      return newMessages;
    });
  }, []);


  useEffect(() => {
    console.log(`채팅방 입장: ${chatRoom.name} (ID: ${chatRoom.id})`);
    
    // 채팅방 변경 시 상태 초기화
    setMessages([]);
    setCurrentPage(0);
    setHasMore(true);
    setTotalPages(0);
    setLoadingMore(false);
    isInitialLoad.current = true;
    
    fetchMessages(0, false);
    
    // 채팅방 구독 및 입장 메시지 전송
    joinChatRoom(chatRoom.id, handleMessage);
    
    // 구독 후 짧은 지연 후 입장 메시지 전송
    setTimeout(() => {
      sendJoinMessage(chatRoom.id);
    }, 100);
    
    return () => {
      // 채팅방 퇴장 메시지 전송 후 구독 해제
      sendLeaveMessage(chatRoom.id);
      setTimeout(() => {
        leaveChatRoom(chatRoom.id);
      }, 100);
    };
  }, [chatRoom.id, fetchMessages, joinChatRoom, leaveChatRoom, sendJoinMessage, sendLeaveMessage]);

  useEffect(() => {
    // 초기 로딩일 때만 스크롤을 맨 아래로
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom();
      isInitialLoad.current = false;
    } else if (!isInitialLoad.current && messages.length > 0) {
      // 새 메시지가 추가될 때도 스크롤을 아래로
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages, scrollToBottom]);

  // 스크롤 이벤트 리스너 추가
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  // 메시지 목록을 메모이제이션하여 중복 렌더링 방지
  const messageList = useMemo(() => {
    // 중복 메시지 필터링 (혹시 모를 추가 보호)
    const uniqueMessages = messages.filter((message, index, array) => 
      index === array.findIndex(m => m.id === message.id)
    );
    
    return uniqueMessages.map((message) => {
      const isMyMessage = message.sender.id === user.id;
      
      return (
        <div 
          key={message.id} 
          className={`message ${isMyMessage ? 'own' : 'other'}`}
        >
          <div className="message-sender">{message.sender.username}</div>
          <div className="message-content">{message.content}</div>
          <div className="message-time">
            {new Date(message.createdAt).toLocaleTimeString()}
          </div>
        </div>
      );
    });
  }, [messages, user.id]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    try {
      sendWebSocketMessage(chatRoom.id, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="page-container">로딩 중...</div>;
  }

  return (
    <div className="page-container chat-page">
      <div className="chat-header">
        <button className="back-button" onClick={onBack}>← 뒤로</button>
        <h1>{chatRoom.name}</h1>
        <div className="header-info">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 연결됨' : '🔴 연결 중...'}
          </div>
          <div className="pagination-debug" style={{fontSize: '12px', color: '#666'}}>
            페이지: {currentPage}/{totalPages-1} | 메시지: {messages.length} | hasMore: {hasMore ? 'Y' : 'N'}
          </div>
        </div>
      </div>
      
      <div className="messages-container" ref={messagesContainerRef}>
        {loadingMore && (
          <div className="loading-more">
            <div className="loading-spinner">과거 메시지 로딩중...</div>
          </div>
        )}
        {hasMore && !loadingMore && messages.length > 0 && (
          <div className="load-more-button-container">
            <button 
              className="load-more-button" 
              onClick={loadMoreMessages}
              disabled={loadingMore}
            >
              과거 메시지 더보기
            </button>
          </div>
        )}
        {messageList}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="message-input-form">
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit" disabled={!isConnected}>
          {isConnected ? '전송' : '연결 중...'}
        </button>
      </form>
    </div>
  );
};

export default ChatPage;
