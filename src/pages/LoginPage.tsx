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
  const [showCustomServer, setShowCustomServer] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [customServerName, setCustomServerName] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<ServerConfig | null>(null);
  const [defaultServers] = useState<ServerConfig[]>(() => parseServerConfigs());
  const navigate = useNavigate();

  // localStorage 키
  const CUSTOM_SERVERS_KEY = 'chat_custom_servers';
  const LAST_SELECTED_SERVER_KEY = 'chat_last_selected_server';

  // localStorage에서 사용자 정의 서버 불러오기
  const loadCustomServers = (): ServerConfig[] => {
    try {
      const stored = localStorage.getItem(CUSTOM_SERVERS_KEY);
      const result = stored ? JSON.parse(stored) : [];
      console.log('📥 사용자 정의 서버 로드:', result);
      return result;
    } catch (error) {
      console.error('사용자 정의 서버 로드 실패:', error);
      return [];
    }
  };

  // localStorage 가용성 체크
  const isLocalStorageAvailable = () => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  };

  // localStorage에 사용자 정의 서버 저장
  const saveCustomServers = (customServers: ServerConfig[]) => {
    if (!isLocalStorageAvailable()) {
      console.error('❌ localStorage 사용 불가! (개인정보 보호 모드일 수 있음)');
      alert('브라우저 설정에서 로컬 저장소가 제한되어 있습니다. 서버 설정이 저장되지 않을 수 있습니다.');
      return;
    }

    try {
      console.log('💾 사용자 정의 서버 저장 시도:', customServers);
      const jsonString = JSON.stringify(customServers);
      console.log('📄 저장할 JSON 문자열:', jsonString);
      
      localStorage.setItem(CUSTOM_SERVERS_KEY, jsonString);
      
      // 즉시 확인
      const saved = localStorage.getItem(CUSTOM_SERVERS_KEY);
      console.log('✅ 저장 후 즉시 확인:', saved);
      
      if (saved === jsonString) {
        console.log('✅ 저장 성공!');
      } else {
        console.error('❌ 저장 실패! 예상:', jsonString, '실제:', saved);
      }
    } catch (error) {
      console.error('❌ 사용자 정의 서버 저장 실패:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert('브라우저 저장 공간이 부족합니다. 일부 데이터를 삭제하고 다시 시도해주세요.');
      }
    }
  };

  // 마지막 선택 서버 저장
  const saveLastSelectedServer = (server: ServerConfig) => {
    if (!isLocalStorageAvailable()) {
      console.warn('⚠️ localStorage 사용 불가 - 마지막 선택 서버 저장 건너뜀');
      return;
    }

    try {
      console.log('🎯 마지막 선택 서버 저장:', server);
      localStorage.setItem(LAST_SELECTED_SERVER_KEY, JSON.stringify(server));
    } catch (error) {
      console.error('❌ 마지막 선택 서버 저장 실패:', error);
    }
  };

  // 마지막 선택 서버 불러오기
  const loadLastSelectedServer = (): ServerConfig | null => {
    try {
      const stored = localStorage.getItem(LAST_SELECTED_SERVER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('마지막 선택 서버 로드 실패:', error);
      return null;
    }
  };

  const removeCustomServer = (serverUrl: string) => {
    // 상태에서 제거
    setServers(prev => {
      const updated = prev.filter(s => s.url !== serverUrl);
      
      // localStorage에서도 제거
      console.log('🗑️ 삭제 후 필터링 전 전체 서버:', updated);
      console.log('🗑️ 기본 서버 목록:', defaultServers);
      
      const customServers = updated.filter(s => {
        const isCustomOption = s.url === 'custom';
        const isDefaultServer = defaultServers.find(defaultServer => defaultServer.url === s.url);
        const shouldKeep = !isCustomOption && !isDefaultServer;
        
        console.log(`🗑️ 서버 "${s.name}" (${s.url}): custom옵션=${isCustomOption}, 기본서버=${!!isDefaultServer}, 저장=${shouldKeep}`);
        
        return shouldKeep;
      });
      
      console.log('🗑️ 필터링 후 저장할 사용자 정의 서버:', customServers);
      saveCustomServers(customServers);
      
      return updated;
    });
    
    if (selectedServer?.url === serverUrl) {
      const defaultServers = servers.filter(s => s.url !== 'custom' && s.url !== serverUrl);
      setSelectedServer(defaultServers.length > 0 ? defaultServers[0] : null);
    }
  };

  const handleDeleteConfirm = () => {
    if (serverToDelete) {
      removeCustomServer(serverToDelete.url);
      setShowDeleteConfirm(false);
      setServerToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setServerToDelete(null);
  };

  useEffect(() => {
    console.log('🔄 LoginPage useEffect 실행');
    
    // 디버깅용 전역 함수 노출
    (window as any).testLocalStorage = () => {
      console.log('🧪 localStorage 테스트 시작');
      try {
        localStorage.setItem('test_key', 'test_value');
        const result = localStorage.getItem('test_key');
        console.log('✅ 기본 localStorage 테스트:', result === 'test_value' ? '성공' : '실패');
        localStorage.removeItem('test_key');
        
        console.log('🗝️ 현재 저장된 사용자 서버:', localStorage.getItem(CUSTOM_SERVERS_KEY));
        console.log('🗝️ 현재 저장된 마지막 선택:', localStorage.getItem(LAST_SELECTED_SERVER_KEY));
        
        const allKeys = Object.keys(localStorage);
        console.log('📋 localStorage 전체 키 목록:', allKeys);
      } catch (error) {
        console.error('❌ localStorage 테스트 실패:', error);
      }
    };
    
    console.log('💡 브라우저 콘솔에서 testLocalStorage() 함수를 실행해보세요');
    
    const customServers = loadCustomServers();
    
    console.log('🔧 기본 서버:', defaultServers);
    console.log('👤 사용자 정의 서버:', customServers);
    
    // 모든 서버 합치기 (기본 + 사용자 정의 + 옵션)
    const allServers = [
      ...defaultServers,
      ...customServers,
      { name: '사용자 정의 서버', url: 'custom' }
    ];
    
    console.log('📋 전체 서버 목록:', allServers);
    setServers(allServers);
    
    // 마지막 선택 서버 복원 시도
    const lastSelectedServer = loadLastSelectedServer();
    console.log('🎯 마지막 선택 서버:', lastSelectedServer);
    
    if (lastSelectedServer && allServers.find(s => s.url === lastSelectedServer.url)) {
      const foundServer = allServers.find(s => s.url === lastSelectedServer.url);
      console.log('✅ 마지막 서버 복원:', foundServer);
      setSelectedServer(foundServer || null);
    } else {
      // 마지막 서버가 없거나 유효하지 않으면 기본 선택
      if (customServers.length > 0) {
        console.log('🎯 첫 번째 사용자 정의 서버 선택:', customServers[0]);
        setSelectedServer(customServers[0]);
      } else if (defaultServers.length > 0) {
        console.log('🎯 첫 번째 기본 서버 선택:', defaultServers[0]);
        setSelectedServer(defaultServers[0]);
      }
    }
  }, [defaultServers]);

  const testConnection = async (url: string) => {
    setTestingConnection(true);
    setConnectionStatus('unknown');
    
    try {
      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        mode: 'cors',
        signal: AbortSignal.timeout(5000) // 5초 타임아웃
      });
      
      if (response.ok || response.status < 500) {
        setConnectionStatus('success');
        return true;
      } else {
        setConnectionStatus('error');
        return false;
      }
    } catch (error) {
      console.error('연결 테스트 실패:', error);
      // 대체 API로 테스트
      try {
        const fallbackResponse = await fetch(`${url}/api/chats`, {
          method: 'GET',
          mode: 'cors',
          signal: AbortSignal.timeout(5000)
        });
        
        if (fallbackResponse.status < 500) {
          setConnectionStatus('success');
          return true;
        }
      } catch (fallbackError) {
        console.error('대체 연결 테스트도 실패:', fallbackError);
      }
      
      setConnectionStatus('error');
      return false;
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCustomServerAdd = async () => {
    if (!customServerUrl.trim()) {
      alert('서버 URL을 입력해주세요.');
      return;
    }
    
    const url = customServerUrl.trim();
    const name = customServerName.trim() || '사용자 정의 서버';
    
    const success = await testConnection(url);
    if (success) {
      const customServer = { name, url };
      
      // 서버 목록에 새 서버 추가 (중복 제거)
      setServers(prev => {
        const existingIndex = prev.findIndex(s => s.url === url);
        let updated: ServerConfig[];
        
        if (existingIndex !== -1) {
          // 기존 서버가 있으면 업데이트
          updated = [...prev];
          updated[existingIndex] = customServer;
        } else {
          // 새 서버 추가 (사용자 정의 서버 옵션 전에)
          const filtered = prev.filter(s => s.url !== 'custom');
          updated = [...filtered, customServer, { name: '사용자 정의 서버', url: 'custom' }];
        }
        
        // localStorage에 사용자 정의 서버만 저장
        console.log('🔍 필터링 전 전체 서버:', updated);
        console.log('🔍 기본 서버 목록:', defaultServers);
        
        const customServers = updated.filter(s => {
          const isCustomOption = s.url === 'custom';
          const isDefaultServer = defaultServers.find(defaultServer => defaultServer.url === s.url);
          const shouldKeep = !isCustomOption && !isDefaultServer;
          
          console.log(`🔍 서버 "${s.name}" (${s.url}): custom옵션=${isCustomOption}, 기본서버=${!!isDefaultServer}, 저장=${shouldKeep}`);
          
          return shouldKeep;
        });
        
        console.log('🔍 필터링 후 저장할 사용자 정의 서버:', customServers);
        saveCustomServers(customServers);
        
        return updated;
      });
      
      setSelectedServer(customServer);
      saveLastSelectedServer(customServer);
      setShowCustomServer(false);
      setCustomServerUrl('');
      setCustomServerName('');
      setConnectionStatus('unknown');
      alert('서버가 성공적으로 추가되었습니다!');
    } else {
      alert('서버에 연결할 수 없습니다. URL을 확인해주세요.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let serverToUse = selectedServer;
    
    // 사용자 정의 서버인 경우
    if (showCustomServer && customServerUrl.trim()) {
      if (connectionStatus !== 'success') {
        alert('먼저 서버 연결 테스트를 성공적으로 완료해주세요.');
        return;
      }
      serverToUse = {
        name: customServerName.trim() || '사용자 정의 서버',
        url: customServerUrl.trim()
      };
    }
    
    if (!serverToUse) {
      alert('서버를 선택하거나 사용자 정의 서버를 설정해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${serverToUse.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        
        // 사용자 정보 조회
        const userResponse = await fetch(`${serverToUse.url}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${data.accessToken}` }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          
          // localStorage에 저장
          localStorage.setItem('chat_access_token', data.accessToken);
          localStorage.setItem('chat_user', JSON.stringify(userData));
          localStorage.setItem('chat_selected_server', JSON.stringify(serverToUse));
          
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
      alert(`서버 연결에 실패했습니다: ${serverToUse.url}`);
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
          <div className="server-select-container">
            <select
              id="server"
              value={selectedServer?.name || ''}
              onChange={(e) => {
                const serverName = e.target.value;
                if (serverName === '사용자 정의 서버') {
                  setShowCustomServer(true);
                  setSelectedServer(null);
                } else {
                  const server = servers.find(s => s.name === serverName);
                  if (server) {
                    setSelectedServer(server);
                    saveLastSelectedServer(server);
                  } else {
                    setSelectedServer(null);
                  }
                  setShowCustomServer(false);
                }
              }}
              required
            >
              <option value="">서버를 선택해주세요</option>
              {servers.map((server) => (
                <option key={server.url} value={server.name}>
                  {server.name} {server.url !== 'custom' && !defaultServers.find(s => s.url === server.url) ? '(사용자 추가)' : ''}
                </option>
              ))}
            </select>
            {selectedServer && selectedServer.url !== 'custom' && !defaultServers.find(s => s.url === selectedServer.url) && (
              <button
                type="button"
                className="remove-server-button"
                onClick={() => {
                  setServerToDelete(selectedServer);
                  setShowDeleteConfirm(true);
                }}
                title="서버 제거"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {showCustomServer && (
          <div className="custom-server-section">
            <div className="form-group">
              <label htmlFor="customServerName">서버 이름 (선택사항)</label>
              <input
                id="customServerName"
                type="text"
                placeholder="예: 내 개인 서버"
                value={customServerName}
                onChange={(e) => setCustomServerName(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="customServerUrl">서버 URL *</label>
              <div className="input-with-button">
                <input
                  id="customServerUrl"
                  type="url"
                  placeholder="예: http://localhost:8080 또는 https://my-server.com"
                  value={customServerUrl}
                  onChange={(e) => {
                    setCustomServerUrl(e.target.value);
                    setConnectionStatus('unknown');
                  }}
                  required
                />
                <button
                  type="button"
                  className="test-connection-button"
                  onClick={() => testConnection(customServerUrl)}
                  disabled={!customServerUrl.trim() || testingConnection}
                >
                  {testingConnection ? '테스트 중...' : '연결 테스트'}
                </button>
              </div>
              
              {connectionStatus === 'success' && (
                <div className="connection-result success">
                  <span>✓ 서버 연결 성공!</span>
                </div>
              )}
              
              {connectionStatus === 'error' && (
                <div className="connection-result error">
                  <span>✗ 서버에 연결할 수 없습니다. URL을 확인해주세요.</span>
                </div>
              )}
            </div>
            
            <div className="custom-server-actions">
              <button
                type="button"
                className="cancel-custom-button"
                onClick={() => {
                  setShowCustomServer(false);
                  setCustomServerUrl('');
                  setCustomServerName('');
                  setConnectionStatus('unknown');
                  if (servers.length > 1) {
                    setSelectedServer(servers[0]);
                  }
                }}
              >
                취소
              </button>
              
              <button
                type="button"
                className="add-custom-button"
                onClick={handleCustomServerAdd}
                disabled={!customServerUrl.trim() || testingConnection || connectionStatus !== 'success'}
              >
                서버 추가
              </button>
            </div>
          </div>
        )}

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
        
        <button 
          type="submit" 
          disabled={loading || (!selectedServer && !showCustomServer)} 
          className="submit-button"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
        
        <div className="auth-links">
          <Link to="/register">회원가입</Link>
        </div>
      </form>

      {/* 서버 삭제 확인 모달 */}
      {showDeleteConfirm && serverToDelete && (
        <div className="elegant-modal-overlay" onClick={handleDeleteCancel}>
          <div className="elegant-modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon danger">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2>서버 제거</h2>
              <p>'{serverToDelete.name}' 서버를 제거하시겠습니까?</p>
            </div>
            
            <div className="modal-actions">
              <button 
                type="button" 
                className="elegant-button secondary"
                onClick={handleDeleteCancel}
              >
                취소
              </button>
              <button 
                type="button" 
                className="elegant-button danger"
                onClick={handleDeleteConfirm}
              >
                제거
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;