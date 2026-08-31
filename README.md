# T Log

> Write · Discuss · Decide · Travel

**웹앱:** [https://rudwndgus.github.io/t-log/](https://rudwndgus.github.io/t-log/)

T Log는 친구들과 여행 아이디어를 쓰고, 대화와 투표로 결정하고, 확정된 일정을 지도 위에서 관리하는 iPhone 우선 협업 여행 PWA입니다.

## 주요 기능

- 초대 코드와 공유 링크가 있는 여행방 생성·참여
- 이메일 매직 링크 인증과 Supabase 기반 데이터 동기화
- 여행에 필요한 블록만 담은 모바일 노트 편집기
- 노트 블록·페이지를 채팅에 공유하거나 투표 제안으로 전환
- Mapbox 장소 검색, 번호 핀, 실제 도보 경로와 Google Maps 열기
- 날짜별 MAP/LIST 보기와 길게 눌러 일정 순서 변경
- 장소 사이 교통수단·시간·거리·메모 관리
- 실시간 채팅, 다중 선택지 투표, 승인된 장소를 일정으로 전환
- 앱 셸 오프라인 캐시, iOS safe area, 홈 화면 설치 지원
- 백엔드 키가 없을 때도 기기에서 사용할 수 있는 로컬 모드

## 기술 스택

React 19, TypeScript, Vite, Supabase Auth/PostgreSQL/Realtime, Mapbox GL JS, dnd-kit, vite-plugin-pwa, GitHub Actions, GitHub Pages

## 로컬 실행

Node.js 22 이상을 권장합니다.

```bash
git clone https://github.com/rudwndgus/t-log.git
cd t-log
npm install
cp .env.example .env.local
npm run dev
```

환경변수를 넣지 않으면 브라우저 `localStorage`를 사용하는 로컬 모드로 실행됩니다. 로컬 모드에서도 여행·노트·일정·채팅·투표 흐름은 동작하지만, 다른 사람과의 동기화 및 Mapbox 실지도는 비활성화됩니다.

## 환경변수

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MAPBOX_TOKEN=pk.your-public-mapbox-token
```

프런트엔드에는 Supabase `anon` 키와 Mapbox 공개 토큰만 사용하세요. Supabase `service_role` 키는 절대 넣지 마세요.

## Supabase 설정

1. [Supabase](https://supabase.com/)에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [`supabase/migrations/20260831000000_initial_schema.sql`](supabase/migrations/20260831000000_initial_schema.sql)을 실행합니다.
3. Authentication → URL Configuration에서 로컬 주소와 Pages 주소를 Redirect URLs에 추가합니다.
   - `http://localhost:5173`
   - `https://rudwndgus.github.io/t-log/`
4. Project Settings → API의 Project URL과 anon public key를 환경변수에 넣습니다.

마이그레이션은 여행 멤버만 데이터를 읽고 수정할 수 있도록 RLS를 활성화합니다. 여행 전체 삭제와 멤버 제거는 방장만 허용됩니다. 채팅, 투표, 일정, 멤버십 변경 테이블은 Realtime publication에도 등록됩니다.

Supabase CLI를 사용하는 경우:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Mapbox 설정

1. [Mapbox](https://account.mapbox.com/)에서 public access token을 만듭니다.
2. 토큰의 Allowed URLs에 로컬 주소와 `https://rudwndgus.github.io/t-log/*`를 추가합니다.
3. `VITE_MAPBOX_TOKEN`에 `pk.`로 시작하는 토큰을 넣습니다.

토큰을 설정하면 Mapbox GL 지도, Geocoding 검색, Directions 도보 경로가 활성화됩니다.

## GitHub Pages 배포

저장소의 Settings → Secrets and variables → Actions에 다음을 등록합니다.

| 구분 | 이름 |
| --- | --- |
| Variable | `VITE_SUPABASE_URL` |
| Secret | `VITE_SUPABASE_ANON_KEY` |
| Secret | `VITE_MAPBOX_TOKEN` |

Settings → Pages → Source를 **GitHub Actions**로 지정합니다. `main` 브랜치에 push하면 [배포 워크플로](.github/workflows/deploy.yml)가 빌드와 Pages 배포를 수행합니다. 앱은 `HashRouter`와 상대 경로 빌드를 사용하므로 GitHub Pages 하위 경로와 직접 진입에서 안전하게 동작합니다.

## iPhone 홈 화면에 설치

1. iPhone Safari에서 [T Log](https://rudwndgus.github.io/t-log/)를 엽니다.
2. Safari의 공유 버튼을 누릅니다.
3. **홈 화면에 추가**를 선택합니다.
4. 홈 화면의 T Log 아이콘으로 실행합니다.

standalone 모드, `100dvh`, 상·하단 safe area 및 16px 이상의 입력 글꼴을 적용해 iOS Safari의 주소창·홈 인디케이터·입력 확대 문제를 줄였습니다.

## 품질 확인

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

E2E 테스트는 390×844 뷰포트에서 여행 생성 → 노트 생성 → 장소 추가 → 일정 목록 → 채팅 전송 흐름을 확인합니다.

## 프로젝트 구조

```text
src/
  components/       공통 모바일 UI
  context/          로컬·클라우드 상태와 도메인 액션
  features/
    notes/          블록 노트
    map/            Mapbox 지도, 일정, 이동 구간
    chat/           채팅, 제안, 투표, 일정 승인
  lib/              Supabase·Mapbox 클라이언트와 유틸리티
  pages/            여행 목록·생성·참여·인증·여행 셸
  services/         Supabase 데이터 변환·동기화
supabase/migrations/ 데이터베이스 스키마와 RLS
```
