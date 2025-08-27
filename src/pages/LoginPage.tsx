import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ServerConfig } from '../types';
import { parseServerConfigs } from '../config/env';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerConfig | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const serverConfigs = parseServerConfigs();
    setServers(serverConfigs);
    if (serverConfigs.length > 0) {
      setSelectedServer(serverConfigs[0]);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedServer) {
      alert('서버를 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${selectedServer.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        
        // 사용자 정보 조회
        const userResponse = await fetch(`${selectedServer.url}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${data.accessToken}` }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          
          // localStorage에 저장
          localStorage.setItem('chat_access_token', data.accessToken);
          localStorage.setItem('chat_user', JSON.stringify(userData));
          localStorage.setItem('chat_selected_server', JSON.stringify(selectedServer));
          
          navigate('/my-chats');
        } else {
          alert('사용자 정보를 불러올 수 없습니다.');
        }
      } else {
        const errorText = await response.text();
        alert(`로그인에 실패했습니다: ${errorText || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      alert(`서버 연결에 실패했습니다: ${selectedServer.url}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="auth-header">
        <h1>로그인</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="server">서버 선택</label>
          <select
            id="server"
            value={selectedServer?.name || ''}
            onChange={(e) => {
              const server = servers.find(s => s.name === e.target.value);
              setSelectedServer(server || null);
            }}
            required
          >
            {servers.map((server) => (
              <option key={server.name} value={server.name}>
                {server.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="username">사용자 이름</label>
          <input
            id="username"
            type="text"
            placeholder="사용자 이름을 입력하세요"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" disabled={loading} className="submit-button">
          {loading ? '로그인 중...' : '로그인'}
        </button>
        
        <div className="auth-links">
          <Link to="/register">회원가입</Link>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;