import React, { useCallback, useEffect } from "react";
import "./App.css";
import { ChatRoom, ServerConfig } from "./types";
import ServerSelectPage from "./components/ServerSelectPage";
import LoginPage from "./components/LoginPage";
import ChatRoomsPage from "./components/ChatRoomsPage";
import ChatPage from "./components/ChatPage";
import ENV, { validateEnv, parseServerConfigs } from "./config/env";
import { useApp } from "./context/AppContext";
import { useSocket } from "./context/SocketContext";

// 환경 변수에서 서버 설정 가져오기
const getDefaultServers = (): ServerConfig[] => {
  return parseServerConfigs();
};

// 기본 서버 목록
const DEFAULT_SERVERS: ServerConfig[] = getDefaultServers();

function App() {
  const { state, selectServer, login, selectChatRoom, goBack } = useApp();
  const {
    connectionStatus,
    connect: connectSocket,
    resubscribeToRoom,
  } = useSocket();

  // 환경 변수 검증
  useEffect(() => {
    validateEnv();
  }, []);

  // 로그인 후 소켓 연결
  useEffect(() => {
    if (
      state.accessToken &&
      state.selectedServer &&
      connectionStatus === "disconnected"
    ) {
      connectSocket(state.selectedServer.url, state.accessToken);
    }
  }, [
    state.accessToken,
    state.selectedServer,
    connectionStatus,
    connectSocket,
  ]);

  // 채팅방 선택 핸들러
  const handleSelectChatRoom = useCallback(
    (chatRoom: ChatRoom, unsubscribeFromRoom: (roomId: number) => void) => {
      // 해당 채팅방의 백그라운드 구독 해제
      unsubscribeFromRoom(chatRoom.id);

      selectChatRoom(chatRoom);
    },
    [selectChatRoom]
  );

  // 뒤로가기 핸들러 (구독 관리 포함)
  const handleGoBack = useCallback(() => {
    if (state.currentPage === "chat" && state.currentChatRoom) {
      // 채팅방에서 돌아갈 때 백그라운드 구독 재개
      resubscribeToRoom(state.currentChatRoom.id, () => {
        // 메시지 수신 시 처리할 콜백 (필요에 따라 구현)
        console.log(`채팅방 ${state.currentChatRoom!.id} 백그라운드 구독 재개`);
      });
    }
    goBack();
  }, [state.currentPage, state.currentChatRoom, resubscribeToRoom, goBack]);

  return (
    <div className="App">
      {state.currentPage === "server-select" && (
        <ServerSelectPage
          servers={DEFAULT_SERVERS}
          onSelectServer={selectServer}
        />
      )}

      {state.currentPage === "login" && state.selectedServer && (
        <LoginPage
          serverName={state.selectedServer.name}
          serverUrl={state.selectedServer.url}
          onLogin={login}
          onBack={handleGoBack}
        />
      )}

      {state.currentPage === "chat-rooms" &&
        state.selectedServer &&
        state.accessToken && (
          <ChatRoomsPage
            serverUrl={state.selectedServer.url}
            accessToken={state.accessToken}
            onSelectChatRoom={handleSelectChatRoom}
            onBack={handleGoBack}
          />
        )}

      {state.currentPage === "chat" &&
        state.currentChatRoom &&
        state.selectedServer &&
        state.accessToken && (
          <ChatPage
            chatRoom={state.currentChatRoom}
            serverUrl={state.selectedServer.url}
            accessToken={state.accessToken}
            user={state.user!}
            onBack={handleGoBack}
          />
        )}
    </div>
  );
}

export default App;
