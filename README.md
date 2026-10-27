# Daylog

HTML·CSS·JavaScript 캘린더에 Node.js / Express REST API와 SQLite를 연결했습니다. 기존 민트색 디자인, 아이디 로그인, 월 이동, 임박한 할 일 강조, 감정 8개, 시간 스크롤 선택기를 유지합니다.

## 실행

Node.js **24.15 이상인 24 LTS** 또는 **26 이상**을 권장합니다. Node.js 22를 사용한다면 22.22.2 이상이 필요합니다. 내장 `node:sqlite`를 사용하므로 SQLite 서버나 네이티브 빌드 도구를 따로 설치하지 않습니다.

```powershell
npm install
npm start
```

**http://localhost:3000** 을 열어 회원가입 또는 로그인합니다. `index.html`을 직접 더블클릭해서 여는 방식은 API를 사용할 수 없습니다. 서버는 localhost에만 바인딩합니다. 종료는 `Ctrl+C`, 개발 중 자동 재시작은 `npm run dev`입니다.

```powershell
npm test
```

테스트는 임시 디렉터리와 임의 포트에서 실행되며 실제 앱 DB를 변경하지 않습니다. CRUD, 날짜 조회, 잘못된 입력, 계정 간 접근 차단, 서버 재시작 후 보존, 아이디 중복 확인, 프론트엔드 fetch 연결 및 일기 자동 저장을 검증합니다. 프론트엔드 테스트는 jsdom 기반이며 실제 브라우저의 픽셀 배치를 검사하지는 않습니다.

## 저장 구조와 계정

- `data/daylog.sqlite`: SQLite DB. 최초 실행 시 테이블과 인덱스를 생성합니다.
- `events`: id, user_id, date, time, title
- `tasks`: id, user_id, date, title, done
- `journals`: id, user_id, date, content, mood. 계정·날짜별 하나의 일기입니다.
- `users`, `sessions`: 계정과 로그인 세션. 비밀번호는 무작위 salt와 scrypt 해시로 저장합니다. 세션은 HttpOnly / SameSite=Strict 쿠키로 인증하고 서버에는 토큰 해시만 저장합니다. 유효기간은 7일입니다.

이제 새 기록과 계정은 localStorage가 아닌 서버 DB에 저장됩니다. 같은 서버에 다시 로그인하면 기록을 불러옵니다. 일기는 500ms 자동 저장 및 저장 버튼을 지원하며, 저장되지 않은 변경이 있으면 페이지 이탈 시 브라우저가 확인합니다. 저장 실패 시 입력을 남기고 알림을 표시합니다. 일기와 감정의 작성·수정·삭제는 서버의 **Asia/Seoul 기준 당일**에만 허용합니다. 과거 일기는 조회 전용, 미래 날짜의 일기 영역은 숨깁니다. 일정과 할 일은 날짜와 관계없이 관리할 수 있습니다.

DB 위치는 `DAYLOG_DATA_DIR` 환경변수로 바꿀 수 있습니다. DB를 백업하려면 서버를 종료한 뒤 `data` 폴더 전체를 복사하세요. 실행 중에는 SQLite WAL 파일도 사용하므로 DB 파일만 복사하지 마세요. `data/`와 `node_modules/`는 Git에서 제외됩니다. 서버 디스크의 DB는 암호화하지 않으므로 해당 폴더의 접근 권한을 관리하세요. 외부 공개 배포에는 HTTPS·보안 쿠키·배포 환경에 맞는 Origin 정책 등이 별도로 필요합니다.

## REST API

모든 데이터 API는 로그인 세션이 필요하며 해당 계정의 데이터만 조회·수정합니다. 날짜는 `YYYY-MM-DD`, 시간은 24시간제 `HH:MM`입니다.

| Method | URL | 동작 |
| --- | --- | --- |
| GET | `/api/auth/username-availability?username=daylog` | 아이디 사용 가능 여부 |
| POST | `/api/auth/register` | `{username, password, name}`으로 가입 |
| POST | `/api/auth/login` | `{username, password}`로 로그인 |
| GET | `/api/auth/me` | 현재 계정 |
| POST | `/api/auth/logout` | 세션 종료 |
| GET | `/api/events`, `/api/tasks`, `/api/journals` | 전체 목록 |
| GET | `/api/events?date=2026-10-28` | 해당 날짜 목록. tasks/journals도 동일 |
| GET | `/api/{종류}/:id` | 단일 기록 |
| POST | `/api/{종류}` | 생성 |
| PATCH | `/api/{종류}/:id` | 전달한 필드 수정 |
| DELETE | `/api/{종류}/:id` | 삭제 |
| GET | `/api/records` | 캘린더용 날짜별 통합 데이터와 서버의 오늘 날짜 |

POST 본문 예시:

```json
{"date":"2026-10-28","time":"09:30","title":"기획 회의"}
```

```json
{"date":"2026-10-28","title":"산책하기","done":false}
```

```json
{"date":"2026-10-28","content":"오늘 있었던 작은 이야기","mood":"평온"}
```

일기 예시의 날짜는 실행 당일로 바꾸세요. 감정 값은 빈 문자열, 기쁨, 평온, 설렘, 감사, 슬픔, 지침, 속상함, 걱정이며 이전 버전 호환을 위해 영감도 허용합니다. 제목 최대 80자, 일기 최대 1,000자, 이름 최대 30자, 아이디 1~254자(공백 불가), 비밀번호 8~128자입니다. 아이디는 대소문자를 구분하지 않습니다. 모든 SQL 값은 `?` 파라미터로 바인딩하며 동적 테이블·컬럼명은 코드의 고정 허용 목록만 사용합니다.

오류 응답은 `{ "error": "설명" }`입니다. 잘못된 입력 400, 인증 실패 401, 일기 수정 제한/Origin 차단 403, 없는 기록 404, 중복 계정/일기 409, 큰 요청 413, 로그인 시도 제한 429, 내부 오류 500을 반환합니다.

기술 참고: [Express 공식 문서](https://expressjs.com/en/5x/api/express/), [Node.js SQLite 공식 문서](https://nodejs.org/api/sqlite.html).

회원가입 화면에서 아이디를 입력하고 **중복 확인**을 눌러야 가입할 수 있습니다. 아이디를 바꾸면 다시 확인해야 합니다. 최종 가입 요청에서도 SQLite UNIQUE 제약으로 중복 계정을 차단합니다. 기존 기록 가져오기 기능은 제거했으며 이미 저장된 DB와 브라우저 원본 기록은 삭제하지 않습니다.
