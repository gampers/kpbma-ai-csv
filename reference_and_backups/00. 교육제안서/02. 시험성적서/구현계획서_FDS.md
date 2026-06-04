# 시험성적서 발행 시스템(COA) 기능설계서(FDS)

## 1. 문서 개요

| 항목 | 내용 |
|---|---|
| 시스템명 | 시험성적서 발행 시스템(COA 발행 시스템) |
| 목적 | 시험 결과 입력, 승인, 성적서 발행 및 감사추적 절차를 CSV 실습용 소프트웨어로 구현 |
| 구현 방식 | 순수 HTML + CSS + JavaScript |
| 저장 방식 | localStorage/sessionStorage |
| 실행 방식 | 브라우저에서 `index.html` 직접 실행 |
| 적용 범위 | CSV 교육 및 실습용 |

본 시스템은 실제 운영용 GMP/Part 11 시스템이 아니라, URS-FDS-구현-검증 흐름을 교육하기 위한 실습 대상 소프트웨어이다.

## 2. 권한 및 기본 계정

| 권한 | 주요 기능 |
|---|---|
| Tester | 시험 결과 입력, 본인이 작성한 미승인 결과 수정, 결과 조회, 승인 완료 COA 출력 |
| Approver | 시험 결과 조회, 결과 승인, COA 출력, 계정 관리, 환경설정, Audit Trail 조회 |

| ID | PW | 권한 | 비고 |
|---|---|---|---|
| tester | tester123! | Tester | 초기 시험자 계정 |
| approver | approver123! | Approver | 초기 승인자 계정 |

## 3. URS 대비 기능 매핑

| URS | 요구사항 | FDS 구현 기능 | 주요 화면 |
|---|---|---|---|
| 1 | 로그인 기능 | ID/PW 인증, 세션 저장, 로그아웃 | 로그인 |
| 2 | 계정 관리 및 권한 부여 | 계정 생성, 권한 선택, 활성/비활성 관리 | 계정 관리 |
| 3 | 시험자 입력 후 승인자 승인 시 출력 | Draft/Approved 상태 관리, 미승인 출력 차단 | 입력, 승인, 출력 |
| 4 | 시험기준 방법 표기 | 시험기준/방법 필수 입력 및 COA 표시 | 입력, 출력 |
| 5 | 시험일자 입력 | 시험일자 필수 입력 및 COA 표시 | 입력, 출력 |
| 6 | 수정 전/후 값 추적 | 수정 사유, 변경 전/후 값, 수정자, 수정일시 기록 | 조회/수정, Audit Trail |
| 7 | 출력자 및 발행일자 표시 | COA 출력 시 출력자, 발행일자 자동 표시 | 출력 |
| 8 | 정밀도 ±1% 표시 | COA에 `정밀도: ±1% 이내` 고정 표시 | 출력 |
| 9 | 결과 입력자 Audit Trail 기록 | 입력자 ID, 이름, 입력일시, 이벤트 기록 | Audit Trail |
| 10 | 작성자 ID/작성일 추적 | 시험 결과마다 작성자 ID, 작성자명, 작성일 저장 | 조회/수정 |
| 11 | 결과값 누락 오류 | 필수값 누락 시 저장 차단 및 오류 메시지 표시 | 입력 |
| 12 | 시험 장비 기록 | 장비명 필수 입력 및 설정 장비 목록 관리 | 입력, 환경설정 |
| 13 | 수정 사유 기록 | 미승인 결과 수정 시 사유 필수 | 조회/수정 |
| 14 | 문서번호 표시 | `COA-YYYYMMDD-###` 규칙으로 자동 부여 | 입력, 출력 |
| 15 | 자동 백업 | 설정된 시간 이후 1일 1회 JSON 백업 파일 생성 | 환경설정 |
| 16 | 승인 후 수정 제한 | Approved 상태 결과 수정 버튼 비활성화 | 조회/수정 |

## 4. 화면 설계

### 4.1 로그인
- 사용자 ID와 비밀번호를 입력한다.
- 로그인 성공 시 대시보드로 이동한다.
- 로그인 성공/실패는 Audit Trail에 기록한다.

### 4.2 대시보드
- 현재 사용자, 권한, 현재 KST 시간, 주요 데이터 건수를 표시한다.
- 권한에 따라 메뉴를 다르게 표시한다.

### 4.3 시험결과 입력
- 시험일자, 품목명, 검체명, 제조번호/Lot No., 시험항목, 시험기준/방법, 장비명, 결과값, 단위를 입력한다.
- 시험일자, 기준/방법, 장비명, 결과값은 필수이다.
- 저장 시 문서번호, 작성자 ID, 작성일시를 자동 부여한다.

### 4.4 시험결과 조회/수정
- 상태, 키워드, 시험일자 범위로 결과를 검색한다.
- Tester는 본인이 작성한 Draft 결과만 수정할 수 있다.
- 수정 시 수정 사유를 반드시 입력한다.
- 수정 전/후 값은 변경 이력과 Audit Trail에 저장한다.

### 4.5 승인
- Approver는 Draft 결과를 확인하고 승인한다.
- 승인 시 승인자 ID, 승인자명, 승인일시를 저장한다.
- 승인 후 결과는 수정할 수 없다.

### 4.6 성적서 출력
- Approved 결과만 COA 미리보기와 출력이 가능하다.
- COA에는 문서번호, 발행일자, 출력자, 시험자, 승인자, 시험일자, 기준/방법, 장비, 결과, 정밀도 문구를 표시한다.
- 출력 이벤트는 Audit Trail에 기록한다.

### 4.7 계정 관리
- Approver는 신규 계정을 생성하고 권한을 부여한다.
- 기존 계정을 활성/비활성 처리할 수 있다.

### 4.8 환경설정
- 문서번호 Prefix, 자동 백업 시간, 장비 목록을 관리한다.
- 수동 백업을 실행할 수 있다.
- 자동 백업 시간 이후 하루 1회 JSON 백업 파일을 생성한다.

### 4.9 Audit Trail
- 로그인, 로그아웃, 입력, 수정, 승인, 출력, 백업, 계정/설정 변경 이벤트를 조회한다.
- 이벤트 일시, 사용자 ID, 사용자명, 이벤트 종류, 상세내용을 표시한다.

## 5. 데이터 구조

### 5.1 accounts

```json
[
  {
    "id": "tester",
    "password": "hash_value",
    "name": "시험자",
    "role": "Tester",
    "active": true,
    "createdAt": "2026-05-04T09:00:00.000Z",
    "createdBy": "system"
  }
]
```

### 5.2 testResults

```json
[
  {
    "id": "res_xxxxx",
    "documentNo": "COA-20260504-001",
    "status": "Draft",
    "testDate": "2026-05-04",
    "productName": "제품명",
    "sampleName": "검체명",
    "lotNo": "LOT-001",
    "testItem": "함량",
    "specificationMethod": "자사 시험방법 SOP-QC-001",
    "equipment": "HPLC-001",
    "resultValue": "99.8",
    "unit": "%",
    "precisionText": "±1% 이내",
    "createdBy": "tester",
    "createdByName": "시험자",
    "createdAt": "2026-05-04T09:00:00.000Z",
    "approvedBy": null,
    "approvedByName": null,
    "approvedAt": null,
    "issuedBy": null,
    "issuedByName": null,
    "issuedAt": null
  }
]
```

### 5.3 changeHistory

```json
[
  {
    "id": "chg_xxxxx",
    "resultId": "res_xxxxx",
    "documentNo": "COA-20260504-001",
    "reason": "오타 수정",
    "beforeValues": { "resultValue": "99.7" },
    "afterValues": { "resultValue": "99.8" },
    "modifiedBy": "tester",
    "modifiedByName": "시험자",
    "modifiedAt": "2026-05-04T10:00:00.000Z"
  }
]
```

### 5.4 auditTrail

```json
[
  {
    "id": "aud_xxxxx",
    "eventType": "RESULT_CREATE",
    "userId": "tester",
    "userName": "시험자",
    "timestamp": "2026-05-04T09:00:00.000Z",
    "detail": "시험결과 입력: COA-20260504-001",
    "targetId": "res_xxxxx"
  }
]
```

### 5.5 systemSettings

```json
{
  "documentPrefix": "COA",
  "backupTime": "18:00",
  "lastBackupDate": null,
  "autoBackupEnabled": true,
  "equipmentList": ["HPLC-001", "GC-001", "Balance-001", "UV-001"]
}
```

## 6. 검증 시나리오

| 번호 | 검증 항목 | 기대 결과 |
|---|---|---|
| TC-01 | 정상 로그인 | 대시보드 이동 및 LOGIN Audit 기록 |
| TC-02 | 잘못된 비밀번호 | 로그인 차단 및 LOGIN_FAIL Audit 기록 |
| TC-03 | Tester 결과 입력 | Draft 결과 생성, 작성자/작성일 기록 |
| TC-04 | 필수 결과값 누락 | 저장 차단 및 오류 메시지 표시 |
| TC-05 | Draft 결과 수정 | 수정 사유 필수, 전/후 값 기록 |
| TC-06 | Approver 승인 | 상태 Approved 변경, 승인자/승인일 기록 |
| TC-07 | 승인 후 수정 시도 | 수정 버튼 비활성화 또는 수정 차단 |
| TC-08 | 미승인 COA 출력 | 출력 대상 목록에 표시되지 않음 |
| TC-09 | 승인 COA 출력 | 문서번호, 발행일자, 출력자, 정밀도 문구 표시 |
| TC-10 | 자동/수동 백업 | JSON 파일 생성 및 BACKUP Audit 기록 |

## 7. 제약사항

- 데이터는 브라우저별 localStorage에 저장되므로 PC/브라우저 간 공유되지 않는다.
- 실습용 간단 해시를 사용하며 실제 운영 보안 수준이 아니다.
- 자동 백업은 브라우저가 열려 있는 상태에서만 동작한다.
- PDF 전용 라이브러리 없이 브라우저 인쇄 기능을 사용한다.
