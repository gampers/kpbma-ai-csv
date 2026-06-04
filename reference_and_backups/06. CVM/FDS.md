# FDS — 세척 검증 결과 관리 시스템 (CVM, 교육용)

> **Functional Design Specification** | CSV(Computer System Validation) 실습 자료
> 작성일: 2026-06-03 | 버전: 1.0 | 작성자: 교육팀

---

## 1. 문서 개요

### 1.1 목적

URS 16개 요구사항을 충족하는 세척 검증 결과 관리 시스템(CVM)의 기능 설계 명세. CSV 교육에서 **다중 측정값의 허용기준 대비 자동판정**(포인트별 + 전체), 부적합 처리, 승인 워크플로우를 시연·검증하는 기준 문서.

### 1.2 범위

- **포함**: 로그인/계정/권한 3종, 설비 마스터, 세척 검증 계획(샘플링 포인트·허용기준), 결과 입력·자동판정, 부적합 처리, 승인(e-Sig), 보고서 출력, 설비별 이력, 감사추적
- **제외**: MACO 계산기(허용기준 산출 — 계획에 결과값만 입력), 회수율 보정, 외부 LIMS 연동, 다국어

### 1.3 참조 문서

- URS v1.0 / GAMP 5 Category 5 / 21 CFR Part 11
- EU GMP Annex 15 §10 (Cleaning Validation), PIC/S PI 006 (세척 검증의 규제 배경)

---

## 2. 시스템 개요

- **실행**: `cvm.html` 더블클릭 (단일 파일 SPA, 외부 의존성 0, 오프라인)
- **저장소**: localStorage (네임스페이스 `cvm:`)
- **GAMP 카테고리**: 5 (교육용 데모, Risk: Low)

---

## 3. 사용자 역할 및 권한

| 역할 코드 | 역할명 | 책임 |
|---|---|---|
| `ADMIN` | 관리자 | 설비 마스터, 계정/설정/감사추적 |
| `VAL` | 밸리데이션담당자 | 검증 계획 등록, 결과 입력, 부적합 처리, 제출 |
| `QA` | QA승인자 | 검증 결과 승인/반려(e-Sig), 보고서 출력 |

### 권한 매트릭스

| 화면 | ADMIN | VAL | QA |
|---|:-:|:-:|:-:|
| 대시보드 / 설비별 이력 | O | O | O |
| 설비 마스터 | O (관리) | 조회 | 조회 |
| 검증 계획 등록 / 결과 입력 | - | O | - |
| 승인 대기 | - | - | O |
| 보고서 출력 | O | - | O |
| 감사추적 / 계정 / 설정 | O | - | - |

---

## 4. 기능 명세

### 4.1 설비 마스터 (URS 3)

- ADMIN 관리. 필수: 설비번호, 설비명, 제품 접촉 재질(SUS316L 등)
- 비활성화 가능 (기존 검증 이력 유지)

### 4.2 세척 검증 계획 (URS 4)

- VAL 전용. 필수 입력:
  - 대상 설비 (마스터에서 선택)
  - 이전 제품 (세척 대상 — worst case 제품)
  - 차기 제품
  - 세척 SOP 번호
  - 샘플링 방법: 스왑(Swab) / 린스(Rinse)
  - **샘플링 포인트 목록**: 자유 추가 (예: 교반기 날개, 탱크 내벽 하단, 배출 밸브) — 최소 1개
  - **잔류물 허용기준**: 수치 + 단위 (예: 10 µg/swab, 5 ppm)
- 계획 등록 후 결과 입력 가능. 계획 자체는 결과가 연결되기 전까지 수정 가능 (수정 사유 불필요 — 계획 단계)

### 4.3 결과 입력 / 자동판정 (URS 5, 6, 7, 16)

- VAL 전용. 계획 선택 → 샘플링 포인트별 결과값 입력 (소수점 둘째 자리)
- **포인트별 자동판정** (URS 6): `결과값 ≤ 허용기준 → 적합(PASS)` / `초과 → 부적합(FAIL)`
- **전체 판정** (URS 7): 모든 포인트 적합 → **적합** / 하나라도 부적합 → **부적합**
- 입력 화면에서 결과값 입력 즉시 포인트별·전체 판정을 실시간 표시
- 시험일자, 시험자 의견 입력. 저장 시 작성자/일시 자동 기록

### 4.4 부적합 처리 (URS 8)

- 전체 판정이 부적합인 결과를 저장/제출하려면 **부적합 사유와 조치 사항이 필수**
- 조치 사항 예: 재세척 후 재시험, 세척 SOP 개정, 일탈 처리
- 부적합 결과도 승인 대상 (기록의 완전성) — 승인 후 동일 계획으로 재시험(새 결과) 생성 가능

### 4.5 승인 워크플로우 (URS 9, 10)

- 상태: `DRAFT → SUBMITTED → APPROVED` (분기: `SUBMITTED → REJECTED → DRAFT`)
- 승인(QA): 비밀번호 재입력 e-Sig → 승인자/일시 기록 → 보고서 발행 가능
- 승인 후 수정 불가 (UI + 로직 이중 차단)

### 4.6 보고서 / 이력 (URS 12, 13)

- **세척 검증 보고서**: 계획 정보(설비/제품/SOP/허용기준) + 포인트별 결과·판정 표 + 전체 판정 + 부적합 처리 내역 + 시험자/승인자 서명 + 출력자/일시
- **설비별 이력**: 설비 선택 → 해당 설비의 모든 검증 수행 이력 (계획·결과·판정·승인 상태)

### 4.7 공통 (URS 1, 2, 11, 14, 15, 16)

- 기존 시스템과 동일 패턴: 로그인, 계정 관리, 수정 사유+이력, 감사추적(CSV), 자동 로그아웃, 필수값 검증

---

## 5. 데이터 모델 (localStorage 스키마)

키 네임스페이스: `cvm:`

```ts
type Role = "ADMIN" | "VAL" | "QA";
type RunStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
type Judgment = "PASS" | "FAIL";

interface Equipment {                   // [URS 3]
  equipmentId: string; equipmentNo: string; equipmentName: string;
  contactMaterial: string; active: boolean;
  createdAt: string; createdBy: string;
}

interface CleaningPlan {                // [URS 4]
  planId: string; equipmentId: string;
  prevProduct: string; nextProduct: string;
  cleaningSop: string;
  samplingMethod: "Swab" | "Rinse";
  samplingPoints: string[];             // 최소 1개
  limitValue: number; limitUnit: string;  // 허용기준
  createdBy: string; createdByName: string; createdAt: string;
}

interface ValidationRun {               // [URS 5, 6, 7, 8]
  runId: string; planId: string;
  testDate: string;
  results: Record<string, number>;      // 포인트명 → 결과값
  pointJudgments: Record<string, Judgment>;  // 포인트별 판정 [URS 6]
  overallResult: Judgment;              // 전체 판정 [URS 7]
  comment: string;
  nonconformity: {reason: string; action: string} | null;  // 부적합 처리 [URS 8]
  status: RunStatus;                    // [URS 9, 10]
  createdBy: string; createdByName: string; createdAt: string;
  submittedAt?: string;
  approvedBy?: string; approvedByName?: string; approvedAt?: string;  // e-Sig
  rejectedBy?: string; rejectedAt?: string; rejectReason?: string;
}

interface RunHistory { /* 수정 이력 [URS 11] */ }
interface AuditEvent { /* 공통 [URS 14] */ }
interface Settings { autoLogoutMinutes: number; companyName: string; }
```

**시드 데이터**:

| 구분 | 내용 |
|---|---|
| 계정 | `admin`/`admin`(ADMIN), `val1`/`1234`(김검증, VAL), `qa1`/`1234`(박승인, QA) |
| 설비 | 과립기 GR-101 (SUS316L), 타정기 TP-201 (SUS316L), 혼합기 MX-301 (SUS304) |
| 계획 | 과립기 GR-101: 제품A → 제품B, 스왑법, 포인트 4개, 허용기준 10 µg/swab |

---

## 6. 자동판정 규칙 (URS 6, 7)

```
포인트별 판정:
  pointJudgment[p] = (results[p] <= plan.limitValue) ? PASS : FAIL

전체 판정:
  overallResult = 모든 포인트가 PASS ? PASS : FAIL
```

- 결과값은 소수점 둘째 자리까지 입력 가능, 비교는 입력값 그대로 수행 (반올림 없이 — 보수적 판정)
- 부적합(FAIL)이 하나라도 있으면 부적합 사유·조치 입력이 필수가 된다 (URS 8)
- 판정 로직은 저장 시점에 확정되어 기록에 보존된다

---

## 7. 데이터 완전성 (ALCOA+ 매핑)

| 원칙 | 구현 방식 | 관련 URS |
|---|---|---|
| **A**ttributable | 시험자/승인자 ID·이름 기록 | 5, 9 |
| **L**egible | 한국어 UI, 보고서 인쇄 양식 | 12 |
| **C**ontemporaneous | 작성/승인 일시 KST 자동 부여 | 9 |
| **O**riginal | 수정 전/후 값 보존, 판정 결과 보존 | 11 |
| **A**ccurate | 허용기준 대비 자동판정 (인적 오류 방지) | 6, 7 |
| Complete | 전체 포인트 결과 필수, 부적합 시 사유·조치 필수 | 8, 16 |
| Consistent | 상태머신 워크플로우, 전체판정 = AND(포인트 판정) | 7, 9 |
| Enduring | localStorage 영속 저장 | - |
| Available | 설비별 이력 조회, 보고서 출력, 감사추적 CSV | 12, 13, 14 |

---

## 8. URS ↔ FDS 추적 매트릭스

| URS # | URS 요약 | FDS 절 | 구현 모듈 | 검증 ID |
|:-:|---|---|---|:-:|
| 1 | 로그인 | 4.7 | `auth.login()` | VS-01 |
| 2 | 계정 + 권한 3종 | 3 | `userMgmt`, 권한 매트릭스 | VS-02 |
| 3 | 설비 마스터 | 4.1 | `equipmentMgmt` | VS-03 |
| 4 | 검증 계획 등록 | 4.2 | `planMgmt.create()` | VS-04 |
| 5 | 포인트별 결과 입력 | 4.3 | `runEntry` | VS-05 |
| 6 | 포인트별 자동판정 | 4.3, 6 | `judgePoint(value, limit)` | VS-06 |
| 7 | 전체 판정 (AND 조건) | 4.3, 6 | `judgeOverall(judgments)` | VS-07 |
| 8 | 부적합 사유·조치 기록 | 4.4 | `nonconformity` 필수 검증 | VS-08 |
| 9 | 승인 후 보고서 발행 (e-Sig) | 4.5 | `workflow.approve()` | VS-09 |
| 10 | 승인 후 수정 불가 | 4.5 | `isLocked()` | VS-10 |
| 11 | 수정 사유 + 전/후 추적 | 4.7 | `updateRun()` + history | VS-11 |
| 12 | 보고서 출력 | 4.6 | `printReport()` | VS-12 |
| 13 | 설비별 이력 조회 | 4.6 | `equipmentHistory()` | VS-13 |
| 14 | 감사추적 | 4.7 | `audit.*` | VS-14 |
| 15 | 자동 로그아웃 | 4.7 | `idleTimer` | VS-15 |
| 16 | 필수값 차단 | 4.3, 4.7 | `validateRequired()` | VS-16 |

---

## 9. 가정 및 트레이드오프

1. **MACO 계산 제외** — 허용기준은 계산된 값을 입력 (MACO 산출식은 교육 이론 세션에서 다룸)
2. **회수율(Recovery) 보정 제외** — 결과값은 보정 완료된 값으로 가정
3. **평문 비밀번호 / localStorage** — 교육용 한정
4. **부적합 시 재시험** — 동일 계획으로 새 결과(Run)를 생성하는 방식 (기존 부적합 기록은 보존)

---

**END OF DOCUMENT**
