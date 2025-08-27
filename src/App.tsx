import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { validateEnv } from './config/env';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyChatsPage from './pages/MyChatsPage';
import AllChatsPage from './pages/AllChatsPage';
import ChatRoomPage from './pages/ChatRoomPage';

function App() {
  // 환경 변수 검증
  useEffect(() => {
    validateEnv();
  }, []);

  // 인증 체크 함수
  const isAuthenticated = () => {
    const accessToken = localStorage.getItem('chat_access_token');
    const selectedServer = localStorage.getItem('chat_selected_server');
    const user = localStorage.getItem('chat_user');
    return !!(accessToken && selectedServer && user);
  };

  // Protected Route 컴포넌트
  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
  };

  return (
    <div className="App">
      <Router>
        <Routes>
          {/* 기본 경로 - 인증 상태에 따라 리다이렉트 */}
          <Route 
            path="/" 
            element={
              isAuthenticated() ? 
                <Navigate to="/my-chats" replace /> : 
                <Navigate to="/login" replace />
            } 
          />
          
          {/* 인증 페이지들 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* 보호된 페이지들 */}
          <Route 
            path="/my-chats" 
            element={
              <ProtectedRoute>
                <MyChatsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/all-chats" 
            element={
              <ProtectedRoute>
                <AllChatsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chats/:roomName" 
            element={
              <ProtectedRoute>
                <ChatRoomPage />
              </ProtectedRoute>
            } 
          />
          
          {/* 404 페이지 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;