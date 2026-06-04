# FDS — 시약/표준품 재고 관리 시스템 (RIM, 교육용)

> **Functional Design Specification** | CSV(Computer System Validation) 실습 자료
> 작성일: 2026-06-03 | 버전: 1.0 | 작성자: 교육팀

---

## 1. 문서 개요

### 1.1 목적

URS 16개 요구사항을 충족하는 시약/표준품 재고 관리 시스템(RIM)의 기능 설계 명세. CSV 교육에서 **수불 기록의 데이터 완전성**(잔량 계산 정확성, 음수 재고 방지, 기록 불변성), 유효기간 통제, 폐기 승인 워크플로우를 시연·검증하는 기준 문서.

### 1.2 범위

- **포함**: 로그인/계정/권한 3종, 품목 마스터, 입고/사용/폐기 수불 기록(append-only), 잔량 자동 계산, 유효기간 통제, 폐기 승인(e-Sig), 재고 현황 보고서·수불부 출력, 감사추적, 자동 로그아웃
- **제외**: 발주/구매 연동, 바코드 스캔, 보관 위치(창고) 관리, 다국어

### 1.3 참조 문서

- URS v1.0 (16개 항목)
- GAMP 5 — Category 5 / 21 CFR Part 11
- 시약 수불부는 MFDS·PIC/S DI 실사의 대표적 점검 대상 (데이터 완전성 통제 시연 목적)

---

## 2. 시스템 개요

- **실행**: `rim.html` 더블클릭 (단일 파일 SPA, 외부 의존성 0, 오프라인 동작)
- **저장소**: localStorage (네임스페이스 `rim:`)
- **GAMP 카테고리**: 5 (교육용 데모, Risk: Low)

---

## 3. 사용자 역할 및 권한

| 역할 코드 | 역할명 | 책임 |
|---|---|---|
| `ADMIN` | 관리자 | 품목 마스터, 계정 관리, 환경설정, 감사추적 |
| `QC` | QC담당자 | 입고 등록, 사용 기록, 폐기 요청, 조회/출력 |
| `MANAGER` | QC책임자 | 폐기 승인(e-Sig), 조회/출력 |

### 권한 매트릭스

| 화면 | ADMIN | QC | MANAGER |
|---|:-:|:-:|:-:|
| 대시보드 / 재고 현황 / 수불부 | O | O | O |
| 품목 마스터 | O (관리) | 조회 | 조회 |
| 입고 등록 / 사용 기록 | - | O | - |
| 폐기 요청 | - | O | - |
| 폐기 승인 (e-Sig) | - | - | O |
| 감사추적 / 계정 관리 / 환경설정 | O | - | - |

---

## 4. 기능 명세

### 4.1 품목 마스터 (URS 3)

- ADMIN 관리. 필수: 품목코드, 품명, 제조사, 규격(Grade), 보관조건, 단위(mL, g, ea 등)
- 품목 비활성화 가능 (기존 Lot/기록 유지)

### 4.2 입고 등록 (URS 4, 16)

- QC 전용. 필수: 품목, Lot 번호, 입고 수량, 유효기간
- **동일 품목 내 Lot 번호 중복 차단** (URS 16)
- 저장 시 입고자/일시 전자서명, 수불 기록(RECEIPT) 생성, Lot 상태 `ACTIVE`

### 4.3 사용 기록 / 잔량 계산 (URS 5, 6, 7, 9)

- QC 전용. 품목 → Lot 선택 시 **현재 잔량 표시**
- 사용량 입력 시 **사용 후 잔량 실시간 미리보기**: `잔량 - 사용량 = 사용 후 잔량`
- **음수 재고 차단** (URS 6): 사용량 > 잔량이면 저장 차단
- **만료 Lot 차단** (URS 9): 유효기간 경과 Lot은 사용 기록 입력 불가
- 저장 시 전자서명 + 수불 기록(USE) append-only 생성, 잔량 0 도달 시 Lot 상태 `DEPLETED`

### 4.4 폐기 처리 (URS 10)

- 2단계: QC가 폐기 요청(사유 필수) → MANAGER가 승인(비밀번호 재입력 e-Sig)
- 승인 시 잔량 전체가 폐기 수량으로 기록(DISPOSAL), Lot 상태 `DISPOSED`
- 반려 시 사유 기록, Lot은 기존 상태 유지

### 4.5 유효기간 통제 (URS 8, 9)

| 상태 | 조건 | 동작 |
|---|---|---|
| 유효 | 만료일까지 30일 초과 | 정상 사용 |
| 만료 임박 | 만료일까지 30일 이내 | 경고 표시, 사용은 가능 |
| 만료 | 만료일 경과 | **사용 기록 차단**, 폐기 대상 표시 |

### 4.6 출력물 (URS 11, 12)

- **재고 현황 보고서**: 전체 품목/Lot의 잔량·유효기간 상태 일람 + 출력자/출력일시
- **수불부 (품목별 사용기록서)**: 특정 품목/Lot의 입고→사용→폐기 전체 이력 + 잔량 변동 + 출력자/출력일시
- `window.print()` → PDF 저장

### 4.7 감사추적 / 자동 로그아웃 / 검증 (URS 13, 14, 15)

- LM/ELB와 동일 패턴: append-only 감사추적 + 필터 + CSV, 무활동 자동 로그아웃, 필수값 검증

---

## 5. 데이터 모델 (localStorage 스키마)

키 네임스페이스: `rim:`

```ts
type Role = "ADMIN" | "QC" | "MANAGER";
type LotStatus = "ACTIVE" | "DEPLETED" | "DISPOSAL_REQUESTED" | "DISPOSED";
type TxType = "RECEIPT" | "USE" | "DISPOSAL";

interface Item {                       // [URS 3]
  itemId: string; itemCode: string; itemName: string;
  manufacturer: string; grade: string; storageCondition: string; unit: string;
  active: boolean; createdAt: string; createdBy: string;
}

interface Lot {                        // [URS 4, 8, 9, 16]
  lotId: string; itemId: string; lotNo: string;
  initialQty: number; currentQty: number;       // 잔량 [URS 5]
  expiryDate: string;                            // [URS 8, 9]
  status: LotStatus;
  receivedBy: string; receivedByName: string; receivedAt: string;
  disposalReason?: string; disposalRequestedBy?: string; disposalRequestedAt?: string;
  disposedBy?: string; disposedByName?: string; disposedAt?: string;
}

interface Transaction {                // [URS 5, 7] append-only
  txId: string; lotId: string; itemId: string;
  type: TxType; qty: number;
  balanceAfter: number;                          // 거래 후 잔량 (수불부 핵심)
  purpose: string;                               // 사용 목적 / 폐기 사유
  signedBy: string; signedByName: string; signedAt: string;   // 전자서명 [URS 7]
}

interface AuditEvent { /* LM/ELB와 동일 */ }
interface Settings { autoLogoutMinutes: number; companyName: string; expiryWarningDays: number; }
```

**시드 데이터**:

| 구분 | 내용 |
|---|---|
| 계정 | `admin`/`admin`(ADMIN), `qc1`/`1234`(김분석, QC), `manager1`/`1234`(이책임, MANAGER) |
| 품목 | Acetonitrile (HPLC Grade, mL), Methanol (HPLC Grade, mL), 표준품 Aspirin USP (mg), Sodium Hydroxide (시약특급, g) |
| Lot | 품목별 초기 Lot 1~2개 (잔량·유효기간 다양: 유효/임박/만료 상태 시연용) |

---

## 6. 수불 무결성 설계 (URS 5, 6, 7)

```
입고 (RECEIPT, +수량)
   │   currentQty = initialQty
   ▼
사용 (USE, -수량)  ← 사용량 ≤ 잔량 검증 (음수 차단)
   │   currentQty -= 사용량, balanceAfter 기록
   │   currentQty == 0 → DEPLETED
   ▼
폐기 (DISPOSAL, -잔량 전체)  ← MANAGER e-Sig 필수
       currentQty = 0, DISPOSED
```

- 모든 거래는 **append-only Transaction**으로 기록되며 수정·삭제 함수가 존재하지 않는다
- `currentQty`는 항상 `initialQty - Σ(USE) - Σ(DISPOSAL)`과 일치해야 한다 (수불 정합성 — IOQ 검증 포인트)
- 수불부 출력 시 각 거래의 `balanceAfter`가 연속적으로 일치하는지 확인 가능

---

## 7. 데이터 완전성 (ALCOA+ 매핑)

| 원칙 | 구현 방식 | 관련 URS |
|---|---|---|
| **A**ttributable | 입고/사용/폐기 전자서명 (기록자 ID/이름) | 4, 7, 10 |
| **L**egible | 한국어 UI, 보고서/수불부 인쇄 양식 | 11, 12 |
| **C**ontemporaneous | 거래 일시 KST 자동 부여 | 7 |
| **O**riginal | 거래 기록 append-only (수정·삭제 불가) | 7 |
| **A**ccurate | 잔량 자동 계산, 음수 차단, 만료 차단 | 5, 6, 9 |
| Complete | 필수값 검증, 모든 거래 누락 없이 기록 | 15 |
| Consistent | 수불 정합성 (balanceAfter 연속성) | 5, 12 |
| Enduring | localStorage 영속 저장 | - |
| Available | 재고 현황/수불부 조회·출력, 감사추적 CSV | 11, 12, 13 |

---

## 8. URS ↔ FDS 추적 매트릭스

| URS # | URS 요약 | FDS 절 | 구현 모듈 | 검증 ID |
|:-:|---|---|---|:-:|
| 1 | 로그인 | 4.7 | `auth.login()` | VS-01 |
| 2 | 계정 + 권한 3종 | 3 | `userMgmt`, 권한 매트릭스 | VS-02 |
| 3 | 품목 마스터 | 4.1 | `itemMgmt` | VS-03 |
| 4 | 입고 등록 + 전자서명 | 4.2 | `inventory.receive()` | VS-04 |
| 5 | 사용 기록 + 잔량 자동 계산 | 4.3, 6 | `inventory.use()`, `balanceAfter` | VS-05 |
| 6 | 음수 재고 차단 | 4.3, 6 | 사용량 ≤ 잔량 검증 | VS-06 |
| 7 | 기록 불변 + 전자서명 | 4.3, 6 | append-only Transaction | VS-07 |
| 8 | 유효기간 임박/만료 표시 | 4.5 | `expiryStatus()` | VS-08 |
| 9 | 만료 Lot 사용 차단 | 4.3, 4.5 | 만료 검증 | VS-09 |
| 10 | 폐기 승인 (e-Sig) | 4.4 | `disposal.request/approve()` | VS-10 |
| 11 | 재고 현황 보고서 출력 | 4.6 | `printStockReport()` | VS-11 |
| 12 | 수불부 출력 | 4.6 | `printLedger()` | VS-12 |
| 13 | 감사추적 (불변, CSV) | 4.7 | `audit.*` | VS-13 |
| 14 | 자동 로그아웃 | 4.7 | `idleTimer` | VS-14 |
| 15 | 필수값 차단 | 4.7 | `validateRequired()` | VS-15 |
| 16 | Lot 중복 차단 | 4.2 | 중복 검증 | VS-16 |

---

## 9. 가정 및 트레이드오프

1. **평문 비밀번호** — 교육용 (운영 금지)
2. **잔량 정정 절차 없음** — 실물 재고와 시스템 잔량 불일치 시 처리는 SOP/일탈 절차로 보완 (교육 토론 주제: 재고 실사)
3. **localStorage** — 브라우저별 독립 (교육용 한정)
4. **소수점 처리** — 수량은 소수점 둘째 자리까지 입력, 계산 결과는 둘째 자리 반올림

---

**END OF DOCUMENT**
