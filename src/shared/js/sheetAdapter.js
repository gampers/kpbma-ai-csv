// Google Sheets DB Sync Adapter (Local-first & Background Sync)

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyspIGIBNc-erhvFKSgfRcjFduPT576G2SqR8T-jWYCjdPMfnI0Je00Ax53UOOb5h3Mog/exec";

// LocalStorage Namespaces
const STORAGE_KEYS = {
  USERS: "gxp_suite:users",
  SETTINGS: "gxp_suite:settings",
  RECORDS: "gxp_suite:records",
  AUDIT_LOGS: "gxp_suite:audit_logs",
  MASTER_DATA: "gxp_suite:master_data",
  PENDING_SYNC: "gxp_suite:pending_sync"
};

// Seed fallback data for offline initialization
const SEED_DATA = {
  users: [
    { userId: "admin", password: "admin", name: "통합관리자", role_coa: "ADMIN", role_lm: "ADMIN", role_elb: "ADMIN", role_rim: "ADMIN", role_sem: "ADMIN", role_cvm: "ADMIN", status: "ACTIVE" },
    { userId: "tester", password: "tester", name: "시험자", role_coa: "TESTER", role_lm: "TRAINER", role_elb: "OPERATOR", role_rim: "QC", role_sem: "QA", role_cvm: "VAL", status: "ACTIVE" },
    { userId: "approver", password: "approver", name: "승인권자", role_coa: "APPROVER", role_lm: "QA", role_elb: "MANAGER", role_rim: "MANAGER", role_sem: "MANAGER", role_cvm: "QA", status: "ACTIVE" }
  ],
  settings: [
    { key: "common:companyName", value: "㈜갬프연구소", system: "COMMON" },
    { key: "common:sessionTimeout", value: "10", system: "COMMON" }
  ],
  records: [],
  audit_logs: [],
  master_data: [
    { id: "PRODUCT:PROD-01", category: "PRODUCT", code: "PROD-01", name: "아세트아미노펜 정 325mg", isDeleted: false },
    { id: "PRODUCT:PROD-02", category: "PRODUCT", code: "PROD-02", name: "아스피린 정 100mg", isDeleted: false },
    { id: "EQUIPMENT:EQ-01", category: "EQUIPMENT", code: "EQ-01", name: "HPLC (Shimadzu-04)", isDeleted: false },
    { id: "EQUIPMENT:EQ-02", category: "EQUIPMENT", code: "EQ-02", name: "리본 믹서 혼합기 (BLN-04-A)", isDeleted: false },
    { id: "EQUIPMENT:EQ-03", category: "EQUIPMENT", code: "EQ-03", name: "고속액체크로마토그래피 2호기 (EQP-HPLC-02)", isDeleted: false },
    { id: "EQUIPMENT:EQ-04", category: "EQUIPMENT", code: "EQ-04", name: "분석저울 (BAL-OHAUS-01)", isDeleted: false },
    { id: "COURSE:CRSE-01", category: "COURSE", code: "CRSE-01", name: "TRN-GMP-001 (GMP 기본 및 위생 교육)", isDeleted: false },
    { id: "COURSE:CRSE-02", category: "COURSE", code: "CRSE-02", name: "TRN-CSV-002 (컴퓨터화 시스템 밸리데이션 실무)", isDeleted: false },
    { id: "REAGENT:RGT-01", category: "REAGENT", code: "RGT-01", name: "REA-ETH-100 (Ethanol 99.9%)", isDeleted: false },
    { id: "REAGENT:RGT-02", category: "REAGENT", code: "RGT-02", name: "REA-MET-200 (Methanol GR Grade)", isDeleted: false }
  ]
};

// Internal API client
async function callApi(action, payload = {}) {
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8" // Redirect/CORS issues with JSON on GAS
      },
      body: JSON.stringify({ action, payload })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  } catch (err) {
    console.warn(`[API Error in ${action}]: `, err);
    throw err;
  }
}

// Background sync queue helper
function enqueueSync(action, payload) {
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || "[]");
  queue.push({ action, payload, id: Date.now() + Math.random().toString(36).substr(2, 5) });
  localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(queue));
  processSyncQueue();
}

async function processSyncQueue() {
  if (processSyncQueue.running) return;
  processSyncQueue.running = true;
  
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || "[]");
  if (queue.length === 0) {
    processSyncQueue.running = false;
    return;
  }
  
  const item = queue[0];
  try {
    await callApi(item.action, item.payload);
    // Success, remove from queue
    const currentQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || "[]");
    const updatedQueue = currentQueue.filter(q => q.id !== item.id);
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(updatedQueue));
    processSyncQueue.running = false;
    
    // Process next item
    setTimeout(processSyncQueue, 100);
  } catch (err) {
    console.warn("Retrying sync queue later...");
    processSyncQueue.running = false;
  }
}

export const sheetAdapter = {
  // Pull latest DB state into local storage on init
  async init() {
    try {
      // First, ensure localStorage has at least seed fallback
      if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_DATA.users));
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_DATA.settings));
        localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(SEED_DATA.records));
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(SEED_DATA.audit_logs));
        localStorage.setItem(STORAGE_KEYS.MASTER_DATA, JSON.stringify(SEED_DATA.master_data));
      }
      
      // Pull fresh data from Google Sheet
      const remoteData = await callApi("SYNC_ALL");
      if (remoteData) {
        if (remoteData.users && remoteData.users.length > 0) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remoteData.users));
        }
        if (remoteData.settings && remoteData.settings.length > 0) {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(remoteData.settings));
        }
        if (remoteData.master_data && remoteData.master_data.length > 0) {
          const normalizedMaster = remoteData.master_data.map(m => ({
            ...m,
            isDeleted: String(m.isDeleted).toUpperCase() === "TRUE"
          }));
          localStorage.setItem(STORAGE_KEYS.MASTER_DATA, JSON.stringify(normalizedMaster));
        }
        // Normalize strings from GAS spreadsheets
        const normalizedRecords = (remoteData.records || []).map(r => ({
          ...r,
          isDeleted: String(r.isDeleted).toUpperCase() === "TRUE"
        }));
        localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(normalizedRecords));
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(remoteData.audit_logs || []));
      }
      
      // Try to flush any offline queue
      processSyncQueue();
    } catch (err) {
      console.warn("Database sync failed, operating in offline cache mode.", err);
    }
  },

  // 1. Users DB Access
  getUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
  },
  
  saveUser(user) {
    const users = this.getUsers();
    const existingIdx = users.findIndex(u => u.userId === user.userId);
    user.updatedAt = new Date().toISOString();
    
    if (existingIdx > -1) {
      users[existingIdx] = { ...users[existingIdx], ...user };
    } else {
      users.push(user);
    }
    
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    
    // Background sync to GAS - WRITE_USER directly on users sheet
    enqueueSync("WRITE_USER", user);
  },

  // 2. Records DB Access
  getRecords(system) {
    const allRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS) || "[]");
    return allRecords.filter(r => r.system === system && !r.isDeleted);
  },
  
  saveRecord(system, payload) {
    const allRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS) || "[]");
    const existingIdx = allRecords.findIndex(r => r.id === payload.id);
    const now = new Date().toISOString();
    
    const record = {
      id: payload.id,
      system: system,
      docNumber: payload.docNumber || "",
      status: payload.status || "DRAFT",
      dataJson: typeof payload.dataJson === "string" ? payload.dataJson : JSON.stringify(payload.dataJson),
      isDeleted: !!payload.isDeleted,
      createdUser: payload.createdUser || "tester",
      createdAt: payload.createdAt || now,
      updatedUser: payload.updatedUser || payload.createdUser || "tester",
      updatedAt: now
    };
    
    if (existingIdx > -1) {
      allRecords[existingIdx] = record;
    } else {
      allRecords.push(record);
    }
    
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(allRecords));
    
    // Background sync
    enqueueSync("WRITE_RECORD", record);
  },

  // 3. Audit Logs DB Access
  getAuditLogs(system) {
    const allLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || "[]");
    return allLogs.filter(l => l.system === system);
  },
  
  saveAuditLog(system, logPayload) {
    const allLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || "[]");
    const now = new Date().toISOString();
    
    const log = {
      logId: logPayload.logId || `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      system: system,
      category: logPayload.category || "DATA", // "SECURITY" or "DATA"
      userId: logPayload.userId || "anonymous",
      action: logPayload.action || "",
      targetId: logPayload.targetId || "",
      beforeValue: typeof logPayload.beforeValue === "object" ? JSON.stringify(logPayload.beforeValue) : logPayload.beforeValue || "",
      afterValue: typeof logPayload.afterValue === "object" ? JSON.stringify(logPayload.afterValue) : logPayload.afterValue || "",
      reason: logPayload.reason || "",
      timestamp: now
    };
    
    allLogs.push(log);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(allLogs));
    
    // Background sync
    enqueueSync("WRITE_AUDIT", log);
  },

  // 4. Master Data DB Access
  getMasterData(category) {
    const allMaster = JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTER_DATA) || "[]");
    return allMaster.filter(m => m.category === category && !m.isDeleted);
  },

  saveMasterDataItem(item) {
    const allMaster = JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTER_DATA) || "[]");
    const id = `${item.category}:${item.code}`;
    const payload = {
      id,
      category: item.category,
      code: item.code,
      name: item.name,
      isDeleted: !!item.isDeleted
    };
    const existingIdx = allMaster.findIndex(m => m.id === id);

    if (existingIdx > -1) {
      allMaster[existingIdx] = payload;
    } else {
      allMaster.push(payload);
    }

    localStorage.setItem(STORAGE_KEYS.MASTER_DATA, JSON.stringify(allMaster));

    // Background sync
    enqueueSync("WRITE_MASTER", payload);
  },

  deleteMasterDataItem(category, code) {
    const allMaster = JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTER_DATA) || "[]");
    const id = `${category}:${code}`;
    const existingIdx = allMaster.findIndex(m => m.id === id);

    if (existingIdx > -1) {
      allMaster[existingIdx].isDeleted = true;
      localStorage.setItem(STORAGE_KEYS.MASTER_DATA, JSON.stringify(allMaster));
      // Background sync
      enqueueSync("WRITE_MASTER", allMaster[existingIdx]);
    }
  },

  // 5. DB Reset
  async resetDatabase() {
    try {
      // Direct call since reset should block UI to restore state
      await callApi("RESET_DEMO");
      
      // Clear cache
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.RECORDS);
      localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
      localStorage.removeItem(STORAGE_KEYS.MASTER_DATA);
      localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
      
      // Reload page to re-initialize
      window.location.reload();
    } catch (err) {
      alert("데이터베이스 초기화에 실패했습니다. 네트워크 연결 상태를 확인해 주세요.");
    }
  }
};
export default sheetAdapter;
