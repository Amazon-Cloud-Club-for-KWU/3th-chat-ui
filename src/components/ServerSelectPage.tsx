import React, { useState } from 'react';
import { ServerConfig } from '../types';

interface ServerSelectPageProps {
  servers: ServerConfig[];
  onSelectServer: (server: ServerConfig) => void;
}

const ServerSelectPage: React.FC<ServerSelectPageProps> = ({ servers, onSelectServer }) => {
  const [customUrl, setCustomUrl] = useState('');
  const [testingConnections, setTestingConnections] = useState<{[key: string]: boolean}>({});
  const [connectionStatus, setConnectionStatus] = useState<{[key: string]: 'success' | 'error' | 'unknown'}>({});

  const testConnection = async (serverUrl: string, serverKey: string) => {
    setTestingConnections(prev => ({ ...prev, [serverKey]: true }));
    
    try {
      // 채팅 API를 직접 테스트 (인증 없이 401 응답이라도 서버가 살아있다는 뜻)
      const response = await fetch(`${serverUrl}/api/chats`, {
        method: 'GET',
        mode: 'cors'
      });
      
      // 401, 403, 404 등의 응답도 서버가 살아있다는 뜻
      if (response.status < 500) {
        setConnectionStatus(prev => ({ ...prev, [serverKey]: 'success' }));
      } else {
        setConnectionStatus(prev => ({ ...prev, [serverKey]: 'error' }));
      }
    } catch (error) {
      console.error(`서버 연결 테스트 실패 (${serverUrl}):`, error);
      
      // CORS 에러인지 네트워크 에러인지 구분
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setConnectionStatus(prev => ({ ...prev, [serverKey]: 'error' }));
      } else {
        setConnectionStatus(prev => ({ ...prev, [serverKey]: 'error' }));
      }
    } finally {
      setTestingConnections(prev => ({ ...prev, [serverKey]: false }));
    }
  };

  const handleServerSelect = async (server: ServerConfig) => {
    const serverKey = server.url;
    await testConnection(server.url, serverKey);
    
    // 연결 테스트 후 잠시 기다린 다음 선택
    setTimeout(() => {
      if (connectionStatus[serverKey] !== 'error') {
        onSelectServer(server);
      }
    }, 500);
  };

  const addCustomServer = async () => {
    if (customUrl.trim()) {
      const server = { name: '사용자 정의 서버', url: customUrl.trim() };
      await handleServerSelect(server);
    }
  };

  return (
    <div className="page-container">
      <h1>채팅 서버 선택</h1>
      <div className="server-list">
        {servers.map((server, index) => {
          const serverKey = server.url;
          const isConnecting = testingConnections[serverKey];
          const status = connectionStatus[serverKey];
          
          return (
            <button 
              key={index} 
              className={`server-item ${status === 'success' ? 'connected' : status === 'error' ? 'disconnected' : ''}`}
              onClick={() => handleServerSelect(server)}
              disabled={isConnecting}
            >
              <div className="server-info">
                <div className="server-name">{server.name}</div>
                <div className="server-url">{server.url}</div>
              </div>
              <div className="connection-status">
                {isConnecting && <span className="connecting">연결 테스트 중...</span>}
                {!isConnecting && status === 'success' && <span className="success">✓ 연결됨</span>}
                {!isConnecting && status === 'error' && <span className="error">✗ 연결 실패</span>}
                {!isConnecting && status === 'unknown' && (
                  <button 
                    className="test-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      testConnection(server.url, serverKey);
                    }}
                  >
                    연결 테스트
                  </button>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="custom-server">
        <h3>사용자 정의 서버</h3>
        <input
          type="text"
          placeholder="서버 URL을 입력하세요 (예: http://localhost:8080)"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addCustomServer()}
        />
        <button 
          onClick={addCustomServer}
          disabled={testingConnections[customUrl.trim()]}
        >
          {testingConnections[customUrl.trim()] ? '테스트 중...' : '연결 테스트'}
        </button>
      </div>
    </div>
  );
};

export default ServerSelectPage;
