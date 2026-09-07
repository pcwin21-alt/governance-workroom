# Harness Routing Record

## KRDS typography and information hierarchy repair — 2026-09-06

- Task: 기존 거버넌스 워크룸에 KRDS 기반 본문 가독성·행간·굵기·정보 위계 규칙을 적용.
- Project contract: 합성 데이터 기반의 역할·테넌트 격리 MVP에서 `오늘 → 회의·결정 → 정책제안`의 운영 흐름과 권한 경계를 유지한다. 이번 변경은 정보 구조를 바꾸지 않고 읽기·상태 판단·입력 행동의 글자 역할만 바로잡는다.
- Active: Shared Harness Root AGENTS, Harness & Skill Inventory Router, Project Execution Agent, KRDS Web Typography and Information Hierarchy Skill, codex-delivery-loop, Eval.
- Reference: Design System은 기존 화면 문법과 충돌 여부만 확인했다. Brain·Source는 새 사실·주장·외부 자료를 만들지 않는 CSS 교정이므로 제외했다.
- Decision: 본문은 `1rem/1.6/400`, 제목은 H1/H2/H3 계층과 `700`, 실제 판단·조작에 쓰이는 메타와 컨트롤은 최소 `.875rem`으로 통일한다. 작은 시각 카운트나 장식은 운영 판단을 대신하지 않는다.
- Acceptance evidence: `npm test` 36건 통과, `npm run build:public-demo` 통과, `node --check public/app.js`·`server.mjs` 통과. 합성 일반위원 로그인 화면에서 본문 `16px/25.6px/400`, H2 `28.16px/38.016px/700`, 상태·조작·탐색 `14px`, 데스크톱(1265px)과 390px에서 수평 오버플로·잘린 버튼 없음, 브라우저 오류 없음까지 확인했다.


## Request

- Task: 청년 참여기구·청년정책 거버넌스 운영 플랫폼의 기획 확정 및 MVP 구현
- Task type: research / writing / product planning / local MVP implementation
- Date: 2026-08-22

---

## Dashboard visual usability research — 2026-08-23

- Task: 대시보드를 시각적으로 완성도 있고 처음 쓰는 사람도 빠르게 익히게 만드는 외부 연구·영상 조사와 적용 우선순위 설계.
- Project contract: 청년 거버넌스 운영 플랫폼의 운영사·간사·의장단·일반위원이 회의→제안→경과를 판단·행동할 수 있는 역할별 업무 화면. 산출물은 근거와 현재 진단을 분리한 내부 리서치 문서. 완료 기준은 채택/제외 원칙, 화면 번역, 검증 과업이 분명한 것.
- Active: Root AGENTS, Brain, Project Execution Agent, Harness & Skill Inventory Router, Website Product Planning Harness, Source, Eval.
- Reference: Style은 문서 문장 보정만; Keyword Discovery는 이번 요청이 새 아이템 선별이 아니라 기존 제품 화면 개선이라 제외.
- Source handling: 학술 리뷰·원 논문, NN/g 실무 영상, W3C 접근성 기준을 우선했다. 관찰(현재 코드), 외부 근거, 제품 제안은 `10_대시보드_시각_가독성_사용성_리서치.md`에서 분리했다.
- Decision: 대시보드를 장식적 수치 벽이 아니라 역할별 행동 작업대로 재구성한다. 개인 평가·순위는 기존 제품 경계에 따라 제외한다.
- Eval plan: 역할별 과업 테스트, 상태·행동의 텍스트 전달, 대비·키보드·모바일 확인을 후속 구현 종료 관문으로 둔다.

---

## Role-first dashboard implementation — 2026-08-23

- Applied: 홈을 동일한 수치 카드 벽에서 역할별 행동 작업대로 재구성했다. 일반위원은 참석·과제·제안, 간사·의장단은 피드백·참석 응답·결정, 운영사는 지원 신호를 먼저 본다.
- Visual rule: 한 개의 행동 초점 영역, 세 개의 보조 신호, 두 개의 작업 목록으로 위계를 제한했다. 상태는 색만이 아니라 읽을 수 있는 텍스트로 표시한다.
- Boundary: 실제 마감·개인 성과·순위 데이터를 새로 만들지 않았고, 기존 합성 데이터와 권한 범위 안에서만 표시했다.
- Verification: `node --check public/app.js`, `node --check server.mjs`, `npm test` 9건, 로컬 HTTP 200을 확인했다. 실제 역할별 사용자 과업 테스트와 대비·키보드·모바일 시각 검수는 다음 사용자 검증 단계다.

---

## Invitation, membership approval, permission, and sharing design — 2026-08-23

- Task: 대표가 기구를 개설·설정하고, 위원이 초대 링크를 통해 계정을 만든 뒤 소속 승인으로 입장하는 접근 구조와 외부 메신저 공유 흐름을 설계.
- Active: Root AGENTS, Brain, Project Execution Agent, Harness & Skill Inventory Router, Website Product Planning Harness, Source, Eval.
- Sources: OWASP는 최소 권한·기본 거부·매 요청 권한 검사, NIST는 계정 복구 통지, Kakao Developers는 사용자 주도 공유 템플릿과 등록 도메인 요구 사항의 근거로 사용했다.
- Decision: 계정과 기구 멤버십을 분리하고, 링크는 소속 신청 경로로만 둔다. 실제 카카오 자동·대량 발송과 대화 내용 수집은 범위에서 제외한다.
- Output: `11_초대_가입_승인_권한_공유_설계초안.md`; 기존 초대 UX·화면 명세도 승인제 흐름으로 정정.

## Project contract

- Project file or minimum contract: `website-product-brief.md`
- Topic: 다기관 청년 거버넌스 운영·정책제안 협업 플랫폼
- Audience: 운영사, 도입기관, 위원회 사무국·의장단·구성원
- Purpose: 파일럿 MVP의 문제·가설·권한·데이터·기능·검증 범위 고정
- Medium / output: Markdown 기획 문서와 MVP 보조 산출물
- Completion criteria: 합성 데이터 기반 MVP의 권한·핵심 흐름·테넌트 격리를 구현·테스트하고, 실제 도입 전 외부 결정과 보안 경계를 분리
- Core hypothesis: 회의와 정책제안의 맥락을 연결하면 기구 운영과 다음 기수 인수인계의 재작업을 줄일 수 있다.

## Inventory pass

- Registry checked: `dashboard/harness_index.json`
- Actual files checked: root AGENTS, Brain, Skill, Project Execution Agent, Website Product Planning Harness, Keyword and Item Discovery Harness, Source, Eval, TEST_CASES, routing template
- Index/file mismatch or missing entries: 현재 작업 폴더에는 프로젝트 문서가 없어 최소 프로젝트 계약을 새로 작성함.

## Activation decision

| Layer / entry | Status | Why this status | Required input | Expected output |
| --- | --- | --- | --- | --- |
| Root AGENTS | always | 실질 업무 공통 규칙 | 사용자 요청 | 적용·제외 계층 결정 |
| Brain | always | 가설·검증·과장 방지 | 최소 계약 | 판단 경계 |
| Project | active | 새 제품 기획 | 사용자 요구 | 제품 브리프 |
| Project Execution Agent | active | 범위·가설·리스크·완료 기준 | 브리프 | 단계별 실행 판단 |
| Keyword and Item Discovery | active | 기능 전 고객 장면·병목 선별 | 사용자 발화·제도 맥락 | 기회 후보·실험 카드 |
| Website Product Planning | active | 제품·화면·데이터·전환 설계 | 통과 후보 | 브리프·화면·실험 문서 |
| Source | active | 법·사용자 발화·가설의 분리 | 공식 법령, 사용자 요청 | evidence ledger |
| Style | excluded | 실행 기획 문서이며 별도 문체 요청 없음 | - | - |
| Eval | active | 외부 공유 전 기획 경계 확인 | Eval/TEST_CASES | 아래 종료 판정 |

## Execution order

1. 사용자 발화를 문제·역할·흐름·운영사 관점으로 분해한다.
2. 아이템 후보를 선별하고 첫 수직 흐름을 회의→정책제안으로 고정한다.
3. 권한·데이터·화면·로드맵·실험과 금지선을 함께 작성한다.
4. 합성 시드 데이터와 서버 권한 검사로 워크룸과 운영사 Control Plane을 구현하고 자동 검증한다.
5. 법령은 운영 맥락으로만 참고하며, 모든 테넌트에 대한 법적 요건으로 일반화하지 않는다.

## Conflict and boundary check

- Existing rule conflict: 없음.
- Project boundary risk: 커뮤니티·AI·연구 기능을 MVP에 과도하게 포함할 위험. 후속 단계로 분리.
- Public/private or source-provenance risk: 사용자 발화는 검증 전 운영 가설로 표시. 법률 검토·개인정보 처리 역할은 기관별 검토로 유보.
- Unapproved promotion avoided: 본 기획의 가설·규칙을 identity harness에 승격하지 않음.

## Eval closeout

- Eval file/case: `Eval.md`, `TEST_CASES.md`의 Website Product Planning, Mandatory Harness Gate, UX writing 기준
- Passed: Project 목적·독자·완료기준, 병목 우선순위, 관계·데이터 경계, 합성 데이터 기반 권한·테넌트 격리·핵심 흐름·운영사 콘솔 API 자동 검증
- Failed or deferred: 직접 사용자 인터뷰, 실제 자료 흐름 검증, 레퍼런스 관찰, 법률·보안·계약 검토, 실제 개인정보 운영 환경
- Final decision: local MVP complete; actual pilot readiness conditional

---

## UX flow extension — 2026-08-22

### Request and project contract

- Task: 공개 소개 페이지부터 도입·초대·워크룸·운영사 콘솔까지의 전반적 이용자 경험 설계
- Task type: product planning / UX writing
- Project source: `website-product-brief.md`
- Audience: 최초 방문한 기관 운영 담당자, 초대받은 위원·간사·검토자, 운영사 관리자
- Purpose: 이용자 관점에서 각 공간의 과업·CTA·권한·동의·다음 상태를 고정
- Output: `05_전반적_이용자_경험_플로우.md`, 갱신된 제품 브리프·화면 명세
- Completion criteria: 공개 사이트와 로그인 후 워크룸/운영사 공간이 분리되고, 핵심 역할별 최초 행동과 상태가 명시됨
- Core hypothesis: 첫 방문자에게 기능 목록보다 회의→제안→제출 경과의 실제 업무 흐름을 먼저 보여 주면 도입 적합성을 더 정확하게 판단할 수 있다.

### Activation decision

| Layer / entry | Status | Why this status | Input → output |
| --- | --- | --- | --- |
| Root AGENTS / Brain | always | 프로젝트 범위·판단·과장 방지 | 기존 MVP 문서 → 사용자 여정 경계 |
| Project Execution Agent | active | 공개 도입과 워크룸의 역할 분리 | 제품 브리프 → 구현 우선순위 |
| Website Product Planning Harness | active | 상황·화면·CTA·동의·이벤트 설계 | 기존 기회 후보·화면 명세 → UX 흐름 정본 |
| Product UI / 1차 인지 UX 기준 | active | 첫 화면과 상태 문구 설계 | UI 원칙 → 상태·행동·결과 문구 |
| Source | reference | 기존 사용자 요청과 내부 문서만 활용, 외부 도입 사실 미주장 | 합성 예시·운영 가설 유지 |
| Style | reference | 업무 설계 문서의 명료성만 적용 | 에세이 문체 미적용 |
| Eval | active | 화면·동의·권한·상태 누락 점검 | 아래 종료 판정 |

### Execution order

1. 기존 기회 후보와 공개/워크룸/운영사 경계를 다시 확인했다.
2. 최초 방문·파일럿·초대·회의·제안·제출 경과·기수 전환·운영사까지의 사용자 여정을 설계했다.
3. 제품 브리프와 화면 명세를 같은 구조로 갱신했다.
4. 1차 인지 UX, 개인정보·동의 분리, 역할·권한·빈/오류 상태를 Eval 기준으로 점검했다.

### Conflict and boundary check

- Existing rule conflict: 기존 MVP의 로그인 중심 화면은 공개 소개·도입 흐름을 충분히 설명하지 못함. `05` 문서를 공개 사이트 정본으로 추가함.
- Project boundary risk: 도입 안내가 실제 보안·법무·AI 기능 완료를 암시할 위험. 미확정 항목과 AI 금지선을 명시함.
- Public/private or source-provenance risk: 합성 흐름 예시는 실제 기관 사례·성과·후기로 표현하지 않음.
- Unapproved promotion avoided: 발견한 UX 규칙을 Brain·Style에 승격하지 않음.

### Eval closeout

- Eval file/case: `Eval.md`의 Website Product Planning, Cross-Project Design/UX Writing, 1차 인지 UX 언어 Gate
- Passed: 공통/고유 프레임, 공개·워크룸·운영사 공간 분리, 화면별 CTA·권한·동의·이벤트, 상태 문구, 개인정보 최소수집·AI 경계
- Deferred: 실제 5명 이상 사용자 인터뷰, 공개 소개 페이지 구현·모바일 시각 검수, 문의 수집·동의 문구의 법무 확인
- Final decision: design complete; implementation and user validation pending

---

## Identity and color system extension — 2026-08-22

- Task: 청년거버넌스 운영 플랫폼의 핵심 컬러·디자인 콘셉트·아이덴티티 제안 및 화면 반영
- Task type: product identity / visual implementation
- Project contract: `website-product-brief.md`, 공개 소개와 워크룸·운영사 콘솔을 같은 제품 언어로 연결
- Core hypothesis: 기존 녹색보다 딥 인디고·Link Blue 체계가 기록·연결·공공 신뢰와 청년 참여의 움직임을 더 분명히 구분한다.

| Layer / entry | Status | Why this status | Input → output |
| --- | --- | --- | --- |
| Root AGENTS / Brain | always | 과장·권위주의·개인 점수화 방지 | 제품 경계 → 아이덴티티 금지선 |
| Project Execution Agent | active | 제품·공개·워크룸 화면의 일관된 전환 | UX 정본 → 전역 색상 토큰 |
| Website Product Planning Harness | active | 1차 인지·공개 사이트/업무 화면의 역할 분리 | 화면 구조 → 색·행동색 배분 |
| Style Product UI Design Standard | active | 컨테이너·타입·행동색·반응형 일관성 | 기존 디자인 토큰 → Link Blue 시스템 |
| Source | reference | Viewof/Nextclass의 관찰은 구조 비교용으로만 사용 | 레퍼런스 → 채택·제외 근거 |
| Eval | active | 색상 과장·레퍼런스 복제·상태 문구 침범 점검 | 반영 범위 → 보류 항목 |

- Applied: `06_브랜드_아이덴티티_및_디자인_시스템.md`, 전역 CSS 토큰과 공개/워크룸/Control Plane 색상 전환, 기존 레퍼런스 분석 갱신.
- Excluded: 브랜드명·로고 확정, 실제 참여자 사진, 접근성 도구 기반 대비 판정, 화이트라벨 색상 정책.
- Eval result: 디자인 개념·색상 역할·금지선·보류를 분리했고, 한 행동색 원칙과 1차 인지 UX를 유지함. 실제 모바일 시각 QA와 대비 측정은 보류.

---

## Product-showcase public entry revision — 2026-08-22

- Trigger: 공개 첫 화면은 단순 운영 문제 설명보다, 이 상품 자체를 먼저 보여 주고 써 보고 싶은 사람이 데모로 들어가야 한다는 사용자 피드백.
- Decision: 공개 홈을 제품 쇼케이스로 전환. `제품 → 데모 워크룸 → 이슈·사례 → 운영 기준 → 도입 준비` 순서로 재구성.
- Reference use: 토스 공식 홈의 제품군을 기능·상황·화면으로 연속해서 보이는 구조만 참고했다. 금융 슈퍼앱의 서비스 수, 3D 로고, 수치·혜택·카피는 복제하지 않았다.
- Implemented: `/explore` 로그인 없는 합성 데모 워크룸, `/insights` 합성 이슈·사례 화면, `/about` 제품을 만드는 이유, 제품 쇼케이스형 홈과 내비게이션.
- Boundary: 공개 정보는 일반 뉴스 포털이 아니라 회의·제안에 다시 연결되는 맥락을 보여 준다. 실제 기관·개인·정책 성과는 사용하지 않는다.
- Verification: 새 공개 경로 응답, 클라이언트 자산 반영, 기존 자동 테스트 8건 통과. 실제 사용자 반응·모바일 시각 QA는 보류.

---

## Natural Korean UI language revision — 2026-08-23

- Trigger: 영어 보조 라벨, 임시 이니셜 마크, 장식형 번호가 AI 생성 사이트처럼 보인다는 사용자 피드백.
- Applied: 공개 소개·데모·운영사 화면에서 해당 요소를 제거하고, 한국어 과업 제목과 실제 상태명으로 교체했다.
- Reference: GOV.UK와 USWDS의 제목·라벨·탐색·절차 원칙을 제품 문법으로만 참고했다. 토스는 제품 경험 우선의 공개 진입 구조만 참고했다.
- Excluded: 유행형 SaaS 갤러리의 3D·과한 그라데이션·가짜 수치·영문 eyebrow 문법. 검증되지 않은 YouTube 영상은 채택하지 않았다.

---

## Reusable website design-baseline update — 2026-08-23

- Task: 자연스러운 제품 UI 기준을 디자인 베이스로 고정하고, 사이트 제작 하네스에 반영한 뒤 현재 제품에 적용.
- Routing: `Website Product Planning Harness`와 `Eval.md`를 갱신했다. 전역 Brain에는 넣지 않았다. 이 규칙은 웹·앱 화면의 구현 및 품질 검수 규칙이지, 모든 작업의 정체성 판단이 아니기 때문이다.
- Applied: `08_디자인_베이스.md`, 공개 소개·합성 데모 화면의 텍스트 우선 계층, 비번호형 흐름 표시, 카드·CTA·워크룸 표면 규칙.
- Verification: 제목·상태·다음 행동이 보이는지, 장식용 마크·번호가 남지 않았는지, 앱 구문과 자동 테스트가 통과하는지 확인한다.

---

## UX-language source synthesis — 2026-08-23

- Task: 현재 제품에 적용한 UX 언어와 말투를 고치기 위한 자료·레퍼런스 수집.
- Active: Research Synthesis + Source + Website Product Planning Harness. Style은 문체 원천이 아니라 제품 카피 기준이므로 제외했다.
- Sources: ONS 사용자 필요, Microsoft·Material·Apple의 제품 언어, GOV.UK·NHS·W3C의 폼·오류·접근성 원칙.
- Output: `09_UX_언어_레퍼런스와_카피_기준.md`에 출처, 역할별 말투, 용어·상태 규칙, 현재 카피 수정 후보를 분리해 기록.
- Boundary: 외부 영어 문구를 번역·복제하지 않는다. 실제 파일럿 사용자의 언어 검증 전에는 제안 문구를 확정 카피로 처리하지 않는다.

---

## Reusable UX-language baseline update — 2026-08-23

- Source request: 조사한 UX 언어 자료를 향후 사이트 제작 하네스에 적용 가능한 형태로 반영.
- Routing: 실행 규칙은 `WEBSITE_PRODUCT_PLANNING_HARNESS.md`, 누락을 잡는 질문은 `Eval.md`에 추가했다. 개인 문체·정체성 규칙이 아니므로 Brain·Style·root AGENTS에는 넣지 않았다.
- Added: 화면별 과업·상태·다음 행동·다음 결과, 버튼·용어·오류·빈·권한·고위험 행동 문법, 상태 문구 형식, 검수 질문.
- Verification: 중앙 하네스와 Eval에 삽입된 기준을 검색으로 확인한다. 다음 제품 카피 수정에서는 이 기준과 실제 사용자 언어를 함께 적용한다.

---

## UX-language implementation pass — 2026-08-23

- Applied scope: 공개 홈·합성 데모·운영사 개요의 제목, CTA, 상태·지표 문구.
- Changes: 제품 은유를 과업·결과 문장으로, `보기`·`논의` 중심 CTA를 구체적 다음 행동으로, 감시처럼 들릴 수 있는 `지원 신호`·`흐름`을 확인 대상 문구로 교정.
- Deferred: 워크룸 전체의 역할별 메뉴·모달·오류·고위험 데이터 흐름의 문구는 다음 UI 카피 패스에서 실제 역할별 흐름과 함께 교정.
- Verification: `node --check public/app.js`, 자동 테스트 8건 통과.

---

## Public-home identity background — 2026-08-23

- Trigger: 공개 홈이 지나치게 밋밋하다는 피드백.
- Applied: `기록의 좌표면` 배경. 낮은 대비의 격자·연결 원·선으로 기록의 연결을 보조하며, 공개 홈에만 적용했다.
- Excluded: 3D 오브젝트, 사진 없는 인물 일러스트, 과한 그라데이션, 숫자 장식. 제품 흐름과 CTA를 배경보다 앞에 둔다.
- Verification: 데스크톱 공개 홈 시각 확인. 모바일은 기존 패턴 크기를 줄이는 CSS 규칙으로 대응한다.

---

## Public-route layout variation — 2026-08-23

- Trigger: 메뉴 페이지가 같은 제목·본문·카드 배치로 반복되어 예측 가능해 보인다는 피드백.
- Applied: 이슈·사례는 편집형, 운영 흐름은 오프셋 경로형, 기구별 사용 장면은 교차 목록형, 운영·보안은 기준표형, 소개는 선언형으로 변주했다.
- Invariant: Link Blue·Ink·Paper 토큰, 한국어 과업형 제목, CTA 위계, 모바일 단일 열 읽기 순서는 유지했다.
- Verification: 이슈·사례와 운영 흐름의 데스크톱, 운영 흐름의 375px 모바일 화면을 확인했다.

---

## 청년정책 뉴스와 거버넌스 워크룸의 브랜드 구조 판단 — 2026-08-23

- Task: 청년정책 뉴스 서비스와 청년 거버넌스 활동 관리 도구를 별도 운영할지, 하나의 브랜드 사이트로 엮을지 판단.
- Minimum project contract: 청년 참여기구 운영자가 회의·제안·인수인계를 끝내는 제품의 범위를 지키면서, 정책 정보 탐색의 확장 가능성을 판단한다. 산출물은 브랜드 구조 권고와 검증 가설이다.
- Active: Root AGENTS, Brain, Project Execution Agent, Harness & Skill Inventory Router, Website Product Planning Harness, Eval. Style과 외부 Source는 제외했다. 이번 판단은 현재 제품 정의와 범위의 정합성 검토이며, 시장 규모나 이용자 수에 관한 외부 사실을 주장하지 않는다.
- Evidence checked: `00_청년거버넌스_운영플랫폼_기획안_초안.md`의 MVP 범위, `05_전반적_이용자_경험_플로우.md`의 최초 사용자 상황, `06_브랜드_아이덴티티_및_디자인_시스템.md`와 기존 라우팅 기록의 제품 정체성 및 공개 정보 경계.
- Decision: 하나의 상위 브랜드 아래에 두되, 뉴스는 별도 정보 제품/편집면으로, 워크룸은 별도 업무 제품으로 운영한다. 하나의 홈·메뉴·가입 퍼널에 동등하게 섞지 않는다.
- Boundary: 워크룸의 중심 과업은 회의→결정→제안→경과이며, 뉴스는 그 과업에 다시 연결되는 의제 맥락·출처·확인일·저장/공유 행동을 제공할 때만 제품 안에 들어온다. 범용 뉴스 포털, 대규모 공개 아카이브, 일일 뉴스 소비를 MVP 핵심으로 승격하지 않는다.
- First validation: 공개 뉴스 면에서 `의제별 저장 또는 관련 회의/제안으로 연결`을, 워크룸에서 `외부 자료 첨부 또는 의제 맥락 확인`을 각각 별도 이벤트로 검증한다. 단순 PV를 결합의 성공 지표로 삼지 않는다.
- Eval: 현재 제품의 목적·최초 사용자·MVP 제외 범위와 충돌하지 않는 조건부 권고로 통과. 실제 통합 설계 전에는 뉴스의 편집 책임, 출처·확인일, 갱신 주기, 권리·개인정보, 독립 KPI를 제품 브리프와 화면 명세에 추가해야 한다.

---

## 테넌트별 조직도 편성 — 2026-08-23

- Task: 거버넌스 대시보드에서 각 기구가 자기 조직 단위를 만들고, 구성원의 소속을 정리할 수 있게 구현.
- Applied: 간사·의장단·운영사만 조직 단위를 생성하고 구성원 소속을 배정하도록 서버 권한과 UI를 추가했다. 상위 조직 연결과 테넌트별 데이터 분리를 포함한다.
- Boundary: 조직도는 운영 단위와 소속을 표현할 뿐, 개인별 열성도·평가·서열·민감정보는 저장하거나 표시하지 않는다.
- Verification: 간사 생성·배정, 외부 검토자 변경 거부를 포함한 Node 자동 테스트를 통과했다.

---

## 구독형 뉴스와 워크룸의 계정 경계 판단 — 2026-08-23

- Task: 구독형 청년정책 뉴스의 가입 필요성과 워크룸 계정의 분리·연동 구조 판단.
- Active: 기존 브랜드 구조 판단의 Root AGENTS, Brain, Project Execution Agent, Website Product Planning Harness, Eval. Source·Style은 제외했다. 현재 권한·동의·테넌트 명세를 입력으로 사용했다.
- Decision: `하나의 인증 주체(선택적 SSO) + 두 개의 제품 프로필·권한·결제 영역`으로 설계한다. 이메일 하나로 로그인할 수 있어도 뉴스 구독자와 워크룸 구성원을 같은 고객 레코드·권한·분석·마케팅 수신 동의로 합치지 않는다.
- News account: 개인이 공개 자료 저장, 구독 결제, 알림·관심 의제를 관리하는 자발 가입. 뉴스레터/마케팅 동의와 서비스 이용을 분리하고, 워크룸 초대나 기관 소속을 요구하지 않는다.
- Workroom account: 기관 또는 기구의 초대 수락을 통해 `User + Tenant Membership + Role + Term`이 생기는 업무 접근. 뉴스 구독만으로 워크룸을 만들거나 입장할 수 없고, 한 사람의 다수 테넌트 소속은 멤버십으로 분리한다.
- Link rule: 동일 이메일을 자동 병합하지 않는다. 로그인 뒤 사용자가 명시적으로 연결을 선택할 때만 인증 주체를 재사용한다. 회의·제안·출결·테넌트 정보는 뉴스 개인화·추천·마케팅으로 보내지 않으며, 뉴스 열람 이력도 워크룸 권한·평가에 쓰지 않는다.
- Billing rule: 개인 뉴스 구독과 기관 워크룸 계약은 별도 청구·환불·세금계산서·해지 흐름으로 둔다. 공통 쿠폰이나 번들은 수요가 확인된 뒤 별도 상품으로 검증한다.
- MVP sequence: 뉴스는 공개 열람 + 선택적 저장/구독부터, 워크룸은 초대 기반 로그인부터 시작한다. SSO는 두 제품을 함께 쓰는 사용자가 충분히 확인된 뒤 도입한다. 지금은 공통 사용자 ID를 전제로 데이터 모델을 고정하지 않는다.
- Eval: 워크룸의 테넌트 격리, 최소수집, 동의 분리, 초대 기반 권한 모델과 정합. 실제 도입 전에는 개인정보 처리 주체·방침, 인증 제공자, 계정 삭제/연결 해제, 교차 제품 분석 범위를 별도 확정해야 한다.

---

## Google OAuth 로그인 구현 — 2026-08-23

- Task: 워크룸에 쉬운 Google 로그인 경로를 추가한다.
- Active: Root AGENTS, Brain, Project Execution Agent, Website Product Planning Harness, Eval. Style·Source는 제외했다.
- Implemented: Google OAuth Authorization Code 흐름, 10분 만료 상태값, Google의 이메일 확인 뒤 12시간 HttpOnly SameSite=Lax 세션 쿠키 발급, 설정 여부에 따른 로그인 버튼 표시를 추가했다.
- Boundary: Google 이메일이 기존의 활성 워크룸 사용자와 일치할 때만 세션을 만든다. 신규 사용자·테넌트·권한을 자동 생성하지 않으며, 초대되지 않은 이메일은 간사에게 초대를 요청하도록 안내한다. 기존 비밀번호 데모 로그인은 유지한다.
- Required deployment input: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, 그리고 배포 환경에서는 등록된 HTTPS 콜백 주소의 `GOOGLE_REDIRECT_URI`.
- Verification: `node --check server.mjs`, `node --check public/app.js`, `npm test` 통과. 실제 Google 콘솔 설정과 실계정 콜백은 인증정보가 제공된 뒤 별도 확인이 필요하다.

---

## Kakao OAuth 로그인 구현 — 2026-08-23

- Task: 카카오 로그인 경로를 Google 로그인과 같은 워크룸 계정 경계로 추가한다.
- Implemented: 카카오 인가 코드 요청, 10분 상태값, 토큰 교환, 사용자 정보의 확인된 이메일 확인, HttpOnly 세션 쿠키, 설정 여부에 따른 로그인 버튼을 추가했다.
- Boundary: 카카오의 `account_email` 동의와 확인된 이메일이 필요하며, 그 이메일이 활성화된 기존 워크룸 사용자와 일치할 때만 세션을 발급한다. 신규 사용자·테넌트·권한을 자동 생성하지 않는다.
- Required deployment input: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, 배포 시 등록한 HTTPS 주소의 `KAKAO_REDIRECT_URI`. 카카오 디벨로퍼스에서 카카오 로그인·Redirect URI·이메일 동의항목을 함께 설정해야 한다.
- Verification: 구문 검사와 OAuth 시작 경로(미설정 차단, 설정 시 카카오 인가 URL 생성)를 자동 테스트에 추가했다. 실제 카카오 앱 설정·실계정 콜백은 키를 넣은 뒤 확인한다.

---

## 참여기구 기본 정보 카드 — 2026-08-24

- Task type: implementation / dashboard information architecture.
- Project: `website-product-brief.md`의 테넌트별 워크룸·최소수집 원칙을 적용했다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, Project Execution, Website Product Planning, Eval. Style·외부 Source는 제외했다. 새 외부 사실이나 브랜드명을 만들지 않는 로컬 MVP 수정이기 때문이다.
- Implemented: 내 정보·데이터에 참여기구 프로필 카드와 대표·업무 연락처·근거 조례·임기·활동 기간·기수 요약을 추가했다. 로고는 HTTPS 이미지 또는 약칭 마크로 표시한다. 위원장과 운영사 관리자만 수정할 수 있고, 대표 연락처는 공개 가능한 업무용으로 한정한다.
- Boundary: 실제 기관·조례·연락처를 기본값으로 사용하지 않았다. 조례 예시는 합성으로 표기하고, 전체 생년월일·민감정보·개인 연락처는 추가 수집하지 않는다.
- Eval: 구문 검사, API 권한 테스트, 기존 테넌트 격리 테스트, 로컬 HTTP 확인으로 종료한다. 실제 로고 저작권·기관 연락처 공개 범위·조례 링크는 실제 도입 전 확인이 필요하다.

---

## 위원장 핵심 운영 흐름 완결 — 2026-08-24

- Task: 위원장 관점에서 막혔던 초대·가입 승인, 회의 운영, 정보 발행, 컨설팅 접근, 제안 협업·결정 흐름을 실제 API와 화면으로 연결한다.
- Active: Root AGENTS, Brain, Project Execution, Website Product Planning, Eval. Style·외부 Source는 제외했다. 외부 사실을 만들지 않는 로컬 합성 데이터 MVP 수정이기 때문이다.
- Implemented: 14일 만료·회수 가능한 초대 링크와 가입 신청·승인, 참석 대상·응답·실제 출결·결정·CSV가 있는 회의, 이슈·공지·링크형 자료 등록, 외부 검토자 배정과 제안서 열람 권한, 기여자·결정 상태·버전 경과를 연결했다.
- Boundary: 링크는 복사·공유만 제공하며 실제 이메일·메신저 발송은 하지 않는다. 파일은 안전한 HTTPS 링크로만 등록하고 바이너리 업로드는 열지 않는다. 실제 기관·개인정보·외부 알림은 사용하지 않는다.
- Eval: `node --check server.mjs`, `node --check public/app.js`, 17개 자동 테스트, 테넌트 격리·권한 회수·초대 승인 흐름, 로컬 HTTP 재기동 확인으로 판정한다.

---

## 기수 인계·활동 리포트·초대 문구 — 2026-08-24

- Task type: implementation / dashboard information architecture.
- Project: `website-product-brief.md`의 ‘회의·제안·인수인계 연결’ 완료 기준을 기수 권한 전환과 기간 활동 리포트까지 확장했다. 핵심 가설은 다음 기수가 이전 활동을 새로 해석하지 않고, 기록·권한·우선 과제를 받은 상태에서 시작할 수 있다는 것이다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, Project Execution, Website Product Planning, Eval, Browser local-web-development verification. Style·외부 Source는 제외했다. 새 외부 사실이나 브랜드 문구를 만들지 않는 로컬 합성 데이터 구현이기 때문이다.
- Implemented: 기수 인계 계획, 다음 운영진 초대·가입 승인 뒤 권한 전환, 선택 아카이브를 포함한 자동 인계 패키지, 그룹 단위 기간 활동 리포트, OpenAI API 선택형 검토 문안 경로, 메신저·메일용 초대 문구와 기본 메일 앱 전달 경로를 추가했다.
- Boundary: 실제 이메일·메신저 발송과 수신 추적은 하지 않는다. AI API에는 개인 이름·연락처·개인별 점수 없이 리포트 집계값만 보낼 수 있으며, 키가 없으면 규칙 기반 리포트만 작동한다. AI의 문안은 사람의 운영 판단·제출·법적 판단을 대체하지 않는다.
- Eval: `node --check server.mjs`, `node --check public/app.js`, 18개 자동 테스트, localhost HTTP 200, 위원장 로그인 후 기수 인계·리포트 화면 DOM 및 콘솔 오류 없음으로 판정한다. 실제 API 키 호출·요금·기관 데이터 전송은 키와 계약이 제공된 뒤 별도 검증이 필요하다.

---

## 대표자 데모 프로필 정렬 — 2026-08-24

- Task type: implementation / synthetic demo data adjustment.
- Active: Root AGENTS, Brain, Project Execution, Eval. Style·Source는 제외했다. 사용자가 명시한 본인 이름을 합성 데모의 대표자 표시값으로 반영하는 로컬 데이터 조정이다.
- Implemented: `chair-1`의 표시 이름과 직업을 박진감·청년정책 활동가·위원장으로 바꾸고, 2030자문단 시뮬레이션의 대표자 직책·업무용 데모 연락처를 위원장·대표 기준으로 정렬했다. 계정 ID와 이메일은 데모 전용으로 유지해 기존 회의·제안·감사 기록 연결을 보존했다.
- Boundary: 실제 기관·실제 개인 연락처로 표기하지 않고 `chair@workroom.demo`, `02-2030-2030` 합성 연락처를 유지한다.

---

## 유료 운영·후원 좌석 이용 구조 — 2026-08-24

- Task type: implementation / product boundary and operating-console update.
- Project: `website-product-brief.md`의 공개 체험 → 실제 운영 전환 흐름을 보완했다. 핵심 가설은 실제 운영·저장·지원·보고가 계약 구조에 포함되어야 다기관 제품의 책임과 비용 주체가 흐려지지 않는다는 것이다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, Project Execution, Website Product Planning, Eval. Style·외부 Source는 제외했다. 사용자가 확정한 사업모델 변경을 로컬 제품·권한·문서에 반영하는 작업이며, 외부 시장 사실을 새로 주장하지 않는다.
- Implemented: `ServiceAccess`에 `템플릿·체험 / 기관 계약 / 후원 좌석`, 이용 상태, 합성/실운영 구분, 후원 주체·좌석·기간·지원 범위를 추가했다. 운영사 콘솔과 공개 파일럿 페이지에 같은 경계를 표시하고, 새 템플릿 체험 테넌트 구성원은 서버에서 운영 기록 저장이 차단된다. 합성 데모는 기능 검증을 위한 예외로 명시했다.
- Boundary: 결제, 계약 체결, 청구, 후원금 정산, 자동 갱신·만료 차단, 실제 계약·개인정보 처리는 구현하지 않았다. 후원 주체는 참여기구의 기록을 자동 열람하지 않는다.
- Eval: `node --check server.mjs`, `node --check public/app.js`, 19개 자동 테스트, 로컬 HTTP 확인으로 종료한다.

---

## 파일럿 문의 접수·운영사 알림 — 2026-08-24

- Task type: implementation / public conversion flow and operator notification.
- Project: 공개 파일럿 점검을 실제 도입 문의로 연결하되, 문의 정보가 테넌트 운영 데이터나 마케팅 DB로 섞이지 않게 했다. 완료 기준은 공개 폼 접수, 운영사 전용 열람·상태 변경, 외부 발송 미설정 시에도 정확한 상태 표시다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, Project Execution, Website Product Planning, Eval. 외부 Source는 Resend 공식 이메일 전송 API 문서만 구현 설정 검증에 참조했고, Style은 제외했다.
- Implemented: 최소 문의 필드와 문의 처리 동의, 서버 저장·15분 기준 요청 제한·허니팟, 운영사 전용 `도입 문의` 접수함과 상태 변경, 선택형 Resend 이메일 알림 시도를 구현했다. 이메일 비밀값은 환경변수만 사용하며, 발송 미연결·실패도 접수함에 표시한다.
- Boundary: 실제 이메일이 수신되려면 수신 주소·발신 인증 도메인·Resend API 키를 배포 환경 비밀관리로 제공해야 한다. 자동 회신, CRM 동기화, 마케팅 동의, 실제 보존·삭제 처리, 이메일 전달 성공의 외부 검증은 구현하지 않았다.
- Eval: `node --check server.mjs`, `node --check public/app.js`, 20개 자동 테스트, localhost `/pilot` HTTP 200과 운영사 bootstrap의 접수함·이메일 설정 상태 확인으로 종료한다.

---

## 대표 계정·비밀번호 변경 — 2026-08-24

- Task type: implementation / representative account setup.
- Project: 행정안전부 2030자문단 시뮬레이션의 대표·위원장 박진감이 공용 역할 이메일 대신 전용 로그인 아이디로 들어가고, 첫 로그인 뒤 초기 비밀번호를 바꾸는 흐름을 마련했다.
- Active: Root AGENTS, Brain, Project Execution, Eval. Style·외부 Source는 제외했다. 실제 신원·기관 이메일·외부 인증을 임의로 만들지 않는 로컬 계정 구조 수정이다.
- Implemented: `chair-1`에 `parkjingam` 로그인 아이디와 초기 비밀번호 변경 표시를 추가했다. 로그인은 아이디 또는 이메일을 받으며, 현재 비밀번호 확인·12자 이상 새 비밀번호·해당 계정의 기존 세션 회수·감사 로그를 포함한다.
- Boundary: 이 환경은 로컬 합성 데이터라 초기 비밀번호 `demo1234`가 남아 있다. 실제 배포 전에는 이메일 인증, 비밀번호 재설정, MFA, 비밀관리, 실제 업무용 이메일·도메인 검증을 적용해야 한다.
- Eval: `node --check server.mjs`, `node --check public/app.js`, 21개 자동 테스트, `parkjingam` 로그인과 대표·위원장·초기 변경 필요 상태의 localhost 확인으로 종료한다.

---

## 조직도 배치·직책 회수와 되돌리기 — 2026-08-25

- Task type: implementation / governance organization control.
- Active: Root AGENTS, Brain, Project Execution, Eval. 실제 기관 계정·개인정보·외부 연동 없이 합성 테넌트의 역할·소속 상태만 다룬다.
- Implemented: 조직 단위별 소속·겸임 배치 또는 운영 역할 변경을 서버 이력으로 최대 50건 보관한다. 관리 권한자는 특정 소속만, 모든 조직 배치, 또는 운영 역할을 일반위원으로 회수할 수 있고, 화면의 되돌리기와 Ctrl/Cmd+Z는 가장 최근 조직도 변경을 서버에서 복원한다.
- Boundary: 일반위원에게 변경 이력을 전달하지 않으며, 회수·되돌리기 권한도 서버에서 테넌트별로 검사한다. 장기 인사 이력, 승인 워크플로우, 역할 변경 알림은 후속 범위다.
- Eval: `node --check server.mjs`, `node --check public/app.js`, 권한·회수·되돌리기 자동 테스트, localhost 로그인 후 조직도 UI 확인으로 판정한다.

---

## 회의 상세 패널의 인라인 입력 크기 — 2026-08-25

- Task type: implementation / responsive layout correction.
- Project contract: 위원장이 회의의 결정·과제를 입력할 때, 데스크톱의 좁은 상세 패널과 모바일 모두에서 입력값·담당자·기한·추가 버튼이 잘리지 않고 읽혀야 한다. 완료 기준은 한국어 버튼이 세로로 줄바꿈되지 않고, 패널 폭에 맞춰 입력 행이 재배치되는 것이다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, Project Execution, Eval. Style·Source·외부 레퍼런스는 문장·사실 조사 작업이 아니므로 제외했다. `dashboard/harness_index.json`과 실제 Core/Project Execution/Eval 파일을 대조했으며, 별도 거버넌스 프로젝트 파일은 없어 최소 계약으로 고정했다.
- Implemented: 회의 상세 패널을 컨테이너 기준 반응형 영역으로 만들고, 결정·과제 입력 폼을 `minmax(0, ...)`로 축소 가능하게 했다. 한국어 버튼은 최소 폭과 줄바꿈 금지 규칙을 부여했고, 패널 폭 620px 이하에서는 제목 입력·나머지 필드·전체 폭 버튼 순으로 재배치한다. 같은 패널의 회의 관리 버튼도 줄바꿈 가능한 행으로 정리했다.
- Boundary: 화면 폭보다 패널 폭을 기준으로만 수정했으며, 회의 데이터·권한·입력 흐름은 바꾸지 않았다. 브라우저에 비밀번호를 입력하는 테스트는 사용자 인증정보 전송을 피하기 위해 수행하지 않았다.
- Eval: `node --check public/app.js`, `npm test`, CSS 변경 범위 점검과 localhost 정적 자산 확인으로 판정한다.

---

## 좌측 기구명 표시 기준 통일 — 2026-08-25

- Task type: implementation / data-display consistency correction.
- Project contract: 참여기구 정보에서 바꾼 기구명이 좌측 워크룸 카드에도 같은 값으로 표시돼야 한다. 완료 기준은 운영사 콘솔을 제외한 사이드바가 `organizationProfile.displayName`을 우선하고, 미입력 기구는 기존 테넌트명으로 안전하게 표시하는 것이다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, Project Execution, Eval. Style·Source는 제외했다. 이 수정은 화면 표시 기준만 통일하며, 테넌트 내부 식별자·초대 문구·조직도 루트 이름을 임의로 바꾸지 않는다.
- Implemented: 사이드바의 기구명 기준을 테넌트 초기 이름에서 참여기구 프로필의 표시명 우선 구조로 변경했다.
- Eval: `node --check public/app.js`, `npm test`, localhost의 대표 계정 bootstrap 데이터와 정적 앱 자산을 확인한다.

---

## 청년참여기구 정책 환류 운영시스템 고도화 계획 — 2026-08-30

- Task type: product planning / implementation roadmap.
- Project contract: 기존 다기관 청년거버넌스 워크룸을, 청년의 정책제안이 소관 부서 배정·검토·결정 사유·재검토·공개 회신·기수 인계까지 남는 지자체 운영시스템으로 고도화한다. 독자는 참여기구 청년, 운영기관 실무자, 청년정책 담당 공무원·소관 부서, 기관장이다. 이번 산출물은 구현 지시가 아닌 우선순위·데이터·권한·단계 계획이며, 완료 기준은 현재 MVP와 새 환류 모델의 유지·교체·후속 범위가 분명한 것이다.
- Core hypothesis: 기존 참여기구 운영의 가장 큰 반복 손실은 제안 자체의 부족이 아니라, 접수 이후 담당·기한·결정 사유·다음 행동·청년 회신이 분리되어 기수와 담당자 교체 때 사라지는 데 있다. 첫 도입 기관은 제안 1건의 책임 이력을 끝까지 완결할 수 있는 도구에 반응할 것이다.
- Inventory and activation: Root AGENTS, Brain, Harness & Skill Inventory Router, `identity-harness-autopilot`, Project Execution, Product Planning Insight, Website Product Planning Harness, Source Registry, Eval, TEST_CASES를 확인했다. `dashboard/harness_index.json`은 발견용으로 대조했고 현재 프로젝트 전용 Project.md는 없어 최소 계약을 사용했다. `codex-delivery-loop`은 이번 turn이 구현·UI 납품이 아닌 제품계획이므로 reference, Style은 문체 산출물이 아니므로 excluded, Keyword and Item Discovery는 시장·고객 인터뷰 실험 전 단계라 reference로 남겼다.
- Inputs → procedure → output: 사용자 고도화 계획·현재 MVP의 Proposal/Consultation/Submission/Progress/Handover/Audit 구현을 대조하고, 빠띠 믹스 공식 소개의 그룹·제안·토론·실행 아카이빙·권한관리 범위를 확인했다. 표면 문제 20개를 분해해 `소관·기한·결정 사유·회신`의 책임 이력과 `내부 검토/청년 공개 회신` 분리를 첫 두 병목으로 선정한다. 결과물은 역할 분리, 사건 이력 모델, 단계별 릴리스, 파일럿 전 외부 결정 목록이다.
- Boundary and source: 빠띠 믹스의 기능을 과소평가하지 않는다. 공식 소개상 제안·토론·실행 아카이빙·권한관리가 이미 있으므로, 차별점은 공론장 부재가 아니라 지자체의 제안 처리 책임 이력이다. 실제 행정결정의 법적 효력, 기록물 보존, 부서 SSO·알림·공문 연계는 기관 권한·법무·보안 결정 전에는 구현 완료로 부르지 않는다.
- Eval: 계획은 기존 기능을 폐기하지 않고 좁은 수직 흐름으로 재사용하며, 공식 결정 권한·내부 메모·공개 회신·개인정보 범위를 분리하는지 점검했다. 고객 인터뷰·유료 파일럿·법무·기관 기록물 검토가 남아 있으므로 시장성·법적 적합성은 unverified다.

---

## 통합 운영센터 — 2026-08-23

- Task: 거버넌스 워크룸과 청년투게더의 지표·권한을 다루는 별도 운영자 공간을 기획하고 구현.
- Minimum project contract: 플랫폼 운영자가 서비스별 연결 상태, 운영 신호, 권한 경계, 감사 기록을 확인한다. 산출물은 `/admin` 통합 운영센터, 보안 기본값, 연결 설계 문서다. 완료 기준은 일반 사용자의 관리자 API 차단, 연결되지 않은 청년투게더 지표의 비표시, 자동 테스트 통과다.
- Active: Root AGENTS, Brain, Project Execution Agent, Keyword and Item Discovery Harness(기존 opportunity/evidence 산출물 참조), Website Product Planning Harness(기존 제품·화면 명세 참조), Sites building, Eval. Style·외부 Source는 제외했다. 이 작업은 제품 구현과 기존 명세 정합성 검토이며 외부 시장 사실을 주장하지 않는다.
- Decision: 하나의 플랫폼 운영센터에서 두 서비스를 보되, 서비스별 데이터·권한·동의는 합치지 않는다. 청년투게더는 승인된 읽기 전용 연결 전까지 `연결 대기`와 연결 요건만 표시한다.
- Security boundary: 세션을 브라우저 저장소에서 제거하고 HttpOnly SameSite 쿠키로 전환했다. 보안 헤더와 쿠키 기반 변경 요청의 동일 출처 검증을 추가했다. `SESSION_COOKIE_SECURE=true`는 HTTPS 운영 배포의 필수 환경 설정이다.
- Deferred: 청년투게더의 실제 상태 API·전용 서비스 계정·비밀관리·운영 MFA·관리형 DB·독립 침투 테스트는 외부 운영 결정과 인증정보가 필요하므로 구현하지 않았다.
- Eval: 구현 후 구문 검사와 권한·격리 자동 테스트로 판정한다.

---

## 청년 활동가·기관 운영자 통로와 전달 알림 — 2026-08-31

- Task contract: 공개 첫 화면부터 청년 활동가와 기관 운영자의 진입 목적을 구분하고, 청년이 정책제안을 전달하면 기관 역할 계정에 수신함·알림이 생기며 기관의 확인·답변이 작성자에게 되돌아오는 최소 수직 흐름을 구현한다. 완료 기준은 역할 선택이 권한 승격 없이 작동하고, 같은 테넌트 안의 전달·확인·답변·알림과 다른 테넌트 차단이 자동·화면 검증으로 확인되는 것이다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `identity-harness-autopilot`, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, UX language baseline, Eval, TEST_CASES, Browser control skill. Style은 문체 산출물이 아니므로 excluded, Keyword and Item Discovery는 이번 변경이 신규 시장 탐색이 아닌 기존 MVP 수직 흐름 구현이므로 reference, 외부 Source는 새 시장·정책 사실을 주장하지 않아 excluded다.
- Input → procedure → checks → output: 기존 공개 홈·초대 기반 인증·테넌트 역할·Proposal 모델을 입력으로 사용했다. 홈과 `/login?entry=youth|institution`에 역할별 과업을, Proposal에 `institutionDelivery`를, 사용자별 `notifications`를 추가했다. 서버는 작성자·공동 작성자만 전달 가능, 위원장·운영·간사만 기관 확인·답변 가능, 수신·답변 알림은 작성자·공동 작성자에게만 생성하도록 검사한다. 출력은 `기관 수신함`, 인앱 알림, 선택형 브라우저 알림, 화면·README·UX 흐름 명세다.
- Boundary: 역할 선택은 화면 안내일 뿐 계정의 역할·테넌트·권한을 바꾸지 않는다. 기관 통로는 공식 행정결정·부서 결재·공문·이메일/카카오/문자 발송·백그라운드 푸시를 구현하지 않는다. 브라우저 알림은 사용자가 직접 허용하고 페이지가 열려 있을 때만 표시한다. 합성 데이터·테넌트 격리 원칙을 유지한다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 25건 통과. 자동 테스트로 전달 → 기관 수신 알림 → 기관 확인·답변 → 작성자 알림과 타 테넌트 전달 차단을 확인했다. 브라우저에서 홈 역할 카드·기관 로그인 통로 DOM, 390px 모바일 카드 폭 343px 및 가로 오버플로 없음까지 확인했다. 브라우저에 비밀번호를 입력하는 검수는 수행하지 않았고, 실제 이메일·푸시·기관 계정·공식 기록물 연동은 unverified다.

---

## 자연스러운 클릭·메뉴 전환 — 2026-08-31

- Task contract: 공개 홈·로그인과 워크룸에서 메뉴·카드·버튼을 눌렀을 때 화면이 즉시 갈아끼워지는 인상을 줄이고, 사용자의 행동과 화면 전환을 짧고 절제된 모션으로 연결한다. 완료 기준은 클릭 확인, 메뉴·상세·달력 화면 전환, 모달 열기·닫기가 작동하며 저장·제출 결과를 꾸며낸 로딩으로 표현하지 않고 `동작 줄이기` 환경도 존중하는 것이다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `identity-harness-autopilot`, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval, TEST_CASES, Browser control skill. Style·외부 Source는 문체·새 사실 조사 작업이 아니므로 excluded, Keyword and Item Discovery는 기존 제품의 UI 보정이므로 reference다. `dashboard/harness_index.json`은 발견용으로만 대조하고, 프로젝트 전용 Project.md 부재는 이 계약으로 보완한다.
- Input → procedure → output: 현재 단일 페이지 렌더 구조와 디자인 베이스를 입력으로 삼아, 메뉴·상세·달력 이동 직전에 `viewMotion` 상태를 부여하고 공개·워크룸 콘텐츠에만 짧은 진입 모션을 적용한다. 버튼·행·카드는 눌림과 색·경계 전환을, 알림은 짧은 진입을, 모달은 열기·닫기 전환을 제공한다. 결과물은 `public/app.js`, `public/additional.css`, 디자인 베이스의 모션 기준이다.
- Boundary: 서버 API, 권한, 데이터 저장 순서와 알림 의미는 바꾸지 않는다. 실제 처리 중이 아닌 행동에는 스피너·지연·가짜 진행률을 추가하지 않는다. 배포 브라우저나 실제 기관 계정에 로그인해 검증하지 않는다.
- Eval: `node --check public/app.js`, `npm test`, 로컬 브라우저에서 공개 홈→역할별 로그인과 모달·메뉴 전환, 390px 모바일 및 키보드 초점·콘솔 오류를 확인한 뒤 판정한다.

---

## 위원회 소개자료·명단 검토 반영 — 2026-09-01

- Task contract: 위원회 기본 소개자료와 명단(HWP/HWPX/PDF/XLSX/CSV/TXT)을 워크룸에 올리되, 즉시 기구 정보·계정으로 확정하지 않고 `업로드 → 추출 초안 → 위원장 수정·행별 선택 → 최종 반영 → 별도 초대`로 처리한다. 완료 기준은 원본·초안의 권한 분리, 사람이 검토하지 않은 값의 미반영, 테넌트 격리, 선택 행 반영 및 안내 문서다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `identity-harness-autopilot`, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval, TEST_CASES. HWP, PDF, spreadsheets, documents skills은 형식별 안전한 추출 경계 점검에만 사용했다. Style·외부 Source는 이번 요청이 문체·외부 사실 조사가 아닌 로컬 기능 구현이므로 제외했다.
- Decision: 범용 변환 의존성을 서버에 추가하지 않았다. CSV와 XLSX는 크기·압축해제 한도가 있는 경량 파서로 초안을 만들고, HWPX/PDF는 텍스트를 읽을 수 있을 때만 참고한다. 구형 HWP·스캔 PDF·복잡한 표는 실패를 숨기지 않고 수동 검토·재저장을 안내한다. 원본은 공개 경로가 아닌 로컬 임시 보관 경로에 두며, 검토 초안 폐기 시 즉시 삭제하고 30일 뒤 다음 요청에서 정리한다.
- Boundary: 이것은 실제 기록물 관리·문서 진본성 검증·OCR·악성코드 검사·암호화 저장·기관 보존기한 판정 기능이 아니다. 실제 파일럿 전에는 기관의 기록물·개인정보 기준, 배포 환경의 암호화 저장소와 백그라운드 파기, 파일 악성코드 검사, 담당자 승인 규칙을 확정해야 한다.
- Eval evidence: `node --check server.mjs`, `node --check public/app.js`, `npm test` 27건 통과. 자동 테스트로 CSV 초안 생성→위원장 수정→선택 행 최종 반영, 일반위원 비공개, 타 테넌트 수정 차단, XLSX 행 읽기, 구형 HWP 수동 검토 경로를 확인했다. 실제 HWP/PDF 원본과 브라우저 로그인 상태의 전체 UI는 합성·로컬 외 검증하지 않았으므로 unverified다.

---

## 좌측 워크스페이스 식별 영역 정리 — 2026-09-01

- Task contract: 좌측의 제품명·기구명 영역을 분리 카드 두 개가 아니라 하나의 워크스페이스 식별 카드로 합치고, 기구 로고·기수·대표자와 직책을 함께 보여 준다. 제품 소개와 첫 사용 안내는 계정 영역에서 분리한 보조 동작으로 재배치한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval. Style·Source는 신규 문장·외부 사실 산출물이 아니므로 제외했다.
- Decision: 상단 카드에는 `조직 로고 → 워크스페이스명·기수 → 대표 이름·직책` 순으로만 배치해 현재 소속을 먼저 인지하게 했다. `제품 소개 보기`와 `첫 사용 안내 다시 보기`는 메뉴와 계정 사이의 보조 영역으로 내렸다. 외부 HTTPS 로고 주소가 설정된 경우에만 표시할 수 있도록 이미지 보안 정책을 제한적으로 확장했다.
- Eval: JavaScript 구문·자동 테스트·로컬 서버 응답을 확인하고, 실제 로그인 화면의 수동 시각 검수는 로컬 합성 계정 입력을 피하기 위해 별도 확인 대상으로 남긴다.

---

## 구성원·조직 메뉴 통합 — 2026-09-01

- Task contract: 분리된 `구성원·임기`와 `조직도` 메뉴를 하나의 `구성원·조직` 작업 화면으로 통합한다. 조직 단위·배치·직책·되돌리기와 초대·승인·명단·임기 관리가 같은 정보 영역에 있어야 한다.
- Decision: 조직도와 배치 제어를 먼저 두고, 아래에서 초대·자료 가져오기·명단·임기를 관리하도록 재배치했다. 메뉴 하나를 제거하되 기존 권한·배치·회수·Ctrl/Cmd+Z 동작은 새 `members` 탭을 기준으로 유지한다.
- Eval: `node --check public/app.js`, `npm test` 및 메뉴 식별자 검색으로 기존 조직도 전용 탭 참조가 남지 않는지 확인한다.

---

## 운영 드라이브·자료 아카이브 — 2026-09-01

- Task contract: 자료 아카이브를 단순 목록이 아니라 테넌트별 운영 드라이브로 전환한다. 다른 메뉴의 회의·정책제안·이슈·공지·인수인계·리포트를 원본과 분리한 보관본으로 넣고, 폴더·표 보기·미리보기·메모 파일·이동·수정 이력·기수 정보를 한 흐름에서 제공한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `identity-harness-autopilot`, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval, TEST_CASES. Style·외부 Source는 신규 문체 또는 외부 사실 조사 작업이 아니므로 제외했다.
- Decision: 원본 운영 기록을 파일처럼 직접 이동하거나 바꾸지 않고, 시점 사본을 `record_snapshot`으로 만든다. 아카이브 기본 폴더는 회의·운영 기록, 정책제안, 공지·이슈, 기수 인계, 운영 메모, 기타 자료이며, 위원장은 사용자 폴더를 추가할 수 있다. 항목별 `history`와 `notes`에는 실행자, 현재 기수, 시간, 변경 내용을 남긴다. 목록형은 스프레드시트 열 구조, 미리보기형은 폴더 카드 구조로 제공한다.
- Boundary: 임의 바이너리 파일의 업로드·다운로드, 실제 이미지 썸네일·폴더 자동 분류, OCR, 파일 버전 비교, 악성 파일 검사, 법정 기록물 보존 자동판정은 포함하지 않는다. 기존 소개자료·명단 업로드는 검토 초안 흐름을 유지하며 범용 드라이브 저장으로 합치지 않는다.
- Eval evidence: `node --check server.mjs`, `node --check public/app.js`, `npm test` 28건 통과. 자동 테스트로 폴더 생성, 회의 기록 보관, 기수 메모, 폴더 이동과 이력, 원본 보관 갱신, 일반위원의 관리자 API 차단을 확인했다. 실제 이미지 파일·이진 파일과 로그인 상태에서의 시각적 미리보기는 아직 unverified다.

---

## 좌측 고정 계정 레일·보조 아이콘 — 2026-09-01

- Task contract: 좌측 바의 제품 소개·첫 사용 안내 텍스트 영역을 하단 아이콘 두 개로 축소하고, 긴 본문·메뉴에서도 로그인한 사람의 이름·직책·로그아웃 영역이 움직이지 않도록 한다.
- Active: Root AGENTS, `codex-delivery-loop`, Browser control, Project Execution, Eval. 외부 Source·Style은 외부 사실 조사나 문체 산출이 아니므로 제외했다.
- Decision: 데스크톱에서 좌측 바를 전체 높이 고정 레일로 두고 메뉴만 내부 스크롤한다. 계정 영역 다음에 제품 소개와 첫 사용 안내를 설명 툴팁이 있는 단색 선 아이콘으로 배치했다. 모바일에서는 고정 레일을 해제해 콘텐츠 공간과 조작성을 보존한다.
- Eval evidence: `node --check public/app.js`, `npm test` 28건 통과. 브라우저에서 공개 홈의 로컬 응답·DOM을 확인했다. 로그인 상태의 긴 워크룸 스크롤은 브라우저에 계정 비밀번호를 입력하지 않아 별도 수동 시각 확인 대상으로 남긴다.

---

## 조직도 선택형 분과 현황 — 2026-09-01

- Task contract: `구성원·조직` 진입점을 `조직도·분과 관리`로 정리하고, 조직도 카드 선택에 따라 해당 분과의 구성원·최근 활동·진행 현황을 같은 화면에서 바꿔 보여 준다. 별도 활동 계획 요약은 제거한다. 미배치 구성원이 있으면 즉시 배치 흐름을 제시한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval, Browser control. Style·외부 Source는 신규 문체·외부 사실 산출이 아니므로 제외했다. `dashboard/harness_index.json`은 발견용으로만 취급했고, 프로젝트 전용 Project.md 부재는 이 계약으로 보완했다.
- Decision: 조직도 카드는 드래그 배치 대상인 동시에 선택 가능한 버튼이다. 일반 선택은 `selectedOrgNodeId`만 바꾸며, 배치 대기 상태에서는 기존처럼 같은 카드 클릭이 배치를 수행한다. 최근 활동은 선택 분과명과 분과명 안의 핵심어로 회의 제목·안건을 연결한다. 미배치 안내의 `배치 시작`은 첫 미배치 구성원을 선택해 바로 조직도 배치 모드로 들어간다.
- Boundary: 분과별 회의와 제안을 별도 데이터 모델로 새로 만들지 않았다. 현재 MVP의 회의 제목·안건과 구성원 배치 기록에서 현황을 계산한다. 실제 기관의 조직·개인 데이터, 자동 배치 추천, 활동 평가·순위화는 포함하지 않는다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 28건 통과. 로컬 공개 홈과 비로그인 데모의 렌더 DOM을 확인했다. 인증된 대표 계정 화면의 카드 클릭·긴 화면 배치는 비밀번호를 브라우저에 입력하지 않아 수동 확인 대기다.

---

## 전체 명단 관리 화면 — 2026-09-01

- Task contract: 좌측에 `전체 명단 관리`를 추가해 위원장이 구성원의 선택형 기본 정보, 역할·임기, 분과·직책, 실제 출결, 정책제안, 진행 과제·계정 상태를 한 화면에서 확인하고 자료 반영·초대·권한 설정으로 바로 갈 수 있게 한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval. Style·외부 Source는 신규 문체·외부 사실 산출이 아니므로 제외했다. Project.md 부재는 이 최소 계약으로 보완한다.
- Decision: 전체 명단 화면은 `permissions` 권한이 있는 위원장·운영사 관리자만 상세 데이터를 본다. 출결은 실제 출석 기록만으로, 정책제안은 작성·참여 건수와 최근 제안 바로가기로, 활동은 진행 중 결정·과제로 표현한다. 개인 열성도 점수, 비교·순위는 만들지 않는다.
- Boundary: 초대 링크 생성, 명단 파일 검토 반영, 역할·권한 변경은 기존의 검증된 흐름을 재사용한다. 실제 이메일 발송 확인, 일괄 개인정보 수정, 인사평가·자동 경고는 포함하지 않는다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 28건 통과. 로그인된 대표 화면의 시각·가로 스크롤 검수는 비밀번호를 브라우저에 입력하지 않아 수동 확인 대기다.

---

## 전 화면 간격·밀도 보정 — 2026-09-01

- Task contract: 첨부된 회의 상세 화면처럼 정보보다 패널 여백·컨트롤 간격이 먼저 보이는 상태를 줄이고, 전체 사이트의 패널·폼·목록·표·모바일 레이아웃을 일관된 밀도로 정리한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval, Browser control. Style·외부 Source는 새 문체·외부 사실 작업이 아니므로 제외했다.
- Decision: 공통 패널 패딩, 섹션 간격, 입력 높이를 토큰화하고, 불필요한 최소 높이를 제거했다. 회의 상세의 안건·자료는 `레이블 + 내용` 행으로, 참석 응답은 레이블과 선택기가 붙는 하나의 컨트롤 행으로 재구성했다. 모바일에서는 패널 헤더·조직 정보·회의 응답을 세로 흐름으로 바꿔 잘림과 과도한 공백을 피한다.
- Boundary: 화면 구성을 새로 바꾸거나 기능·권한·데이터를 변경하지 않았다. 실제 로그인된 내부 워크룸의 수동 화면 검수는 계정 비밀번호를 입력하지 않아 별도 확인 대상이다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 28건 통과, localhost 200 확인. 브라우저에서 공개 데모 데스크톱과 390px 모바일 스크린샷으로 컨테이너 폭·버튼·카드 줄바꿈을 확인했다.

---

## 기수·소속기관 구분 표기 — 2026-09-01

- Task contract: 좌측 워크룸 식별 카드에서 기수를 소속기관보다 먼저 보이고, 기관명 뒤에는 행정기관 구분을 괄호로 표기한다. 기관 구분은 기본 설정에서 관리하며 `중앙정부`, `광역 지자체`, `기초 지자체` 세 값만 허용한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `codex-delivery-loop`, Project Execution, Website Product Planning Harness, Eval. Style·외부 Source는 신규 문체·외부 사실 조사가 아닌 기존 UI·데이터 모델 보정이므로 제외했다.
- Decision: 좌측 표기는 `기수 | 소속기관 (기관 구분)`으로 고정했다. 참여기구 기본 정보와 운영사 새 테넌트 생성에 동일한 선택 필드를 넣고, 서버에서 허용값을 검증한다. 합성 기준 테넌트는 `2기 | 행정안전부 (중앙정부)`로 초기화했으며, 가져오기 초안에서는 기관 구분 열 별칭도 인식한다.
- Boundary: 실제 행정기관의 소속·유형을 자동 판정하거나 외부 기관 정보를 조회하지 않는다. 기존 테넌트는 대표자가 기본 설정에서 직접 확정해야 한다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 28건 통과, 변경 서버 재시작 후 localhost 200 응답을 확인했다.

---

## 소속기관 보도자료 수집·알림·공유 — 2026-09-01

- Task contract: 이슈·공지 메뉴에서 소속기관의 보도자료를 수집하고, 3시간마다 새 항목을 확인해 워크룸 구성원에게 알린다. 원문은 외부 링크로 열고 제목·링크를 공유할 수 있어야 한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `codex-delivery-loop`, Browser control, Project Execution, Website Product Planning Harness, Eval. Style·외부 Source는 특정 기관 보도자료를 조사·발행하는 작업이 아니라 수집 경계와 로컬 제품 기능 구현이므로 제외했다.
- Decision: 임의 기관 HTML을 자동 수집하지 않고, 위원장이 설정한 HTTPS RSS·Atom 피드만 처리한다. 피드는 내부망·localhost·사설 IP·리다이렉트·1MB 초과 응답을 막고, 제목·원문 링크 해시로 중복을 제거한다. 새 항목은 테넌트 이슈로 저장하며 해당 테넌트 활성 구성원의 인앱 알림에만 기록한다. 앱이 실행 중인 동안 3시간 간격으로 실행하며, 위원장은 수동 수집으로 즉시 점검할 수 있다.
- Boundary: 이메일·카카오·문자·백그라운드 푸시 발송, 기관 홈페이지 HTML 크롤링, 로그인·캡차 통과, 실제 기관 피드의 공식성 판단은 제공하지 않는다. 실제 도입 전에는 기관별 피드 URL, 수집 허용·저작권, 알림 수신 동의·보존, 상시 실행 인프라를 확정해야 한다.
- Eval evidence: `node --check server.mjs`, `node --check public/app.js`, `npm test` 28건 통과, 서버 재시작 뒤 localhost 200 확인. 브라우저에서 로그인 진입과 콘솔 오류 없음은 확인했다. 인증된 이슈·공지 화면의 실제 외부 피드 수집은 기관 공식 URL이 아직 지정되지 않아 unverified다.

---

## 개인 정보·참여기구 데이터 분리 — 2026-09-01

- Task contract: `내 정보·데이터`를 로그인한 사람의 워크룸 프로필·계정·데이터 권리 전용으로 만들고, 참여기구의 공통 기본 정보와 기관 바로가기는 별도 `참여기구 데이터 관리` 메뉴로 분리한다. 기구 공통 정보 수정은 위원장에게만 허용한다.
- Active: Root AGENTS, Brain, Harness & Skill Inventory Router, `codex-delivery-loop`, Browser control, Project Execution, Website Product Planning Harness, Eval. Style·외부 Source는 외부 사실 조사·문체 산출이 아닌 기존 제품 정보 구조와 권한 보정이므로 제외했다.
- Decision: 개인 API는 본인이 이름·선택형 연령대·직업·지역만 수정하도록 한정했다. 참여기구 데이터는 기구명, 소속기관·구분, 대표, 기수·임기, 근거 규정, 로고, 보도자료 피드와 기관 홈페이지·청년정책·참여 안내 HTTPS 바로가기를 보관한다. 읽기는 구성원에게 열어 두되, 수정 API와 UI는 해당 테넌트 위원장으로 제한했다.
- Boundary: 개인 연락처·전체 생년월일·민감정보, 기관 대표 여부의 실제 검증, 임의 URL의 신뢰성 자동 판정은 다루지 않는다. 운영사 관리자도 참여기구 기본 정보 수정자가 아니라는 경계를 적용했다.
- Eval evidence: `node --check server.mjs`, `node --check public/app.js`, `npm test` 30건 통과, 서버 재시작 뒤 localhost 200 확인. 브라우저에서 로그인 진입과 콘솔 오류 없음을 확인했다. 인증된 내부 메뉴의 수동 시각 검수는 계정 비밀번호를 입력하지 않아 unverified다.

---

## 개인 프로필 사진·보조 계정 설정 — 2026-09-01

- Task contract: `내 정보·데이터`에서 개인 프로필 사진을 등록·적용하고, 자주 쓰지 않는 비밀번호 변경과 데이터 권리 기능은 작은 진입점으로 한 번 더 들어가 처리한다.
- Active: Root AGENTS, `codex-delivery-loop`, Project Execution, Eval. 신규 외부 조사나 문체 산출이 아니므로 Source·Style은 제외했다.
- Decision: 프로필 사진은 PNG·JPG·WebP, 2MB 이하만 받고 파일 시그니처와 MIME을 함께 확인한다. 저장 파일명은 난수화하고 공개 정적 경로를 쓰지 않으며, 로그인한 같은 테넌트 사용자만 사용자 ID 기반 API로 읽을 수 있다. 교체·삭제 때 이전 파일을 정리하고 감사 로그를 남긴다. 비밀번호 변경과 데이터 내보내기·삭제/처리정지 요청은 대화상자로 분리했다.
- Boundary: 실제 사용자 사진을 시드에 넣지 않았고, 악성코드 검사·EXIF 처리·객체 저장소·법정 보존/파기는 구현하지 않았다. 실제 도입 전에 해당 운영·보안 정책이 필요하다.
- Eval evidence: `node --check server.mjs`, `node --check public/app.js`, `npm test` 31건 통과. 자동 테스트는 회원의 이미지 등록·동일 테넌트 조회·다른 테넌트 차단·삭제까지 확인했다. 인증된 화면에서 실제 파일 선택은 사용자 계정 비밀번호를 브라우저에 입력하지 않아 별도 수동 확인 대상이다.

---

## 워크룸 메뉴 상단 정보 밀도 정리 — 2026-09-01

- Task contract: 워크룸의 모든 메뉴에서 상단을 `메뉴명 + 한 줄 설명`으로 통일하고, 같은 뜻의 눈썹 문구·대제목·긴 소개를 제거한다.
- Active: Root AGENTS, `codex-delivery-loop`, Project Execution, Eval, Browser control. 기존 제품 UI의 정보 위계 보정이므로 외부 Source·Style은 제외했다.
- Decision: 공통 헤더는 상단 메뉴명 아래 옅은 구분선과 한 줄 설명만 표시한다. 회의·조직도·명단·아카이브·인계 등 각 메뉴 내부의 반복 도입 문구와 중복 섹션 제목은 숨기고, 실제 조작 버튼·표·캘린더·기록 목록을 바로 보여 준다. 상세 기록의 필수 상태·경고·빈 상태 안내는 유지한다.
- Correction: CSS 표시 규칙만으로는 기존 화면을 이미 열어 둔 브라우저에서 즉시 확인하기 어려웠고, 명단 화면은 동작 버튼과 설명 블록이 같은 헤더 구조를 공유했다. 렌더 단계에서 반복 도입 블록을 제거하고, 액션 영역은 보존하도록 선택자를 분리했다.
- Eval evidence: `node --check public/app.js`, `npm test` 31건 통과, 서버 재시작 뒤 최신 `app.js` 응답과 localhost 200 확인. 브라우저에서 로그인 진입과 콘솔 오류 없음을 확인했다. 로그인된 각 메뉴의 실제 시각 검수는 계정 비밀번호를 브라우저에 입력하지 않아 수동 확인 대상이다.

---

## 통합 자료 만들기 — 2026-09-01

- Task contract: 보관된 회의·정책제안·운영 메모를 선택해 기관 전달용 문서로 묶고, 수정 가능한 문서와 PDF 전달 경로를 제공한다.
- Active: Root AGENTS, `codex-delivery-loop`, Project Execution, Eval. 기존 워크룸의 자료 흐름 구현이므로 외부 Source·Style은 제외했다.
- Decision: 위원장·간사만 같은 테넌트의 보관 기록 1~25건을 선택해 회의 결과 정리·정책제안 전달문·기수 활동자료집을 생성한다. 생성물에는 원본의 제목·분류·본문 스냅샷만 남기며, DOCX를 직접 내려받고 인쇄 전용 HTML에서 브라우저 PDF 저장을 사용한다. 다른 테넌트와 일반위원은 생성물 목록·출력 경로에 접근할 수 없다.
- Boundary: HWP/HWPX 직접 생성, 서버 측 PDF 렌더링, 임의 바이너리 파일 변환·저장, 실제 기관 제출은 구현하지 않는다. 실제 도입 전에 문서 변환 엔진, 기록물 보존, 전달 승인 절차를 확정해야 한다.
- Eval evidence: `node --check server.mjs`, `node --check public/app.js`, `npm test` 32건 통과로 DOCX·인쇄 화면·테넌트 차단을 확인했다.

---

## 전면 UI 정보 구조 개편 기획 — 2026-09-01

- Task contract: 첨부된 SaaS 대시보드 레퍼런스를 표면 미감이 아니라 업무 상태·다음 행동·이력 전달 방식으로 분석해, 청년거버넌스 워크룸 전면 개편의 단일 기준을 만든다.
- Active: Root AGENTS, Project/최소 계약, `codex-delivery-loop`, `imagegen`, Eval. 외부 사실 조사가 아니라 사용자 제공 레퍼런스의 관찰과 내부 제품 설계이므로 Source는 제외했다.
- Decision: 밝은 고정 사이드바, 얇은 구분선, 상태 스트립, 행 중심 이력을 채택한다. 카드 그리드·환영 문구·개인 순위·일반 SaaS 분석 그래프·다크 사이드바는 제외한다. 모든 메뉴의 첫 구조를 `현재 상태 → 다음 행동 → 근거 이력`으로 통일한다.
- Output: `design-renewal-plan-2026-09-01.md`와 합성 데이터 기반 예상 화면 `design-preview-dashboard-2026-09-01.png`를 만들었다.
- Boundary: 시안의 기관명·날짜·인물·수치는 실제 도입 사례나 운영 데이터를 뜻하지 않는다. 구현 전 디자인 방향 승인과 실제 로그인 화면의 데스크톱·모바일 검수가 필요하다.

---

## 전면 UI 적용·디자인 가치관 정본화 — 2026-09-01

- Task contract: 승인된 전면 개편안을 워크룸 내부 화면에 적용하고, 이후 화면 추가·수정에도 재사용할 프로젝트 디자인 가치관을 정본으로 남긴다.
- Active: Root AGENTS, Project/최소 계약, `codex-delivery-loop`, `harness-update-router`, Browser control, Project Execution, Eval. 외부 사실 조사나 개인 문체 산출이 아니므로 Source·전역 Style은 제외했다.
- Decision: `DESIGN_SYSTEM.md`를 프로젝트 정본으로 만들었다. 밝은 248px 고정 탐색, 한 줄 메뉴 설명, 작은 모서리·얇은 선, 행 중심 정책제안, 화면당 주 행동 1개, 텍스트+기호 상태, 책임·기한·이력 우선 원칙을 공통 CSS에 적용했다. 홈에는 합성 감사 로그 기반 최근 변경 이력을 추가했고 `자료 아카이브` 화면 제목은 실제 역할에 맞춰 `통합 자료 만들기`로 정리했다.
- Harness boundary: 이번 원칙은 이 제품의 행정 환류·운영 화면에 특화되어 있어 전역 identity Brain/Style로 승격하지 않았다. 다른 프로젝트에 재사용하려면 별도 승인과 일반화 검토가 필요하다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 32건 통과. 대표 합성 계정으로 데스크톱 홈·정책제안과 390×844 정책제안 목록을 확인했으며 수평 넘침과 브라우저 콘솔 오류가 없었다. localhost:4173은 HTTP 200으로 유지했다.

---

## 레퍼런스 세부 문법 적용 — 2026-09-01

- Task contract: 레퍼런스의 조직 식별 카드, 행 중심 조작, 고정 표 헤더, 상태 필터, 작성자 식별, 빈 상태 표현을 워크룸에 실제 적용한다.
- Active: Root AGENTS, `codex-delivery-loop`, Project Execution, Eval, Browser control. 외부 사실 조사·전역 문체 수정·신규 서비스 연동은 없으므로 Source·Style은 제외했다.
- Decision: 좌측 기구 식별 영역은 키보드로도 열 수 있는 참여기구 데이터 진입 카드로 바꿨다. 정책제안 목록에는 전체·검토 필요·제출 완료 필터와 열 헤더, hover `열기 →`를 추가했다. 명단·조직·자료 표는 고정 헤더와 이니셜 아바타, 행 내 보조 행동 hover를 적용했다. 모바일에서는 필터를 유지하고 표 헤더는 숨겨 가로 넘침을 막는다.
- Eval evidence: `node --check public/app.js`, `npm test` 32건 통과. 대표 합성 계정에서 조직 카드 클릭이 참여기구 데이터 관리로 이동함을 확인했고, 정책제안 필터, 명단 이니셜 4개, 데스크톱 표 sticky, 390px 모바일 수평 넘침 없음, 브라우저 콘솔 오류 없음을 확인했다.

---

## 로고 연계 색상 체계 적용 — 2026-09-01

- Task contract: 제공된 로고의 청록 계열을 워크룸 색상 체계에 반영하고, 좌측 탐색을 초록색 바탕·흰색 글자로 전환해 시인성을 높인다.
- Active: Root AGENTS, `codex-delivery-loop`, Project Execution, Eval, Browser control. 신규 외부 조사·기관 연동·데이터 모델 변경은 없으므로 Source·Style은 제외했다.
- Decision: 본문 잉크는 로고의 짙은 남색 계열 `#203040`, 좌측 바탕·주 행동은 짙은 청록 `#17635C`, hover는 `#0F4E49`, 보조 강조는 남색 `#4968B8`로 제한했다. 좌측 메뉴는 흰색과 연한 민트 보조 글자로, 활성 상태는 더 밝은 청록 면과 좌측 선으로 구분했다.
- Eval evidence: `npm test` 32건 통과. 실제 브라우저에서 초록 사이드바·흰 메뉴 글자·활성 메뉴·주 버튼의 계산 색상과 수평 넘침 없음을 확인했다.

---

## 플랫폼 브랜드 우선 좌측 탐색 — 2026-09-01

- Task contract: 좌측에서 참여기구 로고를 제거하고 적재적소 브랜드 마크를 우선 배치하며, 대시보드 정보 표현을 더 절제된 제품형 구조로 정리한다.
- Decision: 좌측 상단에 CSS 기반의 적재적소 기하 마크와 제품명을 두고, 기존 참여기구 로고 카드는 로고 없는 `현재 참여기구` 컨텍스트로 교체했다. 이 컨텍스트는 참여기구명과 `기수 | 소속기관 (구분)`을 유지하며 참여기구 데이터 관리로 이동한다. 홈은 큰 배경 패널을 제거하고, 지표만 절제된 연녹색 카드로 분리했으며 작업 목록은 선 중심으로 유지했다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 32건 통과. 대표 합성 계정의 데스크톱 홈에서 브랜드 마크, 참여기구 로고 미표시, 기구명·소속기관 표기, 좌측 고정 계정 패널과 지표 카드 배치를 브라우저 화면으로 확인했다.

---

## 좌측 탐색 반응형 안정화 — 2026-09-03

- Task contract: 화면 폭이 줄어도 좌측 탐색과 본문이 서로의 최소 폭을 침범하지 않으며, 메뉴·계정 영역이 잘리지 않는다.
- Active: Root AGENTS, `codex-delivery-loop`, Project Execution, Eval. 외부 자료·서비스 연동·전역 문체 변경은 제외했다.
- Decision: 1181px 이상은 기존 296px 탐색을 유지하고, 901–1180px는 248px의 컴팩트 탐색과 272px 그리드 트랙으로 전환했다. 이 구간에서는 본문 여백·사이드바 내부 타이포를 함께 축소하고, 1040px 이하는 대시보드 지표·시각화도 2열/1열로 낮춰 수평 압박을 제거한다. 900px 이하의 기존 상단 탐색 전환은 유지한다.
- Eval: CSS 정적 변경 완료. 로그인된 합성 계정의 브라우저 반응형 시각 검수는 현재 세션에 로그인 권한이 없어 별도 확인 대상이다.

---

## 핵심 작업 경로 축소와 위원장 관리 메뉴 — 2026-09-03

- Task contract: 워크룸의 좌측 주 탐색을 `오늘 / 회의·결정 / 정책제안`으로 좁히고, 위원회 정보와 관리 기능은 위원장 전용 하단 아이콘 메뉴로 옮긴다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, Project Execution, Eval. 외부 사실·문체 산출·서비스 연동은 없으므로 Source·Style은 제외했다.
- Decision: 참여기구 홈, 명단, 이슈·공지, 자료·인계, 기구 정보는 주 탐색에서 제거했다. 위원장만 사람+ 아이콘에서 위원회 정보, 구성원·권한, 전체 명단, 이슈·공지, 운영 기록, 리포트·인계를 열 수 있다. 참여기구 컨텍스트 카드는 현재 소속만 표시하고 관리 화면으로 이동하지 않는다. 개인 정보는 별도 하단 아이콘으로 유지한다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 32건 통과. 로그인 화면까지 브라우저 응답을 확인했으며, 인증된 위원장 화면의 시각·키보드 검수는 현재 브라우저 세션에 로그인 권한이 없어 unverified다.

### 2026-09-03 correction

- User decision: 현재 참여기구 카드는 `위원회 정보`로 다시 연결한다. 위원장은 그 화면에서 기본 정보를 관리하고, 일반 위원은 기본 정보 열람과 본인 프로필 수정만 한다. 하단 관리 메뉴에서는 위원회 정보·전체 명단·이슈·공지를 제거하고 `구성원·권한 / 운영 기록 / 리포트·인계`만 유지한다. 개인 설정 하단 아이콘도 제거한다.

### 2026-09-03 account-bar refinement

- User decision: 좌측 하단은 이름·역할, 알림, 위원회 관리, 로그아웃을 한 줄에 두고, 핵심 메뉴는 사이드바 상단에 정렬한다.

## 로그인 워크룸 4메뉴 대시보드 — 2026-09-03

- Task contract: 로그인 직후 워크룸을 위원회 홈, 회의·일정 관리, 정책제안, 아카이브의 네 메뉴로 재구성하고, 위원회 기본 정보·명단·조직도는 상단 위원회 블록으로 분리한다. 화면당 과도한 기능을 피하고, 작성 행동은 명확한 모달 또는 전용 소메뉴로 연다.
- Decision: 홈은 일정·정책제안과 공지·이슈, 회의는 일정·참석과 회의 기록, 정책제안은 현황과 제안서 목록, 아카이브는 모아보기·기록 정리·역대 위원회로 쪼갰다. 제안서에는 마감일과 다섯 필드 프레임워크를, 회의 기록에는 테넌트 제한 사진 업로드를 추가했다. AI 작성 도움은 API가 연결된 경우에만 비저장 검토 문안을 반환하며, 개인정보를 입력하지 않도록 안내한다.
- Boundary: 실제 외부 공무원 회신, 기관 시스템 연동, AI API 연결 여부는 이 로컬 MVP가 보장하지 않는다. 사진은 로컬 데이터 경로에 저장되는 합성 데모 기록이며, 실제 도입 전 보관 기간·동의·접근정책을 확정해야 한다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test`로 확인한다. 정책제안 프레임워크·마감일과 회의 사진의 테넌트 접근 제한은 자동 테스트에 포함한다. 브라우저 시각 검수는 별도 확인한다.

## 전반 UI 점검 및 알림 비차단화 — 2026-09-04

- Task contract: 알림은 전체 화면을 가리는 모달이 아니라 종 아이콘의 상태 신호와 작은 패널로 제공하고, 워크룸 전반의 데스크톱·모바일·키보드·콘솔 상태를 다시 점검한다.
- Decision: 새 알림이 있을 때만 종 아이콘에 짧은 흔들림·점 강조를 적용하고 `동작 줄이기` 환경에서는 정지한다. 알림 목록은 사이드바 하단에 고정된 작은 패널로 열며, 항목 선택 시 읽음 처리와 관련 정책제안 이동을 유지한다. 390px에서 주 메뉴의 내부 스크롤 영역이 문서 전체를 37px 넘기던 문제는 메뉴에 `min-width: 0; max-width: 100%`를 적용해 해결했다.
- Eval evidence: 로컬 합성 위원장 로그인 뒤 4개 주 메뉴, 알림 패널(모달 0개), 키보드 초점, 390×844 모바일(문서 가로 넘침 없음), 데스크톱(가로 넘침 없음), 브라우저 콘솔 오류·경고 0건을 확인했다. `node --check public/app.js`, `npm test` 33건도 통과했다.
- Implementation: 분리된 하단 아이콘 영역을 단일 계정 바로 통합했다. 알림과 위원회 관리 팝오버는 같은 행의 아이콘으로, 로그아웃은 텍스트 뱃지로 표시한다. 위원회 관리 아이콘은 위원장에게만 보인다.
- Eval evidence: `node --check public/app.js`, `node --check server.mjs`, `npm test` 32건 통과. 인증된 화면의 시각 검수는 브라우저 세션 로그인 권한이 없어 unverified다.

---

## 대시보드 타이포그래피 직전 밀도 복원 — 2026-09-07

- Task contract: 최근에 추가된 전역 글자 크기·행간 덮어쓰기만 이전 대시보드 밀도로 되돌리고, 역할·기능·공개 체험 진입은 유지한다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, Project Execution, Eval. 외부 조사·서비스 연동·콘텐츠 문체는 제외했다.
- Decision: `public/additional.css`의 마지막 KRDS 전역 타이포그래피 레이어를 제거했다. 기존 화면별 제목·본문·메타·제어 요소 크기 규칙을 다시 사용하며, 복원 기준 테스트도 전역 덮어쓰기 부재와 기존 컴포넌트 위계를 확인하도록 바꿨다.
- Eval evidence: `node --check public/app.js`, `npm test` 36건 통과, `npm run build:public-demo` 통과. 브라우저 시각 검수와 소유 Vercel 프로젝트 재배포는 로컬 Vercel CLI 로그인 부재로 unverified다.

---

## 사이드바 우측 돌출 제거 — 2026-09-07

- Task contract: 데스크톱 사이드바가 본문 쪽으로 돌출되는 장식 레이어를 제거하고, 하나의 독립된 둥근 탐색 표면으로 유지한다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, KRDS Web Typography and Information Hierarchy, Eval. 외부 조사·서비스 연동·문체 작업은 제외했다.
- Decision: `.sidebar:after` 장식 레이어를 데스크톱에서도 표시하지 않도록 명시했다. 알림 패널의 고정 위치는 유지해 사이드바 바깥으로 필요한 알림만 정상 표출한다.
- Acceptance evidence: 901px 이상에서 사이드바의 우측 의사요소가 `display:none`이며, 실제 본문 영역을 덮는 청록 장식이 없다. 이후 자동·브라우저 검증을 수행한다.

---

## 일정 선택형 캘린더 레이아웃 — 2026-09-07

- Task contract: 기본 회의 화면은 캘린더가 전체 폭을 사용하고, 일정 클릭 시에만 우측 요약 패널을 표시한다. 패널은 자연스럽게 진입하며, 일정 선택을 해제하면 캘린더 폭을 복원한다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, KRDS Web Typography and Information Hierarchy, Eval. 외부 조사·서비스 연동·문체 작업은 제외했다.
- Decision: 기본 선택값을 제거하고, 선택된 일정이 있을 때만 `.meeting-inspector`를 렌더한다. 날짜 클릭 또는 닫기 버튼은 선택을 해제한다. 데스크톱에서는 캘린더 압축과 우측 패널 진입 애니메이션을 적용하고, 1000px 이하에서는 세로 배치를 유지한다.
- Eval evidence: `node --check public/app.js`, `npm test` 36건, `npm run build:public-demo` 통과. 공개 체험판의 데스크톱 브라우저에서 일정 선택 뒤 `.calendar-layout.has-inspector`와 우측 요약 패널(캘린더 폭 652px)을, 닫기 뒤 패널 제거와 전체 폭 캘린더(1024px)를 확인했다.

---

## 메뉴별 중복 요소 정리 — 2026-09-07

- Task contract: 좌측 메뉴와 같은 기능·문구를 반복하는 소제목, 같은 데이터를 중복 표출하는 레이아웃을 제거하되, 각 작업 경로와 모바일 접근성은 유지한다.
- Eval evidence: `node --check public/app.js`, `npm test`(36 passed), `npm run build:public-demo`를 통과했고 공개 체험판에서 좌측 대메뉴만으로 회의·결정과 기록의 핵심 화면·필터·목록이 렌더되는 것을 확인했다. 홈의 중복 일정 캘린더는 회의·결정 메뉴의 단일 캘린더로 통합했다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, KRDS Web Typography and Information Hierarchy, Eval. 외부 조사·서비스 연동·문체 작업은 제외했다.
- Decision: 공통 상단 안내문을 제거하고, 회의 화면의 캘린더 아래 중복 일정 목록을 제거했다. 아카이브는 소메뉴와 같은 제목·구분 요약 카드를 없애고 단일 구분 필터와 기록 목록만 남겼다. 역대 기록도 소메뉴와 중복된 제목을 제거했다.
- Eval evidence: `node --check public/app.js`, `npm test`, 공개 체험판 주요 메뉴 렌더를 확인한다.

---

## 계정 관리와 나의 활동 분리 — 2026-09-07

- Task contract: 하단 사람 아이콘은 개인 정보·계정 관리로 연결하고, 기존 개인 활동 요약은 좌측 대메뉴 `나의 활동`으로 분리한다. 탈퇴는 즉시 삭제가 아닌 명시적 요청 흐름으로 남긴다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, Eval. 외부 조사·서비스 연동·문체 작업은 제외했다. 프로젝트 루트에 `Project.md`는 없어 최소 계약으로 대체했다.
- Decision: 계정 화면에서 개인정보 확인·수정, 사진, 비밀번호, 데이터 권리, 회원 탈퇴 요청을 제공한다. `탈퇴` 확인 문구를 입력해야 요청이 생성되며, 체험판에서 실제 계정 삭제는 하지 않는다.
- Eval evidence: `node --check public/app.js`, `npm test`(36 passed), `npm run build:public-demo`를 통과했다. 공개 체험판에서 `나의 활동` 대메뉴, 사람 아이콘의 계정 관리 진입, 개인정보 확인·수정·회원 탈퇴 요청 항목을 확인했다.

---

## 활동 기록 속성 모델 — 2026-09-07

- Task contract: 노션의 속성 방식을 참고하되, 청년참여기구 활동 기록의 검색·책임·기한·근거·아카이빙·전달에 필요한 최소 속성 모델과 파일화 구조를 설계한다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, Eval. 외부 조사·서비스 연동·문체 작업은 제외했다.
- Decision: 원본 기록 → 버전형 기록 파일 → 고정 아카이브 파일 → DOCX/PDF/통합 자료 흐름을 정했다. 자동·시스템 속성은 보존하고, 운영자가 추가한 속성만 비표시·삭제 가능한 구조로 둔다.
- Output: `RECORD_PROPERTY_MODEL.md`에 속성 목록, 권한, 화면 규칙, 파일화 규칙, 구현 순서와 수락 기준을 기록했다. 아직 실행 코드는 추가하지 않은 설계 단계다.

---

## 메뉴 용어 정리 — 2026-09-07

- Task contract: 좌측 대메뉴와 계정 아이콘을 이용자에게 익숙한 용어로 바꾸되, 탭 식별자와 기능 경로는 유지한다.
- Decision: `오늘→홈`, `나의 활동→내 활동`, `회의·결정→회의`, `정책제안→정책 제안`, `기록→자료실`, `계정 관리→내 계정`으로 정리했다. 자료실 하위 메뉴도 `전체 기록 / 파일 관리 / 역대 기록`으로 맞췄다.
- Eval evidence: `node --check public/app.js`, `npm test`(36 passed), `npm run build:public-demo`를 통과했다.

---

## 공동 기록 범위 정리 — 2026-09-08

- Task contract: `내 활동`이 개인 작업의 단일 진입점이 되도록 회의·정책 제안·자료실의 `전체 / 내 관련` 범위 전환을 제거하고, 각 화면은 참여기구의 공동 기록을 기본으로 표시한다.
- Active: Root AGENTS, Harness & Skill Inventory Router, `codex-delivery-loop`, Eval. 외부 조사·서비스 연동·문체 작업은 제외했다.
- Decision: 회의 캘린더·회의 기록, 정책 제안 현황·목록, 자료실 기록 목록의 개인 범위 필터와 상태를 제거했다. 기존 상태·구분 필터와 열람 권한 표시는 유지한다.
