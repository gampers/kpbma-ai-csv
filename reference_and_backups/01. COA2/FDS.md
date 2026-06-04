# FDS — COA 시험성적서 발행 시스템 (교육용)

> **Functional Design Specification** | CSV(Computer System Validation) 실습 자료
> 작성일: 2026-05-04 | 버전: 1.0 | 작성자: 교육팀

---

## 1. 문서 개요

### 1.1 목적
본 문서는 URS(User Requirements Specification)에 정의된 16개 요구사항을 충족하기 위한 시험성적서(COA, Certificate of Analysis) 발행 시스템의 **기능 설계 명세**를 정의한다. CSV 교육 실습에서 트레이너가 ALCOA+ 데이터 무결성 원칙, 전자기록·전자서명, 감사추적을 시연·검증하는 기준 문서로 사용한다.

### 1.2 범위
- **포함**: 로그인/계정/권한, 결재 워크플로우, COA 출력, 감사추적, 환경설정 및 자동백업.
- **제외**: 외부 LIMS/ERP 연동, 실시간 기기 데이터 수집, 다국어, 모바일 최적화.

### 1.3 약어
| 약어 | 의미 |
|---|---|
| URS | User Requirements Specification |
| FDS | Functional Design Specification |
| COA | Certificate of Analysis (시험성적서) |
| CSV | Computer System Validation |
| ALCOA+ | Attributable, Legible, Contemporaneous, Original, Accurate (+ Complete, Consistent, Enduring, Available) |
| e-Sig | Electronic Signature (전자서명) |
| RBAC | Role-Based Access Control |

### 1.4 참조 문서
- URS v1.0 (16개 항목, 본 시스템의 입력 요구사항)
- GAMP 5 — Category 5 (Custom Application)
- 21 CFR Part 11 — Electronic Records, Electronic Signatures

### 1.5 개정 이력
| 버전 | 날짜 | 변경 내용 | 작성자 |
|---|---|---|---|
| 1.0 | 2026-05-04 | 최초 작성 | 교육팀 |

---

## 2. 시스템 개요

### 2.1 사용 환경
- **클라이언트**: Chrome / Edge 최신 버전 (1024×768 이상)
- **실행 방식**: `coa.html` 더블클릭 → 기본 브라우저에서 로컬 실행 (`file://`)
- **저장소**: 브라우저 `localStorage` (별도 서버 없음)
- **네트워크**: 불필요 (오프라인 동작)

### 2.2 GxP 분류
- **GAMP 카테고리**: 5 (Custom Application — 교육용 데모)
- **Risk 등급**: Low (실제 의약품 출하에 사용되지 않는 교육 시스템)

### 2.3 시스템 구성도
```
┌──────────────────────────────────────────┐
│            Browser (Client)              │
│  ┌────────────────────────────────────┐  │
│  │   coa.html (HTML+CSS+JS, 단일 파일) │  │
│  │   ├── 라우터 (해시 기반)            │  │
│  │   ├── 인증/세션 모듈                │  │
│  │   ├── 결재 워크플로우 모듈          │  │
│  │   ├── COA 출력 모듈                 │  │
│  │   ├── 감사추적 모듈                 │  │
│  │   └── 자동백업 모듈                 │  │
│  └────────────┬───────────────────────┘  │
│               │ 읽기/쓰기                 │
│  ┌────────────▼───────────────────────┐  │
│  │  localStorage (coa: 네임스페이스)   │  │
│  │  users, records, history, audit,    │  │
│  │  settings, sequence, backupMeta     │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## 3. 사용자 역할 및 권한

### 3.1 역할 정의
| 역할 코드 | 역할명 | 책임 |
|---|---|---|
| `TESTER` | 시험자 | 시험 결과 입력, 본인 작성건 수정/제출 |
| `APPROVER` | 승인자 | 제출된 결과 승인/반려, COA 출력 |
| `ADMIN` | 관리자 | 계정 관리, 환경설정, 감사추적 조회 |

> 한 사용자에게 복수 역할 부여 가능 (예: `[TESTER, APPROVER]`).

### 3.2 권한 매트릭스 (역할 × 화면)

| 화면 | TESTER | APPROVER | ADMIN |
|---|:-:|:-:|:-:|
| 로그인 | 공개 | 공개 | 공개 |
| 대시보드 | O | O | O |
| 결과 입력 | O | - | - |
| 내 작성건 조회 | O | - | - |
| 승인 대기 | - | O | - |
| COA 출력 | - | O | O (조회만) |
| 계정 관리 | - | - | O |
| 감사추적 | - | - | O |
| 환경설정 | - | - | O |

라우트 가드 미달 시 `#/dashboard`로 리다이렉트하며 토스트 경고 표시.

---

## 4. 기능 명세

### 4.1 인증 (URS 1)
- ID/Password 입력 → `coa:users`에서 일치 사용자 조회 → 활성 계정인 경우 세션 생성.
- 실패 시 `LOGIN_FAIL` 감사 이벤트 기록, "ID 또는 비밀번호가 올바르지 않습니다." 표시.
- 로그아웃 시 세션 제거 + `LOGOUT` 이벤트 기록.
- 비밀번호는 입력 화면에서 `<input type="password">`로 마스킹.

### 4.2 계정 관리 (URS 2)
- ADMIN 전용 화면 `#/users`.
- 기능: 계정 생성, 역할 변경, 활성/비활성 전환.
- 필수 입력: `userId`, `name`, `password`(4자 이상), `roles[]`(1개 이상).
- 모든 변경은 `USER_CREATE / USER_UPDATE / USER_DEACTIVATE` 감사 이벤트로 기록.

### 4.3 결과 입력 (URS 4, 5, 11, 12)
- TESTER 전용 화면 `#/records/new`.
- 필수 8개 필드:
  1. 제품명 (`productName`)
  2. Lot No (`lotNo`)
  3. 시험일자 (`testDate`, 날짜) — **URS 5**
  4. 사용 장비 (`equipment`) — **URS 12**
  5. 시험 방법 (`testMethod`) — **URS 4**
  6. 허용 기준 (`acceptanceCriteria`) — **URS 4**
  7. 결과값 (`resultValue`, 숫자)
  8. 단위 (`resultUnit`)
- 누락 시 인라인 빨간 헬퍼 텍스트 + 첫 누락 칸 자동 포커스 + 상단 토스트 — **URS 11**.
- 저장 시 `status = "DRAFT"`, `createdBy = 현재사용자`, `createdAt = KST timestamp` 자동 부여.

### 4.4 결재 워크플로우 (URS 3)
- **상태**: `DRAFT → SUBMITTED → APPROVED → PRINTED` (분기: `SUBMITTED → REJECTED → DRAFT`)
- **제출(SUBMIT)**: TESTER가 DRAFT를 SUBMITTED로 변경 → `RECORD_SUBMIT` 감사.
- **승인(APPROVE)**: APPROVER가 비밀번호 재입력(e-Sig 시연) → SUBMITTED를 APPROVED로 → `RECORD_APPROVE` 감사. **이 시점부터 COA 출력 가능.**
- **반려(REJECT)**: APPROVER가 사유(`rejectReason`) 입력 → SUBMITTED를 REJECTED로 → `RECORD_REJECT` 감사. TESTER는 REJECTED 건을 수정하여 재제출 가능.

### 4.5 COA 출력 (URS 7, 8, 14)
- APPROVED / PRINTED 상태만 출력 가능. 그 외 상태는 출력 버튼 비활성.
- 최초 출력 시 `documentNo = "COA-YYYYMMDD-NNN"` 부여 (5번 항 참조).
- 헤더에 **출력자 정보 + 발행일자** 표시 — **URS 7**.
- 결과값 옆에 **±1% 허용 범위 인라인 표기** + 푸터 각주 — **URS 8**.
- 본문에 시험일자/사용장비/시험방법/허용기준/작성자/승인자 모두 표시.
- 브라우저 인쇄 다이얼로그를 통해 PDF 저장 또는 인쇄.
- 재출력 시 `printCount++`, `printedBy/At` 갱신 (documentNo는 동일).

### 4.6 감사추적 (URS 9, 10, 13)
- ADMIN 전용 화면 `#/audit`.
- 모든 시스템 행위가 `AuditEvent`로 기록 (행위자 ID, 시각, 액션, 대상, before/after, reason).
- **수정 시 사유 필수** (`RECORD_UPDATE`, `RECORD_REJECT`, `USER_DEACTIVATE`).
- 화면: 일자/사용자/액션 필터, CSV 내보내기.
- **불변성**: UI에서 수정·삭제 불가. (저장소 직접 조작은 별도 SOP로 통제)

### 4.7 환경설정 (URS 8, 15)
- ADMIN 전용 화면 `#/settings`.
- 항목:
  - **자동 백업 시각** (`backupTime`, HH:mm 24h)
  - **결과 정밀도** (`precisionPct`, 기본 1)
  - **마지막 백업 일시** (읽기 전용, `lastBackupAt`)
  - **수동 백업** 버튼
  - **백업 파일 가져오기** (JSON 업로드)
  - **데이터 리셋** (사유 입력 후 실행, `DATA_RESET` 감사)

### 4.8 자동 백업 (URS 15)
- 트리거: 페이지 로드 + 로그인 직후.
- 조건: `now >= scheduledTime AND lastBackupDate !== today`.
- 동작: 7개 키(`users/records/history/audit/settings/sequence/backupMeta`) 묶음을 JSON으로 다운로드.
- 파일명: `coa-backup-YYYYMMDD-HHmmss.json`.
- 결과: `BACKUP_RUN` 감사 이벤트 + `lastBackupDate/At` 갱신. 같은 날 재실행되지 않음(멱등).
- 환경설정 화면에 **백업 예약 시각**과 **마지막 백업 시각** 모두 표시.

---

## 5. 데이터 모델 (localStorage 스키마)

키 네임스페이스 prefix: `coa:`.

```ts
type Role = "TESTER" | "APPROVER" | "ADMIN";
type RecordStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PRINTED";

interface User {
  userId: string; name: string;
  passwordPlain: string;          // 교육용 평문 (11.1 트레이드오프 참조)
  roles: Role[]; active: boolean;
  createdAt: string; createdBy: string;
}

interface TestRecord {
  recordId: string;               // "rec_<ts>_<rand>"
  documentNo: string | null;      // 최초 출력 시 부여 [URS 14]
  productName: string; lotNo: string;
  testDate: string;               // YYYY-MM-DD       [URS 5]
  equipment: string;              //                  [URS 12]
  testMethod: string;             //                  [URS 4]
  acceptanceCriteria: string;     //                  [URS 4]
  resultValue: number; resultUnit: string;
  status: RecordStatus;           //                  [URS 3, 16]
  createdBy: string; createdAt: string;          // [URS 9, 10]
  submittedAt?: string;
  approvedBy?: string; approvedAt?: string;
  rejectedBy?: string; rejectedAt?: string; rejectReason?: string;
  printedBy?: string; printedAt?: string;        // [URS 7]
  printCount: number;
}

interface RecordHistory {                         // [URS 6, 13]
  historyId: string; recordId: string;
  field: string; beforeValue: any; afterValue: any;
  reason: string;                 // 수정 사유 필수
  changedBy: string; changedAt: string;
}

interface AuditEvent {                            // [URS 9, 10]
  eventId: string; timestamp: string;
  userId: string; action: AuditAction;
  target: string;
  before?: any; after?: any; reason?: string;
  meta?: Record<string, any>;
}

interface Settings {
  backupTime: string;             // "HH:mm"        [URS 15]
  precisionPct: number;           // 1              [URS 8]
  schemaVersion: number;
}

interface DocumentSequence {                       // [URS 14]
  byDate: Record<string, number>; // {"20260504": 7}
}

interface BackupMeta {                             // [URS 15]
  lastBackupDate: string; lastBackupAt: string;
}
```

**시드 계정** (최초 실행 시 자동 주입):

| userId | password | name | roles |
|---|---|---|---|
| admin | admin | 관리자 | ADMIN |
| tester1 | 1234 | 김시험 | TESTER |
| approver1 | 1234 | 박승인 | APPROVER |

---

## 6. 상태 머신 (URS 3, 16)

```
        ┌─────────────────────────────────────────────────────────┐
        │                                                         ▼
       (작성)        (제출)           (승인)             (출력)
   ───►DRAFT────────►SUBMITTED────────►APPROVED────────►PRINTED
                          │                │                │
                          │                │                └──(재출력: printCount++,
                          │                │                     문서번호 동일)
                          │                │
                          │                └──[수정 시도] → 차단 (URS 16)
                          │
                          └──(반려, 사유 필수)
                              ▼
                          REJECTED ──(편집 후 재제출)──► DRAFT → SUBMITTED
```

**잠금 규칙 (URS 16)**: `status ∈ {APPROVED, PRINTED}`인 경우
- UI: 수정/삭제 버튼 비활성, "승인 완료 — 수정 불가" 배지 표시.
- 로직: `record.update()` 호출 시 예외 throw.

---

## 7. 문서번호 부여 규칙 (URS 14)

**형식**: `COA-YYYYMMDD-NNN`
- `YYYYMMDD`: 출력일자 (KST 기준, 예: `20260504`)
- `NNN`: 해당 일자의 일련번호 3자리 (zero-padding, `001`부터 시작)

**부여 시점**: 최초 PRINT 시 (APPROVED → PRINTED 전이 시점).
**재출력**: 동일 `documentNo` 유지, `printCount`만 증가.

```js
function nextDocumentNo() {
  const dateKey = formatDate(new Date(), "YYYYMMDD");
  const seq = storage.get("coa:sequence", { byDate: {} });
  const n = (seq.byDate[dateKey] || 0) + 1;
  seq.byDate[dateKey] = n;
  storage.set("coa:sequence", seq);
  return `COA-${dateKey}-${String(n).padStart(3, "0")}`;
}
```

> 문서번호 부여 규칙 변경은 본 FDS의 개정과 함께 통제되어야 한다.

---

## 8. 정밀도 표시 규칙 (URS 8)

**원칙**: 결과값에 대해 ±`precisionPct`% 허용 범위를 **인라인 + 각주** 두 위치에 표기.

**계산식**:
```
허용범위 = [resultValue × (1 - pct/100), resultValue × (1 + pct/100)]
표시 예: "98.5 mg (허용범위 ±1%: 97.51 ~ 99.49 mg)"
푸터  : "※ 본 시험성적서의 결과값은 ±1% 정밀도 이내로 표기됩니다."
```

`Settings.precisionPct` 변경은 SETTINGS_UPDATE 감사 대상이며, 변경 후 출력되는 모든 COA에 즉시 반영된다.

---

## 9. 데이터 무결성 (ALCOA+ 매핑)

| 원칙 | 본 시스템 구현 방식 | 관련 URS |
|---|---|---|
| **A**ttributable | 모든 행위에 `createdBy`/`userId` 기록 | 9, 10 |
| **L**egible | 한국어 UI, 인쇄 시 명료한 표/서명란 | 7 |
| **C**ontemporaneous | 클라이언트 KST 시각 자동 부여 | 5, 7, 10 |
| **O**riginal | RecordHistory에 수정 전/후 값 영구 보존 | 6 |
| **A**ccurate | ±1% 정밀도 명시, 필수 필드 검증 | 8, 11 |
| Complete | 8개 필수 필드 강제, 필요 시 사유 강제 | 11, 13 |
| Consistent | 상태 머신으로 흐름 강제 | 3, 16 |
| Enduring | localStorage + 자동/수동 백업 | 15 |
| Available | 감사추적 화면 + CSV 내보내기 | 9 |

---

## 10. URS ↔ FDS 추적 매트릭스

| URS # | URS 요약 | FDS 절 | 구현 모듈/함수 | 검증 ID |
|:-:|---|---|---|:-:|
| 1 | 로그인 기능 | 4.1 | `auth.login()`, `auth.logout()` | VS-01 |
| 2 | 계정 관리 + 시험자/승인자 권한 | 3, 4.2 | `userMgmt.create/update`, RBAC | VS-02 |
| 3 | 승인 후에만 성적서 출력 | 4.4, 4.5, 6 | `workflow.submit/approve`, `coa.print` | VS-03 |
| 4 | 시험기준/방법 입력 및 표기 | 4.3, 4.5 | `record.testMethod/acceptanceCriteria` 필드 | VS-04 |
| 5 | 시험일자 입력 | 4.3 | `record.testDate` 필드 | VS-05 |
| 6 | 수정 전/후 값 추적 | 5 (RecordHistory) | `record.update()`, `history.append()` | VS-06 |
| 7 | 출력자 + 발행일자 표시 | 4.5 | `coa.renderHeader()` | VS-07 |
| 8 | ±1% 정밀도 표시 | 4.5, 8 | `coa.formatTolerance()` | VS-08 |
| 9 | 시험자 ID Audit 기록 | 4.6 | `audit.append()` | VS-09 |
| 10 | 작성자 ID/날짜 추적 | 4.3, 5 | `record.createdBy/At` | VS-10 |
| 11 | 결과 누락 시 에러 | 4.3 | `validate.required()` | VS-11 |
| 12 | 사용 장비 기록 | 4.3 | `record.equipment` 필드 | VS-12 |
| 13 | 수정 사유 기록 | 4.3, 4.4, 5 | `history.append()` reason 필수 | VS-13 |
| 14 | 문서번호 표시 (고유, 규칙 기반) | 4.5, 7 | `nextDocumentNo()` | VS-14 |
| 15 | 매일 자동 백업 + 시각 표시 | 4.7, 4.8 | `backup.checkAndRun()`, settings UI | VS-15 |
| 16 | 승인 후 수정 제한 | 6 | `record.isLocked()` | VS-16 |

---

## 11. 가정 및 트레이드오프

### 11.1 평문 비밀번호
교육 시연의 단순화를 위해 평문으로 저장한다. **운영 시스템은 반드시 해싱(bcrypt/scrypt) + salt 적용 필요.** SOP 토론 주제로 활용.

### 11.2 자동 백업의 한계
브라우저가 닫혀 있는 시각에는 백업이 실행되지 않는다. 다음 페이지 로드 시 멱등 트리거되며, 운영 SOP로 "근무 종료 전 수동 백업 1회"를 보완 권고한다.

### 11.3 e-Signature 단일 컴포넌트
승인 시 비밀번호 재입력 1단계만 시행하며, 21 CFR Part 11이 요구하는 2-component(아이디 + 비밀번호 + 추가 인증) 중 한 단계만 시연한다. 토론 시 보완 방안(2FA, 생체 인증) 다룰 것.

### 11.4 localStorage 용량
일반 브라우저 한도 5~10 MB. 교육 시연 데이터로는 충분하나 장기 운영용 시스템에는 부적합 (별도 DB 필요).

### 11.5 시간대
모든 timestamp는 KST(Asia/Seoul) 고정. 브라우저 timezone과 무관.

### 11.6 감사 이벤트 위변조
평문 저장이며 cryptographic chain은 미적용. 교육적 토론 거리: SHA-256 체크섬, 블록체인식 chain hash, 외부 immutable storage.

---

## 12. 검증 시나리오 요약

상세 시나리오는 `구현계획서.md` 6절을 참조. 각 URS 항목은 정확히 1개의 VS-ID와 1:1 매핑된다 (총 16개).

---

**END OF DOCUMENT**
