import { sheetAdapter } from "../shared/js/sheetAdapter.js";
import { authHelper } from "../shared/js/authHelper.js";

const SYSTEM_KEY = "ELB";
const STATUS = { SUBMITTED: "SUBMITTED" }; // Directly submitted and locked

export const elbModule = {
  systemKey: SYSTEM_KEY,
  systemName: "[ELB] 전자로그북",
  
  getSidebarMenus(role) {
    const menus = [
      { href: "#/elb/dashboard", label: "대시보드" }
    ];
    if (role === "OPERATOR" || role === "ADMIN" || role === "MANAGER") {
      menus.push({ href: "#/elb/new", label: "로그 기록 입력" });
    }
    menus.push({ href: "#/elb/records", label: "전체 로그 조회" });
    menus.push({ href: "#/elb/print", label: "로그북 출력" });
    menus.push({ href: "#/elb/audit", label: "감사추적" });
    return menus;
  },

  handleRoute(subRoute, container) {
    if (subRoute === "dashboard" || subRoute === "") {
      this.renderDashboard(container);
    } else if (subRoute === "new") {
      this.renderNew(container);
    } else if (subRoute === "records") {
      this.renderRecordsList(container);
    } else if (subRoute === "print") {
      this.renderPrintSelector(container);
    } else if (subRoute === "audit") {
      this.renderAudit(container);
    } else {
      container.innerHTML = `<h3>알 수 없는 경로입니다.</h3>`;
    }
  },

  renderDashboard(container) {
    const role = authHelper.getUserRole(SYSTEM_KEY);
    const records = sheetAdapter.getRecords(SYSTEM_KEY);
    const totalLogs = records.length;
    
    // Calculate total usage hours
    let totalMinutes = 0;
    records.forEach(r => {
      try {
        const d = JSON.parse(r.dataJson);
        totalMinutes += parseFloat(d.duration || 0);
      } catch(e){}
    });
    const totalHours = (totalMinutes / 60).toFixed(1);
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">${this.systemName} 대시보드</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">GMP 장비의 가동, 세척, 유지보수 활동에 대한 불변적 전자기록(Electronic Logbook) 관리자 대시보드입니다.</p>
      </div>
      
      <div class="grid cols-3">
        <div class="kpi">
          <div class="label">총 장비 로그 기록수</div>
          <div class="value">${totalLogs} 건</div>
        </div>
        <div class="kpi">
          <div class="label">총 가동 시간</div>
          <div class="value" style="color:var(--color-primary);">${totalHours} 시간</div>
        </div>
        <div class="kpi">
          <div class="label">규제 준수 상태</div>
          <div class="value" style="color:var(--color-success); font-size: 15px;">🔒 Append-Only Locked</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:24px;">
        <h2>전자로그북 정책 안내 (ALCOA+ Compliance)</h2>
        <p style="font-size:13.5px; color:var(--color-text); line-height:1.6; margin-bottom:12px;">
          본 로그북 시스템은 데이터 조작 및 임의 삭제를 원천 차단하기 위해 **Append-Only 불변 원칙**으로 운영됩니다.<br>
          한 번 기록된 장비 로그는 **수정(Update)이나 삭제(Delete) 기능이 GUI상에 존재하지 않으며**, 오직 새로운 가동 또는 점검 로그 추가만 허용됩니다.
        </p>
        <div style="display:flex; gap:12px; margin-top:16px;">
          ${role === "OPERATOR" || role === "ADMIN" || role === "MANAGER" ? `
            <a href="#/elb/new" class="btn btn-primary">신규 로그 기록 입력</a>
          ` : ""}
          <a href="#/elb/records" class="btn btn-secondary">장비 가동 기록 조회</a>
        </div>
      </div>
    `;
  },

  renderNew(container) {
    const user = authHelper.getCurrentUser();
    
    const equipments = sheetAdapter.getMasterData("EQUIPMENT");

    container.innerHTML = `
      <h2 style="margin-bottom:24px; color:var(--color-primary-dark);">로그 기록 입력</h2>
      <div class="card">
        <h2>장비 가동/활동 기록 (저장 즉시 영구 잠금 상태가 됩니다)</h2>
        <form id="elb-form">
          <div class="form-row">
            <label class="req">선택 장비</label>
            <select id="elb-equip-select" required>
              <option value="">-- 장비 선택 --</option>
              ${equipments.map(m => `<option value="${window.esc(m.code)}" data-name="${window.esc(m.name)}">${window.esc(m.name)} (${window.esc(m.code)})</option>`).join("")}
            </select>
          </div>
          <input type="hidden" id="elb-equip-id">
          <input type="hidden" id="elb-equip-name">
          <div class="form-row">
            <label class="req">수행 일시</label>
            <input type="datetime-local" id="elb-date" required>
          </div>
          <div class="form-row">
            <label class="req">작업 구분</label>
            <select id="elb-activity-type">
              <option value="RUN">RUN (장비 가동)</option>
              <option value="CLEAN">CLEAN (장비 세척)</option>
              <option value="CAL">CAL (교정/검사)</option>
              <option value="MAINT">MAINT (유지관리)</option>
            </select>
          </div>
          <div class="form-row">
            <label class="req">사용/가동 시간 (분)</label>
            <input type="number" id="elb-duration" required value="60" style="width:120px;">
          </div>
          <div class="form-row">
            <label class="req">작업 내용 설명</label>
            <textarea id="elb-desc" rows="3" required placeholder="수행 작업 상세 내용 입력"></textarea>
          </div>
          <div class="form-row">
            <label>기록 담당자</label>
            <input value="${window.esc(user.name)} (${window.esc(user.userId)})" readonly style="background:#eee;">
          </div>
          
          <div class="form-actions">
            <a href="#/elb/records" class="btn btn-secondary">취소</a>
            <button type="submit" class="btn btn-primary">전자로그 저장 및 봉인</button>
          </div>
        </form>
      </div>
    `;
    
    // Set default datetime
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("elb-date").value = now.toISOString().slice(0, 16);
    
    const equipSelect = document.getElementById("elb-equip-select");
    const equipIdInput = document.getElementById("elb-equip-id");
    const equipNameInput = document.getElementById("elb-equip-name");
    
    equipSelect.onchange = () => {
      const opt = equipSelect.options[equipSelect.selectedIndex];
      if (opt && opt.value) {
        equipIdInput.value = opt.value;
        equipNameInput.value = opt.getAttribute("data-name");
      } else {
        equipIdInput.value = "";
        equipNameInput.value = "";
      }
    };
    
    document.getElementById("elb-form").onsubmit = e => {
      e.preventDefault();
      
      const payload = {
        equipmentId: document.getElementById("elb-equip-id").value.trim(),
        equipmentName: document.getElementById("elb-equip-name").value.trim(),
        dateTime: document.getElementById("elb-date").value,
        activityType: document.getElementById("elb-activity-type").value,
        duration: parseInt(document.getElementById("elb-duration").value, 10),
        activity: document.getElementById("elb-desc").value.trim(),
        operatorName: user.name
      };
      
      const id = `rec-elb-${Date.now()}`;
      
      sheetAdapter.saveRecord(SYSTEM_KEY, {
        id,
        docNumber: `LOG-${Date.now().toString().slice(-6)}`,
        status: STATUS.SUBMITTED,
        dataJson: JSON.stringify(payload),
        isDeleted: false,
        createdUser: user.userId,
        createdAt: new Date().toISOString()
      });
      
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "DATA",
        userId: user.userId,
        action: "APPEND_LOG",
        targetId: id,
        afterValue: payload,
        reason: `장비 가동/활동 기록 추가 완료 (장비ID: ${payload.equipmentId})`
      });
      
      window.toast.show("장비 로그기록이 영구 등록되었습니다 (수정/삭제 불가).", "ok");
      window.location.hash = "#/elb/records";
    };
  },

  renderRecordsList(container) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY);
    
    const trs = records.map(r => {
      let data = {};
      try { data = JSON.parse(r.dataJson); } catch(e){}
      return `
        <tr>
          <td><b>${window.esc(r.docNumber)}</b></td>
          <td><code>${window.esc(data.equipmentId)}</code></td>
          <td>${window.esc(data.equipmentName)}</td>
          <td>${window.esc(data.dateTime.replace("T", " "))}</td>
          <td><span class="badge ${data.activityType === 'RUN' ? 'approved' : data.activityType === 'CLEAN' ? 'printed' : 'warn'}">${data.activityType}</span></td>
          <td>${window.esc(data.duration)} 분</td>
          <td>${window.esc(data.activity)}</td>
          <td>${window.esc(r.createdUser)}</td>
          <td>
            <span class="badge approved" style="font-size:10px;">🔒 Locked</span>
            <button class="btn btn-secondary sm" data-btn-view="${r.id}" style="padding:2px 6px; font-size:11px;">보기</button>
          </td>
        </tr>
      `;
    }).join("");
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">장비 사용 전자로그북 내역</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">이 시스템에 축적된 모든 가동 이력이며, 규정에 따라 임의 수정/삭제가 금지됩니다.</p>
      </div>
      
      <div class="card">
        <table class="list">
          <thead>
            <tr>
              <th>로그 일련번호</th>
              <th>장비 ID</th>
              <th>장비명</th>
              <th>일시</th>
              <th>작업 구분</th>
              <th>사용 시간</th>
              <th>작업 설명</th>
              <th>기록자 ID</th>
              <th>상태 / 작업</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--color-text-muted);">로그가 존재하지 않습니다.</td></tr>` : trs}
          </tbody>
        </table>
      </div>
    `;
    
    container.querySelectorAll("[data-btn-view]").forEach(btn => {
      const id = btn.getAttribute("data-btn-view");
      btn.onclick = () => this.showLogDetail(id);
    });
  },

  showLogDetail(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch(e){}
    
    const content = `
      <h3>장비 사용 로그 상세 조회</h3>
      <table class="list">
        <tr><th>로그 번호</th><td>${window.esc(rec.docNumber)}</td></tr>
        <tr><th>장비 ID</th><td>${window.esc(data.equipmentId)}</td></tr>
        <tr><th>장비명</th><td>${window.esc(data.equipmentName)}</td></tr>
        <tr><th>수행 일시</th><td>${window.esc(data.dateTime.replace("T", " "))}</td></tr>
        <tr><th>작업 구분</th><td>${window.esc(data.activityType)}</td></tr>
        <tr><th>사용 시간</th><td>${window.esc(data.duration)} 분</td></tr>
        <tr><th>작업 설명</th><td>${window.esc(data.activity)}</td></tr>
        <tr><th>기록자 ID</th><td>${window.esc(rec.createdUser)}</td></tr>
        <tr><th>기록 상태</th><td><span class="badge approved">🔒 봉인 완료 (수정/삭제 불가능)</span></td></tr>
      </table>
      <div class="form-actions">
        <button class="btn btn-secondary" id="btn-detail-close">닫기</button>
      </div>
    `;
    
    window.modal.open(content, () => {
      document.getElementById("btn-detail-close").onclick = window.modal.close;
    });
  },

  renderPrintSelector(container) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY);
    
    const trs = records.map(r => {
      let data = {};
      try { data = JSON.parse(r.dataJson); } catch(e){}
      return `
        <tr>
          <td><input type="checkbox" name="elb-print-check" value="${r.id}"></td>
          <td><b>${window.esc(r.docNumber)}</b></td>
          <td><code>${window.esc(data.equipmentId)}</code></td>
          <td>${window.esc(data.equipmentName)}</td>
          <td>${window.esc(data.dateTime.replace("T", " "))}</td>
          <td>${window.esc(data.activityType)}</td>
          <td>${window.esc(data.duration)} 분</td>
          <td>${window.esc(data.activity)}</td>
          <td>${window.esc(r.createdUser)}</td>
        </tr>
      `;
    }).join("");
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">로그북 출력 대상 선택</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">공식 하드카피 바인더 보관이나 밸리데이션 검토를 위해 출력할 항목들을 선택해 주십시오.</p>
      </div>
      
      <div class="card">
        <div style="margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
          <button class="btn btn-secondary sm" id="btn-print-select-all">전체 선택</button>
          <button class="btn btn-primary" id="btn-print-preview-execute">선택 항목 로그북 인쇄</button>
        </div>
        <table class="list">
          <thead>
            <tr>
              <th style="width:40px;">선택</th>
              <th>로그 번호</th>
              <th>장비 ID</th>
              <th>장비명</th>
              <th>수행일시</th>
              <th>작업</th>
              <th>시간</th>
              <th>작업 설명</th>
              <th>기록자</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--color-text-muted);">출력할 장비 로그 기록이 존재하지 않습니다.</td></tr>` : trs}
          </tbody>
        </table>
      </div>
    `;
    
    let allSelected = false;
    document.getElementById("btn-print-select-all").onclick = () => {
      allSelected = !allSelected;
      container.querySelectorAll("input[name='elb-print-check']").forEach(chk => chk.checked = allSelected);
      document.getElementById("btn-print-select-all").textContent = allSelected ? "선택 해제" : "전체 선택";
    };
    
    document.getElementById("btn-print-preview-execute").onclick = () => {
      const selectedIds = Array.from(container.querySelectorAll("input[name='elb-print-check']:checked")).map(chk => chk.value);
      if (selectedIds.length === 0) {
        window.toast.show("출력할 로그를 최소 1개 이상 선택해 주십시오.", "warn");
        return;
      }
      this.showLogbookPrintPreview(selectedIds);
    };
  },

  showLogbookPrintPreview(ids) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => ids.includes(r.id));
    const user = authHelper.getCurrentUser();
    const companyName = JSON.parse(localStorage.getItem("gxp_suite:settings") || "[]")
      .find(s => s.key === "common:companyName")?.value || "㈜갬프연구소";
      
    // Write Data audit trail for printing action
    sheetAdapter.saveAuditLog(SYSTEM_KEY, {
      category: "DATA",
      userId: user.userId,
      action: "PRINT_LOGBOOK",
      targetId: "MULTIPLE_RECORDS",
      reason: `장비로그북 인쇄 수행 (선택 건수: ${ids.length}건)`
    });
    
    const rowsHtml = records.map((r, idx) => {
      let data = {};
      try { data = JSON.parse(r.dataJson); } catch(e){}
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><b>${window.esc(r.docNumber)}</b></td>
          <td><code>${window.esc(data.equipmentId)}</code></td>
          <td>${window.esc(data.equipmentName)}</td>
          <td>${window.esc(data.dateTime.replace("T", " "))}</td>
          <td style="text-align:center;">${window.esc(data.activityType)}</td>
          <td style="text-align:right;">${window.esc(data.duration)} 분</td>
          <td>${window.esc(data.activity)}</td>
          <td>${window.esc(r.createdUser)}</td>
        </tr>
      `;
    }).join("");
    
    const printContent = `
      <div class="coa-printable" style="max-width: 900px; padding: 25px; color:#000;">
        <h1 style="font-size:24px; font-weight:800; text-align:center; color:#000; margin-bottom:6px;">EQUIPMENT LOGBOOK COPY</h1>
        <div style="text-align:center; font-size:12px; font-weight:700; color:#555; margin-bottom:24px;">GMP 분석 및 생산 장비 사용기록 전자대장 사본</div>
        
        <table class="doc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F2F5F8;">
              <th style="border: 1px solid #000; padding:6px; text-align:center; width:40px;">No</th>
              <th style="border: 1px solid #000; padding:6px; text-align:left; width:90px;">로그 번호</th>
              <th style="border: 1px solid #000; padding:6px; text-align:left; width:90px;">장비 ID</th>
              <th style="border: 1px solid #000; padding:6px; text-align:left; width:130px;">장비명</th>
              <th style="border: 1px solid #000; padding:6px; text-align:left; width:120px;">수행일시</th>
              <th style="border: 1px solid #000; padding:6px; text-align:center; width:60px;">구분</th>
              <th style="border: 1px solid #000; padding:6px; text-align:right; width:60px;">시간</th>
              <th style="border: 1px solid #000; padding:6px; text-align:left;">수행 업무 내용</th>
              <th style="border: 1px solid #000; padding:6px; text-align:left; width:70px;">기록자</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        
        <div style="margin-top:30px; border-top: 1px solid #000; padding-top:12px; font-size:11px; text-align:center; line-height:1.6; color:#444;">
          본 사본은 ${window.esc(companyName)} 전자로그북 시스템에서 공식 복제 출력된 문서입니다.<br>
          [기록 보안 잠금: locked | 출력자 ID: ${window.esc(user.userId)} | 출력 일시: ${window.formatKst()}]
        </div>
      </div>
    `;
    
    window.modal.open(`
      <div class="no-print" style="margin-bottom: 20px;">
        <h3>장비 로그북 바인더 인쇄 미리보기</h3>
        <p style="font-size:12px; color:var(--color-text-muted);">
          선택한 ${ids.length}건의 로그를 취합하여 바인더에 삽입할 사본 서식을 인쇄합니다.
        </p>
      </div>
      <!-- Scrollable Wrapper for small viewport compatibility -->
      <div class="printable-scroll-wrap" style="max-height: 60vh; overflow: auto; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; margin-bottom: 15px;">
        ${printContent}
      </div>
      <div class="form-actions no-print">
        <button class="btn btn-secondary" id="btn-preview-close">닫기</button>
        <button class="btn btn-primary" id="btn-do-print">출력하기 (window.print)</button>
      </div>
    `, () => {
      // Enlarge modal dialog size specifically for logbook print preview
      const modalEl = document.querySelector(".modal");
      if (modalEl) {
        modalEl.style.width = "980px";
        modalEl.style.maxWidth = "95vw";
      }

      document.getElementById("btn-preview-close").onclick = () => {
        window.modal.close();
        this.handleRoute("print", document.getElementById("content-viewport"));
      };
      
      document.getElementById("btn-do-print").onclick = () => {
        window.print();
      };
    });
  },

  renderAudit(container) {
    let activeTab = "data"; // 'data' or 'security'
    
    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 style="font-size:20px; color:var(--color-primary-dark);">${this.systemName} 감사추적 (Audit Trail)</h2>
        <p style="color:var(--color-text-muted); font-size:13px;">로그북 기록 추가, 인쇄 이력 및 봉인 상태의 완전성을 입증하는 이력입니다.</p>
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
            <!-- Dynamically populated headers -->
          </thead>
          <tbody id="audit-table-tbody">
            <!-- Dynamically populated rows -->
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
export default elbModule;
