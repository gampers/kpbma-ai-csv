# FDS — 교육 이수 관리 시스템 (LM, 교육용)

> **Functional Design Specification** | CSV(Computer System Validation) 실습 자료
> 작성일: 2026-06-03 | 버전: 1.0 | 작성자: 교육팀

---

## 1. 문서 개요

### 1.1 목적

본 문서는 URS에 정의된 16개 요구사항을 충족하기 위한 교육 이수 관리 시스템(LM, Learning Management)의 **기능 설계 명세**를 정의한다. CSV 교육 실습에서 트레이너가 ALCOA+ 데이터 완전성 원칙, 전자기록·전자서명, 감사추적, 워크플로우 통제를 시연·검증하는 기준 문서로 사용한다.

### 1.2 범위

- **포함**: 로그인/계정/권한, 교육과정·임직원 마스터 관리, 이수 평가 입력·자동판정, 승인 워크플로우, 이수증·교육이력서 출력, 재교육 주기 관리, 감사추적, 환경설정 및 자동백업
- **제외**: 외부 HR/ERP 연동, 온라인 학습 콘텐츠(LMS 기능), 다국어, 모바일 최적화

### 1.3 약어

| 약어 | 의미 |
|---|---|
| URS | User Requirements Specification |
| FDS | Functional Design Specification |
| LM | Learning Management (교육 이수 관리) |
| CSV | Computer System Validation |
| ALCOA+ | Attributable, Legible, Contemporaneous, Original, Accurate (+ Complete, Consistent, Enduring, Available) |
| e-Sig | Electronic Signature (전자서명) |
| RBAC | Role-Based Access Control |

### 1.4 참조 문서

- URS v1.0 (16개 항목, 본 시스템의 입력 요구사항)
- GAMP 5 — Category 5 (Custom Application)
- 21 CFR Part 11 — Electronic Records, Electronic Signatures
- 21 CFR 211.25 — Personnel qualifications (교육 기록의 predicate rule)

### 1.5 개정 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|---|---|---|---|
| 1.0 | 2026-06-03 | 최초 작성 | 교육팀 |

---

## 2. 시스템 개요

### 2.1 사용 환경

- **클라이언트**: Chrome / Edge 최신 버전 (1024×768 이상)
- **실행 방식**: `lm.html` 더블클릭 → 기본 브라우저에서 로컬 실행 (`file://`)
- **저장소**: 브라우저 `localStorage` (별도 서버 없음)
- **네트워크**: 불필요 (오프라인 동작, 외부 의존성 0)

### 2.2 GxP 분류

- **GAMP 카테고리**: 5 (Custom Application — 교육용 데모)
- **Risk 등급**: Low (실제 GMP 운영에 사용되지 않는 교육 시스템)

### 2.3 시스템 구성

```
lm.html (단일 파일: HTML + CSS + JS)
 ├── 해시 라우터 + 역할별 라우트 가드
 ├── 인증/세션 모듈 (자동 로그아웃 포함)
 ├── 마스터 관리 모듈 (교육과정, 임직원)
 ├── 평가/판정 모듈 (자동판정)
 ├── 승인 워크플로우 모듈 (상태머신, e-Sig)
 ├── 출력 모듈 (이수증, 교육이력서 — window.print)
 ├── 재교육 주기 모듈 (유효기간 계산)
 ├── 감사추적 모듈 (CSV 내보내기)
 └── 자동 백업 모듈 (멱등 트리거)
        ↕ localStorage (lm: 네임스페이스)
```

---

## 3. 사용자 역할 및 권한

### 3.1 역할 정의

| 역할 코드 | 역할명 | 책임 |
|---|---|---|
| `ADMIN` | 관리자 | 교육과정·임직원 마스터 관리, 계정 관리, 환경설정, 감사추적 조회 |
| `TRAINER` | 교육담당자 | 이수 평가 입력, 본인 작성건 수정/제출 |
| `QA` | QA승인자 | 제출된 평가 승인/반려(e-Sig), 이수증 발행/출력 |

> 한 사용자에게 복수 역할 부여 가능 (예: `[TRAINER, QA]`)

### 3.2 권한 매트릭스 (역할 × 화면)

| 화면 | ADMIN | TRAINER | QA |
|---|:-:|:-:|:-:|
| 로그인 | 공개 | 공개 | 공개 |
| 대시보드 | O | O | O |
| 교육과정 관리 | O (관리) | 조회 | 조회 |
| 임직원 관리 | O (관리) | 조회 | 조회 |
| 이수 평가 입력 | - | O | - |
| 내 작성건 | - | O | - |
| 승인 대기 | - | - | O |
| 이수증 발행/출력 | 조회 | - | O |
| 교육이력서 | O | O | O |
| 재교육 현황 | O | O | O |
| 감사추적 | O | - | - |
| 계정 관리 | O | - | - |
| 환경설정 | O | - | - |

라우트 가드 미달 시 `#/dashboard`로 리다이렉트하며 토스트 경고 표시.

---

## 4. 기능 명세

### 4.1 인증 (URS 1, 15)

- ID/Password 입력 → `lm:users`에서 일치 사용자 조회 → 활성 계정인 경우 세션 생성
- 실패 시 `LOGIN_FAIL` 감사 이벤트 기록, "ID 또는 비밀번호가 올바르지 않습니다." 표시
- 로그아웃 시 세션 제거 + `LOGOUT` 이벤트 기록
- **자동 로그아웃**: 설정된 시간(기본 15분) 동안 입력 없으면 자동 로그아웃 + `AUTO_LOGOUT` 감사 이벤트. 시간은 환경설정에서 변경 — **URS 15**

### 4.2 계정 관리 (URS 2)

- ADMIN 전용 화면 `#/users`
- 기능: 계정 생성, 역할 변경, 활성/비활성 전환
- 필수 입력: `userId`, `name`, `password`(4자 이상), `roles[]`(1개 이상)
- 모든 변경은 `USER_CREATE / USER_UPDATE / USER_DEACTIVATE` 감사 이벤트로 기록

### 4.3 교육과정 관리 (URS 3)

- ADMIN 관리 / TRAINER·QA 조회 화면 `#/courses`
- 필수 입력: 과정코드(`courseCode`), 과정명(`courseName`), 교육시간(`hours`), **합격기준 점수**(`passScore`, 0~100), **재교육 주기**(`revalidMonths`, 개월)
- 과정 비활성화 가능 (비활성 과정은 신규 평가 입력 불가, 기존 기록은 유지)

### 4.4 임직원 관리 (URS 4)

- ADMIN 관리 / TRAINER·QA 조회 화면 `#/employees`
- 필수 입력: 사번(`empNo`), 이름(`name`), 부서(`department`)
- 임직원 비활성화 가능 (퇴사자 처리, 기존 기록은 유지)

### 4.5 이수 평가 입력 및 자동판정 (URS 5, 6, 16)

- TRAINER 전용 화면 `#/records/new`
- 필수 입력 5개 필드: 교육과정, 교육 대상자(임직원), 교육일자, 평가점수(0~100), 평가방법
- **자동판정 (URS 6)**: 평가점수 ≥ 과정의 합격기준 → **합격(PASS)** / 미만 → **불합격(FAIL)**. 입력 화면에서 점수 입력 즉시 판정 결과를 실시간 표시하고, 저장 시 `result` 필드에 확정 기록
- 누락 시 인라인 오류 표시 + 첫 누락 칸 자동 포커스 + 토스트 — **URS 16**
- 저장 시 `status = "DRAFT"`, `createdBy`, `createdAt`(KST) 자동 부여
- **유효기간 자동 계산**: 교육일자 + 과정의 재교육 주기 = `expiryDate` — **URS 13**

### 4.6 승인 워크플로우 (URS 7, 8)

- **상태**: `DRAFT → SUBMITTED → APPROVED → ISSUED` (분기: `SUBMITTED → REJECTED → DRAFT`)
- **제출(SUBMIT)**: TRAINER가 DRAFT를 SUBMITTED로 변경 → `RECORD_SUBMIT` 감사
- **승인(APPROVE)**: QA가 **비밀번호 재입력(e-Sig)** → SUBMITTED를 APPROVED로 → `RECORD_APPROVE` 감사. 승인자/승인일시 기록 — **URS 8. 이 시점부터 이수증 발행 가능 (URS 7)**
- **반려(REJECT)**: QA가 사유 입력 → SUBMITTED를 REJECTED로 → `RECORD_REJECT` 감사. TRAINER는 REJECTED 건을 수정하여 재제출 가능
- 불합격(FAIL) 기록도 제출·승인 대상이다 (기록의 완전성). 단, **이수증 발행은 합격(PASS) + 승인(APPROVED) 건만 가능**

### 4.7 이수증 발행/출력 (URS 7, 11)

- QA 전용(발행) / ADMIN(조회) 화면 `#/certificates`
- 발행 가능 조건: `status = APPROVED` **AND** `result = PASS`
- 최초 발행 시 문서번호 부여: `CERT-YYYYMMDD-NNN` (7번 항 참조), 상태 `ISSUED`로 전이
- 이수증 표시 항목: 문서번호, 대상자(이름/사번/부서), 과정명/교육시간/교육일자, 평가점수/판정, 유효기간, 교육담당자, QA승인자/승인일시, **발행일자, 출력자** — **URS 11**
- 브라우저 인쇄(`window.print()`)로 PDF 저장 또는 출력. 출력 이벤트는 `CERT_PRINT` 감사 기록
- 재출력 시 `printCount++`, 문서번호 동일 유지

### 4.8 교육이력서 (URS 12)

- 전체 역할 조회 가능 화면 `#/transcript`
- 임직원 선택 → 해당 임직원의 모든 승인·발행된 교육 기록을 시간순으로 표시
- 표시 항목: 과정명, 교육일자, 교육시간, 점수, 판정, 유효기간, 이수증 번호
- 인쇄 양식: 개인별 교육이력서 (출력자/출력일시 표시)

### 4.9 재교육 현황 (URS 13)

- 전체 역할 조회 가능 화면 `#/retraining`
- 발행(ISSUED)된 합격 기록 기준으로 유효기간 상태 분류:
  - **유효**: 만료일까지 30일 초과
  - **만료 임박**: 만료일까지 30일 이내
  - **만료**: 만료일 경과
- 대시보드에 만료 임박/만료 건수 경고 카드 표시

### 4.10 감사추적 (URS 14)

- ADMIN 전용 화면 `#/audit`
- 모든 시스템 행위를 `AuditEvent`로 기록 (행위자 ID, 시각(KST), 액션, 대상, before/after, reason)
- 화면: 일자/사용자/액션 필터, **CSV 내보내기**
- **불변성**: UI에서 수정·삭제 기능 미제공 (저장소 직접 조작은 SOP로 통제)

### 4.11 환경설정 및 백업 (URS 15, 16)

- ADMIN 전용 화면 `#/settings`
- 항목: 자동 로그아웃 시간(분), 자동 백업 시각(HH:mm), 회사명(이수증 표기), 마지막 백업 일시(읽기 전용), 수동 백업, 백업 가져오기, 데이터 리셋(사유 필수)
- **자동 백업**: 트리거 = 페이지 로드/로그인 직후. 조건 = `now >= 예약시각 AND 오늘 미실행`(멱등). 전체 키를 JSON으로 다운로드. `BACKUP_RUN` 감사 기록

---

## 5. 데이터 모델 (localStorage 스키마)

키 네임스페이스 prefix: `lm:`

```ts
type Role = "ADMIN" | "TRAINER" | "QA";
type RecordStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ISSUED";
type Result = "PASS" | "FAIL";

interface User {
  userId: string; name: string;
  passwordPlain: string;          // 교육용 평문 (11.1 트레이드오프 참조)
  roles: Role[]; active: boolean;
  createdAt: string; createdBy: string;
}

interface Course {                                 // [URS 3]
  courseId: string; courseCode: string; courseName: string;
  hours: number; passScore: number;                // 합격기준 [URS 6]
  revalidMonths: number;                           // 재교육 주기 [URS 13]
  description: string; active: boolean;
  createdAt: string; createdBy: string;
}

interface Employee {                               // [URS 4]
  empId: string; empNo: string; name: string;
  department: string; position: string; active: boolean;
  createdAt: string; createdBy: string;
}

interface TrainingRecord {
  recordId: string;
  certificateNo: string | null;                    // 발행 시 부여 [URS 11]
  courseId: string; empId: string;
  trainingDate: string;                            // YYYY-MM-DD
  score: number; method: string;
  result: Result;                                  // 자동판정 [URS 6]
  expiryDate: string;                              // 유효기간 [URS 13]
  status: RecordStatus;                            // [URS 7, 9]
  createdBy: string; createdAt: string;
  submittedAt?: string;
  approvedBy?: string; approvedAt?: string;        // e-Sig [URS 8]
  rejectedBy?: string; rejectedAt?: string; rejectReason?: string;
  issuedBy?: string; issuedAt?: string;            // [URS 11]
  printCount: number;
}

interface RecordHistory {                          // [URS 10]
  historyId: string; recordId: string;
  field: string; beforeValue: any; afterValue: any;
  reason: string;                                  // 수정 사유 필수
  changedBy: string; changedAt: string;
}

interface AuditEvent {                             // [URS 14]
  eventId: string; timestamp: string;
  userId: string; action: string; target: string;
  before?: any; after?: any; reason?: string;
}

interface Settings {
  autoLogoutMinutes: number;                       // [URS 15]
  backupTime: string;                              // "HH:mm" [URS 16]
  companyName: string;                             // 이수증 표기
  schemaVersion: number;
}

interface DocumentSequence { byDate: Record<string, number>; }   // [URS 11]
interface BackupMeta { lastBackupDate: string; lastBackupAt: string; }
```

**시드 데이터** (최초 실행 시 자동 주입):

| 구분 | 내용 |
|---|---|
| 계정 | `admin`/`admin`(관리자, ADMIN), `trainer1`/`1234`(김교육, TRAINER), `qa1`/`1234`(박품질, QA) |
| 교육과정 | GMP 기본 교육(8h, 80점, 12개월), 데이터 완전성(DI) 교육(4h, 80점, 12개월), CSV 실무 교육(7h, 70점, 24개월) |
| 임직원 | 홍길동(생산팀), 김민지(QC팀), 이서준(QA팀), 최수아(공무팀) |

---

## 6. 상태 머신 (URS 7, 9)

```
      (작성)         (제출)            (승인 e-Sig)        (이수증 발행 ※PASS만)
 ───► DRAFT ───────► SUBMITTED ───────► APPROVED ─────────► ISSUED
                         │                  │                  │
                         │                  │                  └─ (재출력: printCount++,
                         │                  │                      문서번호 동일)
                         │                  └─ [수정 시도] → 차단 (URS 9)
                         │
                         └─ (반려, 사유 필수)
                              ▼
                          REJECTED ──(편집 후 재제출)──► DRAFT → SUBMITTED
```

**잠금 규칙 (URS 9)**: `status ∈ {APPROVED, ISSUED}`인 경우
- UI: 수정 버튼 비활성 + "승인 완료 — 수정 불가" 배지 표시
- 로직: 레코드 갱신 함수 호출 시 예외 throw (이중 차단)

---

## 7. 문서번호 부여 규칙 (URS 11)

**형식**: `CERT-YYYYMMDD-NNN`
- `YYYYMMDD`: 발행일자 (KST 기준)
- `NNN`: 해당 일자의 일련번호 3자리 (zero-padding, `001`부터)

**부여 시점**: 최초 발행 시 (APPROVED → ISSUED 전이 시점)
**재출력**: 동일 `certificateNo` 유지, `printCount`만 증가

---

## 8. 자동판정 및 유효기간 규칙 (URS 6, 13)

**합격 판정**:
```
result = (score >= course.passScore) ? "PASS" : "FAIL"
```
- 점수 입력 즉시 화면에 판정 결과를 실시간 미리보기로 표시
- 저장 시점에 과정의 합격기준을 함께 기록 (이후 과정 기준이 변경되어도 기존 기록의 판정은 불변)

**유효기간 계산**:
```
expiryDate = trainingDate + course.revalidMonths (개월)
```
- 만료 30일 이내 = "만료 임박", 만료일 경과 = "만료"
- 불합격(FAIL) 기록은 유효기간 없음 (재교육 대상)

---

## 9. 데이터 완전성 (ALCOA+ 매핑)

| 원칙 | 본 시스템 구현 방식 | 관련 URS |
|---|---|---|
| **A**ttributable | 모든 행위에 사용자 ID 기록 (작성자/승인자/발행자) | 8, 10, 14 |
| **L**egible | 한국어 UI, 인쇄 시 명료한 이수증·이력서 양식 | 11, 12 |
| **C**ontemporaneous | KST 시각 자동 부여 (작성/승인/발행 일시) | 8, 11 |
| **O**riginal | RecordHistory에 수정 전/후 값 영구 보존 | 10 |
| **A**ccurate | 합격기준 자동판정 (인적 판단 오류 방지), 필수 필드 검증 | 6, 16 |
| Complete | 필수 필드 강제, 수정·반려 사유 강제 | 10, 16 |
| Consistent | 상태머신으로 워크플로우 강제 | 7, 9 |
| Enduring | localStorage + 자동/수동 백업 | 16 |
| Available | 감사추적 화면 + CSV 내보내기, 교육이력서 조회 | 12, 14 |

---

## 10. URS ↔ FDS 추적 매트릭스

| URS # | URS 요약 | FDS 절 | 구현 모듈/함수 | 검증 ID |
|:-:|---|---|---|:-:|
| 1 | 로그인 기능 | 4.1 | `auth.login()`, `auth.logout()` | VS-01 |
| 2 | 계정 관리 + 권한 3종 | 3, 4.2 | `userMgmt.*`, RBAC 라우트 가드 | VS-02 |
| 3 | 교육과정 등록 관리 | 4.3 | `courseMgmt.*` | VS-03 |
| 4 | 임직원 등록 관리 | 4.4 | `employeeMgmt.*` | VS-04 |
| 5 | 이수 평가 입력 | 4.5 | `recordEntry.save()` | VS-05 |
| 6 | 합격/불합격 자동판정 | 4.5, 8 | `judge(score, passScore)` | VS-06 |
| 7 | 승인 후에만 이수증 발행 | 4.6, 4.7, 6 | `workflow.approve()`, `cert.issue()` | VS-07 |
| 8 | 전자서명 (비밀번호 재입력) | 4.6 | `esig.confirm()` | VS-08 |
| 9 | 승인 후 수정 불가 | 6 | `record.isLocked()` | VS-09 |
| 10 | 수정 사유 + 전/후 값 추적 | 4.5, 5 | `history.append()` reason 필수 | VS-10 |
| 11 | 이수증 문서번호/발행일자/출력자 | 4.7, 7 | `nextCertNo()`, `cert.render()` | VS-11 |
| 12 | 개인별 교육이력서 출력 | 4.8 | `transcript.render()` | VS-12 |
| 13 | 재교육 주기/유효기간 관리 | 4.9, 8 | `calcExpiry()`, `retraining.classify()` | VS-13 |
| 14 | 감사추적 (불변, CSV) | 4.10 | `audit.append()`, `audit.exportCsv()` | VS-14 |
| 15 | 자동 로그아웃 + 시간 설정 | 4.1, 4.11 | `idleTimer.*` | VS-15 |
| 16 | 필수값 차단 + 자동/수동 백업 | 4.5, 4.11 | `validate.required()`, `backup.checkAndRun()` | VS-16 |

---

## 11. 가정 및 트레이드오프

### 11.1 평문 비밀번호
교육 시연의 단순화를 위해 평문으로 저장한다. **운영 시스템은 반드시 해싱(bcrypt/scrypt) + salt 적용 필요.** SOP 토론 주제로 활용.

### 11.2 e-Signature 단일 컴포넌트
승인 시 비밀번호 재입력 1단계만 시행. 21 CFR Part 11 §11.200의 2-component 요건 중 일부만 시연. 토론 시 2FA·생체 인증 보완 방안을 다룰 것.

### 11.3 localStorage 한계
브라우저별 독립 저장(5~10MB), PC/브라우저 간 공유 불가. 교육 시연 데이터로는 충분하나 운영 시스템에는 부적합 (별도 DB 필요).

### 11.4 자동 백업의 한계
브라우저가 닫혀 있는 시각에는 백업이 실행되지 않는다. "기회 트리거 + 멱등" 패턴으로 보완하며, 운영 SOP로 "근무 종료 전 수동 백업 1회"를 권고.

### 11.5 시간대
모든 timestamp는 KST(Asia/Seoul) 고정.

### 11.6 감사추적 위변조
cryptographic chain 미적용. 교육적 토론 거리: SHA-256 체크섬, chain hash, 외부 불변 스토리지.

---

## 12. 검증 시나리오 요약

상세 시나리오는 `구현계획서.md` 6절을 참조. 각 URS 항목은 정확히 1개의 VS-ID와 1:1 매핑된다 (총 16개).

---

**END OF DOCUMENT**
