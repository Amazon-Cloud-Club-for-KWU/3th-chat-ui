import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import { AppState, ServerConfig, ChatRoom, User } from "../types";

// 액션 타입 정의
type AppAction =
  | { type: "SELECT_SERVER"; payload: ServerConfig }
  | { type: "LOGIN"; payload: { user: User; accessToken: string } }
  | { type: "LOGOUT" }
  | { type: "SELECT_CHAT_ROOM"; payload: ChatRoom }
  | { type: "CLEAR_CHAT_ROOM" }
  | { type: "SET_PAGE"; payload: AppState["currentPage"] }
  | { type: "UPDATE_USER"; payload: User };

// 초기 상태
const initialState: AppState = {
  currentPage: "server-select",
};

// 리듀서 함수
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SELECT_SERVER":
      return {
        ...state,
        selectedServer: action.payload,
        currentPage: "login",
      };

    case "LOGIN":
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        currentPage: "chat-rooms",
      };

    case "LOGOUT":
      return {
        currentPage: "server-select",
      };

    case "SELECT_CHAT_ROOM":
      return {
        ...state,
        currentChatRoom: action.payload,
        currentPage: "chat",
      };

    case "CLEAR_CHAT_ROOM":
      return {
        ...state,
        currentChatRoom: undefined,
        currentPage: "chat-rooms",
      };

    case "SET_PAGE":
      return {
        ...state,
        currentPage: action.payload,
      };

    case "UPDATE_USER":
      return {
        ...state,
        user: action.payload,
      };

    default:
      return state;
  }
}

// Context 생성
interface AppContextType {
  state: AppState;
  selectServer: (server: ServerConfig) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  selectChatRoom: (chatRoom: ChatRoom) => void;
  clearChatRoom: () => void;
  goBack: () => void;
  updateUser: (user: User) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// localStorage 키 상수
const STORAGE_KEYS = {
  ACCESS_TOKEN: "chat_access_token",
  USER: "chat_user",
  SELECTED_SERVER: "chat_selected_server",
};

// localStorage에서 상태 로드
const loadFromStorage = (): AppState | null => {
  try {
    const savedAccessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const savedServer = localStorage.getItem(STORAGE_KEYS.SELECTED_SERVER);

    if (savedAccessToken && savedUser && savedServer) {
      return {
        accessToken: savedAccessToken,
        user: JSON.parse(savedUser),
        selectedServer: JSON.parse(savedServer),
        currentPage: "chat-rooms" as const,
        currentChatRoom: undefined,
      };
    }
  } catch (error) {
    console.error("localStorage 로드 오류:", error);
    clearStorage();
  }
  return null;
};

// localStorage에 저장
const saveToStorage = (
  accessToken: string,
  user: User,
  selectedServer: ServerConfig
) => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(
      STORAGE_KEYS.SELECTED_SERVER,
      JSON.stringify(selectedServer)
    );
  } catch (error) {
    console.error("localStorage 저장 오류:", error);
  }
};

// localStorage 정리
const clearStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_SERVER);
  } catch (error) {
    console.error("localStorage 정리 오류:", error);
  }
};

// Provider 컴포넌트
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState, () => {
    const savedState = loadFromStorage();
    return savedState || initialState;
  });

  // 앱 시작 시 사용자 정보 검증
  useEffect(() => {
    const validateUser = async () => {
      if (state.accessToken && state.selectedServer && state.user) {
        try {
          console.log("저장된 사용자 정보 검증 시작");
          const response = await fetch(
            `${state.selectedServer.url}/api/users/me`,
            {
              headers: { Authorization: `Bearer ${state.accessToken}` },
            }
          );

          if (response.ok) {
            const userData = await response.json();
            console.log("사용자 정보 검증 성공:", userData);

            // 저장된 정보와 서버 정보가 다르면 업데이트
            if (
              userData.id !== state.user.id ||
              userData.username !== state.user.username
            ) {
              console.log("사용자 정보 업데이트 필요");
              const updatedUser = {
                id: userData.id,
                username: userData.username,
                email: userData.email || state.user.email,
              };

              saveToStorage(
                state.accessToken,
                updatedUser,
                state.selectedServer
              );
              dispatch({ type: "UPDATE_USER", payload: updatedUser });
            }
          } else if (response.status === 401) {
            console.log("토큰 만료, 로그아웃 처리");
            logout();
          }
        } catch (error) {
          console.error("사용자 정보 검증 오류:", error);
        }
      }
    };

    validateUser();
  }, []);

  // 서버 선택
  const selectServer = (server: ServerConfig) => {
    dispatch({ type: "SELECT_SERVER", payload: server });
  };

  // 로그인
  const login = async (username: string, password: string) => {
    if (!state.selectedServer) {
      alert("서버가 선택되지 않았습니다.");
      return;
    }

    try {
      console.log("로그인 시도:", {
        username,
        serverUrl: state.selectedServer.url,
      });

      const response = await fetch(
        `${state.selectedServer.url}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("로그인 성공 응답:", data);

        // 로그인 성공 후 실제 사용자 정보 조회
        try {
          console.log("사용자 정보 조회 시작");
          const userResponse = await fetch(
            `${state.selectedServer.url}/api/users/me`,
            {
              headers: { Authorization: `Bearer ${data.accessToken}` },
            }
          );

          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log("사용자 정보 조회 성공:", userData);

            // 실제 서버에서 받은 사용자 정보 사용
            const user = {
              id: userData.id,
              username: userData.username,
              email: userData.email || `${userData.username}@example.com`,
            };

            // localStorage에 로그인 정보 저장
            if (state.selectedServer) {
              saveToStorage(data.accessToken, user, state.selectedServer);
            }

            console.log("로그인 후 상태 업데이트:", {
              user,
              accessToken: data.accessToken
                ? `${data.accessToken.substring(0, 20)}...`
                : "없음",
              currentPage: "chat-rooms",
            });

            dispatch({
              type: "LOGIN",
              payload: { user, accessToken: data.accessToken },
            });
          } else {
            console.error("사용자 정보 조회 실패:", userResponse.status);
            alert("사용자 정보를 불러올 수 없습니다.");
          }
        } catch (userError) {
          console.error("사용자 정보 조회 오류:", userError);
          alert("사용자 정보 조회 중 오류가 발생했습니다.");
        }
      } else {
        const errorText = await response.text();
        console.error("로그인 실패:", response.status, errorText);
        alert(`로그인에 실패했습니다: ${errorText || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("로그인 오류:", error);
      alert(`서버 연결에 실패했습니다: ${state.selectedServer.url}`);
    }
  };

  // 로그아웃
  const logout = () => {
    clearStorage();
    dispatch({ type: "LOGOUT" });
  };

  // 채팅방 선택
  const selectChatRoom = (chatRoom: ChatRoom) => {
    dispatch({ type: "SELECT_CHAT_ROOM", payload: chatRoom });
  };

  // 채팅방 페이지에서 돌아가기
  const clearChatRoom = () => {
    dispatch({ type: "CLEAR_CHAT_ROOM" });
  };

  // 뒤로가기
  const goBack = () => {
    if (state.currentPage === "chat") {
      dispatch({ type: "CLEAR_CHAT_ROOM" });
    } else if (state.currentPage === "chat-rooms") {
      logout();
    } else if (state.currentPage === "login") {
      dispatch({ type: "SET_PAGE", payload: "server-select" });
    }
  };

  // 사용자 정보 업데이트
  const updateUser = (user: User) => {
    dispatch({ type: "UPDATE_USER", payload: user });
  };

  const value: AppContextType = {
    state,
    selectServer,
    login,
    logout,
    selectChatRoom,
    clearChatRoom,
    goBack,
    updateUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
