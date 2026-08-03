# Borderless — 실시간 번역 레이어 Implementation Plan (React + Vite)

> **For agentic workers:** 남은 작업은 아래 "남은 Task"의 checkbox(`- [ ]`)로 추적. 앞부분은 as-built 기록.

**Goal:** 화상회의에서 음성은 거의 실시간 번역 자막으로, 수화는 큐레이션 어휘 인식 자막으로 표시하고, 전체를 transcript(JSON)로 저장하는 웹앱.

**Architecture:** **React + Vite SPA**. LiveKit이 화상 + data 채널을 담당. 각 클라이언트가 자기 마이크 오디오를 4초 청크로 잘라 **Vite dev 미들웨어**(`/api/stt`)로 보내 OpenAI STT+번역을 거치고, 결과 자막을 LiveKit data 메시지로 룸 전체에 브로드캐스트한다. 수화는 브라우저에서 MediaPipe 랜드마크 → KNN 분류로 인식해 같은 자막 경로에 합류한다. 자막은 transcript로 누적되어 JSON으로 내보낸다. 다운스트림(에이전트·요약·wiki)은 이 JSON을 소비하는 별도 작업으로 디커플링.

**Tech Stack:** React 19 + Vite + TypeScript(strict), LiveKit (`livekit-client`, `@livekit/components-react`, `livekit-server-sdk`), OpenAI SDK(`openai`), MediaPipe(`@mediapipe/tasks-vision`), Playwright(브라우저 검증).

## Global Constraints

- Node 24.x / npm 11.x. 새 의존성은 npm으로.
- TypeScript strict.
- AI 외부 API는 **OpenAI만** (STT: `gpt-4o-transcribe`, 번역: `gpt-4o-mini`).
- 실시간: **LiveKit Cloud**. 필수 env(`.env.local`): `VITE_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `OPENAI_API_KEY`.
  - 클라이언트 노출용은 `VITE_` 접두사만. 키(LiveKit secret / OpenAI)는 접두사 없이 → dev 미들웨어(서버)에서만 접근.
- 백엔드 = **Vite dev 미들웨어**(`vite.config.ts`의 `configureServer`). dev 전용. 배포 시 독립 서버로 분리 필요(로드맵).
- 초기 언어: 한국어(`ko`), 영어(`en`).
- 수화: KSL, 데모 큐레이션 어휘. few-shot KNN(무거운 학습 없음).
- 시크릿 커밋 금지(`.env.local`은 `.gitignore`).
- transcript 저장 형식은 `TranscriptEntry` 타입 고정 — 다운스트림 계약.

## 파일 맵 (실제 구조)

```
vite.config.ts            # react() + dev 미들웨어 /api/token, /api/stt
server/stt.ts             # transcribeAndTranslate (OpenAI STT+번역, 서버 전용)
src/
  App.tsx                 # join <-> room 전환, 토큰 fetch, 세션(name/lang/code) 보관
  index.css               # iOS 27 Liquid Glass 디자인 토큰/클래스
  lib/
    roomCode.ts           # generateRoomCode / normalizeRoomCode (코드=룸ID)
    caption.ts            # TranscriptEntry 타입 + encode/decodeCaption
    mic.ts                # startMic: 마이크 청크→/api/stt→data 브로드캐스트
    sign/                 # (남은 작업) knn.ts, vocab.json, samples.json
  components/
    JoinScreen.tsx        # 세그먼티드(만들기|참여) + 이름 + 언어 선택 + 코드 생성/복사
    RoomView.tsx          # 커스텀 유리 레이아웃(GridLayout+ParticipantTile) + 컨트롤바 + 코드 pill + Captions
    Captions.tsx          # 로컬(마이크)+원격(DataReceived) 자막을 내 언어로 렌더
    icons.tsx             # SF 스타일 라인 아이콘
```

## 구현 현황 (as-built)

- ✅ **Task A. 화상통화** — LiveKit 룸, 커스텀 레이아웃. 실통화에서 카메라·마이크·화면공유·연결 검증.
- ✅ **Task B. 참여코드** — `roomCode.ts`(코드=룸ID, 별도 DB 없음), JoinScreen 만들기/참여, 코드 pill+복사. 생성 코드로 실접속 검증.
- ✅ **Task C. iOS 27 Liquid Glass 디자인** — `index.css` 유리 머티리얼, 컨트롤바/세그먼티드/둥근 타일. 실영상 위 렌더 검증.
- 🟡 **Task D. 실시간 번역 자막** — `server/stt.ts` + `/api/stt` 미들웨어 + `mic.ts` + `caption.ts` + `Captions.tsx` + 언어 선택. 빌드·배선 통과. **실전사/번역 검증은 `OPENAI_API_KEY` 투입 후 진행.**

---

## 남은 Task

### Task E: 수화 인식 (MediaPipe + few-shot KNN) → 자막 합류

**Files:**
- Create: `src/lib/sign/knn.ts`, `src/lib/sign/vocab.json`, `src/lib/sign/samples.json`, `src/components/SignInput.tsx`
- Modify: `src/components/RoomView.tsx` (수화 사용자에 SignInput 마운트), `src/App.tsx`/`JoinScreen.tsx` (수화 모드 플래그 전달)

**Interfaces:**
- `classify(vec: number[], samples: {label:string; vec:number[]}[], k?: number, maxDist?: number): string | null`
- `<SignInput speaker displayLang />` — 카메라 랜드마크 → classify → vocab 매핑 → `TranscriptEntry(kind:'sign')` publish + 로컬 렌더(기존 caption 경로 재사용).

- [ ] Step 1: `classify` 순수 함수 + 최근접 이웃 테스트(작은 벡터 fixture로 검증; vitest 없으면 임시 node 스크립트로 assert).
- [ ] Step 2: MediaPipe HandLandmarker(브라우저, CDN wasm) 로드 → `normalize(landmarks)`(손목 기준 상대좌표) → `classify`.
- [ ] Step 3: `vocab.json`(label→KSL 자연어), `samples.json`(데모 전 캡처한 참조 벡터; 비면 인식 없음 — 정직 표기).
- [ ] Step 4: RoomView에 `?sign=1` 또는 언어=수화 선택 시 SignInput 마운트, 기존 `Captions`/data 경로로 자막 합류.
- [ ] Step 5: 브라우저 검증 — samples 시드 후 큐레이션 동작 → 상대 자막에 어휘 표시. (시드 전이면 그 사실 명시)

> ponytail: 자유 문장 통역 아님 — vocab 내 인식만. samples 없으면 아무것도 안 뜸(정상).

### Task F: Transcript 누적 + 회의록 JSON 내보내기

**Files:**
- Create: `src/lib/transcript.ts`(store: add/entries/toJSON), `src/components/TranscriptRecorder.tsx`
- Modify: `src/components/RoomView.tsx`(마운트), `src/components/Captions.tsx`(수신 자막도 누적 대상에 포함)

**Interfaces:**
- `createTranscript(): { add(e:TranscriptEntry):void; entries():TranscriptEntry[]; toJSON():string }`
- "회의록 저장" 버튼 → `toJSON()` 파일 다운로드. 이 JSON이 다운스트림 입력 계약.

- [ ] Step 1: `createTranscript` + 순서 보존/JSON 왕복 테스트.
- [ ] Step 2: Captions가 받는 로컬+원격 자막을 TranscriptRecorder가 구독해 누적(현재 Captions state는 최근 몇 개만 유지하므로 별도 누적 필요).
- [ ] Step 3: 저장 버튼(유리 아이콘 버튼) → JSON 다운로드.
- [ ] Step 4: 브라우저 검증 — 2인 몇 문장 → 저장 → JSON에 양쪽 발화가 `TranscriptEntry`로 시간순 저장 확인.

---

## 로드맵 (이 계획 밖)
견고한 양방향 수화, 3D 아바타, 온보딩 프로필(4경계 선언), 에이전트·요약·llmwiki·"proceed" 자동화, 배포용 독립 백엔드.
