# 🌙 달빛 포션 상점 (1단계)

초등학교 5학년 2학기 **「소수의 곱셈」** 을 반복 연습하는 2D 웹게임입니다.
밤에만 여는 포션 가게의 주인이 되어, 손님의 주문을 받고 **레시피의 1병당 재료량 × 병 수**를 계산해 포션을 만듭니다.
계산한 답이 곧 계량해서 솥에 넣는 재료량입니다. 답을 맞혀야 재료가 들어가고, 모든 재료가 들어가야 포션이 완성되고 판매금을 받습니다.

- 시간제한·인내심 감소 없음. 오답이나 힌트로 돈이나 손님을 잃지 않습니다.
- 서버·로그인·유료 API 없이 브라우저만으로 동작합니다. 진행 상황은 브라우저(localStorage)에 저장됩니다.
- 태블릿(화면 키패드)과 PC(키보드) 모두 지원합니다.

> 현재 버전은 **1단계(제조 핵심)** 입니다: 여우 손님, 별빛 포션, 달빛 이슬·별가루, 여러 병 주문(학습 유형 ① 소수 한 자리 × 자연수, ② 소수 두 자리 × 자연수).
> 전체 설계와 이후 단계 계획은 [`docs/DESIGN.md`](docs/DESIGN.md)에 있습니다.

---

## 1. 로컬에서 설치하고 실행하기

**준비물:** [Node.js](https://nodejs.org/ko) 22 LTS(22.18 이상) 또는 24 이상. 설치 후 터미널에서 `node -v`로 확인하세요.

```bash
# 프로젝트 폴더에서
npm install        # 처음 한 번 (package-lock.json이 생깁니다)
npm run dev        # 개발 서버 실행 → 터미널에 나온 주소(보통 http://localhost:5173)를 브라우저로 엽니다
```

그 밖의 명령:

| 명령 | 하는 일 |
|---|---|
| `npm test` | 계산·판정·게임 규칙 자동 테스트 (Node 내장 테스트 실행기) |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run build` | 타입 검사 후 배포용 파일을 `dist/` 폴더에 만듭니다 |
| `npm run preview` | 만든 `dist/`를 로컬에서 미리 보기 |

> **package-lock.json 안내:** 이 ZIP은 패키지 저장소에 접근할 수 없는 환경에서 만들어져 `package-lock.json`이 들어 있지 않습니다.
> 처음 `npm install`을 하면 자동으로 생기니, 그 파일도 함께 저장소에 올려 두면 이후 배포에서 같은 버전이 설치됩니다(`npm ci`).
> 올리지 않아도 배포 workflow가 `npm install`로 설치하므로 배포는 됩니다.

## 2. ZIP을 풀어 GitHub 저장소에 올리기

1. GitHub에서 새 저장소를 만듭니다. (예: `moonlight-potion-shop`, Public 권장 — 무료 계정은 Public 저장소에서 Pages를 쓸 수 있습니다)
2. `Moonlight-Potion-Shop-phase1.zip`의 압축을 풉니다. 압축을 풀면 `Moonlight-Potion-Shop` 폴더가 생깁니다.
3. **그 폴더의 안쪽 내용**(`package.json`, `index.html`, `src/`, `public/`, `.github/` 등)이 저장소의 **맨 위(루트)** 에 오도록 올립니다.
   `Moonlight-Potion-Shop` 폴더 자체를 한 단계 더 넣어 올리면 배포가 되지 않습니다.
   - **Git 사용 시:** 압축을 푼 폴더 안에서
     ```bash
     git init
     git add .
     git commit -m "달빛 포션 상점 1단계"
     git branch -M main
     git remote add origin https://github.com/<사용자이름>/<저장소이름>.git
     git push -u origin main
     ```
   - **웹 업로드 시:** 저장소 화면의 **Add file → Upload files**에 폴더 안의 파일과 폴더를 끌어다 놓고 **Commit changes**를 누릅니다.
     ⚠️ `.github`처럼 점(.)으로 시작하는 폴더는 컴퓨터에서 숨김 폴더라 빠지기 쉽습니다. 다음 항목으로 꼭 확인하세요.

## 3. `.github/workflows/deploy.yml`이 올라갔는지 확인하기

- 저장소 첫 화면의 파일 목록에 `.github` 폴더가 보여야 하고, 들어가면 `workflows/deploy.yml`이 있어야 합니다.
- 주소창에 `https://github.com/<사용자이름>/<저장소이름>/blob/main/.github/workflows/deploy.yml`을 입력해 열리는지 확인해도 됩니다.
- 없다면: 저장소에서 **Add file → Create new file**을 누르고 파일 이름 칸에 `.github/workflows/deploy.yml`을 입력한 뒤, ZIP 안의 같은 파일 내용을 붙여 넣고 커밋합니다.
  (Windows 탐색기: 보기 → 표시 → 숨긴 항목 / macOS Finder: `Cmd + Shift + .` 로 숨김 폴더를 볼 수 있습니다.)

## 4. Settings → Pages에서 Source를 GitHub Actions로 선택하기

1. 저장소 상단의 **Settings** → 왼쪽 메뉴 **Pages**로 갑니다.
2. **Build and deployment → Source**에서 **GitHub Actions**를 선택합니다. (저장할 버튼은 따로 없고 선택하면 바로 적용됩니다.)

## 5. 배포 완료 확인과 사이트 접속

1. 저장소 상단 **Actions** 탭에서 **Deploy to GitHub Pages** 실행을 엽니다.
   - Source를 GitHub Actions로 바꾸기 전에 push했다면 첫 실행이 실패했을 수 있습니다. 왼쪽에서 **Deploy to GitHub Pages** → 오른쪽 **Run workflow** → **Run workflow**를 눌러 다시 실행합니다.
2. `build`와 `deploy` 두 작업이 모두 초록색 ✓ 이 되면 배포 완료입니다(보통 1~3분).
3. `deploy` 작업 안이나 **Settings → Pages** 상단에 나온 주소로 접속합니다.
   주소 형식: `https://<사용자이름>.github.io/<저장소이름>/`
4. 이후에는 `main` 브랜치에 push할 때마다 자동으로 다시 배포됩니다.

### 배포 방식 설명 (저장소 이름과 base 경로)

GitHub Pages 사이트는 `/<저장소이름>/` 하위 경로에서 열립니다. workflow가 저장소 이름을 읽어
`VITE_BASE_PATH=/<저장소이름>/` 환경 변수를 만들고, `vite.config.ts`의 `base`가 이 값을 사용합니다.
그래서 저장소 이름을 무엇으로 정하든 코드를 고칠 필요가 없습니다.

- 이미지·효과음은 `src/lib/assets.ts`의 `assetUrl()`로 경로를 만들어 base 경로가 자동으로 붙습니다.
- 화면 전환은 주소(URL)가 아니라 게임 상태로 하므로, 어느 화면에서 새로고침해도 404가 나지 않습니다.
- 저장소 이름이 `<사용자이름>.github.io`이면 루트(`/`)로 빌드합니다.
- 사용자 지정 도메인을 연결했다면 workflow의 `Set base path` 단계에서 `BASE_PATH="/"`로 바꾸세요.

## 게임 방법 (1단계)

1. **가게 문 열기** → 창구에 여우 손님 코코가 와서 “별빛 포션 3병 주세요!”처럼 주문합니다.
2. **주문 받기 → 제조대로** → 왼쪽 레시피북에서 1병당 재료량을 확인합니다. (별빛 포션: 달빛 이슬 0.6mL, 별가루 0.25g)
3. 재료를 고르고 계산식(예: `0.6 × 3 = ?`)의 답을 키패드나 키보드로 입력한 뒤 **계량하기**를 누릅니다.
   - 키보드: 숫자, `.`(소수점), `Backspace`(한 글자 지우기), `Esc`/`Delete`(전체 지우기), `Enter`(계량하기)
   - `0.5`와 `0.50`처럼 같은 수는 모두 정답입니다.
   - 틀리면 재료는 들어가지 않고, 원인이 분명할 때(예: 소수점 위치) 구체적인 안내가 나옵니다. **힌트 보기**로 3단계 도움(크기 어림 → 자연수 곱셈과 소수점 → 단계별 풀이·그림)을 받을 수 있습니다.
4. 두 재료를 모두 넣으면 **포션 완성하기** → 병에 담기 → **창구로 가져가기** → **포션 전달하기** → 달빛 동전을 받습니다.
5. **다음 손님 맞이하기**로 새 주문을 받습니다. 병 수 2~9병을 섞어서, 최근과 같은 주문은 피해서 냅니다.

진행 중에 창을 닫거나 새로고침해도, 다시 열어 **이어서 영업하기**를 누르면 완료한 재료와 입력 중인 답까지 복구됩니다.
처음 화면의 **처음부터 다시 하기**로 저장을 지울 수 있습니다.

## 프로젝트 구조

```
index.html               진입 HTML
vite.config.ts           Vite 설정 (VITE_BASE_PATH → base)
.github/workflows/deploy.yml  GitHub Pages 배포 (하나만 사용)
public/                  정적 파일 (favicon, assets/ui/moon-logo.svg)
src/
  lib/decimal.ts         BigInt 기반 정확한 소수 계산 (부동소수점 미사용)
  lib/answerInput.ts     키패드 입력, 입력 형식 검사
  lib/deck.ts, rng.ts    문제 덱(최근 문제 회피·소진 시 섞어서 재사용), 시드 난수
  lib/josa.ts            숫자·단위에 맞는 조사(은/는, 을/를…) 자동 선택
  lib/assets.ts          base 경로를 반영한 정적 파일 주소
  data/                  재료·레시피·손님·학습 유형 데이터 (코드와 분리)
  game/types.ts          주문·문제·학습 기록·게임 상태 타입
  game/orderFactory.ts   주문 생성, 학습 범위 확인
  game/feedback.ts       오답 진단, 3단계 힌트
  game/reducer.ts        모든 게임 규칙(투입·완성·판매 가드)
  game/save.ts           버전 있는 localStorage 저장
  components/            화면(타이틀·창구·제조대)과 임시 그래픽(art/)
tests/                   자동 테스트 (npm test)
docs/DESIGN.md           전체 설계와 단계별 계획
```

### 그림 교체하기

지금 그림은 코드로 그린 **임시 그래픽**이라 그림 파일이 없어도 동작합니다.
손님 그림이 생기면 `public/assets/customers/fox.png`처럼 넣고 `src/data/customers.ts`의 해당 손님에 `image: "assets/customers/fox.png"`를 추가하면 됩니다(파일을 못 읽으면 자동으로 임시 그래픽으로 돌아갑니다).

## 현재 제한 사항 (다음 단계 예정)

- 손님 1명(여우), 포션 1종(별빛 포션), 여러 병 주문(학습 유형 ①②)만 있습니다.
- 하루 영업(손님 5명)·마감 결과, 저장 데이터 JSON 내보내기·가져오기 → 2단계
- 학습 유형 ③~⑦, 맞춤 배수·소수점 비교 주문, 교사 설정 화면, 학습 기록 화면, 틀린 유형 복습 문제 → 3단계
- 도감·해금(4단계), 가게 꾸미기(5단계), 최종 그래픽·효과음(6단계)
- 학습 기록은 이미 게임 상태에 저장되지만, 확인하는 화면은 아직 없습니다.
