/**
 * Google Apps Script
 * GMP Computerized System Integrated Portal
 *
 * 지원 액션
 * - SYNC_ALL
 * - SYNC_SYSTEM
 * - WRITE_USER
 * - WRITE_RECORD
 * - WRITE_AUDIT
 * - WRITE_MASTER
 * - COMMIT_RECORD
 * - RESET_DEMO
 */

// ─────────────────────────────────────────────
// 스키마 정의
// ─────────────────────────────────────────────

var SHEET_HEADERS = {
  users: [
    "userId",
    "password",
    "name",
    "role_coa",
    "role_lm",
    "role_elb",
    "role_rim",
    "role_sem",
    "role_cvm",
    "status",
    "updatedAt"
  ],

  settings: [
    "key",
    "value",
    "system"
  ],

  records: [
    "id",
    "system",
    "docNumber",
    "status",
    "dataJson",
    "isDeleted",
    "createdUser",
    "createdAt",
    "updatedUser",
    "updatedAt"
  ],

  audit_logs: [
    "logId",
    "system",
    "category",
    "userId",
    "action",
    "targetId",
    "beforeValue",
    "afterValue",
    "reason",
    "timestamp"
  ],

  master_data: [
    "id",
    "category",
    "code",
    "name",
    "isDeleted"
  ]
};

var ALLOWED_SYSTEMS = [
  "COA",
  "LM",
  "ELB",
  "RIM",
  "SEM",
  "CVM"
];

// 감사추적은 업무 시스템 외에 포털 수준(로그인/로그아웃, 계정/기준정보/설정 관리)
// 보안 이벤트도 기록하므로 "SYSTEM"을 추가로 허용한다.
var AUDIT_ALLOWED_SYSTEMS = ALLOWED_SYSTEMS.concat(["SYSTEM"]);

var WRITE_ACTIONS = [
  "WRITE_USER",
  "WRITE_RECORD",
  "WRITE_AUDIT",
  "WRITE_MASTER",
  "COMMIT_RECORD",
  "RESET_DEMO"
];

// ─────────────────────────────────────────────
// Web App 진입점
// ─────────────────────────────────────────────

function doPost(e) {
  var lock = null;

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Request body is missing.");
    }

    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    var payload = request.payload || {};
    var responseData;

    if (!action) {
      throw new Error("Action is required.");
    }

    // 읽기 요청에는 전역 잠금을 적용하지 않는다.
    if (action === "SYNC_ALL") {
      responseData = syncAll();

    } else if (action === "SYNC_SYSTEM") {
      responseData = syncSystem(payload.system);

    } else {
      if (WRITE_ACTIONS.indexOf(action) === -1) {
        throw new Error("Unknown action: " + action);
      }

      // 쓰기 요청만 직렬 처리한다.
      lock = LockService.getScriptLock();

      // 프론트엔드 재시도 기능이 추가되기 전까지
      // 최대 10초 동안 쓰기 잠금을 기다린다.
      lock.waitLock(10000);

      responseData = dispatchWriteAction(action, payload);
    }

    return createJsonResponse({
      success: true,
      data: responseData
    });

  } catch (err) {
    console.error(err);

    return createJsonResponse({
      success: false,
      error: err.toString()
    });

  } finally {
    if (lock && lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

// GET 요청 확인용
function doGet() {
  return createJsonResponse({
    success: true,
    service: "GMP Computerized System Integrated Portal API",
    version: "3.0.1",
    serverTime: new Date().toISOString()
  });
}

function dispatchWriteAction(action, payload) {
  if (action === "WRITE_USER") {
    return writeUser(payload);
  }

  if (action === "WRITE_RECORD") {
    return writeRecord(payload);
  }

  if (action === "WRITE_AUDIT") {
    return writeAudit(payload);
  }

  if (action === "WRITE_MASTER") {
    return writeMaster(payload);
  }

  if (action === "COMMIT_RECORD") {
    return commitRecord(payload);
  }

  if (action === "RESET_DEMO") {
    return resetDemo();
  }

  throw new Error("Unsupported write action: " + action);
}

function createJsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
// 조회 API
// ─────────────────────────────────────────────

/**
 * 전체 데이터 동기화
 *
 * 기존 프론트엔드와의 호환을 위해 유지한다.
 * 로그인 초기화 이외에는 SYNC_SYSTEM 사용을 권장한다.
 */
function syncAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  return {
    users: getSheetDataAsJson("users", ss),
    settings: getSheetDataAsJson("settings", ss),
    records: getSheetDataAsJson("records", ss),
    audit_logs: getSheetDataAsJson("audit_logs", ss),
    master_data: getSheetDataAsJson("master_data", ss),
    serverTime: new Date().toISOString()
  };
}

/**
 * 선택한 시스템의 레코드와 감사추적만 조회한다.
 *
 * 예:
 * {
 *   "action": "SYNC_SYSTEM",
 *   "payload": {
 *     "system": "CVM"
 *   }
 * }
 */
function syncSystem(system) {
  validateSystem(system);

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var records = getSheetDataAsJson("records", ss).filter(function(record) {
    return String(record.system) === String(system);
  });

  var auditLogs = getSheetDataAsJson("audit_logs", ss).filter(function(log) {
    return String(log.system) === String(system);
  });

  return {
    system: system,
    records: records,
    audit_logs: auditLogs,
    serverTime: new Date().toISOString()
  };
}

// ─────────────────────────────────────────────
// 사용자 저장
// ─────────────────────────────────────────────

function writeUser(user) {
  if (!user || !user.userId) {
    throw new Error("userId is required.");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(
    ss,
    "users",
    SHEET_HEADERS.users
  );

  var normalizedUser = copyObject(user);
  normalizedUser.updatedAt =
    normalizedUser.updatedAt || new Date().toISOString();

  var result = upsertRow(
    sheet,
    SHEET_HEADERS.users,
    1,
    normalizedUser.userId,
    normalizedUser
  );

  return {
    userId: normalizedUser.userId,
    row: result.row,
    created: result.created
  };
}

// ─────────────────────────────────────────────
// 업무 레코드 저장
// ─────────────────────────────────────────────

function writeRecord(record) {
  if (!record || !record.id) {
    throw new Error("Record id is required.");
  }

  if (!record.system) {
    throw new Error("Record system is required.");
  }

  validateSystem(record.system);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(
    ss,
    "records",
    SHEET_HEADERS.records
  );

  var now = new Date().toISOString();
  var normalizedRecord = copyObject(record);

  normalizedRecord.createdAt =
    normalizedRecord.createdAt || now;

  normalizedRecord.updatedAt =
    normalizedRecord.updatedAt || now;

  normalizedRecord.isDeleted =
    normalizeBoolean(normalizedRecord.isDeleted);

  if (
    normalizedRecord.dataJson !== undefined &&
    typeof normalizedRecord.dataJson !== "string"
  ) {
    normalizedRecord.dataJson =
      JSON.stringify(normalizedRecord.dataJson);
  }

  var result = upsertRow(
    sheet,
    SHEET_HEADERS.records,
    1,
    normalizedRecord.id,
    normalizedRecord
  );

  return {
    id: normalizedRecord.id,
    system: normalizedRecord.system,
    row: result.row,
    created: result.created
  };
}

// ─────────────────────────────────────────────
// 감사추적 저장
// ─────────────────────────────────────────────

/**
 * 감사추적은 수정하지 않고 Append만 수행한다.
 *
 * 동일한 logId가 이미 존재하면 중복 추가하지 않는다.
 */
function writeAudit(log) {
  if (!log) {
    throw new Error("Audit payload is required.");
  }

  if (!log.system) {
    throw new Error("Audit system is required.");
  }

  validateAuditSystem(log.system);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(
    ss,
    "audit_logs",
    SHEET_HEADERS.audit_logs
  );

  var normalizedLog = copyObject(log);

  normalizedLog.logId =
    normalizedLog.logId || "log-" + Utilities.getUuid();

  normalizedLog.timestamp =
    normalizedLog.timestamp || new Date().toISOString();

  normalizedLog.category =
    normalizedLog.category || "DATA";

  normalizedLog.userId =
    normalizedLog.userId || "anonymous";

  // 네트워크 재시도에 따른 감사추적 중복 방지
  var existingRow = findRowByValue(
    sheet,
    1,
    normalizedLog.logId
  );

  if (existingRow > 0) {
    return {
      logId: normalizedLog.logId,
      row: existingRow,
      created: false,
      duplicate: true
    };
  }

  var rowValues = objectToRow(
    SHEET_HEADERS.audit_logs,
    normalizedLog
  );

  var nextRow = Math.max(sheet.getLastRow() + 1, 2);

  sheet
    .getRange(nextRow, 1, 1, rowValues.length)
    .setValues([rowValues]);

  return {
    logId: normalizedLog.logId,
    row: nextRow,
    created: true,
    duplicate: false
  };
}

// ─────────────────────────────────────────────
// 레코드 + 감사추적 통합 저장
// ─────────────────────────────────────────────

/**
 * 향후 프론트엔드에서 사용할 통합 저장 API
 *
 * 요청 예:
 * {
 *   "action": "COMMIT_RECORD",
 *   "payload": {
 *     "record": { ... },
 *     "audit": { ... }
 *   }
 * }
 *
 * 현재 WRITE_RECORD와 WRITE_AUDIT도 계속 지원한다.
 */
function commitRecord(payload) {
  if (!payload || !payload.record || !payload.audit) {
    throw new Error(
      "COMMIT_RECORD requires record and audit payloads."
    );
  }

  var record = copyObject(payload.record);
  var audit = copyObject(payload.audit);

  if (!audit.system) {
    audit.system = record.system;
  }

  if (!audit.targetId) {
    audit.targetId = record.id;
  }

  var recordResult = writeRecord(record);
  var auditResult = writeAudit(audit);

  return {
    record: recordResult,
    audit: auditResult
  };
}

// ─────────────────────────────────────────────
// 기준정보 저장
// ─────────────────────────────────────────────

function writeMaster(item) {
  if (!item) {
    throw new Error("Master data payload is required.");
  }

  if (!item.category || !item.code) {
    throw new Error("Master category and code are required.");
  }

  var normalizedItem = copyObject(item);

  normalizedItem.id =
    normalizedItem.id ||
    normalizedItem.category + ":" + normalizedItem.code;

  normalizedItem.isDeleted =
    normalizeBoolean(normalizedItem.isDeleted);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(
    ss,
    "master_data",
    SHEET_HEADERS.master_data
  );

  var result = upsertRow(
    sheet,
    SHEET_HEADERS.master_data,
    1,
    normalizedItem.id,
    normalizedItem
  );

  return {
    id: normalizedItem.id,
    row: result.row,
    created: result.created
  };
}

// ─────────────────────────────────────────────
// 데모 데이터 초기화
// ─────────────────────────────────────────────

/**
 * 시트를 삭제하지 않고 내용을 일괄 교체한다.
 *
 * 동시 사용 중에는 실행하지 않는다.
 */
function resetDemo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date().toISOString();

  var seedUsers = [
    [
      "admin",
      "admin",
      "통합관리자",
      "ADMIN",
      "ADMIN",
      "ADMIN",
      "ADMIN",
      "ADMIN",
      "ADMIN",
      "ACTIVE",
      now
    ],
    [
      "tester",
      "tester",
      "시험자",
      "TESTER",
      "TRAINER",
      "OPERATOR",
      "QC",
      "QA",
      "VAL",
      "ACTIVE",
      now
    ],
    [
      "approver",
      "approver",
      "승인권자",
      "APPROVER",
      "QA",
      "MANAGER",
      "MANAGER",
      "MANAGER",
      "QA",
      "ACTIVE",
      now
    ]
  ];

  var seedSettings = [
    [
      "common:companyName",
      "㈜갬프연구소",
      "COMMON"
    ],
    [
      "common:sessionTimeout",
      "10",
      "COMMON"
    ]
  ];

  var seedMaster = [
    [
      "PRODUCT:PROD-01",
      "PRODUCT",
      "PROD-01",
      "아세트아미노펜 정 325mg",
      false
    ],
    [
      "PRODUCT:PROD-02",
      "PRODUCT",
      "PROD-02",
      "아스피린 정 100mg",
      false
    ],
    [
      "EQUIPMENT:EQ-01",
      "EQUIPMENT",
      "EQ-01",
      "HPLC (Shimadzu-04)",
      false
    ],
    [
      "EQUIPMENT:EQ-02",
      "EQUIPMENT",
      "EQ-02",
      "리본 믹서 혼합기 (BLN-04-A)",
      false
    ],
    [
      "EQUIPMENT:EQ-03",
      "EQUIPMENT",
      "EQ-03",
      "고속액체크로마토그래피 2호기 (EQP-HPLC-02)",
      false
    ],
    [
      "EQUIPMENT:EQ-04",
      "EQUIPMENT",
      "EQ-04",
      "분석저울 (BAL-OHAUS-01)",
      false
    ],
    [
      "COURSE:CRSE-01",
      "COURSE",
      "CRSE-01",
      "TRN-GMP-001 (GMP 기본 및 위생 교육)",
      false
    ],
    [
      "COURSE:CRSE-02",
      "COURSE",
      "CRSE-02",
      "TRN-CSV-002 (컴퓨터화 시스템 밸리데이션 실무)",
      false
    ],
    [
      "REAGENT:RGT-01",
      "REAGENT",
      "RGT-01",
      "REA-ETH-100 (Ethanol 99.9%)",
      false
    ],
    [
      "REAGENT:RGT-02",
      "REAGENT",
      "RGT-02",
      "REA-MET-200 (Methanol GR Grade)",
      false
    ]
  ];

  replaceSheetData(
    ss,
    "users",
    SHEET_HEADERS.users,
    seedUsers
  );

  replaceSheetData(
    ss,
    "settings",
    SHEET_HEADERS.settings,
    seedSettings
  );

  replaceSheetData(
    ss,
    "records",
    SHEET_HEADERS.records,
    []
  );

  replaceSheetData(
    ss,
    "audit_logs",
    SHEET_HEADERS.audit_logs,
    []
  );

  replaceSheetData(
    ss,
    "master_data",
    SHEET_HEADERS.master_data,
    seedMaster
  );

  SpreadsheetApp.flush();

  return {
    status: "RESET_SUCCESS",
    resetAt: now
  };
}

// ─────────────────────────────────────────────
// 공통 시트 조회
// ─────────────────────────────────────────────

function getSheetDataAsJson(sheetName, spreadsheet) {
  var ss =
    spreadsheet || SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn === 0) {
    return [];
  }

  var data = sheet
    .getRange(1, 1, lastRow, lastColumn)
    .getValues();

  var headers = data[0];
  var jsonArray = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    if (isEmptyRow(row)) {
      continue;
    }

    var obj = {};

    for (var j = 0; j < headers.length; j++) {
      if (headers[j] !== "") {
        obj[String(headers[j])] = row[j];
      }
    }

    jsonArray.push(obj);
  }

  return jsonArray;
}

// ─────────────────────────────────────────────
// 공통 Upsert
// ─────────────────────────────────────────────

function upsertRow(
  sheet,
  headers,
  idColumn,
  idValue,
  objectValue
) {
  var foundRow = findRowByValue(
    sheet,
    idColumn,
    idValue
  );

  var rowValues = objectToRow(
    headers,
    objectValue
  );

  if (foundRow > 0) {
    sheet
      .getRange(foundRow, 1, 1, headers.length)
      .setValues([rowValues]);

    return {
      row: foundRow,
      created: false
    };
  }

  var nextRow = Math.max(sheet.getLastRow() + 1, 2);

  sheet
    .getRange(nextRow, 1, 1, headers.length)
    .setValues([rowValues]);

  return {
    row: nextRow,
    created: true
  };
}

/**
 * 전체 시트를 읽지 않고 식별자 열만 조회한다.
 */
function findRowByValue(sheet, columnIndex, targetValue) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return -1;
  }

  var values = sheet
    .getRange(2, columnIndex, lastRow - 1, 1)
    .getValues();

  var target = String(targetValue);

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === target) {
      return i + 2;
    }
  }

  return -1;
}

// ─────────────────────────────────────────────
// 시트 생성 및 초기화
// ─────────────────────────────────────────────

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}

function createSheetWithHeaders(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  return getOrCreateSheet(
    ss,
    name,
    headers
  );
}

function replaceSheetData(
  ss,
  sheetName,
  headers,
  rows
) {
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.clearContents();

  var values = [headers].concat(rows || []);

  sheet
    .getRange(
      1,
      1,
      values.length,
      headers.length
    )
    .setValues(values);

  sheet.setFrozenRows(1);

  return sheet;
}

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────

function validateSystem(system) {
  if (!system || ALLOWED_SYSTEMS.indexOf(system) === -1) {
    throw new Error("Invalid system: " + system);
  }
}

function validateAuditSystem(system) {
  if (!system || AUDIT_ALLOWED_SYSTEMS.indexOf(system) === -1) {
    throw new Error("Invalid audit system: " + system);
  }
}

function objectToRow(headers, objectValue) {
  return headers.map(function(header) {
    var value = objectValue[header];

    if (value === undefined || value === null) {
      return "";
    }

    if (
      typeof value === "object" &&
      !(value instanceof Date)
    ) {
      return JSON.stringify(value);
    }

    return value;
  });
}

function normalizeBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  return String(value).toUpperCase() === "TRUE";
}

function copyObject(source) {
  var target = {};

  Object.keys(source || {}).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
}

function isEmptyRow(row) {
  for (var i = 0; i < row.length; i++) {
    if (
      row[i] !== "" &&
      row[i] !== null &&
      row[i] !== undefined
    ) {
      return false;
    }
  }

  return true;
}
