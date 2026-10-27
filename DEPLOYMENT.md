# Daylog · Vercel 배포

기존 HTML·CSS·JavaScript 화면과 Express API를 유지하면서, Vercel에서는 Turso의 **libSQL 호환 원격 SQLite DB**를 사용하도록 변경했습니다. 로컬에서는 이전처럼 `data/daylog.sqlite`를 사용할 수 있습니다.

## 1. Turso 연결 정보 준비

Turso에서 libSQL 호환 데이터베이스를 생성하고 다음 두 값을 준비하세요.

- Database URL: `libsql://…turso.io`
- 해당 DB의 쓰기 권한이 있는 Auth Token

Turso CLI를 사용한다면 libSQL 호환 DB를 생성한 뒤 다음 명령으로 연결 정보를 확인할 수 있습니다.

```text
turso db show <DB이름> --url
turso db tokens create <DB이름>
```

클라이언트는 `@libsql/client/http`를 사용합니다. 원격 서버와 HTTPS로 통신하며 Vercel 함수의 디스크에 DB 파일을 쓰지 않습니다. `users`, `sessions`, `events`, `tasks`, `journals`, `auth_rate_limits` 테이블은 최초 API 요청 시 자동 생성합니다. 스키마 초기화가 실패하면 다음 요청에서 재시도합니다.

새 Turso DB는 비어 있습니다. 현재 로컬 SQLite의 계정과 기록이 자동 전송되는 것은 아닙니다. 기존 로컬 DB 파일은 변경하거나 삭제하지 않습니다.

## 2. GitHub 업로드

수정된 코드를 저장소에 commit/push하세요. `.env.local`, `.env`, `data/`, `.vercel/`, `node_modules/`는 업로드하지 않습니다. `.env.example`에는 실제 토큰 대신 예시만 들어 있습니다.

## 3. Vercel 프로젝트 설정

1. GitHub 저장소를 Vercel의 새 프로젝트로 Import합니다.
2. Framework Preset은 **Express**, Root Directory는 이 프로젝트 루트로 선택합니다.
3. Node.js는 **24.x**로 설정합니다. 프로젝트 `package.json`에도 지정되어 있습니다.
4. Build Command는 `npm run build`입니다. `vercel.json`에 설정되어 있습니다. Output Directory는 임의로 지정하지 말고 Express 기본 설정을 유지합니다.
5. Environment Variables에 다음 값을 등록한 뒤 Deploy합니다.

| 이름 | 값 | 필수 여부 |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | `libsql://실제-DB주소.turso.io` | 필수 |
| `TURSO_AUTH_TOKEN` | 실제 DB Auth Token | 필수 |
| `APP_ORIGIN` | `https://나의도메인` | 선택 |

`APP_ORIGIN`에는 경로나 마지막 `/` 없이 정확한 origin만 넣습니다. 지정하지 않아도 현재 Vercel 배포 주소의 HTTPS 요청은 허용합니다. 커스텀 도메인을 추가해도 해당 도메인으로 직접 접속하면 사용할 수 있습니다. 인증 쿠키에는 운영 환경에서 Secure, HttpOnly, SameSite=Strict를 적용합니다.

Production/Preview 환경 중 사용할 환경에 변수를 등록하세요. Preview에는 별도 DB를 연결하면 테스트 중 운영 기록을 변경하지 않습니다. 환경변수를 바꾼 뒤에는 Redeploy해야 합니다.

Vercel에서 원격 DB 변수가 빠졌거나 잘못 설정되면 API가 503을 반환합니다. 로컬 파일 DB나 `/tmp`에 저장하는 방식으로 대체하지 않습니다.

## 4. 배포 확인

1. `https://배포주소/api/health`에서 `{"ok":true}`를 확인합니다. 실제 DB 스키마 초기화까지 성공해야 이 응답이 나옵니다.
2. 회원가입 화면에서 아이디 중복 확인 → 가입을 진행합니다.
3. 일정·할 일·오늘 일기를 작성합니다.
4. 로그아웃 후 다시 로그인해 기록이 남아 있는지 확인합니다.

계정·세션·중복 아이디 제약과 인증 시도 횟수는 DB에 저장되므로 함수 인스턴스가 바뀌어도 공유됩니다. 기존 SQL 파라미터 바인딩, 입력값 검증, 날짜별 조회, 당일에만 일기를 수정하는 규칙도 유지합니다.

## 로컬 실행과 빌드

Node.js 24.15 이상인 24 LTS 환경을 권장합니다.

```powershell
npm install
npm start
```

http://localhost:3000 에서 사용합니다. Turso 환경변수를 설정하지 않으면 기존 로컬 SQLite를 사용합니다. 로컬 서버는 기본 localhost:3000이며 `PORT` 환경변수로 포트를 변경할 수 있습니다.

로컬에서도 Turso로 테스트하려면 `.env.example`을 `.env.local`로 복사하고 실제 URL·토큰을 입력한 뒤 `npm start`를 실행하세요. 로컬 테스트에서는 `APP_ORIGIN`을 생략할 수 있습니다. `.env.local`은 로컬 서버 시작 시 자동으로 읽고, Vercel에서는 대시보드에 설정한 환경변수를 사용합니다.

```powershell
npm run build
npm test
```

빌드는 루트의 `index.html`, `styles.css`, `app.js` **3개만** `public/`으로 복사합니다. Vercel은 이 폴더의 파일을 CDN으로 제공합니다. 화면을 수정할 때는 기존 루트 파일을 수정하세요. `public/`은 빌드 결과이며 Git에서 제외됩니다. 서버 파일·로컬 DB·환경변수는 정적 파일에 복사하지 않습니다.

테스트는 임시 SQLite와 메모리 libSQL을 사용하며 실제 Turso 서버를 변경하지 않습니다. CRUD, 프론트엔드 fetch, 중복 가입, HTTPS Origin 검사, 보안 쿠키, 여러 앱 인스턴스의 데이터·세션·인증 횟수 공유를 검증합니다. 실제 원격 URL·토큰을 통한 연결과 Vercel 배포는 위 배포 확인 단계에서 확인해야 합니다.

참고: [Vercel Express 공식 문서](https://vercel.com/docs/frameworks/backend/express), [libSQL 클라이언트 공식 문서](https://github.com/tursodatabase/libsql-client-ts).
