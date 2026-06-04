# FDS — 공급업체 평가 관리 시스템 (SEM, 교육용)

> **Functional Design Specification** | CSV(Computer System Validation) 실습 자료
> 작성일: 2026-06-03 | 버전: 1.0 | 작성자: 교육팀

---

## 1. 문서 개요

### 1.1 목적

URS 16개 요구사항을 충족하는 공급업체 평가 관리 시스템(SEM)의 기능 설계 명세. CSV 교육에서 **다항목 점수 평가 → 등급 자동판정 → 승인 워크플로우 → ASL 등재**의 통제 흐름과 데이터 완전성을 시연·검증하는 기준 문서.

### 1.2 범위

- **포함**: 로그인/계정/권한 3종, 공급업체 마스터, 평가 기준 관리, 평가 수행(다항목 점수), 등급 자동판정, 승인(e-Sig), ASL 관리·출력, 평가 보고서 출력, 재평가 주기 관리, 감사추적
- **제외**: 공급업체 실사(audit) 일정 관리, 외부 ERP/구매 시스템 연동, 첨부파일 관리, 다국어

### 1.3 참조 문서

- URS v1.0 / GAMP 5 Category 5 / 21 CFR Part 11
- ICH Q10 §2.7 (외주 활동 및 구매 자재 관리 — 공급업체 평가의 규제 배경)

---

## 2. 시스템 개요

- **실행**: `sem.html` 더블클릭 (단일 파일 SPA, 외부 의존성 0, 오프라인)
- **저장소**: localStorage (네임스페이스 `sem:`)
- **GAMP 카테고리**: 5 (교육용 데모, Risk: Low)

---

## 3. 사용자 역할 및 권한

| 역할 코드 | 역할명 | 책임 |
|---|---|---|
| `ADMIN` | 관리자 | 공급업체 마스터, 평가 기준 관리, 계정/설정/감사추적 |
| `QA` | QA담당자 | 평가 수행(점수 입력), 본인 작성건 수정/제출 |
| `MANAGER` | QA책임자 | 평가 승인/반려(e-Sig), ASL·보고서 출력 |

### 권한 매트릭스

| 화면 | ADMIN | QA | MANAGER |
|---|:-:|:-:|:-:|
| 대시보드 / ASL / 재평가 현황 | O | O | O |
| 공급업체 마스터 | O (관리) | 조회 | 조회 |
| 평가 수행 / 내 평가 | - | O | - |
| 승인 대기 | - | - | O |
| 평가 보고서 출력 | O | O | O |
| 평가 기준 관리 / 감사추적 / 계정 / 설정 | O | - | - |

---

## 4. 기능 명세

### 4.1 공급업체 마스터 (URS 3)

- ADMIN 관리. 필수: 업체코드, 업체명, 공급품목 구분(원료/부자재/포장재/서비스), 소재지
- 비활성화 가능 (기존 평가 이력 유지)

### 4.2 평가 기준 관리 (URS 4)

- ADMIN 전용. 두 가지 기준을 관리:
  - **평가 항목**: 항목명 + 배점 (기본 5항목 × 20점 = 100점 만점)
    1. 품질시스템 (GMP/ISO 인증) — 20점
    2. 품질 이력 (부적합/회수 이력) — 20점
    3. 납기 준수 — 20점
    4. 문서 관리 (COA, 시험성적 신뢰성) — 20점
    5. 변경 관리 (변경 통보 체계) — 20점
  - **등급 판정 기준**: 등급별 최소 점수 + 재평가 주기
- 기준 변경은 감사추적 기록. **진행 중 평가에는 영향 없음** (평가 저장 시점의 기준이 평가에 보존됨)

### 4.3 평가 수행 / 등급 자동판정 (URS 5, 6, 16)

- QA 전용. 공급업체 선택 → 평가 항목별 점수 입력 (0 ~ 항목 배점)
- **실시간 등급 판정 미리보기**: 점수 입력 시 총점과 예상 등급 즉시 표시
- 등급 판정 기준 (기본값):

| 등급 | 총점 기준 | 의미 | 재평가 주기 |
|---|---|---|---|
| **A** | 90점 이상 | 승인 | 36개월 |
| **B** | 70~89점 | 조건부 승인 | 12개월 |
| **C** | 50~69점 | 개선 후 재평가 | 6개월 |
| **부적합** | 50점 미만 | 사용 불가 | - (ASL 제외) |

- 평가 의견(서술) 필수, 저장 시 평가자/일시 자동 기록, 평가 시점의 기준(항목·배점·등급규칙) 스냅샷 보존

### 4.4 승인 워크플로우 (URS 7, 8, 9)

- 상태: `DRAFT → SUBMITTED → APPROVED` (분기: `SUBMITTED → REJECTED → DRAFT`)
- 승인(MANAGER): 비밀번호 재입력 e-Sig → 승인자/일시 기록 → **ASL 자동 반영**
- 승인 시 차기 평가 예정일 자동 계산: 평가일 + 등급별 재평가 주기 (URS 13)
- 승인 후 수정 불가 (UI 비활성 + 로직 throw)

### 4.5 ASL / 재평가 현황 (URS 12, 13)

- **ASL (승인 공급업체 목록)**: 공급업체별 최신 승인 평가 기준으로 등급 A/B/C 업체 목록 표시. 부적합은 제외하되 별도 표시
- **재평가 현황**: 차기 평가 예정일 기준 분류 — 정상 / 도래 임박(60일 이내) / 경과
- ASL 출력물: 업체명, 품목 구분, 등급, 최근 평가일, 차기 평가 예정일, 출력자/일시

### 4.6 출력물 (URS 11, 12)

- **공급업체 평가 보고서**: 개별 평가의 항목별 점수, 총점, 등급, 평가 의견, 평가자/승인자 서명
- **ASL**: 승인 공급업체 일람표
- `window.print()` → PDF 저장

### 4.7 공통 (URS 1, 2, 10, 14, 15, 16)

- LM/RIM과 동일 패턴: 로그인, 계정 관리, 수정 사유+이력 추적, 감사추적(CSV), 자동 로그아웃, 필수값 검증

---

## 5. 데이터 모델 (localStorage 스키마)

키 네임스페이스: `sem:`

```ts
type Role = "ADMIN" | "QA" | "MANAGER";
type EvalStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
type Grade = "A" | "B" | "C" | "FAIL";

interface Supplier {                    // [URS 3]
  supplierId: string; supplierCode: string; supplierName: string;
  category: string;                     // 원료 / 부자재 / 포장재 / 서비스
  location: string; active: boolean;
  createdAt: string; createdBy: string;
}

interface Evaluation {                  // [URS 5, 6]
  evalId: string; supplierId: string;
  evalDate: string;
  scores: Record<string, number>;       // 항목 key → 점수
  totalScore: number;
  grade: Grade;                         // 자동판정 [URS 6]
  comment: string;                      // 평가 의견
  criteriaSnapshot: {                   // 평가 시점 기준 보존
    items: {key:string; label:string; maxScore:number}[];
    gradeRules: {grade:Grade; minScore:number; revalidMonths:number|null}[];
  };
  nextEvalDate: string | null;          // 차기 평가 예정일 [URS 13]
  status: EvalStatus;                   // [URS 7, 9]
  createdBy: string; createdByName: string; createdAt: string;
  submittedAt?: string;
  approvedBy?: string; approvedByName?: string; approvedAt?: string;  // e-Sig [URS 8]
  rejectedBy?: string; rejectedAt?: string; rejectReason?: string;
}

interface EvalHistory { /* 수정 이력 — LM과 동일 패턴 [URS 10] */ }
interface AuditEvent { /* 공통 패턴 [URS 14] */ }

interface Settings {
  autoLogoutMinutes: number; companyName: string;
  evaluationCriteria: {key:string; label:string; maxScore:number}[];     // [URS 4]
  gradeRules: {grade:Grade; label:string; minScore:number; revalidMonths:number|null}[];  // [URS 4]
}
```

**시드 데이터**:

| 구분 | 내용 |
|---|---|
| 계정 | `admin`/`admin`(ADMIN), `qa1`/`1234`(김품질, QA), `manager1`/`1234`(박책임, MANAGER) |
| 공급업체 | 한국원료(주) [원료], 대한포장 [포장재], 신성케미칼 [원료], 글로벌물류(주) [서비스] |
| 평가 기준 | 5항목 × 20점, 등급 A(90+/36개월), B(70+/12개월), C(50+/6개월), 부적합(<50) |

---

## 6. 등급 자동판정 규칙 (URS 6)

```
totalScore = Σ(항목별 점수)
grade = gradeRules에서 totalScore >= minScore를 만족하는 최고 등급
        (어느 기준도 만족하지 못하면 FAIL = 부적합)

차기 평가 예정일 (승인 시점에 확정):
nextEvalDate = evalDate + grade의 revalidMonths (부적합은 null)
```

- 평가 저장 시점의 평가 기준 전체(`criteriaSnapshot`)가 평가 기록에 보존된다 → 이후 기준이 변경되어도 기존 평가의 판정 근거가 유지됨 (데이터 완전성: Original)
- 항목별 점수는 0 ~ 해당 항목 배점 범위만 입력 가능 (범위 초과 차단)

---

## 7. 데이터 완전성 (ALCOA+ 매핑)

| 원칙 | 구현 방식 | 관련 URS |
|---|---|---|
| **A**ttributable | 평가자/승인자 ID·이름 기록 | 5, 8 |
| **L**egible | 한국어 UI, 보고서/ASL 인쇄 양식 | 11, 12 |
| **C**ontemporaneous | 작성/승인 일시 KST 자동 부여 | 8 |
| **O**riginal | 수정 전/후 값 보존 + 평가 기준 스냅샷 | 10, 6 |
| **A**ccurate | 등급 자동판정 (인적 판단 오류 방지), 점수 범위 검증 | 6 |
| Complete | 필수 항목 강제 (전 항목 점수 + 의견) | 16 |
| Consistent | 상태머신 워크플로우 강제 | 7, 9 |
| Enduring | localStorage 영속 저장 | - |
| Available | ASL/보고서 조회·출력, 감사추적 CSV | 11, 12, 14 |

---

## 8. URS ↔ FDS 추적 매트릭스

| URS # | URS 요약 | FDS 절 | 구현 모듈 | 검증 ID |
|:-:|---|---|---|:-:|
| 1 | 로그인 | 4.7 | `auth.login()` | VS-01 |
| 2 | 계정 + 권한 3종 | 3 | `userMgmt`, 권한 매트릭스 | VS-02 |
| 3 | 공급업체 등록 관리 | 4.1 | `supplierMgmt` | VS-03 |
| 4 | 평가 기준 관리 | 4.2 | `settings.evaluationCriteria/gradeRules` | VS-04 |
| 5 | 평가 수행 (항목별 점수) | 4.3 | `evaluation.create()` | VS-05 |
| 6 | 등급 자동판정 | 4.3, 6 | `judgeGrade(totalScore)` | VS-06 |
| 7 | 승인 후 ASL 반영 | 4.4, 4.5 | `workflow.approve()` → ASL | VS-07 |
| 8 | 전자서명 | 4.4 | `esig` 비밀번호 재입력 | VS-08 |
| 9 | 승인 후 수정 불가 | 4.4 | `isLocked()` | VS-09 |
| 10 | 수정 사유 + 전/후 추적 | 4.7 | `updateEvaluation()` + history | VS-10 |
| 11 | 평가 보고서 출력 | 4.6 | `printEvalReport()` | VS-11 |
| 12 | ASL 출력 | 4.5, 4.6 | `printAsl()` | VS-12 |
| 13 | 재평가 주기/예정일 | 4.5, 6 | `nextEvalDate`, 재평가 현황 | VS-13 |
| 14 | 감사추적 | 4.7 | `audit.*` | VS-14 |
| 15 | 자동 로그아웃 | 4.7 | `idleTimer` | VS-15 |
| 16 | 필수값 차단 | 4.3, 4.7 | `validateRequired()` | VS-16 |

---

## 9. 가정 및 트레이드오프

1. **평문 비밀번호** — 교육용 (운영 금지)
2. **공급업체별 ASL 등급 = 최신 승인 평가 기준** — 이전 평가 이력은 보존되되 ASL에는 최신만 반영
3. **재평가 알림** — 화면 표시만 제공 (이메일 등 외부 알림 없음)
4. **localStorage** — 브라우저별 독립 (교육용 한정)

---

**END OF DOCUMENT**
