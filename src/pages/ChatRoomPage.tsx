import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChatRoom, ChatMessage, User, PaginationResponse } from '../types';
import useWebSocket from '../hooks/useWebSocket';

const ChatRoomPage: React.FC = () => {
  const { roomName } = useParams<{ roomName: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const chatRoom = location.state?.chatRoom as ChatRoom;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const messageHandler = useRef<((message: any) => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  
  // WebSocket Hook 사용
  const { connected, connect, subscribe, unsubscribe, publish } = useWebSocket();

  // localStorage에서 데이터 가져오기
  const accessToken = localStorage.getItem('chat_access_token');
  const selectedServer = JSON.parse(localStorage.getItem('chat_selected_server') || 'null');
  const user = JSON.parse(localStorage.getItem('chat_user') || 'null') as User;

  useEffect(() => {
    if (!accessToken || !selectedServer || !user || !chatRoom) {
      navigate('/login');
      return;
    }
  }, [accessToken, selectedServer, user, chatRoom, navigate]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async (page: number = 0, append: boolean = false) => {
    if (!selectedServer || !accessToken || !chatRoom) return;
    
    if (append) {
      setLoadingMore(true);
    }
    
    try {
      const response = await fetch(`${selectedServer.url}/api/chats/${chatRoom.id}/messages?page=${page}&size=20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data: PaginationResponse<ChatMessage> = await response.json();
        const newMessages = data.content || [];
        const totalCount = data.page.totalElements || 0;
        const pageSize = data.page.size || 20;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        setTotalPages(totalPages);
        setCurrentPage(page);
        setHasMore(page < totalPages - 1);
        
        if (append && page > 0) {
          setMessages(prev => {
            const orderedNewMessages = [...newMessages].reverse();
            return [...orderedNewMessages, ...prev];
          });
        } else {
          setMessages([...newMessages].reverse());
        }
      } else if (response.status === 401) {
        alert('인증이 만료되었습니다. 다시 로그인해주세요.');
        localStorage.clear();
        navigate('/login');
      } else {
        console.error('메시지 조회 실패:', response.status);
        alert('메시지를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('메시지 조회 오류:', error);
      alert(`서버 연결 실패: ${selectedServer.url}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedServer, accessToken, chatRoom, navigate]);

  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingMore || !hasMore) return;

    if (container.scrollTop <= 100) {
      const nextPage = currentPage + 1;
      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;
      
      await fetchMessages(nextPage, true);
      
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
    const container = messagesContainerRef.current;
    let scrollHeight = 0;
    let scrollTop = 0;
    
    if (container) {
      scrollHeight = container.scrollHeight;
      scrollTop = container.scrollTop;
    }
    
    await fetchMessages(nextPage, true);
    
    setTimeout(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const scrollOffset = newScrollHeight - scrollHeight;
        container.scrollTop = scrollTop + scrollOffset;
      }
    }, 50);
  }, [loadingMore, hasMore, currentPage, fetchMessages]);

  const connectWebSocket = useCallback(async () => {
    if (!selectedServer || !accessToken || !chatRoom) return;
    
    try {
      await connect(selectedServer.url, accessToken);
      console.log('ChatRoomPage WebSocket 연결 완료');
      
      // 메시지 핸들러 생성
      const handler = (receivedMessage: any) => {
        setMessages(prev => {
          const isAlreadyExists = prev.some(msg => msg.id === receivedMessage.id);
          if (isAlreadyExists) {
            console.log('중복 메시지 무시:', receivedMessage.id);
            return prev;
          }
          return [...prev, receivedMessage];
        });
      };
      
      // 구독 및 핸들러 저장
      subscribe(`/sub/chat/room/${chatRoom.id}`, handler);
      messageHandler.current = handler;
      
      // 채팅방 입장 메시지 전송
      setTimeout(() => {
        try {
          publish(`/pub/chat/join/${chatRoom.id}`, {}, {
            'Authorization': `Bearer ${accessToken}`
          });
          console.log('채팅방 입장 완료');
        } catch (error) {
          console.error('채팅방 입장 실패:', error);
        }
      }, 100);
    } catch (error) {
      console.error('ChatRoomPage WebSocket 연결 실패:', error);
    }
  }, [selectedServer, accessToken, chatRoom, connect, subscribe, publish]);

  const disconnectWebSocket = useCallback(() => {
    if (connected && chatRoom) {
      try {
        // 채팅방 퇴장 메시지 전송
        publish(`/pub/chat/leave/${chatRoom.id}`, {}, {
          'Authorization': `Bearer ${accessToken}`
        });
        
        // 구독 해제
        if (messageHandler.current) {
          unsubscribe(`/sub/chat/room/${chatRoom.id}`, messageHandler.current);
          messageHandler.current = null;
        }
        
        console.log('채팅방 퇴장 완료');
      } catch (error) {
        console.error('채팅방 퇴장 중 오류:', error);
      }
    }
  }, [connected, chatRoom, accessToken, publish, unsubscribe]);

  useEffect(() => {
    if (!chatRoom || !selectedServer || !accessToken) return;
    
    setMessages([]);
    setCurrentPage(0);
    setHasMore(true);
    setTotalPages(0);
    setLoadingMore(false);
    isInitialLoad.current = true;
    
    const initializeRoom = async () => {
      await fetchMessages(0, false);
      await connectWebSocket();
    };
    
    initializeRoom();
    
    return () => {
      disconnectWebSocket();
    };
  }, [chatRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom();
      isInitialLoad.current = false;
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  const messageList = useMemo(() => {
    const uniqueMessages = messages.filter((message, index, array) => 
      index === array.findIndex(m => m.id === message.id)
    );
    
    return uniqueMessages.map((message) => {
      const isMyMessage = message.sender.id === user?.id;
      
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
  }, [messages, user]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !connected || !chatRoom) return;

    const messageToSend = {
      chatRoomId: chatRoom.id,
      content: newMessage.trim()
    };

    try {
      publish('/pub/chat/send', messageToSend, {
        'Authorization': `Bearer ${accessToken}`
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (!accessToken || !selectedServer || !user || !chatRoom) {
    return null;
  }

  if (loading) {
    return <div className="page-container">로딩 중...</div>;
  }

  return (
    <div className="page-container chat-page">
      <div className="chat-header">
        <button className="back-button" onClick={handleBack}>← 뒤로</button>
        <h1>{chatRoom.name}</h1>
        <div className="header-info">
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 연결됨' : '🔴 연결 중...'}
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
        <button type="submit" disabled={!connected}>
          {connected ? '전송' : '연결 중...'}
        </button>
      </form>
    </div>
  );
};

export default ChatRoomPage;