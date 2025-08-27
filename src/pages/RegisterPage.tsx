import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ServerConfig } from '../types';
import { parseServerConfigs } from '../config/env';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    
    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${selectedServer.url}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      if (response.ok) {
        alert('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.');
        navigate('/login');
      } else {
        const errorText = await response.text();
        alert(`회원가입에 실패했습니다: ${errorText || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('회원가입 오류:', error);
      alert('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="auth-header">
        <h1>회원가입</h1>
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
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        
        <div className="form-group">
          <label htmlFor="confirmPassword">비밀번호 확인</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" disabled={loading} className="submit-button">
          {loading ? '회원가입 중...' : '회원가입'}
        </button>
        
        <div className="auth-links">
          <Link to="/login">로그인으로 돌아가기</Link>
        </div>
      </form>
    </div>
  );
};

export default RegisterPage;