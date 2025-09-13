// 타입 정의
export interface User {
  id: number;
  username: string;
  email?: string;  // email은 optional (서버에서 UserDto에 포함되지 않을 수 있음)
}

export interface ChatRoom {
  id: number;
  name: string;
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  chatRoom: ChatRoom;
  sender: User;
  content: string;
  createdAt: string;
}

export interface ServerConfig {
  name: string;
  url: string;
}

export interface PaginationResponse<T> {
  content: T[];
  page: PageInfo;
}

export interface PageInfo {
  size: number,
  number: number,
  totalElements: number,
  totalPages: number
}

export interface AppState {
  selectedServer?: ServerConfig;
  user?: User;
  accessToken?: string;
  currentPage: 'server-select' | 'login' | 'chat-rooms' | 'chat';
  currentChatRoom?: ChatRoom;
}
