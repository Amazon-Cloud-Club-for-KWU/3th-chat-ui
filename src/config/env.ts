// 환경 변수 설정
export const ENV = {
  // API 설정
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080',
  WS_BASE_URL: process.env.REACT_APP_WS_BASE_URL || 'http://localhost:8080',
  
  // 서버 설정
  SERVER_NAME: process.env.REACT_APP_SERVER_NAME || '로컬 서버',
  
  // 앱 설정
  APP_NAME: process.env.REACT_APP_NAME || '3th Chat',
  APP_VERSION: process.env.REACT_APP_VERSION || '1.0.0',
  
  // 개발 설정
  DEBUG: process.env.REACT_APP_DEBUG === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // 채팅 설정
  MESSAGE_PAGE_SIZE: parseInt(process.env.REACT_APP_MESSAGE_PAGE_SIZE || '20'),
  WS_RECONNECT_DELAY: parseInt(process.env.REACT_APP_WS_RECONNECT_DELAY || '5000'),
  
  // UI 설정
  NOTIFICATION_ENABLED: process.env.REACT_APP_NOTIFICATION_ENABLED !== 'false',
};

// 웹소켓 URL을 환경에 맞게 생성하는 함수
export const getWebSocketUrl = (serverUrl: string): string => {
  try {
    const url = new URL(serverUrl);
    
    // 프로토콜 자동 감지
    if (url.protocol === 'https:' || window.location.protocol === 'https:') {
      // HTTPS 환경에서는 WSS 사용
      return `wss://${url.host}${url.pathname}`;
    } else {
      // HTTP 환경에서는 WS 사용
      return `ws://${url.host}${url.pathname}`;
    }
  } catch (error) {
    console.warn('URL 파싱 실패, 기본값 사용:', error);
    
    // URL 파싱 실패 시 현재 페이지 프로토콜 기반으로 추정
    if (window.location.protocol === 'https:') {
      // HTTPS 환경에서 localhost가 아닌 경우
      if (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) {
        return `ws://${serverUrl.replace(/^https?:\/\//, '')}`;
      } else {
        return `wss://${serverUrl.replace(/^https?:\/\//, '')}`;
      }
    } else {
      return `ws://${serverUrl.replace(/^https?:\/\//, '')}`;
    }
  }
};

// SockJS URL을 환경에 맞게 생성하는 함수
export const getSockJSUrl = (serverUrl: string): string => {
  try {
    const url = new URL(serverUrl);
    
    // SockJS는 HTTP/HTTPS 프로토콜을 그대로 사용
    // SockJS가 내부적으로 적절한 웹소켓 프로토콜을 선택함
    return serverUrl;
  } catch (error) {
    console.warn('SockJS URL 생성 실패:', error);
    return serverUrl;
  }
};

// 여러 서버 설정을 파싱하는 함수
export const parseServerConfigs = (): ServerConfig[] => {
  try {
    // 환경 변수에서 서버 목록 파싱
    const serversEnv = process.env.REACT_APP_SERVERS;
    if (serversEnv) {
      const servers = JSON.parse(serversEnv);
      return servers.map((server: any) => ({
        name: server.name || 'Unknown Server',
        url: server.url || 'http://localhost:8080'
      }));
    }
    
    // 기본 서버 설정
    return [
      {
        name: ENV.SERVER_NAME,
        url: ENV.API_BASE_URL
      }
    ];
  } catch (error) {
    console.warn('서버 설정 파싱 실패, 기본값 사용:', error);
    return [
      {
        name: ENV.SERVER_NAME,
        url: ENV.API_BASE_URL
      }
    ];
  }
};

// 서버 설정 타입 정의
export interface ServerConfig {
  name: string;
  url: string;
}

// 환경별 설정 검증
export const validateEnv = () => {
  const required = ['REACT_APP_API_BASE_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing);
    console.warn('Using default values for missing variables');
  }
  
  // 서버 설정 파싱 테스트
  const servers = parseServerConfigs();
  console.log('Available servers:', servers);
  
  // 웹소켓 URL 테스트
  const testServerUrl = ENV.API_BASE_URL;
  const wsUrl = getWebSocketUrl(testServerUrl);
  const sockJsUrl = getSockJSUrl(testServerUrl);
  
  // 웹소켓 지원 상태 확인
  const wsSupport = checkWebSocketSupport();
  const wsIssues = diagnoseWebSocketIssues(testServerUrl);
  
  console.log('Environment configuration:', {
    NODE_ENV: ENV.NODE_ENV,
    API_BASE_URL: ENV.API_BASE_URL,
    WS_BASE_URL: ENV.WS_BASE_URL,
    DEBUG: ENV.DEBUG,
    SERVER_COUNT: servers.length,
    CURRENT_PROTOCOL: window.location.protocol,
    WEBSOCKET_URL: wsUrl,
    SOCKJS_URL: sockJsUrl,
    WEBSOCKET_SUPPORT: wsSupport.supported,
    WEBSOCKET_ISSUES: wsIssues
  });
  
  // 웹소켓 문제가 있으면 경고
  if (wsIssues.length > 0) {
    console.warn('WebSocket 연결 문제 감지:', wsIssues);
  }
  
  if (!wsSupport.supported) {
    console.error('WebSocket 지원 문제:', wsSupport.details);
  }
};

// 웹소켓 연결 문제 진단 함수
export const diagnoseWebSocketIssues = (serverUrl: string): string[] => {
  const issues: string[] = [];
  
  try {
    const url = new URL(serverUrl);
    const currentProtocol = window.location.protocol;
    
    // 프로토콜 불일치 확인
    if (currentProtocol === 'https:' && url.protocol === 'http:') {
      issues.push('⚠️ HTTPS 페이지에서 HTTP 서버로 연결 시도 중. 보안 정책으로 차단될 수 있습니다.');
    }
    
    // 로컬호스트 확인
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      if (currentProtocol === 'https:') {
        issues.push('⚠️ HTTPS 환경에서 localhost 서버 연결 시도 중. 인증서 문제가 발생할 수 있습니다.');
      }
    }
    
    // 포트 확인
    if (!url.port && currentProtocol === 'https:') {
      issues.push('ℹ️ HTTPS 환경에서 기본 포트(443) 사용 중입니다.');
    }
    
    // CORS 확인
    if (url.origin !== window.location.origin) {
      issues.push('ℹ️ 다른 도메인으로 연결 시도 중. CORS 설정이 필요할 수 있습니다.');
    }
    
  } catch (error) {
    issues.push('❌ URL 파싱 실패. 올바른 URL 형식을 확인해주세요.');
  }
  
  // 브라우저 지원 확인
  if (!window.WebSocket) {
    issues.push('❌ 브라우저가 WebSocket을 지원하지 않습니다.');
  }
  
  // SockJS 지원 확인 (타입 안전하게)
  if (typeof (window as any).SockJS === 'undefined') {
    issues.push('❌ SockJS가 로드되지 않았습니다.');
  }
  
  return issues;
};

// 웹소켓 연결 상태 확인 함수
export const checkWebSocketSupport = (): {
  supported: boolean;
  details: string[];
} => {
  const details: string[] = [];
  let supported = true;
  
  // WebSocket 지원 확인
  if (typeof WebSocket === 'undefined') {
    details.push('WebSocket API가 지원되지 않습니다.');
    supported = false;
  } else {
    details.push('✅ WebSocket API 지원됨');
  }
  
  // SockJS 지원 확인 (타입 안전하게)
  if (typeof (window as any).SockJS === 'undefined') {
    details.push('SockJS가 로드되지 않았습니다.');
    supported = false;
  } else {
    details.push('✅ SockJS 지원됨');
  }
  
  // STOMP 클라이언트 확인
  try {
    // @stomp/stompjs가 로드되었는지 확인
    if (typeof window !== 'undefined' && (window as any).Stomp) {
      details.push('✅ STOMP 클라이언트 지원됨');
    } else {
      details.push('⚠️ STOMP 클라이언트 확인 필요');
    }
  } catch (error) {
    details.push('⚠️ STOMP 클라이언트 확인 실패');
  }
  
  return { supported, details };
};

export default ENV;
