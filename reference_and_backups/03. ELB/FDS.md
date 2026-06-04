# FDS — 전자로그북 기록 시스템 v2 (ELB, 교육용)

> **Functional Design Specification** | CSV(Computer System Validation) 실습 자료
> 작성일: 2026-06-03 | 버전: 2.0 | 작성자: 교육팀

---

## 1. 문서 개요

### 1.1 목적

본 문서는 URS에 정의된 16개 요구사항을 충족하기 위한 전자로그북 기록 시스템 v2(ELB)의 **기능 설계 명세**를 정의한다. CSV 교육 실습에서 전자기록·전자서명, 기록 불변성, 감사추적, 계정 정책 통제를 시연·검증하는 기준 문서로 사용한다.

### 1.2 v1 → v2 주요 변경

| 항목 | v1 (파일럿) | v2 (본 문서) |
|---|---|---|
| 파일 구조 | 멀티페이지 HTML 7개 + JS 7개 + CSS | **단일 파일 SPA (elb.html)** |
| PDF 출력 | jsPDF + AutoTable (CDN 의존) | `window.print()` + `@media print` (**의존성 0**) |
| 네트워크 | CDN 로드 필요 (인터넷 필수) | **완전 오프라인 동작** |
| 비밀번호 | 단순 해시 | 평문 (교육용 명시) + **정책 강제 적용** |
| 디자인 | 기본 CSS | Starbucks 디자인 시스템 |

### 1.3 범위

- **포함**: 로그인/계정/권한(Manager·Operator), 패스워드 정책, 장비 마스터, 사용 로그 작성·전자서명, 기록 불변성, 이력 조회·필터·출력, 감사추적, 자동 로그아웃
- **제외**: 외부 장비 인터페이스 연동, 승인 워크플로우(로그는 작성 즉시 확정), 다국어, 모바일 최적화

### 1.4 참조 문서

- URS v2.0 (16개 항목)
- GAMP 5 — Category 5 (Custom Application)
- 21 CFR Part 11 — Electronic Records, Electronic Signatures (§11.10, §11.50, §11.300)

### 1.5 개정 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|---|---|---|---|
| 1.0 | 2026-03 | 파일럿 (멀티페이지 + jsPDF) | 교육팀 |
| 2.0 | 2026-06-03 | 단일 파일 SPA 재구축, 의존성 제거, 패스워드 정책 강제 | 교육팀 |

---

## 2. 시스템 개요

### 2.1 사용 환경

- **클라이언트**: Chrome / Edge 최신 버전 (표준 HTML5 브라우저 — URS 10)
- **실행 방식**: `elb.html` 더블클릭 → 로컬 실행 (`file://`), **네트워크 불필요**
- **저장소**: 브라우저 `localStorage` (네임스페이스 `elb:`)

### 2.2 GxP 분류

- **GAMP 카테고리**: 5 (Custom Application — 교육용 데모)
- **Risk 등급**: Low (교육 시스템)

---

## 3. 사용자 역할 및 권한

### 3.1 역할 정의 (URS 13, 14, 15)

| 역할 코드 | 역할명 | 책임 |
|---|---|---|
| `MANAGER` | 관리자 | Operator 계정 생성, 패스워드 정책·장비 목록·시스템 설정 관리, 감사추적 조회, 로그 작성·출력 |
| `OPERATOR` | 작업자 | 장비 사용 로그 작성(전자서명), 이력 조회, 장비사용 기록서 출력 |

- 초기 Manager 계정 1개 시드 주입 (URS 14)
- Manager만 신규 계정(Operator/Manager)을 생성할 수 있다

### 3.2 권한 매트릭스

| 화면 | MANAGER | OPERATOR |
|---|:-:|:-:|
| 로그인 | 공개 | 공개 |
| 대시보드 (KST 시계) | O | O |
| 로그 기록 작성 | O | O |
| 이력 조회 / 기록서 출력 | O | O |
| 감사추적 | O | - |
| 계정 관리 | O | - |
| 시스템 설정 (자동 로그아웃, 패스워드 정책, 장비 관리) | O | - |
| 비밀번호 변경 (본인) | O | O |

---

## 4. 기능 명세

### 4.1 인증 / 자동 로그아웃 (URS 1, 11)

- ID/PW 로그인. 실패 시 `LOGIN_FAIL` 감사 기록 + 오류 메시지
- 로그인 시 **비밀번호 만료 검사**: 마지막 변경일 + 정책의 변경 주기 경과 시 비밀번호 변경 화면으로 강제 이동 (URS 12)
- 자동 로그아웃: 설정된 시간(기본 15분) 무활동 시 `AUTO_LOGOUT` (URS 11)

### 4.2 계정 관리 / 패스워드 정책 (URS 12, 13, 14)

- MANAGER 전용. 신규 계정 생성 시 역할 선택(Manager/Operator)
- **패스워드 정책 설정** (시스템 설정 화면): 최소 길이, 대문자 포함, 숫자 포함, 특수문자 포함, 변경 주기(일)
- 정책은 계정 생성·비밀번호 변경 시점에 **강제 검증**된다 — 미충족 시 저장 차단 + 구체적 사유 표시
- 본인 비밀번호 변경 화면 제공 (모든 역할)

### 4.3 장비 마스터 (URS 2)

- MANAGER가 시스템 설정에서 장비 추가/비활성화
- 로그 작성 시 등록된 장비 선택 **또는 직접 입력** 둘 다 지원 (URS 2)

### 4.4 로그 기록 작성 / 전자서명 (URS 3, 4, 5)

- 입력 필드: 장비(선택 또는 직접입력), 작업 시작 시간, 종료 시간, 사용 목적 — 모두 필수
- 종료 시간은 시작 시간 이후여야 한다 (검증)
- **저장 = 전자서명**: 저장 즉시 서명자(ID, 이름)와 서명 일시(KST)가 기록에 영구 부여 (URS 4)
- **기록 불변성**: 저장된 기록은 수정·삭제 UI가 없으며, 로직 레벨에서도 갱신 함수가 존재하지 않는다 (URS 5)

### 4.5 이력 조회 / 필터 / 출력 (URS 6, 7, 8, 15)

- 필터: 장비별, 날짜 범위, 작성자별 (URS 8)
- 필터된 결과를 **장비사용 기록서**로 출력: `window.print()` → 브라우저에서 PDF 저장 (URS 6)
- 출력물 머리말에 **출력시간 `YYYY-MM-DD HH:MM:SS`** 및 출력자 표시 (URS 7)
- 출력 이벤트는 `LOGBOOK_PRINT` 감사 기록

### 4.6 감사추적 (URS 9)

- MANAGER 전용 화면
- 기록 이벤트: `LOGIN`, `LOGIN_FAIL`, `LOGOUT`, `AUTO_LOGOUT`, `LOG_CREATE`(작성=전자서명), `LOGBOOK_PRINT`, `USER_CREATE`, `PASSWORD_CHANGE`, `POLICY_UPDATE`, `EQUIPMENT_ADD/REMOVE`, `SETTINGS_UPDATE`
- 수정·삭제 불가, 일자/사용자/이벤트 필터, CSV 내보내기

### 4.7 KST 시계 (URS 16)

- 상단바에 실시간 시계 (1초 갱신, `YYYY-MM-DD HH:MM:SS KST`)
- 대시보드에 대형 시계 표시

---

## 5. 데이터 모델 (localStorage 스키마)

키 네임스페이스 prefix: `elb:`

```ts
type Role = "MANAGER" | "OPERATOR";

interface User {
  userId: string; name: string;
  passwordPlain: string;             // 교육용 평문
  role: Role; active: boolean;
  passwordChangedAt: string;         // 정책 주기 검사 기준 [URS 12]
  createdAt: string; createdBy: string;
}

interface LogRecord {                 // [URS 3, 4, 5]
  recordId: string;
  equipment: string;                  // 선택 또는 직접입력 [URS 2]
  startTime: string;                  // datetime-local
  endTime: string;
  purpose: string;
  signedBy: string;                   // 전자서명: 사용자 ID [URS 4]
  signedByName: string;
  signedAt: string;                   // 전자서명: 일시 (KST) [URS 4]
  /* 수정·삭제 불가 — 갱신 API 자체가 없음 [URS 5] */
}

interface AuditEvent {                // [URS 9]
  eventId: string; timestamp: string;
  userId: string; userName: string;
  action: string; target: string; detail?: string;
}

interface Settings {
  autoLogoutMinutes: number;          // [URS 11]
  passwordPolicy: {                   // [URS 12]
    minLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSpecialChar: boolean;
    changeIntervalDays: number;
  };
  equipmentList: string[];            // [URS 2]
  companyName: string;
}
```

**시드 데이터**:

| 구분 | 내용 |
|---|---|
| 계정 | `manager`/`Manager1!` (관리자, MANAGER — URS 14 임시 계정) |
| 장비 | HPLC-001, GC-001, Balance-001, UV-001, pH Meter-001 |
| 패스워드 정책 | 최소 8자, 대문자·숫자·특수문자 필수, 변경 주기 90일 |

---

## 6. 기록 불변성 설계 (URS 5)

전자로그북의 핵심 데이터 완전성 통제. 승인 워크플로우가 없는 대신 **작성 = 서명 = 확정**:

```
[입력 폼] → 저장 버튼 → 전자서명 자동 부여 → localStorage 추가(append-only)
                                                    │
                              수정/삭제 UI 없음 ─────┤
                              갱신 함수 없음 ────────┘  (구조적 불변)
```

- v1과 동일하게 수정·삭제 버튼을 제공하지 않으며, v2에서는 코드 레벨에서도 LogRecord 갱신 함수를 구현하지 않는다 (구조적 불변성)
- 잘못 입력한 경우: 새 기록을 추가하고 사용 목적에 정정 사유를 기재하는 운영 절차(SOP)로 보완 — 교육 토론 주제

---

## 7. 데이터 완전성 (ALCOA+ 매핑)

| 원칙 | 본 시스템 구현 방식 | 관련 URS |
|---|---|---|
| **A**ttributable | 전자서명: 서명자 ID/이름 자동 기록 | 4 |
| **L**egible | 한국어 UI, 인쇄 기록서 양식 | 6 |
| **C**ontemporaneous | 서명 일시 KST 자동 부여, 실시간 시계 | 4, 16 |
| **O**riginal | 기록 수정·삭제 불가 (append-only) | 5 |
| **A**ccurate | 필수값 검증, 시작<종료 시간 검증 | 3 |
| Complete | 모든 필드 필수, 감사추적 전체 기록 | 3, 9 |
| Consistent | 작성=서명=확정 단일 흐름 | 4, 5 |
| Enduring | localStorage 영속 저장 | - |
| Available | 이력 조회·필터·출력, 감사추적 CSV | 6, 8, 9 |

---

## 8. URS ↔ FDS 추적 매트릭스

| URS # | URS 요약 | FDS 절 | 구현 모듈/함수 | 검증 ID |
|:-:|---|---|---|:-:|
| 1 | ID/PW 로그인 | 4.1 | `auth.login()` | VS-01 |
| 2 | 장비 선택 또는 직접입력 | 4.3, 4.4 | 장비 select + 직접입력 토글 | VS-02 |
| 3 | 시작/종료시간, 목적 입력 | 4.4 | `logEntry.save()` | VS-03 |
| 4 | 전자서명 (서명자+일시) | 4.4 | `signedBy/signedAt` 자동 부여 | VS-04 |
| 5 | 기록 수정·삭제 불가 | 4.4, 6 | 갱신 함수 부재 (구조적 불변) | VS-05 |
| 6 | PDF 출력 | 4.5 | `printLogbook()` + window.print | VS-06 |
| 7 | 출력시간 YYYY-MM-DD HH:MM:SS | 4.5 | 출력물 머리말 타임스탬프 | VS-07 |
| 8 | 이력 조회 + 필터링 | 4.5 | 장비/날짜/작성자 필터 | VS-08 |
| 9 | 감사추적 | 4.6 | `audit.append()` | VS-09 |
| 10 | 모든 브라우저 지원 | 2.1 | 표준 HTML5/CSS3/ES2017 | VS-10 |
| 11 | 자동 로그아웃 + 시간 설정 | 4.1 | `idleTimer` | VS-11 |
| 12 | 패스워드 정책 (주기, 복잡성) | 4.2 | `validatePassword()`, 만료 검사 | VS-12 |
| 13 | 계정 생성, 권한 2종 | 3, 4.2 | `userMgmt.create()` | VS-13 |
| 14 | Manager 1개 시드, Operator 생성 | 3.1, 5 | 시드 데이터 + 계정 관리 | VS-14 |
| 15 | Operator 로그 작성 + 출력 | 3.2 | 권한 매트릭스 | VS-15 |
| 16 | KST 현재 시간 표시 | 4.7 | 상단바 + 대시보드 시계 | VS-16 |

---

## 9. 가정 및 트레이드오프

1. **평문 비밀번호** — 교육용. 단, 정책(복잡성·주기)은 실제로 강제하여 Part 11 §11.300 통제를 시연
2. **승인 워크플로우 없음** — 로그북 특성상 작성=확정. 정정은 신규 기록 + SOP로 보완 (토론 주제)
3. **localStorage** — 브라우저별 독립, PC 간 공유 불가 (교육용 한정)
4. **PDF 출력** — 브라우저 인쇄 다이얼로그의 "PDF로 저장" 사용 (별도 라이브러리 없음)

---

## 10. 검증 시나리오 요약

상세 시나리오는 `구현계획서.md` 4절 참조. 각 URS는 VS-01~16과 1:1 매핑된다.

---

**END OF DOCUMENT**
