# T Log

> Write · Discuss · Decide · Travel

**웹앱:** [https://rudwndgus.github.io/t-log/](https://rudwndgus.github.io/t-log/)

T Log는 친구들과 여행 아이디어를 쓰고, 대화와 투표로 결정하고, 확정된 일정을 자체 지도 위에서 관리하는 iPhone 우선 협업 여행 PWA입니다.

## 아키텍처

```text
React + Vite PWA
├─ Firebase Authentication — 이메일/비밀번호 로그인·회원가입
├─ Cloud Firestore — 여행·노트·일정·채팅·제안 실시간 저장
├─ MapLibre GL JS + OpenFreeMap — API 키 없는 임베디드 지도
├─ OpenStreetMap Nominatim — 사용자가 직접 실행하는 장소 검색
├─ IndexedDB — Firebase 미설정 시 로컬 저장
└─ GitHub Pages — 정적 웹앱 호스팅
```

Supabase, Mapbox, Google Maps 임베드 및 유료 지도 API는 사용하지 않습니다. Google Maps URL은 좌표를 읽는 참고 자료일 뿐이며, 저장된 좌표로 T Log의 MapLibre 지도에 독립적인 핀을 생성합니다.

## 주요 기능

- 이메일/비밀번호 로그인과 회원가입, 세션 유지
- 초대 코드와 공유 링크가 있는 여행방
- Firestore `onSnapshot()` 기반 멤버·노트·장소·이동·채팅·제안 실시간 반영
- 모바일 블록 노트와 800ms 디바운스 저장
- 노트 → 채팅 공유 → 제안 → 투표 → 일정 승인 흐름
- 날짜별 MAP/LIST, 번호 핀, API 키 없는 직선 waypoint route
- 길게 눌러 일정 순서 변경과 수동 교통정보 관리
- 세 가지 장소 추가 방식
  - OpenStreetMap 장소 검색
  - 펼쳐진 Google Maps URL 좌표 추출
  - 지도에서 직접 핀 지정
- Google Maps 짧은 링크를 읽지 못할 때 검색·확장 URL·직접 핀 안내
- Firebase 설정이 없을 때 IndexedDB 로컬 모드
- iPhone safe area와 홈 화면 설치를 지원하는 PWA
- 새 배포 감지 시 사용자 확인 후 저장·서비스 워커 교체·자동 새로고침

## 로컬 실행

Node.js 22 이상을 권장합니다.

```bash
git clone https://github.com/rudwndgus/t-log.git
cd t-log
npm install
cp .env.example .env.local
npm run dev
```

Firebase 환경변수가 하나라도 없으면 로컬 모드로 실행됩니다. 기존 T Log `localStorage` 데이터가 있으면 최초 실행 시 IndexedDB로 마이그레이션합니다. 샘플 여행은 자동 생성하지 않습니다.

## Firebase 웹앱 설정

Firebase Console에서 웹앱을 등록해 받은 `firebaseConfig`를 다음처럼 `.env.local`에 옮깁니다. 값을 소스 코드에 직접 넣지 마세요.

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase Console에서 추가로 설정합니다.

1. Authentication → Sign-in method에서 **Email/Password**를 활성화합니다.
2. Authentication → Settings → Authorized domains에 `rudwndgus.github.io`를 추가합니다.
3. Firestore Database를 **Standard Edition**으로 생성합니다.
4. 저장소의 보안 규칙을 배포합니다.

```bash
npx firebase-tools login
npx firebase-tools use YOUR_PROJECT_ID
npx firebase-tools deploy --only firestore
```

[`firestore.rules`](firestore.rules)는 인증된 여행 멤버에게만 하위 데이터를 허용합니다. 여행 삭제·멤버 제거는 owner만 가능하고, 투표 문서는 로그인한 본인만 작성할 수 있습니다. `allow read, write: if true` 규칙은 사용하지 않습니다.

Firestore 구조:

```text
users/{userId}
inviteCodes/{inviteCode}
trips/{tripId}
  members/{userId}
  notes/{noteId}
  places/{placeId}
  segments/{segmentId}
  messages/{messageId}
  proposals/{proposalId}
    votes/{userId}
```

## GitHub Actions에 Firebase 값 전달

로컬 `.env.local`은 GitHub Actions에 자동으로 전달되지 않습니다. 저장소 Settings → Secrets and variables → Actions에 아래 6개를 반드시 등록해야 Pages에서도 Firebase 모드가 활성화됩니다.

| 종류 | 이름 |
| --- | --- |
| Secret | `VITE_FIREBASE_API_KEY` |
| Variable | `VITE_FIREBASE_AUTH_DOMAIN` |
| Variable | `VITE_FIREBASE_PROJECT_ID` |
| Variable | `VITE_FIREBASE_STORAGE_BUCKET` |
| Variable | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| Secret | `VITE_FIREBASE_APP_ID` |

GitHub CLI 예시:

```bash
gh secret set VITE_FIREBASE_API_KEY --repo rudwndgus/t-log
gh variable set VITE_FIREBASE_AUTH_DOMAIN --repo rudwndgus/t-log --body "YOUR_VALUE"
gh variable set VITE_FIREBASE_PROJECT_ID --repo rudwndgus/t-log --body "YOUR_VALUE"
gh variable set VITE_FIREBASE_STORAGE_BUCKET --repo rudwndgus/t-log --body "YOUR_VALUE"
gh variable set VITE_FIREBASE_MESSAGING_SENDER_ID --repo rudwndgus/t-log --body "YOUR_VALUE"
gh secret set VITE_FIREBASE_APP_ID --repo rudwndgus/t-log
```

설정 후 Actions에서 **Deploy T Log to GitHub Pages**를 다시 실행하거나 `main`에 push합니다. [배포 워크플로](.github/workflows/deploy.yml)가 각 값을 Vite 빌드 환경으로 전달합니다. 호스팅은 Firebase Hosting이 아니라 계속 GitHub Pages를 사용합니다.

## 무료 지도와 장소 추가

MapLibre는 OpenFreeMap의 Positron 스타일을 직접 렌더링합니다. 지도 기본 기능, 번호 핀, waypoint line, 직접 핀에는 API 키가 필요하지 않습니다.

장소 검색은 공개 Nominatim 서비스 정책을 고려해 자동완성이 아닌 명시적 **검색** 버튼으로만 요청합니다. 최근 결과는 기기에 캐시하며, 검색 서비스가 실패해도 Google Maps URL 또는 직접 핀으로 계속 진행할 수 있습니다.

지원하는 Google Maps 좌표 패턴 예:

```text
@43.6426,-79.3871
!3d43.6426!4d-79.3871
?q=43.6426,-79.3871
```

`maps.app.goo.gl` 짧은 링크는 GitHub Pages 브라우저의 redirect/CORS 제한 때문에 읽지 못할 수 있습니다. 앱은 실패하지 않고 펼쳐진 URL, 이름 검색, 직접 핀 옵션을 안내합니다.

## iPhone 홈 화면 설치

1. iPhone Safari에서 [T Log](https://rudwndgus.github.io/t-log/)를 엽니다.
2. 공유 버튼 → **홈 화면에 추가**를 선택합니다.
3. 홈 화면의 T Log 아이콘으로 실행합니다.

standalone 모드, `100dvh`, safe-area inset, 16px 이상의 입력 글꼴을 적용했습니다.

새 버전이 GitHub Pages에 배포되면 앱이 시작될 때, 다시 화면으로 돌아올 때, 그리고 실행 중 15분 간격으로 서비스 워커 업데이트를 확인합니다. 업데이트가 있으면 **새 버전이 준비됐어요** 안내가 표시되며, **확인**을 누르면 현재 데이터를 저장하고 새 서비스 워커로 교체한 뒤 자동으로 최신 화면을 불러옵니다.

## 품질 확인

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

E2E 테스트는 390×844에서 여행·노트 생성, Google Maps URL 장소 추가, 지도 직접 핀, LIST 전환, 채팅 전송을 확인합니다.

## 프로젝트 구조

```text
src/
  components/       공통 모바일 UI
  context/          Firebase/IndexedDB 상태와 도메인 액션
  features/
    notes/          블록 노트
    map/            MapLibre 지도, 일정, 이동 구간
    chat/           채팅, 제안, 투표, 일정 승인
  lib/              Firebase 초기화와 공통 유틸리티
  services/         Firestore, IndexedDB, 검색, URL 파싱, routing 경계
firestore.rules     Firestore 보안 규칙
firebase.json       Rules/Index 배포 설정
```
