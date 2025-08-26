# 3th Chat UI

실시간 채팅 애플리케이션의 프론트엔드입니다.

## 설치 및 실행

```bash
npm install
npm start
```

## 환경 변수 설정

### 개발 환경
```bash
# .env.local 파일 생성
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_WS_BASE_URL=http://localhost:8080
REACT_APP_DEBUG=true
```

### 배포 환경
```bash
# .env.production 파일 생성
REACT_APP_API_BASE_URL=https://your-domain.com
REACT_APP_WS_BASE_URL=https://your-domain.com
REACT_APP_DEBUG=false
NODE_ENV=production
```

### 웹소켓 연결 문제 해결

배포환경에서 웹소켓 연결이 안 되는 경우:

1. **프로토콜 확인**: HTTPS 환경에서는 자동으로 WSS 프로토콜을 사용합니다
2. **방화벽 설정**: 웹소켓 포트(보통 80/443)가 열려있는지 확인
3. **프록시 설정**: Nginx나 Apache에서 웹소켓 프록시 설정 확인
4. **CORS 설정**: 서버에서 웹소켓 엔드포인트의 CORS 허용 확인

### Nginx 웹소켓 프록시 설정 예시

```nginx
location /ws-chat {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 주요 기능

- 실시간 채팅
- 채팅방 관리
- 사용자 인증
- 메시지 히스토리
- 웹소켓 자동 재연결
