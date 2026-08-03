# Borderless — Frontend

경계 없는 화상 회의. React + Vite + TypeScript + LiveKit. iOS 27 Liquid Glass UI.

기능: 화상통화, 참여코드(생성/입장), 실시간 번역 자막(OpenAI). 백엔드(토큰·STT)는 별도 서비스 — [ms_backend](https://github.com/astern655/ms_backend).

## 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:5173
```

`.env.local`:
- `VITE_LIVEKIT_URL` — LiveKit Cloud 프로젝트 URL
- `VITE_API_BASE` — 백엔드 서비스 URL (예: http://localhost:3001)

백엔드가 함께 떠 있어야 입장·자막이 동작한다.

## 구조
- `src/App.tsx` — join ↔ room 전환
- `src/components/` — JoinScreen / RoomView / Captions / icons
- `src/lib/` — roomCode / caption / mic / api
