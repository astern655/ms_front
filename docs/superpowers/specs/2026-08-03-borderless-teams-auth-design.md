# Borderless — 계정 · 그룹/팀 · 지속 세션 설계 스펙 (B)

작성일: 2026-08-03
상태: 초안 (리뷰 대기)
전제: A(통화 화면 폴리시 — 레이아웃 분할·타일 유격·이름표·설정 애니메이션)는 별도 작업. 이 문서는 B만.

## 한 줄 정의
디스코드식 구조 + 조직 계층. **대표자가 그룹을 소유 → 그 아래 팀들 → 각 팀은 지속되는 화상 세션.** 팀에 회의 기록이 누적되어 협업이 이어지고 프로덕션이 진행된다. 인증·DB는 Supabase(Postgres).

## 핵심 원칙: 지속 세션
- 팀 = 일회성 방이 아니라 **상시 존재·재입장 가능한 세션**(팀 id = 고정 LiveKit 룸).
- 회의마다 자막/결론이 **팀에 누적** → "지난 회의에 정한 것"이 남아 다음 회의로 이어짐 → 요약·wiki·자동화(로드맵)의 입력.
- 역할은 **팀 단위**: 같은 사용자가 A팀 팀장 / B팀 팀원 가능.

## 데이터 모델 (Supabase Postgres)
```sql
-- 프로필 (auth.users 1:1)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  language text not null default 'ko',      -- ko | en | vi ...
  job_role text,                            -- 직군: frontend/backend/design/pm ...
  avatar_url text,
  created_at timestamptz default now()
);

create table groups (                       -- 그룹(조직). 소유자 = 대표자
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id),
  created_at timestamptz default now()
);

create table group_members (
  group_id uuid references groups on delete cascade,
  user_id uuid references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table teams (                        -- 팀 = 채널 = 지속 세션(고정 룸)
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table team_members (
  team_id uuid references teams on delete cascade,
  user_id uuid references profiles on delete cascade,
  role text not null default 'member',      -- 'lead' | 'member' (팀별 역할)
  created_at timestamptz default now(),
  primary key (team_id, user_id)
);

create table meetings (                     -- 세션 안의 개별 회의 이력
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table transcripts (                  -- 누적 회의록 (요약·wiki 입력 계약)
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  meeting_id uuid references meetings on delete cascade,
  speaker text not null,
  kind text not null default 'speech',      -- 'speech' | 'sign'
  source_lang text not null,
  source_text text not null,
  translations jsonb not null default '{}',
  ts timestamptz default now()
);
```
- LiveKit 룸 이름 = `team:<team_id>` (팀 = 지속 룸).

## RLS (행 수준 보안)
- `profiles`: 본인 행만 update, 인증자는 read.
- `groups`/`teams`: 소속 멤버만 select. group insert = 인증자(생성자가 owner=대표자). team insert/update/delete = 그룹 owner 또는 팀 lead.
- `team_members`: 팀 lead/그룹 owner가 관리. 본인 소속 행 read.
- `transcripts`: 팀 멤버만 select/insert.
- 정책은 마이그레이션에 `create policy`로 작성(구현 단계에서 상세화).

## 인증 흐름 (Supabase Auth)
- 방식: **이메일+비밀번호 + Google OAuth**(기본안).
- 회원가입 → Supabase Auth 사용자 생성 → **온보딩: 프로필 작성**(이름·언어·직군) → `profiles` insert.
- 세션은 Supabase가 관리(JWT). 프런트 `@supabase/supabase-js`.

## 기존 앱과의 통합
- 로그인 후: **디스코드식 좌측 레일**(그룹 목록 → 팀 목록) → 팀 클릭 → 그 팀 지속 세션 입장(현재 화상+자막+채팅 UI 재사용).
- **LiveKit 토큰 게이팅**: 프런트가 Supabase JWT를 백엔드(`/api/token`)에 전달 → 백엔드가 JWT 검증 + `team_members`로 소속 확인 → 그 팀 룸 토큰 발급(아무나 남 팀 못 들어옴).
- **회의록**: 자막 파이프라인이 각 entry를 `transcripts`에 insert(팀·미팅 단위). 회의 시작 시 `meetings` 행 생성.
- 기존 "코드로 빠른 입장"은 로그인 없는 **게스트 입장용**으로 병행 유지(선택).

## 프런트 구조 (신규/변경)
- `lib/supabase.ts` — supabase 클라이언트(URL + anon key)
- 라우팅: 비로그인 → 로그인/회원가입 → 온보딩(프로필) → 앱 셸(좌측 레일 + 메인)
- `components/auth/*` — 로그인·회원가입·온보딩
- `components/nav/*` — 그룹 레일 · 팀 목록 · 그룹/채널 관리(생성·이름변경·멤버/역할)
- 기존 `RoomView` = 팀 세션 화면으로 재사용(룸 이름 = team id)

## 백엔드 변경 (Express)
- `/api/token`: `Authorization: Bearer <supabase jwt>` + `teamId` 받기 → Supabase에서 JWT 검증 + 멤버십 확인 → LiveKit 토큰 발급.
- (선택) `/api/transcript`: 클라이언트 대신 서버가 저장하고 싶을 때. MVP는 프런트에서 Supabase로 직접 insert(RLS로 보호)해도 됨.
- 필요 env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(JWT 검증/관리용, 백엔드 전용).

## 시크릿 / 환경변수
- 프런트: `VITE_SUPABASE_URL=https://iqvatbxcvriwxclfxeln.supabase.co`, `VITE_SUPABASE_ANON_KEY=...`(공개 가능)
- 백엔드: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(비밀), 기존 LiveKit/OpenAI 키
- anon key는 클라 번들에 들어가도 안전(RLS로 보호). service_role은 **절대 프런트/커밋 금지**.

## MVP 컷라인 (B)
- ✅: 회원가입/로그인(이메일+비번) + 프로필 온보딩 / 그룹·팀 생성·목록 / 팀 멤버·역할 / 팀 세션 입장(토큰 게이팅) / 회의록 Supabase 누적
- 📋 후속: Google OAuth, 팀 안 서브채널(텍스트/화상 분리), 초대 링크, 권한 세분화, 요약·wiki 자동화, A 폴리시

## 결정된 사항
- 계층: 그룹(대표자) → 팀(지속 세션) → 팀별 역할
- 프로필: 이름·언어·직군
- DB/인증: Supabase(Postgres + Auth + RLS)
- 회의록: Supabase `transcripts`에 팀별 누적 (클라 JSON 다운로드는 폐기)

## 열린 질문
- Google OAuth를 MVP에 포함할지(기본: 후속)
- 팀 안 서브채널 필요 시점(기본: 후속, 지금은 팀=세션 1개)
- 게스트 코드 입장 유지 여부(기본: 유지)
