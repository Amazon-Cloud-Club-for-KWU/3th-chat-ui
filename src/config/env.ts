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
  
  console.log('Environment configuration:', {
    NODE_ENV: ENV.NODE_ENV,
    API_BASE_URL: ENV.API_BASE_URL,
    WS_BASE_URL: ENV.WS_BASE_URL,
    DEBUG: ENV.DEBUG,
    SERVER_COUNT: servers.length
  });
};

export default ENV;
