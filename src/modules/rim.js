import { sheetAdapter } from "../shared/js/sheetAdapter.js";
import { authHelper } from "../shared/js/authHelper.js";

const SYSTEM_KEY = "RIM";
const STATUS = { SUBMITTED: "SUBMITTED" };

// Helper: Calculate current balance of a specific Lot
function getLotBalance(materialCode, lotNo) {
  const records = sheetAdapter.getRecords(SYSTEM_KEY);
  let balance = 0;
  records.forEach(r => {
    try {
      const data = JSON.parse(r.dataJson);
      if (data.materialCode === materialCode && data.lotNo === lotNo) {
        if (data.type === "RECEIVE") {
          balance += data.quantity;
        } else if (data.type === "USE") {
          balance -= data.quantity;
        }
      }
    } catch(e){}
  });
  return balance;
}

// Helper: Find expiry date of a specific Lot from RECEIVE record
function getLotExpiry(materialCode, lotNo) {
  const records = sheetAdapter.getRecords(SYSTEM_KEY);
  for (const r of records) {
    try {
      const data = JSON.parse(r.dataJson);
      if (data.materialCode === materialCode && data.lotNo === lotNo && data.type === "RECEIVE") {
        return data.expiryDate;
      }
    } catch(e){}
  }
  return null;
}

export const rimModule = {
  systemKey: SYSTEM_KEY,
  systemName: "[RIM] 시약/표준품 관리",
  
  getSidebarMenus(role) {
    const menus = [
      { href: "#/rim/dashboard", label: "대시보드" }
    ];
    if (role === "QC" || role === "ADMIN") {
      menus.push({ href: "#/rim/receive", label: "시약 입고 등록" });
      menus.push({ href: "#/rim/use", label: "시약 사용 기록" });
    }
    menus.push({ href: "#/rim/records", label: "재고 수불 대장" });
    menus.push({ href: "#/rim/audit", label: "감사추적" });
    return menus;
  },

  handleRoute(subRoute, container) {
    if (subRoute === "dashboard" || subRoute === "") {
      this.renderDashboard(container);
    } else if (subRoute === "receive") {
      this.renderReceive(container);
    } else if (subRoute === "use") {
      this.renderUse(container);
    } else if (subRoute === "records") {
      this.renderRecordsList(container);
    } else if (subRoute === "audit") {
      this.renderAudit(container);
    } else {
      container.innerHTML = `<h3>알 수 없는 경로입니다.</h3>`;
    }
  },

  renderDashboard(container) {
    const role = authHelper.getUserRole(SYSTEM_KEY);
    const records = sheetAdapter.getRecords(SYSTEM_KEY);
    
    // Group by material & lot to find unique stocks
    const lotsMap = {};
    records.forEach(r => {
      try {
        const d = JSON.parse(r.dataJson);
        const key = `${d.materialCode}:${d.lotNo}`;
        if (!lotsMap[key]) {
          lotsMap[key] = {
            materialCode: d.materialCode,
            materialName: d.materialName,
            lotNo: d.lotNo,
            unit: d.unit,
            expiryDate: getLotExpiry(d.materialCode, d.lotNo)
          };
        }
      } catch(e){}
    });
    
    let totalLotsCount = 0;
    let expiredLotsCount = 0;
    let activeLotsCount = 0;
    const today = new Date().toISOString().split("T")[0];
    
    Object.keys(lotsMap).forEach(k => {
      const lot = lotsMap[k];
      const bal = getLotBalance(lot.materialCode, lot.lotNo);
      if (bal > 0) {
        totalLotsCount++;
        if (lot.expiryDate && lot.expiryDate < today) {
          expiredLotsCount++;
        } else {
          activeLotsCount++;
        }
      }
    });
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">${this.systemName} 대시보드</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">실험용 시약 및 표준물질의 입출고 이력, 재고 상태 및 유효기간을 관리합니다.</p>
      </div>
      
      <div class="grid cols-3">
        <div class="kpi">
          <div class="label">보유 중인 시약 품목 (Lot 수)</div>
          <div class="value">${totalLotsCount} 개</div>
        </div>
        <div class="kpi">
          <div class="label">유효기간 만료 (폐기 대상)</div>
          <div class="value" style="color:var(--color-danger);">${expiredLotsCount} 개</div>
        </div>
        <div class="kpi">
          <div class="label">사용 가능 재고</div>
          <div class="value" style="color:var(--color-success);">${activeLotsCount} 개</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:24px;">
        <h2>시약 재고관리 수행</h2>
        <div style="display:flex; gap:12px; margin-top:12px;">
          ${role === "QC" || role === "ADMIN" ? `
            <a href="#/rim/receive" class="btn btn-primary">시약 신규 입고 등록</a>
            <a href="#/rim/use" class="btn btn-secondary">시약 사용 기록 등록</a>
          ` : ""}
          <a href="#/rim/records" class="btn btn-secondary">재고 수불부 조회</a>
        </div>
      </div>
    `;
  },

  renderReceive(container) {
    const reagents = sheetAdapter.getMasterData("REAGENT");

    container.innerHTML = `
      <h2 style="margin-bottom:24px; color:var(--color-primary-dark);">시약 신규 입고 등록</h2>
      <div class="card">
        <h2>시약/표준품 입고 (RECEIVE)</h2>
        <form id="rim-recv-form">
          <div class="form-row">
            <label class="req">대상 시약 선택</label>
            <select id="rim-reagent-select" required>
              <option value="">-- 시약 선택 --</option>
              ${reagents.map(m => `<option value="${window.esc(m.code)}" data-name="${window.esc(m.name)}">${window.esc(m.name)} (${window.esc(m.code)})</option>`).join("")}
            </select>
          </div>
          <input type="hidden" id="rim-code">
          <input type="hidden" id="rim-name">
          <div class="form-row">
            <label class="req">Lot Number</label>
            <input id="rim-lot" required placeholder="예: LOT-2026-ETH01">
          </div>
          <div class="form-row">
            <label class="req">입고 수량</label>
            <input type="number" step="any" id="rim-qty" required value="1000" style="width:160px;">
          </div>
          <div class="form-row">
            <label class="req">단위</label>
            <input id="rim-unit" required value="mL" style="width:100px;">
          </div>
          <div class="form-row">
            <label class="req">유효 기간</label>
            <input type="date" id="rim-expiry" required style="width:200px;">
          </div>
          
          <div class="form-actions">
            <a href="#/rim/records" class="btn btn-secondary">취소</a>
            <button type="submit" class="btn btn-primary">시약 입고 저장</button>
          </div>
        </form>
      </div>
    `;
    
    // Set default expiry date (1 year from now)
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    document.getElementById("rim-expiry").value = nextYear.toISOString().split("T")[0];
    
    const reagentSelect = document.getElementById("rim-reagent-select");
    const codeInput = document.getElementById("rim-code");
    const nameInput = document.getElementById("rim-name");

    reagentSelect.onchange = () => {
      const opt = reagentSelect.options[reagentSelect.selectedIndex];
      if (opt && opt.value) {
        codeInput.value = opt.value;
        nameInput.value = opt.getAttribute("data-name");
      } else {
        codeInput.value = "";
        nameInput.value = "";
      }
    };

    document.getElementById("rim-recv-form").onsubmit = e => {
      e.preventDefault();
      
      const payload = {
        materialCode: codeInput.value.trim(),
        materialName: nameInput.value.trim(),
        lotNo: document.getElementById("rim-lot").value.trim(),
        type: "RECEIVE",
        quantity: parseFloat(document.getElementById("rim-qty").value),
        unit: document.getElementById("rim-unit").value.trim(),
        expiryDate: document.getElementById("rim-expiry").value,
        timestamp: new Date().toISOString()
      };
      
      const user = authHelper.getCurrentUser();
      const id = `rec-rim-${Date.now()}`;
      
      sheetAdapter.saveRecord(SYSTEM_KEY, {
        id,
        docNumber: `RCV-${Date.now().toString().slice(-6)}`,
        status: STATUS.SUBMITTED,
        dataJson: JSON.stringify(payload),
        isDeleted: false,
        createdUser: user.userId,
        createdAt: new Date().toISOString()
      });
      
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "DATA",
        userId: user.userId,
        action: "RECEIVE_MATERIAL",
        targetId: id,
        afterValue: payload,
        reason: `시약 신규 입고 완료 (품목: ${payload.materialName}, Lot: ${payload.lotNo}, 수량: ${payload.quantity}${payload.unit})`
      });
      
      window.toast.show("시약 입고 처리가 완료되었습니다.", "ok");
      window.location.hash = "#/rim/records";
    };
  },

  renderUse(container) {
    // Collect all available Lots (reagents that have balance > 0)
    const records = sheetAdapter.getRecords(SYSTEM_KEY);
    const uniqueLots = [];
    const seen = new Set();
    
    records.forEach(r => {
      try {
        const d = JSON.parse(r.dataJson);
        const key = `${d.materialCode}:${d.lotNo}`;
        if (!seen.has(key)) {
          seen.add(key);
          const bal = getLotBalance(d.materialCode, d.lotNo);
          if (bal > 0) {
            uniqueLots.push({
              materialCode: d.materialCode,
              materialName: d.materialName,
              lotNo: d.lotNo,
              balance: bal,
              unit: d.unit,
              expiryDate: getLotExpiry(d.materialCode, d.lotNo)
            });
          }
        }
      } catch(e){}
    });
    
    const optionsHtml = uniqueLots.map(l => `
      <option value="${l.materialCode}:${l.lotNo}">${window.esc(l.materialName)} [Lot: ${window.esc(l.lotNo)}] (잔량: ${l.balance}${window.esc(l.unit)})</option>
    `).join("");
    
    container.innerHTML = `
      <h2 style="margin-bottom:24px; color:var(--color-primary-dark);">시약 사용 기록 등록</h2>
      <div class="card">
        <h2>시약/표준품 사용 (USE)</h2>
        
        <div id="rim-use-validation-error" class="kpbma-notice-box" style="display:none; background-color:#FEE2E2; border-color:#EF4444; color:#991B1B; margin-bottom:16px;">
          <span class="icon">❌</span>
          <div class="content" id="rim-use-validation-content"></div>
        </div>
        
        <form id="rim-use-form">
          <div class="form-row">
            <label class="req">사용 대상 시약 Lot</label>
            <select id="rim-use-select" required>
              <option value="">-- 사용 시약 선택 --</option>
              ${optionsHtml}
            </select>
          </div>
          
          <div id="rim-lot-details" style="display:none; background-color:var(--color-bg-muted); border:1px solid var(--color-border); border-radius:10px; padding:16px; margin-bottom:20px;">
            <h4 style="color:var(--color-primary-dark); margin-bottom:10px;">선택한 시약 상태</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13.5px;">
              <div>• <b>현재 재고 잔량:</b> <span id="lbl-balance"></span></div>
              <div>• <b>유효기간:</b> <span id="lbl-expiry"></span></div>
            </div>
          </div>
          
          <div class="form-row">
            <label class="req">사용량</label>
            <div>
              <input type="number" step="any" id="rim-use-qty" required style="width:160px;">
              <span id="lbl-use-unit" style="margin-left:8px; font-weight:700;"></span>
            </div>
          </div>
          
          <div class="form-row">
            <label class="req">사용 목적 / 비고</label>
            <textarea id="rim-use-purpose" rows="3" required placeholder="예: 성적서 분석용 HPLC 이동상 제조 사용"></textarea>
          </div>
          
          <div class="form-actions">
            <a href="#/rim/records" class="btn btn-secondary">취소</a>
            <button type="submit" class="btn btn-primary" id="btn-save-rim-use">시약 사용 등록</button>
          </div>
        </form>
      </div>
    `;
    
    const select = document.getElementById("rim-use-select");
    const lotDetails = document.getElementById("rim-lot-details");
    const lblBal = document.getElementById("lbl-balance");
    const lblExp = document.getElementById("lbl-expiry");
    const lblUnit = document.getElementById("lbl-use-unit");
    const qtyInput = document.getElementById("rim-use-qty");
    const valErr = document.getElementById("rim-use-validation-error");
    const valContent = document.getElementById("rim-use-validation-content");
    
    // Select change
    select.onchange = () => {
      valErr.style.display = "none";
      const val = select.value;
      if (!val) {
        lotDetails.style.display = "none";
        lblUnit.textContent = "";
        return;
      }
      
      const [code, lot] = val.split(":");
      const lotObj = uniqueLots.find(l => l.materialCode === code && l.lotNo === lot);
      if (lotObj) {
        lblBal.textContent = `${lotObj.balance} ${lotObj.unit}`;
        lblExp.textContent = lotObj.expiryDate;
        
        // Show validation warning in red if expired
        const today = new Date().toISOString().split("T")[0];
        if (lotObj.expiryDate < today) {
          lblExp.innerHTML = `<span style="color:var(--color-danger); font-weight:700;">${lotObj.expiryDate} (유효기간 만료!)</span>`;
        } else {
          lblExp.innerHTML = `<span style="color:var(--color-success); font-weight:700;">${lotObj.expiryDate} (유효)</span>`;
        }
        
        lblUnit.textContent = lotObj.unit;
        lotDetails.style.display = "block";
      }
    };
    
    document.getElementById("rim-use-form").onsubmit = e => {
      e.preventDefault();
      valErr.style.display = "none";
      
      const val = select.value;
      if (!val) return;
      
      const [code, lot] = val.split(":");
      const lotObj = uniqueLots.find(l => l.materialCode === code && l.lotNo === lot);
      const useQty = parseFloat(qtyInput.value);
      
      const today = new Date().toISOString().split("T")[0];
      
      // 1. Expiry blocker
      if (lotObj.expiryDate < today) {
        valContent.innerHTML = `<b>오류:</b> 유효기간이 만료된 시약 Lot은 사용할 수 없습니다. (유효기간: ${lotObj.expiryDate})`;
        valErr.style.display = "flex";
        return;
      }
      
      // 2. Negative quantity blocker
      if (useQty > lotObj.balance) {
        valContent.innerHTML = `<b>오류:</b> 입력된 사용량(${useQty}${lotObj.unit})이 현재 재고 잔량(${lotObj.balance}${lotObj.unit})보다 큽니다. 음수 재고는 허용되지 않습니다.`;
        valErr.style.display = "flex";
        return;
      }
      
      const payload = {
        materialCode: lotObj.materialCode,
        materialName: lotObj.materialName,
        lotNo: lotObj.lotNo,
        type: "USE",
        quantity: useQty,
        unit: lotObj.unit,
        expiryDate: lotObj.expiryDate,
        purpose: document.getElementById("rim-use-purpose").value.trim(),
        timestamp: new Date().toISOString()
      };
      
      const user = authHelper.getCurrentUser();
      const id = `rec-rim-${Date.now()}`;
      
      sheetAdapter.saveRecord(SYSTEM_KEY, {
        id,
        docNumber: `USE-${Date.now().toString().slice(-6)}`,
        status: STATUS.SUBMITTED,
        dataJson: JSON.stringify(payload),
        isDeleted: false,
        createdUser: user.userId,
        createdAt: new Date().toISOString()
      });
      
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "DATA",
        userId: user.userId,
        action: "USE_MATERIAL",
        targetId: id,
        afterValue: payload,
        reason: `시약 출고 사용 기록 (품목: ${payload.materialName}, Lot: ${payload.lotNo}, 사용량: ${payload.quantity}${payload.unit})`
      });
      
      window.toast.show("시약 사용 기록이 완료되었습니다.", "ok");
      window.location.hash = "#/rim/records";
    };
  },

  renderRecordsList(container) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY);
    
    const trs = records.map(r => {
      let data = {};
      try { data = JSON.parse(r.dataJson); } catch(e){}
      
      const isReceive = data.type === "RECEIVE";
      
      return `
        <tr>
          <td><b>${window.esc(r.docNumber)}</b></td>
          <td><code>${window.esc(data.materialCode)}</code></td>
          <td>${window.esc(data.materialName)}</td>
          <td>${window.esc(data.lotNo)}</td>
          <td>
            <span class="badge" style="background-color:${isReceive ? 'var(--color-primary-soft)' : '#FEF3C7'}; color:${isReceive ? 'var(--color-primary)' : '#D97706'};">
              ${isReceive ? '입고(RECEIVE)' : '사용(USE)'}
            </span>
          </td>
          <td><b>${isReceive ? '+' : '-'}${window.esc(data.quantity)}</b> ${window.esc(data.unit)}</td>
          <td>${window.esc(data.expiryDate || "-")}</td>
          <td>${window.esc(data.purpose || "시약 최초 신규 입고")}</td>
          <td>${window.esc(r.createdUser)}</td>
          <td>${window.formatKst(r.createdAt)}</td>
        </tr>
      `;
    }).join("");
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">재고 수불 대장 (Material Ledger)</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">시약/표준품의 모든 입고 및 출고 사용에 관한 실시간 트랜잭션 기록 대장입니다.</p>
      </div>
      
      <div class="card">
        <table class="list">
          <thead>
            <tr>
              <th>문서 번호</th>
              <th>품목 코드</th>
              <th>시약명</th>
              <th>Lot No</th>
              <th>구분</th>
              <th>수량</th>
              <th>유효기간</th>
              <th>사용 목적 및 비고</th>
              <th>담당자 ID</th>
              <th>수행일시</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="10" style="text-align:center; padding:32px; color:var(--color-text-muted);">수불 내역이 존재하지 않습니다.</td></tr>` : trs}
          </tbody>
        </table>
      </div>
    `;
  },

  renderAudit(container) {
    let activeTab = "data";
    
    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 style="font-size:20px; color:var(--color-primary-dark);">${this.systemName} 감사추적 (Audit Trail)</h2>
        <p style="color:var(--color-text-muted); font-size:13px;">시약 입고, 출고 사용, 만료일자 점검 등 재고 관리 프로세스의 완전성 이력입니다.</p>
      </div>
      
      <div class="card no-print">
        <h2>감사 로그 검색 필터</h2>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:12px; margin-top:12px;">
          <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
            <label style="padding-top:0; font-size:12px;">작업자 ID</label>
            <input id="filt-mod-user" placeholder="ID 입력 검색">
          </div>
          <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
            <label style="padding-top:0; font-size:12px;">작업 내용 검색</label>
            <input id="filt-mod-keyword" placeholder="사유/액션명 검색">
          </div>
          <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
            <label style="padding-top:0; font-size:12px;">시작일</label>
            <input type="date" id="filt-mod-start">
          </div>
          <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
            <label style="padding-top:0; font-size:12px;">종료일</label>
            <input type="date" id="filt-mod-end">
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:12px;">
          <button class="btn btn-secondary sm" id="btn-filt-mod-reset">초기화</button>
          <button class="btn btn-primary sm" id="btn-filt-mod-search">검색</button>
        </div>
      </div>
      
      <div class="card">
        <div class="audit-tabs">
          <div class="audit-tab ${activeTab === 'data' ? 'active' : ''}" id="tab-data-logs">데이터 변경 로그 (DATA)</div>
          <div class="audit-tab ${activeTab === 'security' ? 'active' : ''}" id="tab-sec-logs">보안 및 권한 로그 (SECURITY)</div>
        </div>
        
        <table class="list">
          <thead id="audit-table-thead">
          </thead>
          <tbody id="audit-table-tbody">
          </tbody>
        </table>
      </div>
    `;

    const renderLogs = () => {
      const userVal = document.getElementById("filt-mod-user").value.trim().toLowerCase();
      const keywordVal = document.getElementById("filt-mod-keyword").value.trim().toLowerCase();
      const startVal = document.getElementById("filt-mod-start").value;
      const endVal = document.getElementById("filt-mod-end").value;

      const allLogs = JSON.parse(localStorage.getItem("gxp_suite:audit_logs") || "[]");
      const sysLogs = allLogs.filter(l => l.system === SYSTEM_KEY);
      
      const filtered = sysLogs.filter(l => {
        if (activeTab === "data" && l.category !== "DATA") return false;
        if (activeTab === "security" && l.category !== "SECURITY") return false;
        if (userVal && !String(l.userId).toLowerCase().includes(userVal)) return false;
        
        if (keywordVal) {
          const action = String(l.action).toLowerCase();
          const reason = String(l.reason).toLowerCase();
          const target = String(l.targetId).toLowerCase();
          const before = String(l.beforeValue).toLowerCase();
          const after = String(l.afterValue).toLowerCase();
          if (!action.includes(keywordVal) && !reason.includes(keywordVal) && !target.includes(keywordVal) && !before.includes(keywordVal) && !after.includes(keywordVal)) return false;
        }
        
        if (startVal && l.timestamp.split("T")[0] < startVal) return false;
        if (endVal && l.timestamp.split("T")[0] > endVal) return false;
        
        return true;
      }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      const thead = document.getElementById("audit-table-thead");
      const tbody = document.getElementById("audit-table-tbody");

      if (activeTab === "data") {
        thead.innerHTML = `
          <tr>
            <th style="width:160px;">일시</th>
            <th style="width:100px;">작업자</th>
            <th style="width:120px;">액션</th>
            <th style="width:140px;">대상 ID</th>
            <th>변경 전</th>
            <th>변경 후</th>
            <th>사유</th>
          </tr>
        `;
        tbody.innerHTML = filtered.length === 0 
          ? `<tr><td colspan="7" style="text-align:center; color:var(--color-text-muted); padding:32px;">감사 기록이 존재하지 않습니다.</td></tr>`
          : filtered.map(l => `
            <tr>
              <td>${window.formatKst(l.timestamp)}</td>
              <td><b>${window.esc(l.userId)}</b></td>
              <td><code>${window.esc(l.action)}</code></td>
              <td>${window.esc(l.targetId)}</td>
              <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><small>${window.esc(l.beforeValue || "-")}</small></td>
              <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><small>${window.esc(l.afterValue || "-")}</small></td>
              <td>${window.esc(l.reason || "")}</td>
            </tr>
          `).join("");
      } else {
        thead.innerHTML = `
          <tr>
            <th style="width:160px;">일시</th>
            <th style="width:100px;">작업자</th>
            <th style="width:120px;">액션</th>
            <th style="width:140px;">대상 ID</th>
            <th>사유 / 설명</th>
          </tr>
        `;
        tbody.innerHTML = filtered.length === 0 
          ? `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted); padding:32px;">감사 기록이 존재하지 않습니다.</td></tr>`
          : filtered.map(l => `
            <tr>
              <td>${window.formatKst(l.timestamp)}</td>
              <td><b>${window.esc(l.userId)}</b></td>
              <td><code>${window.esc(l.action)}</code></td>
              <td>${window.esc(l.targetId)}</td>
              <td>${window.esc(l.reason || "")}</td>
            </tr>
          `).join("");
      }
    };

    document.getElementById("tab-data-logs").onclick = () => {
      activeTab = "data";
      document.getElementById("tab-data-logs").classList.add("active");
      document.getElementById("tab-sec-logs").classList.remove("active");
      renderLogs();
    };
    document.getElementById("tab-sec-logs").onclick = () => {
      activeTab = "security";
      document.getElementById("tab-sec-logs").classList.add("active");
      document.getElementById("tab-data-logs").classList.remove("active");
      renderLogs();
    };

    document.getElementById("btn-filt-mod-search").onclick = renderLogs;
    document.getElementById("btn-filt-mod-reset").onclick = () => {
      document.getElementById("filt-mod-user").value = "";
      document.getElementById("filt-mod-keyword").value = "";
      document.getElementById("filt-mod-start").value = "";
      document.getElementById("filt-mod-end").value = "";
      renderLogs();
    };

    renderLogs();
  }
};
export default rimModule;
