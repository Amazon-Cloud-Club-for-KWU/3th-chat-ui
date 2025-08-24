import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import { AppState, ServerConfig, ChatRoom } from './types';
import ServerSelectPage from './components/ServerSelectPage';
import LoginPage from './components/LoginPage';
import ChatRoomsPage from './components/ChatRoomsPage';
import ChatPage from './components/ChatPage';

// 기본 서버 목록
const DEFAULT_SERVERS: ServerConfig[] = [
  { name: '로컬 서버', url: 'http://localhost:8080' }
];

// localStorage 키 상수
const STORAGE_KEYS = {
  APP_STATE: 'chat_app_state',
  ACCESS_TOKEN: 'chat_access_token',
  USER: 'chat_user',
  SELECTED_SERVER: 'chat_selected_server'
};

// localStorage에서 상태 로드 함수들
const loadFromStorage = () => {
  try {
    const savedAccessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const savedServer = localStorage.getItem(STORAGE_KEYS.SELECTED_SERVER);
    
    if (savedAccessToken && savedUser && savedServer) {
      return {
        accessToken: savedAccessToken,
        user: JSON.parse(savedUser),
        selectedServer: JSON.parse(savedServer),
        currentPage: 'chat-rooms' as const
      };
    }
  } catch (error) {
    console.error('localStorage 로드 오류:', error);
    // 오류 발생 시 localStorage 정리
    clearStorage();
  }
  return null;
};

const saveToStorage = (accessToken: string, user: any, selectedServer: ServerConfig) => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.SELECTED_SERVER, JSON.stringify(selectedServer));
  } catch (error) {
    console.error('localStorage 저장 오류:', error);
  }
};

const clearStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_SERVER);
  } catch (error) {
    console.error('localStorage 정리 오류:', error);
  }
};

function App() {
  // 초기 상태를 localStorage에서 로드하거나 기본값 사용
  const [appState, setAppState] = useState<AppState>(() => {
    const savedState = loadFromStorage();
    return savedState || { currentPage: 'server-select' };
  });

  // 채팅방 구독 관리를 위한 상태
  const [chatRoomSubscriptionManager, setChatRoomSubscriptionManager] = useState<{
    resubscribeToRoom?: (roomId: number) => void;
  }>({});

  // 앱 시작 시 사용자 정보 검증
  useEffect(() => {
    const validateUser = async () => {
      if (appState.accessToken && appState.selectedServer && appState.user) {
        try {
          console.log('저장된 사용자 정보 검증 시작');
          const response = await fetch(`${appState.selectedServer.url}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${appState.accessToken}` }
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('사용자 정보 검증 성공:', userData);
            
            // 저장된 정보와 서버 정보가 다르면 업데이트
            if (userData.id !== appState.user.id || userData.username !== appState.user.username) {
              console.log('사용자 정보 업데이트 필요');
              const updatedUser = {
                id: userData.id,
                username: userData.username,
                email: userData.email || appState.user.email
              };
              
              saveToStorage(appState.accessToken, updatedUser, appState.selectedServer);
              setAppState(prev => ({ ...prev, user: updatedUser }));
            }
          } else if (response.status === 401) {
            console.log('토큰 만료, 로그아웃 처리');
            clearStorage();
            setAppState({ currentPage: 'server-select' });
          }
        } catch (error) {
          console.error('사용자 정보 검증 오류:', error);
        }
      }
    };

    validateUser();
  }, []); // 앱 시작 시 한 번만 실행

  // 서버 선택 핸들러
  const selectServer = (server: ServerConfig) => {
    setAppState(prev => ({
      ...prev,
      selectedServer: server,
      currentPage: 'login'
    }));
  };

  // 로그인 핸들러
  const login = async (username: string, password: string) => {
    if (!appState.selectedServer) {
      alert('서버가 선택되지 않았습니다.');
      return;
    }

    try {
      console.log('로그인 시도:', { username, serverUrl: appState.selectedServer.url });
      
      const response = await fetch(`${appState.selectedServer.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('로그인 성공 응답:', data);
        
        // 로그인 성공 후 실제 사용자 정보 조회
        try {
          console.log('사용자 정보 조회 시작');
          const userResponse = await fetch(`${appState.selectedServer.url}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${data.accessToken}` }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('사용자 정보 조회 성공:', userData);
            
            // 실제 서버에서 받은 사용자 정보 사용
            const user = {
              id: userData.id,
              username: userData.username,
              email: userData.email || `${userData.username}@example.com` // email이 없으면 임시 생성
            };
            
            // localStorage에 로그인 정보 저장
            if (appState.selectedServer) {
              saveToStorage(data.accessToken, user, appState.selectedServer);
            }
            
            setAppState(prev => ({
              ...prev,
              user,
              accessToken: data.accessToken,
              currentPage: 'chat-rooms'
            }));
          } else {
            console.error('사용자 정보 조회 실패:', userResponse.status);
            alert('사용자 정보를 불러올 수 없습니다.');
          }
        } catch (userError) {
          console.error('사용자 정보 조회 오류:', userError);
          alert('사용자 정보 조회 중 오류가 발생했습니다.');
        }
      } else {
        const errorText = await response.text();
        console.error('로그인 실패:', response.status, errorText);
        alert(`로그인에 실패했습니다: ${errorText || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      alert(`서버 연결에 실패했습니다: ${appState.selectedServer.url}`);
    }
  };

  // 채팅방 선택 핸들러
  const selectChatRoom = (chatRoom: ChatRoom, unsubscribeFromRoom: (roomId: number) => void) => {
    // 해당 채팅방의 백그라운드 구독 해제
    unsubscribeFromRoom(chatRoom.id);
    
    setAppState(prev => ({
      ...prev,
      currentChatRoom: chatRoom,
      currentPage: 'chat'
    }));
  };

  // 채팅방 페이지에서 돌아올 때 호출되는 핸들러
  const handleChatPageReturn = useCallback((resubscribeToRoom: (roomId: number) => void) => {
    setChatRoomSubscriptionManager({ resubscribeToRoom });
  }, []); // 의존성 없음으로 안정적인 함수 생성

  // 뒤로가기 핸들러
  const goBack = () => {
    setAppState(prev => {
      if (prev.currentPage === 'chat') {
        // 채팅방에서 돌아갈 때 백그라운드 구독 재개
        if (prev.currentChatRoom && chatRoomSubscriptionManager.resubscribeToRoom) {
          chatRoomSubscriptionManager.resubscribeToRoom(prev.currentChatRoom.id);
        }
        return { ...prev, currentPage: 'chat-rooms', currentChatRoom: undefined };
      } else if (prev.currentPage === 'chat-rooms') {
        // 채팅방 목록에서 뒤로가기 = 로그아웃
        clearStorage();
        return { currentPage: 'server-select' };
      } else if (prev.currentPage === 'login') {
        return { ...prev, currentPage: 'server-select', selectedServer: undefined };
      }
      return prev;
    });
  };

  return (
    <div className="App">
      {appState.currentPage === 'server-select' && (
        <ServerSelectPage servers={DEFAULT_SERVERS} onSelectServer={selectServer} />
      )}
      
      {appState.currentPage === 'login' && appState.selectedServer && (
        <LoginPage 
          serverName={appState.selectedServer.name}
          serverUrl={appState.selectedServer.url}
          onLogin={login} 
          onBack={goBack}
        />
      )}
      
      {appState.currentPage === 'chat-rooms' && appState.selectedServer && appState.accessToken && (
        <ChatRoomsPage 
          serverUrl={appState.selectedServer.url}
          accessToken={appState.accessToken}
          onSelectChatRoom={selectChatRoom}
          onChatPageReturn={handleChatPageReturn}
          onBack={goBack}
        />
      )}
      
      {appState.currentPage === 'chat' && appState.currentChatRoom && appState.selectedServer && appState.accessToken && (
        <ChatPage 
          chatRoom={appState.currentChatRoom}
          serverUrl={appState.selectedServer.url}
          accessToken={appState.accessToken}
          user={appState.user!}
          onBack={goBack}
        />
      )}
    </div>
  );
}

export default App;