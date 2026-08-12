import { sheetAdapter } from "../shared/js/sheetAdapter.js";
import { authHelper } from "../shared/js/authHelper.js";

const SYSTEM_KEY = "COA";
const ROLES = { TESTER: "TESTER", APPROVER: "APPROVER", ADMIN: "ADMIN" };
const STATUS = { DRAFT: "DRAFT", SUBMITTED: "SUBMITTED", APPROVED: "APPROVED", REJECTED: "REJECTED", PRINTED: "PRINTED" };
const STATUS_LABEL = { DRAFT: "작성중", SUBMITTED: "승인대기", APPROVED: "승인완료", REJECTED: "반려", PRINTED: "출력완료" };
const ROLE_LABEL = { TESTER: "시험자", APPROVER: "승인자", ADMIN: "관리자" };

// Global system routes
const routes = {};
function route(path, fn, allowedRoles = null) {
  routes[path] = { fn, roles: allowedRoles };
}

function navigate(hash) {
  window.location.hash = hash;
}

// Toast System
const toast = {
  show(msg, kind = "info") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.innerHTML = `<span>${kind === "ok" ? "✓" : kind === "error" ? "✗" : "ℹ"}</span> ${msg}`;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 3500);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }
};

// Modal System
const modal = {
  open(htmlContent, onMount) {
    const root = document.getElementById("modal-root");
    if (!root) return;
    root.innerHTML = `<div class="modal-bg"><div class="modal">${htmlContent}</div></div>`;
    if (onMount) onMount(root);
  },
  close() {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }
};

// Escaping for HTML Safety
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatKst(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function generateDocNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateKey = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  
  // Sequence counter in local storage to keep it simple but auto-incrementing
  const seqKey = "gxp_suite:seq:coa";
  let seq = JSON.parse(localStorage.getItem(seqKey) || "{}");
  if (seq.date !== dateKey) {
    seq = { date: dateKey, val: 0 };
  }
  seq.val += 1;
  localStorage.setItem(seqKey, JSON.stringify(seq));
  
  return `COA-${dateKey}-${String(seq.val).padStart(3, "0")}`;
}

/* =========================================================================
 * 1) 렌더링 레이아웃 셸 (KPBMA 톤앤매너 헤더/푸터 적용)
 * ========================================================================= */
function renderShell(activeHash, contentHtml, onMount) {
  const user = authHelper.getCurrentUser();
  if (!user) {
    navigate("/login");
    return;
  }
  
  const systemRole = authHelper.getUserRole(SYSTEM_KEY);
  
  const navItems = [
    { href: "#/dashboard", label: "대시보드", roles: null },
    { href: "#/records/new", label: "결과 입력", roles: [ROLES.TESTER] },
    { href: "#/records/mine", label: "내 작성건", roles: [ROLES.TESTER] },
    { href: "#/approvals", label: "승인 대기", roles: [ROLES.APPROVER] },
    { href: "#/coa", label: "COA 출력", roles: [ROLES.APPROVER, ROLES.ADMIN] },
    { href: "#/users", label: "계정 관리", roles: [ROLES.ADMIN] },
    { href: "#/audit", label: "감사추적", roles: [ROLES.ADMIN] },
    { href: "#/settings", label: "환경설정", roles: [ROLES.ADMIN] }
  ];
  
  const navHtml = navItems
    .filter(n => !n.roles || n.roles.includes(systemRole))
    .map(n => {
      const active = activeHash === n.href ? "class='active'" : "";
      return `<a ${active} href="${n.href}">${n.label}</a>`;
    })
    .join("");
    
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="kpbma-topbar no-print">
      <div class="brand">
        <span class="title">KPBMA GMP 컴퓨터화 시스템</span>
      </div>
      <div class="user-info">
        <span><b>${esc(user.name)}</b> (${esc(user.userId)})</span>
        <span class="role-badge">${esc(ROLE_LABEL[systemRole] || systemRole)}</span>
        <button class="btn btn-secondary sm" id="btn-logout" style="padding: 4px 12px; font-size:12px;">로그아웃</button>
      </div>
    </div>
    <div class="shell">
      <div class="sidenav no-print">
        <div class="group">COA 메뉴</div>
        ${navHtml}
      </div>
      <div class="main-panel">
        ${contentHtml}
        
        <!-- Strict KPBMA Regulatory Disclaimer Footer -->
        <div class="kpbma-footer no-print">
          <div class="disclaimer">
            본 시스템은 CSV 실습 교육을 위한 가상 목업 시스템(Mock-up System)입니다. 
            구글 시트는 교육용 데이터 저장소로 활용되며, 실제 GMP 운영 환경의 정식 데이터베이스나 밸리데이션된 전자서명 시스템을 대체하지 않습니다.
          </div>
          <div style="margin-top: 8px;">© GAMPLAB · KPBMA AI-Based Data Integrity Course</div>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById("btn-logout").onclick = () => {
    authHelper.logout(SYSTEM_KEY);
  };
  
  if (onMount) onMount();
}

/* =========================================================================
 * 2) Views 정의
 * ========================================================================= */

// --- 2.1 LOGIN VIEW ---
route("/login", () => {
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-box">
        <div class="logo-area">
          <h2 style="color:var(--color-primary-dark); font-weight:800; font-size: 24px; letter-spacing:-0.03em;">KPBMA</h2>
        </div>
        <h1>시험성적서(COA) 발행 시스템</h1>
        <div class="sub">AI-Based DI 및 CSV 교육용 가상 시스템 v2</div>
        
        <form id="login-form">
          <div class="form-row" style="grid-template-columns: 100px 1fr; margin-bottom: 12px;">
            <label class="req">사용자 ID</label>
            <input id="lg-id" autocomplete="off" placeholder="ID 입력">
          </div>
          <div class="form-row" style="grid-template-columns: 100px 1fr; margin-bottom: 20px;">
            <label class="req">비밀번호</label>
            <input id="lg-pw" type="text" style="-webkit-text-security: disc;" autocomplete="off" placeholder="비밀번호 입력">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; border-radius:8px;">로그인</button>
        </form>
        
        <div class="seed-info">
          <b>시드 테스트 계정 정보</b><br>
          • 관리자: <b>admin</b> / 비밀번호: <b>admin</b><br>
          • 시험자: <b>tester</b> / 비밀번호: <b>tester</b><br>
          • 승인자: <b>approver</b> / 비밀번호: <b>approver</b>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById("login-form").onsubmit = e => {
    e.preventDefault();
    const id = document.getElementById("lg-id").value.trim();
    const pw = document.getElementById("lg-pw").value;
    
    if (!id || !pw) {
      toast.show("ID와 비밀번호를 입력해주세요.", "warn");
      return;
    }
    
    const res = authHelper.login(id, pw);
    if (res.success) {
      toast.show(`${res.user.name}님 환영합니다.`, "ok");
      navigate("/dashboard");
    } else {
      toast.show(esc(res.message), "error");
    }
  };
});

// --- 2.2 DASHBOARD VIEW ---
route("/dashboard", () => {
  const systemRole = authHelper.getUserRole(SYSTEM_KEY);
  const records = sheetAdapter.getRecords(SYSTEM_KEY);
  
  let dashboardCards = "";
  
  if (systemRole === ROLES.TESTER) {
    const drafts = records.filter(r => r.status === STATUS.DRAFT).length;
    const submitted = records.filter(r => r.status === STATUS.SUBMITTED).length;
    const approved = records.filter(r => r.status === STATUS.APPROVED || r.status === STATUS.PRINTED).length;
    const rejected = records.filter(r => r.status === STATUS.REJECTED).length;
    
    dashboardCards += `
      <div class="card">
        <h2>시험자 업무 KPI 대시보드</h2>
        <div class="grid cols-4">
          <div class="kpi"><div class="label">작성 중 (DRAFT)</div><div class="value">${drafts}</div></div>
          <div class="kpi"><div class="label">승인 대기 중</div><div class="value">${submitted}</div></div>
          <div class="kpi"><div class="label">승인 완료</div><div class="value">${approved}</div></div>
          <div class="kpi"><div class="label">반려됨</div><div class="value" style="color:var(--color-danger)">${rejected}</div></div>
        </div>
        <div class="form-actions" style="margin-top: 20px; justify-content: flex-start;">
          <a class="btn btn-primary" href="#/records/new">신규 결과 입력</a>
          <a class="btn btn-secondary" href="#/records/mine">내 작성 데이터 목록</a>
        </div>
      </div>
    `;
  }
  
  if (systemRole === ROLES.APPROVER) {
    const pend = records.filter(r => r.status === STATUS.SUBMITTED).length;
    const done = records.filter(r => r.status === STATUS.APPROVED || r.status === STATUS.PRINTED).length;
    
    dashboardCards += `
      <div class="card">
        <h2>승인권자 업무 KPI 대시보드</h2>
        <div class="grid cols-3">
          <div class="kpi"><div class="label">검토/승인 대기 건</div><div class="value" style="color:var(--color-warning)">${pend}</div></div>
          <div class="kpi"><div class="label">최종 승인 완료 건</div><div class="value">${done}</div></div>
          <div class="kpi"><div class="label">출력 가능한 COA</div><div class="value">${done}</div></div>
        </div>
        <div class="form-actions" style="margin-top: 20px; justify-content: flex-start;">
          <a class="btn btn-primary" href="#/approvals">승인 대기목록 조회</a>
          <a class="btn btn-secondary" href="#/coa">COA 시험성적서 출력</a>
        </div>
      </div>
    `;
  }
  
  if (systemRole === ROLES.ADMIN) {
    const users = sheetAdapter.getUsers();
    const totalRecords = records.length;
    
    dashboardCards += `
      <div class="card">
        <h2>시스템 관리자 통제 현황</h2>
        <div class="grid cols-3">
          <div class="kpi"><div class="label">스위트 등록 사용자</div><div class="value">${users.length}</div></div>
          <div class="kpi"><div class="label">총 시험성적 레코드</div><div class="value">${totalRecords}</div></div>
          <div class="kpi"><div class="label">구글 시트 연동 상태</div><div class="value" style="font-size: 15px; color: var(--color-success)">🟢 Connected</div></div>
        </div>
        <div class="form-actions" style="margin-top: 20px; justify-content: flex-start;">
          <a class="btn btn-secondary" href="#/users">계정 관리</a>
          <a class="btn btn-secondary" href="#/audit">감사추적</a>
          <a class="btn btn-secondary" href="#/settings">환경설정</a>
        </div>
      </div>
    `;
  }
  
  renderShell("#/dashboard", `
    <h2 style="margin-bottom: 24px;">대시보드</h2>
    <div class="kpbma-notice-box">
      <span class="icon">ℹ</span>
      <div class="content">
        <h4>설득 및 데모 프로세스 안내</h4>
        <p>본 데모는 구글 스프레드시트 백엔드와 실시간 연동됩니다. 계정 생성, 데이터 수정 및 승인 시 발생하는 모든 로그는 감사추적(Audit Trail) 탭에서 두 개의 분류로 안전하게 모니터링됩니다.</p>
      </div>
    </div>
    ${dashboardCards}
  `);
});

// --- 2.3 RECORD NEW VIEW ---
route("/records/new", () => {
  renderShell("#/records/new", `
    <h2 style="margin-bottom: 24px;">시험 결과 신규 입력</h2>
    <div class="card">
      <h2>신규 시험성적 정보 기록 (DRAFT)</h2>
      <form id="record-form">
        ${renderFormField("rc-product", "제품명", "", true)}
        ${renderFormField("rc-lot", "Lot No", "", true)}
        ${renderFormField("rc-date", "시험일자", new Date().toISOString().split("T")[0], true, "date")}
        ${renderFormField("rc-equip", "사용 분석장비", "", true)}
        ${renderFormField("rc-method", "시험 규격 및 방법", "", true, "textarea")}
        ${renderFormField("rc-criteria", "적격 허용기준 (숫자)", "", true, "number")}
        ${renderFormField("rc-value", "시험 결과 측정값 (숫자)", "", true, "number")}
        ${renderFormField("rc-unit", "결과값 단위", "mg", true)}
        
        <div class="form-actions">
          <a class="btn btn-secondary" href="#/records/mine">취소</a>
          <button type="submit" class="btn btn-primary">DRAFT 임시저장</button>
        </div>
      </form>
    </div>
  `, () => {
    document.getElementById("record-form").onsubmit = e => {
      e.preventDefault();
      const parsedData = collectAndValidateForm();
      if (!parsedData) return;
      
      const user = authHelper.getCurrentUser();
      const id = `rec-coa-${Date.now()}`;
      
      // Auto determination of pass/fail
      const pass = parsedData.resultValue <= parsedData.acceptanceCriteria; // Example criteria
      parsedData.isPassed = pass;
      
      sheetAdapter.saveRecord(SYSTEM_KEY, {
        id,
        docNumber: "",
        status: STATUS.DRAFT,
        dataJson: JSON.stringify(parsedData),
        isDeleted: false,
        createdUser: user.userId,
        createdAt: new Date().toISOString()
      });
      
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "DATA",
        userId: user.userId,
        action: "CREATE_RECORD",
        targetId: id,
        afterValue: parsedData,
        reason: "신규 시험 결과 입력 및 임시저장"
      });
      
      toast.show("성공적으로 DRAFT 저장되었습니다.", "ok");
      navigate("/records/mine");
    };
  });
}, [ROLES.TESTER]);

function renderFormField(id, label, value, required, type = "text") {
  let fieldHtml = "";
  if (type === "textarea") {
    fieldHtml = `<textarea id="${id}" rows="3" class="form-control">${esc(value)}</textarea>`;
  } else {
    fieldHtml = `<input id="${id}" type="${type}" step="any" value="${esc(value)}" class="form-control">`;
  }
  
  return `
    <div class="form-row" data-field="${id}">
      <label class="${required ? 'req' : ''}">${label}</label>
      <div>
        ${fieldHtml}
        <div class="field-error" style="display:none;"></div>
      </div>
    </div>
  `;
}

function collectAndValidateForm() {
  const fields = [
    { id: "rc-product", key: "productName", label: "제품명" },
    { id: "rc-lot", key: "lotNo", label: "Lot No" },
    { id: "rc-date", key: "testDate", label: "시험일자" },
    { id: "rc-equip", key: "equipment", label: "사용 분석장비" },
    { id: "rc-method", key: "testMethod", label: "시험 규격 및 방법" },
    { id: "rc-criteria", key: "acceptanceCriteria", label: "허용기준", num: true },
    { id: "rc-value", key: "resultValue", label: "시험 결과 측정값", num: true },
    { id: "rc-unit", key: "resultUnit", label: "결과값 단위" }
  ];
  
  const data = {};
  let valid = true;
  
  fields.forEach(f => {
    const row = document.querySelector(`[data-field="${f.id}"]`);
    const inp = document.getElementById(f.id);
    const err = row.querySelector(".field-error");
    const val = inp.value.trim();
    
    row.classList.remove("invalid");
    err.style.display = "none";
    
    if (!val) {
      row.classList.add("invalid");
      err.textContent = `${f.label}은(는) 필수 필드입니다.`;
      err.style.display = "block";
      valid = false;
      return;
    }
    
    if (f.num) {
      const n = Number(val);
      if (isNaN(n)) {
        row.classList.add("invalid");
        err.textContent = "숫자 값만 입력 가능합니다.";
        err.style.display = "block";
        valid = false;
      } else {
        data[f.key] = n;
      }
    } else {
      data[f.key] = val;
    }
  });
  
  return valid ? data : null;
}

// --- 2.4 RECORD MINE VIEW (TESTER ONLY) ---
route("/records/mine", () => {
  const user = authHelper.getCurrentUser();
  const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.createdUser === user.userId);
  
  renderShell("#/records/mine", `
    <h2 style="margin-bottom: 24px;">내 작성 데이터 목록</h2>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <h2>DRAFT 및 진행 중인 레코드</h2>
        <a class="btn btn-primary" href="#/records/new">신규 입력</a>
      </div>
      ${renderRecordsTable(records, "tester")}
    </div>
  `, () => {
    bindTableActions("tester");
  });
}, [ROLES.TESTER]);

// --- 2.5 APPROVALS VIEW (APPROVER ONLY) ---
route("/approvals", () => {
  const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.status === STATUS.SUBMITTED);
  
  renderShell("#/approvals", `
    <h2 style="margin-bottom: 24px;">시험성적 승인 대기 목록</h2>
    <div class="card">
      <h2>검토 및 승인 서명 대상 건</h2>
      ${renderRecordsTable(records, "approver")}
    </div>
  `, () => {
    bindTableActions("approver");
  });
}, [ROLES.APPROVER]);

// --- 2.6 COA LIST VIEW (APPROVER, ADMIN) ---
route("/coa", () => {
  const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.status === STATUS.APPROVED || r.status === STATUS.PRINTED);
  
  renderShell("#/coa", `
    <h2 style="margin-bottom: 24px;">COA 시험성적서 출력 대상</h2>
    <div class="card">
      <h2>인쇄 대기 및 이력 관리</h2>
      ${renderRecordsTable(records, "coa")}
    </div>
  `, () => {
    bindTableActions("coa");
  });
}, [ROLES.APPROVER, ROLES.ADMIN]);

function renderRecordsTable(records, mode) {
  if (records.length === 0) {
    return `<div style="text-align:center; padding:32px; color:var(--color-text-muted);">레코드가 존재하지 않습니다.</div>`;
  }
  
  const trs = records.map(r => {
    let rawData = {};
    try { rawData = JSON.parse(r.dataJson); } catch(e){}
    
    let actionButtons = "";
    if (mode === "tester") {
      if (r.status === STATUS.DRAFT || r.status === STATUS.REJECTED) {
        actionButtons += `<button class="btn btn-secondary sm" data-act="edit" data-id="${r.id}">수정</button> `;
        actionButtons += `<button class="btn btn-primary sm" data-act="submit" data-id="${r.id}">승인요청</button> `;
      }
      actionButtons += `<button class="btn btn-secondary sm" data-act="detail" data-id="${r.id}">상세</button>`;
    } else if (mode === "approver") {
      actionButtons += `<button class="btn btn-primary sm" data-act="approve" data-id="${r.id}">승인날인</button> `;
      actionButtons += `<button class="btn btn-danger sm" data-act="reject" data-id="${r.id}">반려</button> `;
      actionButtons += `<button class="btn btn-secondary sm" data-act="detail" data-id="${r.id}">상세</button>`;
    } else if (mode === "coa") {
      actionButtons += `<button class="btn btn-primary sm" data-act="print" data-id="${r.id}">인쇄</button> `;
      actionButtons += `<button class="btn btn-secondary sm" data-act="detail" data-id="${r.id}">상세</button>`;
    }
    
    return `
      <tr>
        <td><b>${esc(r.docNumber || "-")}</b></td>
        <td>${esc(rawData.productName || "")}</td>
        <td>${esc(rawData.lotNo || "")}</td>
        <td>${esc(rawData.testDate || "")}</td>
        <td>
          <span class="badge ${rawData.isPassed ? 'approved' : 'rejected'}">
            ${rawData.isPassed ? '적격' : '부적합'}
          </span>
        </td>
        <td><span class="badge ${r.status.toLowerCase()}">${STATUS_LABEL[r.status]}</span></td>
        <td>${esc(r.createdUser)}</td>
        <td>${formatKst(r.createdAt)}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join("");
  
  return `
    <table class="list">
      <thead>
        <tr>
          <th>문서번호</th>
          <th>제품명</th>
          <th>Lot No</th>
          <th>시험일자</th>
          <th>자동 판정</th>
          <th>결재 상태</th>
          <th>시험자 ID</th>
          <th>기록일시</th>
          <th class="no-print">작업</th>
        </tr>
      </thead>
      <tbody>
        ${trs}
      </tbody>
    </table>
  `;
}

function bindTableActions(mode) {
  const user = authHelper.getCurrentUser();
  
  document.querySelectorAll("[data-act]").forEach(btn => {
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    
    btn.onclick = () => {
      if (act === "detail") {
        showRecordDetail(id);
      } else if (act === "edit") {
        showRecordEdit(id);
      } else if (act === "submit") {
        if (confirm("이 데이터를 제출하고 승인을 요청하시겠습니까? 제출 후에는 승인 전까지 수정이 불가합니다.")) {
          const records = sheetAdapter.getRecords(SYSTEM_KEY);
          const rec = records.find(r => r.id === id);
          rec.status = STATUS.SUBMITTED;
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: user.userId,
            action: "SUBMIT_RECORD",
            targetId: id,
            reason: "시험성적 승인 요청 제출"
          });
          toast.show("승인요청이 정상 제출되었습니다.", "ok");
          window.location.reload();
        }
      } else if (act === "approve") {
        showApprovalModal(id, true);
      } else if (act === "reject") {
        showApprovalModal(id, false);
      } else if (act === "print") {
        showPrintWindow(id);
      }
    };
  });
}

// --- 2.7 RECORD DETAIL MODAL ---
function showRecordDetail(id) {
  const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
  if (!rec) return;
  
  let rawData = {};
  try { rawData = JSON.parse(rec.dataJson); } catch(e){}
  
  // Find Audit log changes history for Data modifications
  const auditLogs = sheetAdapter.getAuditLogs(SYSTEM_KEY)
    .filter(l => l.targetId === id && l.action === "UPDATE_DATA")
    .sort((a,b) => b.timestamp.localeCompare(a.timestamp));
    
  let historyHtml = "";
  if (auditLogs.length > 0) {
    const trs = auditLogs.map(l => `
      <tr>
        <td>${formatKst(l.timestamp)}</td>
        <td>${esc(l.userId)}</td>
        <td>${esc(l.reason)}</td>
        <td><small class="muted">${esc(l.beforeValue)} → ${esc(l.afterValue)}</small></td>
      </tr>
    `).join("");
    historyHtml = `
      <div style="margin-top:20px;">
        <h4 style="color:var(--color-primary-dark); font-size:13px; margin-bottom:8px;">기록 수정 이력 (Record Audit Trail)</h4>
        <table class="list" style="font-size:12px;">
          <thead>
            <tr><th>일시</th><th>수정자</th><th>수정 사유</th><th>값 변경 내역</th></tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
    `;
  } else {
    historyHtml = `<div style="margin-top:14px; font-size:12px; color:var(--color-text-muted);">기록 수정 이력이 없습니다. (최초 작성 상태)</div>`;
  }
  
  const content = `
    <h3>시험 레코드 상세 조회</h3>
    <table class="list" style="margin-bottom:18px;">
      <tr><th>문서 번호</th><td>${esc(rec.docNumber || "미발행")}</td></tr>
      <tr><th>제품명</th><td>${esc(rawData.productName)}</td></tr>
      <tr><th>Lot No</th><td>${esc(rawData.lotNo)}</td></tr>
      <tr><th>시험일자</th><td>${esc(rawData.testDate)}</td></tr>
      <tr><th>사용 분석장비</th><td>${esc(rawData.equipment)}</td></tr>
      <tr><th>규격 및 방법</th><td>${esc(rawData.testMethod)}</td></tr>
      <tr><th>허용 규격</th><td>${esc(rawData.acceptanceCriteria)} ${esc(rawData.resultUnit)} 이하</td></tr>
      <tr><th>측정 결과값</th><td>${esc(rawData.resultValue)} ${esc(rawData.resultUnit)}</td></tr>
      <tr><th>적격 여부</th><td>
        <span class="badge ${rawData.isPassed ? 'approved' : 'rejected'}">
          ${rawData.isPassed ? '적격(Pass)' : '부적합(Fail)'}
        </span>
      </td></tr>
      <tr><th>결재 상태</th><td><span class="badge ${rec.status.toLowerCase()}">${STATUS_LABEL[rec.status]}</span></td></tr>
    </table>
    
    ${historyHtml}
    
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-close-detail">닫기</button>
    </div>
  `;
  
  modal.open(content, () => {
    document.getElementById("btn-close-detail").onclick = modal.close;
  });
}

// --- 2.8 RECORD EDIT MODAL (REASON ENFORCED) ---
function showRecordEdit(id) {
  const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
  if (!rec) return;
  
  let rawData = {};
  try { rawData = JSON.parse(rec.dataJson); } catch(e){}
  
  const content = `
    <h3>시험 결과 데이터 수정</h3>
    <form id="edit-form">
      ${renderFormField("ed-product", "제품명", rawData.productName, true)}
      ${renderFormField("ed-lot", "Lot No", rawData.lotNo, true)}
      ${renderFormField("ed-date", "시험일자", rawData.testDate, true, "date")}
      ${renderFormField("ed-equip", "사용 분석장비", rawData.equipment, true)}
      ${renderFormField("ed-method", "시험 규격 및 방법", rawData.testMethod, true, "textarea")}
      ${renderFormField("ed-criteria", "적격 허용기준 (숫자)", rawData.acceptanceCriteria, true, "number")}
      ${renderFormField("ed-value", "시험 결과 측정값 (숫자)", rawData.resultValue, true, "number")}
      ${renderFormField("ed-unit", "결과값 단위", rawData.resultUnit, true)}
      
      <div class="form-row" data-field="ed-reason">
        <label class="req" style="color:var(--color-danger)">기록 수정 사유</label>
        <div>
          <input id="ed-reason" type="text" placeholder="이 데이터를 수정하는 합당한 사유를 5자 이상 입력하세요." class="form-control">
          <div class="field-error" id="ed-reason-error" style="display:none;"></div>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-close-edit">취소</button>
        <button type="submit" class="btn btn-primary">수정사항 저장</button>
      </div>
    </form>
  `;
  
  modal.open(content, () => {
    document.getElementById("btn-close-edit").onclick = modal.close;
    
    document.getElementById("edit-form").onsubmit = e => {
      e.preventDefault();
      
      const reason = document.getElementById("ed-reason").value.trim();
      const err = document.getElementById("ed-reason-error");
      err.style.display = "none";
      
      if (!reason || reason.length < 5) {
        err.textContent = "수정 사유는 최소 5자 이상이어야 합니다. (ALCOA+ 변경 통제 준수)";
        err.style.display = "block";
        return;
      }
      
      const fields = [
        { id: "ed-product", key: "productName" },
        { id: "ed-lot", key: "lotNo" },
        { id: "ed-date", key: "testDate" },
        { id: "ed-equip", key: "equipment" },
        { id: "ed-method", key: "testMethod" },
        { id: "ed-criteria", key: "acceptanceCriteria", num: true },
        { id: "ed-value", key: "resultValue", num: true },
        { id: "ed-unit", key: "resultUnit" }
      ];
      
      const updatedData = {};
      fields.forEach(f => {
        const val = document.getElementById(f.id).value.trim();
        updatedData[f.key] = f.num ? Number(val) : val;
      });
      
      updatedData.isPassed = updatedData.resultValue <= updatedData.acceptanceCriteria;
      
      const beforeString = JSON.stringify(rawData);
      const afterString = JSON.stringify(updatedData);
      
      const user = authHelper.getCurrentUser();
      
      rec.dataJson = afterString;
      sheetAdapter.saveRecord(SYSTEM_KEY, rec);
      
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "DATA",
        userId: user.userId,
        action: "UPDATE_DATA",
        targetId: id,
        beforeValue: beforeString,
        afterValue: afterString,
        reason: reason
      });
      
      toast.show("성공적으로 변경 사항이 기록 및 동기화되었습니다.", "ok");
      modal.close();
      window.location.reload();
    };
  });
}

// --- 2.9 APPROVAL / REJECT MODAL (e-Signature) ---
function showApprovalModal(id, isApprove) {
  const user = authHelper.getCurrentUser();
  const title = isApprove ? "시험성적서 승인 전자서명" : "시험성적 반려 사유 입력";
  
  const content = `
    <h3>${title}</h3>
    <form id="approval-form">
      ${isApprove ? `
        <div class="kpbma-notice-box" style="margin-bottom:14px; padding: 10px 14px;">
          <span class="icon">🔒</span>
          <div class="content" style="font-size:12px;">
            <b>21 CFR Part 11 전자서명 준수고지</b><br>
            성적서 승인 시 서명자 본인의 비밀번호 재확인이 필수입니다.
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 100px 1fr; margin-bottom:12px;">
          <label>서명자</label>
          <input type="text" value="${esc(user.name)}" readonly style="background:#eee;">
        </div>
        <div class="form-row" style="grid-template-columns: 100px 1fr; margin-bottom:16px;">
          <label class="req">비밀번호 확인</label>
          <input type="text" style="-webkit-text-security: disc;" autocomplete="off" id="ap-password" placeholder="비밀번호 입력">
          <div class="field-error" id="ap-password-error" style="display:none;"></div>
        </div>
      ` : `
        <div class="form-row" style="grid-template-columns: 100px 1fr; margin-bottom:16px;">
          <label class="req">반려 사유</label>
          <input type="text" id="ap-reason" placeholder="반려 사유를 5자 이상 입력하세요.">
          <div class="field-error" id="ap-reason-error" style="display:none;"></div>
        </div>
      `}
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-close-ap">취소</button>
        <button type="submit" class="btn btn-primary">${isApprove ? "승인 날인" : "반려 처리"}</button>
      </div>
    </form>
  `;
  
  modal.open(content, () => {
    document.getElementById("btn-close-ap").onclick = modal.close;
    
    document.getElementById("approval-form").onsubmit = e => {
      e.preventDefault();
      const records = sheetAdapter.getRecords(SYSTEM_KEY);
      const rec = records.find(r => r.id === id);
      
      if (isApprove) {
        const pwd = document.getElementById("ap-password").value;
        const err = document.getElementById("ap-password-error");
        err.style.display = "none";
        
        // Match user pass
        const users = sheetAdapter.getUsers();
        const me = users.find(u => u.userId === user.userId);
        
        if (me.password !== pwd) {
          err.textContent = "비밀번호가 올바르지 않습니다.";
          err.style.display = "block";
          return;
        }
        
        rec.status = STATUS.APPROVED;
        rec.docNumber = generateDocNumber(); // Issue official document sequence
        rec.updatedUser = user.userId;
        rec.updatedAt = new Date().toISOString();
        
        sheetAdapter.saveRecord(SYSTEM_KEY, rec);
        sheetAdapter.saveAuditLog(SYSTEM_KEY, {
          category: "DATA",
          userId: user.userId,
          action: "APPROVE_RECORD",
          targetId: id,
          reason: "시험성적 최종 검증 및 전자서명 승인"
        });
        
        toast.show("성공적으로 승인 서명이 날인되었습니다.", "ok");
      } else {
        const reason = document.getElementById("ap-reason").value.trim();
        const err = document.getElementById("ap-reason-error");
        err.style.display = "none";
        
        if (!reason || reason.length < 5) {
          err.textContent = "반려 사유를 5자 이상 기입하세요.";
          err.style.display = "block";
          return;
        }
        
        rec.status = STATUS.REJECTED;
        rec.updatedUser = user.userId;
        rec.updatedAt = new Date().toISOString();
        
        sheetAdapter.saveRecord(SYSTEM_KEY, rec);
        sheetAdapter.saveAuditLog(SYSTEM_KEY, {
          category: "DATA",
          userId: user.userId,
          action: "REJECT_RECORD",
          targetId: id,
          reason: `성적서 반려: ${reason}`
        });
        
        toast.show("레코드가 반려 처리되었습니다.", "warn");
      }
      
      modal.close();
      window.location.reload();
    };
  });
}

// --- 2.10 PRINT COA WINDOW ---
function showPrintWindow(id) {
  const user = authHelper.getCurrentUser();
  const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
  if (!rec) return;
  
  let rawData = {};
  try { rawData = JSON.parse(rec.dataJson); } catch(e){}
  
  // Track print action into Audit Trail
  rec.status = STATUS.PRINTED;
  sheetAdapter.saveRecord(SYSTEM_KEY, rec);
  
  sheetAdapter.saveAuditLog(SYSTEM_KEY, {
    category: "DATA",
    userId: user.userId,
    action: "PRINT_COA",
    targetId: rec.id,
    reason: `성적서 공식 사본 인쇄 (문서번호: ${rec.docNumber})`
  });
  
  const printContent = `
    <div class="coa-printable">
      <h1>CERTIFICATE OF ANALYSIS</h1>
      <div class="coa-sub">품질 검사 시험 성적서</div>
      
      <table class="doc-table">
        <tr><th>성적서 번호</th><td>${esc(rec.docNumber)}</td><th>lot 번호</th><td>${esc(rawData.lotNo)}</td></tr>
        <tr><th>제 품 명</th><td>${esc(rawData.productName)}</td><th>시험 일자</th><td>${esc(rawData.testDate)}</td></tr>
        <tr><th>사용 분석기기</th><td colspan="3">${esc(rawData.equipment)}</td></tr>
        <tr><th>시험 기준/규격</th><td colspan="3">${esc(rawData.testMethod)}</td></tr>
        <tr><th>판정 허용기준</th><td colspan="3">${esc(rawData.acceptanceCriteria)} ${esc(rawData.resultUnit)} 이하</td></tr>
        <tr><th>시험 측정결과</th><td colspan="3"><b>${esc(rawData.resultValue)} ${esc(rawData.resultUnit)}</b></td></tr>
        <tr><th>품질 판정결과</th><td colspan="3">
          <span style="font-size:16px; font-weight:800; color:${rawData.isPassed ? '#065F46' : '#991B1B'}">
            ${rawData.isPassed ? '적격 (PASS)' : '부적합 (FAIL)'}
          </span>
        </td></tr>
      </table>
      
      <div class="stamp-row">
        <div class="stamp">
          <div class="ttl">PREPARED BY (시험자)</div>
          <div class="body">
            ID: ${esc(rec.createdUser)}<br>
            일시: ${formatKst(rec.createdAt)}
          </div>
        </div>
        <div class="stamp">
          <div class="ttl">APPROVED BY (승인자)</div>
          <div class="body">
            ID: ${esc(rec.approvedBy || user.userId)}<br>
            일시: ${formatKst(rec.approvedAt || new Date().toISOString())}
          </div>
        </div>
      </div>
      
      <div class="footer-note">
        본 성적서는 전자기록 서명 및 승인을 통해 공식적으로 검증 및 출력된 문서 사본입니다.<br>
        [출력자 ID: ${esc(user.userId)} | 출력 일시: ${formatKst()}]
      </div>
    </div>
  `;
  
  modal.open(`
    <div class="no-print">
      <h3>COA 시험성적서 인쇄 미리보기</h3>
      <p style="font-size:12px; margin-bottom:12px; color:var(--color-text-muted);">
        하단의 '인쇄하기' 버튼을 누르면 브라우저 인쇄 창이 실행되어 PDF 출력이나 용지 인쇄를 진행할 수 있습니다.
      </p>
    </div>
    ${printContent}
    <div class="form-actions no-print" style="margin-top:20px;">
      <button class="btn btn-secondary" id="btn-close-print">미리보기 닫기</button>
      <button class="btn btn-primary" id="btn-do-print">인쇄하기 (window.print)</button>
    </div>
  `, () => {
    document.getElementById("btn-close-print").onclick = () => {
      modal.close();
      window.location.reload();
    };
    document.getElementById("btn-do-print").onclick = () => {
      window.print();
    };
  });
}

// --- 2.11 USERS ADMINISTRATION VIEW (WITH ROLE MATRIX) ---
route("/users", () => {
  const users = sheetAdapter.getUsers();
  
  const trs = users.map(u => `
    <tr>
      <td><b>${esc(u.userId)}</b></td>
      <td>${esc(u.name)}</td>
      <td><span class="badge ${u.status === 'ACTIVE' ? 'approved' : 'rejected'}">${u.status}</span></td>
      <td><small>${esc(u.role_coa)}</small></td>
      <td><small>${esc(u.role_lm)}</small></td>
      <td><small>${esc(u.role_elb)}</small></td>
      <td><small>${esc(u.role_rim)}</small></td>
      <td><small>${esc(u.role_sem)}</small></td>
      <td><small>${esc(u.role_cvm)}</small></td>
      <td><button class="btn btn-secondary sm" data-user-edit="${u.userId}">권한 설정</button></td>
    </tr>
  `).join("");
  
  const html = `
    <h2 style="margin-bottom: 24px;">사용자 계정 및 역할 매트릭스 관리</h2>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <h2>GMP Suite 등록 사용자 목록</h2>
        <button class="btn btn-primary" id="btn-add-user">신규 사용자 등록</button>
      </div>
      <table class="list">
        <thead>
          <tr>
            <th>ID</th>
            <th>이름</th>
            <th>상태</th>
            <th>COA</th>
            <th>LM</th>
            <th>ELB</th>
            <th>RIM</th>
            <th>SEM</th>
            <th>CVM</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>
    </div>
  `;
  
  renderShell("#/users", html, () => {
    // Add user click handler
    document.getElementById("btn-add-user").onclick = () => {
      showUserEditModal(null);
    };
    
    // Edit user roles click handler
    document.querySelectorAll("[data-user-edit]").forEach(btn => {
      const uId = btn.getAttribute("data-user-edit");
      btn.onclick = () => {
        showUserEditModal(uId);
      };
    });
  });
}, [ROLES.ADMIN]);

function showUserEditModal(uId) {
  const users = sheetAdapter.getUsers();
  const targetUser = uId ? users.find(u => u.userId === uId) : {
    userId: "", password: "", name: "", status: "ACTIVE",
    role_coa: "NONE", role_lm: "NONE", role_elb: "NONE", role_rim: "NONE", role_sem: "NONE", role_cvm: "NONE"
  };
  
  const isEdit = !!uId;
  const adminUser = authHelper.getCurrentUser();
  
  const content = `
    <h3>${isEdit ? '계정 권한 매트릭스 변경' : '신규 사용자 계정 등록'}</h3>
    <form id="user-edit-form">
      <div class="form-row">
        <label class="req">사용자 ID</label>
        <input type="text" id="us-id" value="${esc(targetUser.userId)}" ${isEdit ? 'readonly style="background:#eee"' : ''} required>
      </div>
      <div class="form-row">
        <label class="req">이름</label>
        <input type="text" id="us-name" value="${esc(targetUser.name)}" required>
      </div>
      <div class="form-row">
        <label class="req">비밀번호</label>
        <input type="text" style="-webkit-text-security: disc;" autocomplete="off" id="us-pw" value="${esc(targetUser.password)}" required>
      </div>
      <div class="form-row">
        <label>활성 상태</label>
        <select id="us-status">
          <option value="ACTIVE" ${targetUser.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE (사용 가능)</option>
          <option value="DEACTIVATED" ${targetUser.status === 'DEACTIVATED' ? 'selected' : ''}>DEACTIVATED (접근 잠금)</option>
        </select>
      </div>
      
      <div style="margin-top:20px; border-top: 1px solid var(--color-border); padding-top:16px;">
        <h4 style="font-size:13px; color:var(--color-primary-dark); margin-bottom:12px;">GMP Suite 시스템별 업무 권한 설정 (RBAC)</h4>
        
        <div class="form-row" style="grid-template-columns: 140px 1fr; margin-bottom: 8px;">
          <label>COA 성적서 발행</label>
          <select id="role-coa">
            <option value="NONE" ${targetUser.role_coa === 'NONE' ? 'selected' : ''}>NONE (접근 불가)</option>
            <option value="TESTER" ${targetUser.role_coa === 'TESTER' ? 'selected' : ''}>TESTER (시험자)</option>
            <option value="APPROVER" ${targetUser.role_coa === 'APPROVER' ? 'selected' : ''}>APPROVER (승인권자)</option>
            <option value="ADMIN" ${targetUser.role_coa === 'ADMIN' ? 'selected' : ''}>ADMIN (환경/계정관리)</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 140px 1fr; margin-bottom: 8px;">
          <label>LM 교육 관리</label>
          <select id="role-lm">
            <option value="NONE" ${targetUser.role_lm === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="TRAINER" ${targetUser.role_lm === 'TRAINER' ? 'selected' : ''}>TRAINER (교육담당)</option>
            <option value="QA" ${targetUser.role_lm === 'QA' ? 'selected' : ''}>QA (승인권자)</option>
            <option value="ADMIN" ${targetUser.role_lm === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 140px 1fr; margin-bottom: 8px;">
          <label>ELB 전자로그북</label>
          <select id="role-elb">
            <option value="NONE" ${targetUser.role_elb === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="OPERATOR" ${targetUser.role_elb === 'OPERATOR' ? 'selected' : ''}>OPERATOR (기록자)</option>
            <option value="MANAGER" ${targetUser.role_elb === 'MANAGER' ? 'selected' : ''}>MANAGER (관리자)</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 140px 1fr; margin-bottom: 8px;">
          <label>RIM 시약 재고</label>
          <select id="role-rim">
            <option value="NONE" ${targetUser.role_rim === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="QC" ${targetUser.role_rim === 'QC' ? 'selected' : ''}>QC (분석원)</option>
            <option value="MANAGER" ${targetUser.role_rim === 'MANAGER' ? 'selected' : ''}>MANAGER (관리자)</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 140px 1fr; margin-bottom: 8px;">
          <label>SEM 공급업체 평가</label>
          <select id="role-sem">
            <option value="NONE" ${targetUser.role_sem === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="QA" ${targetUser.role_sem === 'QA' ? 'selected' : ''}>QA (평가자)</option>
            <option value="MANAGER" ${targetUser.role_sem === 'MANAGER' ? 'selected' : ''}>MANAGER (관리자)</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 140px 1fr; margin-bottom: 8px;">
          <label>CVM 세척 검증</label>
          <select id="role-cvm">
            <option value="NONE" ${targetUser.role_cvm === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="VAL" ${targetUser.role_cvm === 'VAL' ? 'selected' : ''}>VAL (밸리데이션담당)</option>
            <option value="QA" ${targetUser.role_cvm === 'QA' ? 'selected' : ''}>QA (승인권자)</option>
          </select>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-close-user-edit">취소</button>
        <button type="submit" class="btn btn-primary">계정 정보 저장</button>
      </div>
    </form>
  `;
  
  modal.open(content, () => {
    document.getElementById("btn-close-user-edit").onclick = modal.close;
    
    document.getElementById("user-edit-form").onsubmit = e => {
      e.preventDefault();
      
      const payload = {
        userId: document.getElementById("us-id").value.trim(),
        name: document.getElementById("us-name").value.trim(),
        password: document.getElementById("us-pw").value,
        status: document.getElementById("us-status").value,
        role_coa: document.getElementById("role-coa").value,
        role_lm: document.getElementById("role-lm").value,
        role_elb: document.getElementById("role-elb").value,
        role_rim: document.getElementById("role-rim").value,
        role_sem: document.getElementById("role-sem").value,
        role_cvm: document.getElementById("role-cvm").value
      };
      
      sheetAdapter.saveUser(payload);
      
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "SECURITY",
        userId: adminUser.userId,
        action: isEdit ? "UPDATE_USER" : "CREATE_USER",
        targetId: payload.userId,
        reason: isEdit ? `계정 권한 매트릭스 변경` : `새 사용자 계정 등록`
      });
      
      toast.show("성공적으로 계정 정보가 저장 및 동기화되었습니다.", "ok");
      modal.close();
      window.location.reload();
    };
  });
}

// --- 2.12 DUAL-TAB AUDIT TRAIL VIEW ---
route("/audit", () => {
  renderShell("#/audit", `
    <h2 style="margin-bottom: 24px;">시스템 감사추적 (Audit Trail)</h2>
    <div class="card">
      <div class="audit-tabs">
        <div class="audit-tab active" id="tab-security">시스템 & 보안 로그</div>
        <div class="audit-tab" id="tab-data">데이터 완전성 감사추적</div>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 id="audit-title" style="font-size:14px; color:var(--color-primary-dark);">시스템 접근제어 및 계정 관리 기록</h3>
        <button class="btn btn-secondary sm" id="btn-export-audit">감사 로그 CSV 내보내기</button>
      </div>
      
      <div id="audit-table-container">
        <!-- Dynamic Table gets injected here -->
      </div>
    </div>
  `, () => {
    let currentCategory = "SECURITY";
    
    const showLogs = () => {
      const logs = sheetAdapter.getAuditLogs(SYSTEM_KEY).filter(l => l.category === currentCategory)
        .sort((a,b) => b.timestamp.localeCompare(a.timestamp));
        
      const container = document.getElementById("audit-table-container");
      
      if (logs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:32px; color:var(--color-text-muted);">감사 로그가 없습니다.</div>`;
        return;
      }
      
      const trs = logs.map(l => `
        <tr>
          <td>${formatKst(l.timestamp)}</td>
          <td><b>${esc(l.userId)}</b></td>
          <td><span class="badge ${l.category === 'SECURITY' ? 'submitted' : 'approved'}">${esc(l.action)}</span></td>
          <td>${esc(l.targetId || "-")}</td>
          <td><small class="muted">${esc(l.beforeValue || "-")}</small></td>
          <td><small>${esc(l.afterValue || "-")}</small></td>
          <td>${esc(l.reason || "-")}</td>
        </tr>
      `).join("");
      
      container.innerHTML = `
        <table class="list" style="font-size:13px;">
          <thead>
            <tr>
              <th style="width:160px;">일시 (KST)</th>
              <th>행위자 ID</th>
              <th>액션</th>
              <th>대상 식별자</th>
              <th>변경 전 데이터</th>
              <th>변경 후 데이터</th>
              <th>사유/설명</th>
            </tr>
          </thead>
          <tbody>
            ${trs}
          </tbody>
        </table>
      `;
    };
    
    // Tab event bindings
    const tabSec = document.getElementById("tab-security");
    const tabData = document.getElementById("tab-data");
    const auditTitle = document.getElementById("audit-title");
    
    tabSec.onclick = () => {
      tabSec.classList.add("active");
      tabData.classList.remove("active");
      currentCategory = "SECURITY";
      auditTitle.textContent = "시스템 접근제어 및 계정 관리 기록";
      showLogs();
    };
    
    tabData.onclick = () => {
      tabData.classList.add("active");
      tabSec.classList.remove("active");
      currentCategory = "DATA";
      auditTitle.textContent = "시험 데이터 완전성 및 변경 이력 추적";
      showLogs();
    };
    
    // Export handler
    document.getElementById("btn-export-audit").onclick = () => {
      const logs = sheetAdapter.getAuditLogs(SYSTEM_KEY).filter(l => l.category === currentCategory);
      if (logs.length === 0) {
        toast.show("내보낼 감사 로그가 없습니다.", "warn");
        return;
      }
      
      const csvHeaders = "Timestamp,User ID,Action,Target ID,Before Value,After Value,Reason\n";
      const csvRows = logs.map(l => [
        formatKst(l.timestamp),
        `"${l.userId}"`,
        `"${l.action}"`,
        `"${l.targetId || ''}"`,
        `"${(l.beforeValue || '').replace(/"/g, '""')}"`,
        `"${(l.afterValue || '').replace(/"/g, '""')}"`,
        `"${(l.reason || '').replace(/"/g, '""')}"`
      ].join(",")).join("\n");
      
      const blob = new Blob(["\uFEFF" + csvHeaders + csvRows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AuditTrail_${SYSTEM_KEY}_${currentCategory}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Track Export Action in Security Audit Trail
      const user = authHelper.getCurrentUser();
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "SECURITY",
        userId: user.userId,
        action: "EXPORT_AUDIT_LOGS",
        targetId: `${SYSTEM_KEY}_${currentCategory}`,
        reason: `감사 로그 파일 다운로드 수행 (Category: ${currentCategory})`
      });
    };
    
    showLogs();
  });
}, [ROLES.ADMIN]);

// --- 2.13 ENVIRONMENTAL SETTINGS VIEW (WITH DATABASE RESET) ---
route("/settings", () => {
  renderShell("#/settings", `
    <h2 style="margin-bottom: 24px;">시스템 환경 설정</h2>
    <div class="card">
      <h2>글로벌 GMP 설정</h2>
      <div class="form-row">
        <label>회사/연구소명</label>
        <input type="text" value="㈜갬프연구소" readonly style="background:#eee;">
      </div>
      <div class="form-row">
        <label>자동 세션 타임아웃</label>
        <input type="text" value="10 분 (사용 무반응 감시)" readonly style="background:#eee;">
      </div>
    </div>
    
    <div class="card" style="border-color: var(--color-danger)">
      <h2 style="color:var(--color-danger)">위험 통제 - 데모 초기화 관리</h2>
      <p style="font-size:12.5px; color:var(--color-text-muted); margin-bottom:16px;">
        교육 시연 중 계정이 꼬이거나 데이터가 지저분해졌을 때, 아래 리셋 버튼을 통해 구글 시트 원본 DB를 
        최초 시드시 설정한 3개의 권한 테스트 계정과 깨끗한 환경으로 즉시 복구할 수 있습니다.
      </p>
      <button class="btn btn-danger" id="btn-reset-db">Google Sheets DB 공장 초기화 실행</button>
    </div>
  `, () => {
    document.getElementById("btn-reset-db").onclick = () => {
      if (confirm("🚨 경고: 이 작업을 실행하면 구글 시트에 저장된 모든 시험 기록과 새로 생성된 계정 정보, 감사추적(Audit Trail) 이력이 전부 영구적으로 클리어되고 기본 테스트 계정 3개만 남게 됩니다. 초기화를 실행하시겠습니까?")) {
        toast.show("구글 시트 데이터베이스 초기화 처리 중...", "info");
        sheetAdapter.resetDatabase();
      }
    };
  });
}, [ROLES.ADMIN]);

/* =========================================================================
 * 3) 라우팅 핸들러 및 앱 진입점
 * ========================================================================= */
function resolveRoute() {
  const hash = window.location.hash.replace(/^#/, "") || "/login";
  
  if (hash === "/login") {
    if (authHelper.isLoggedIn()) {
      navigate("/dashboard");
    } else {
      routes["/login"].fn();
    }
    return;
  }
  
  // Guard Check
  if (!authHelper.isLoggedIn()) {
    navigate("/login");
    return;
  }
  
  // Resolve parametric pattern
  let matched = null;
  let params = {};
  
  Object.keys(routes).forEach(pattern => {
    if (matched) return;
    const rx = new RegExp("^" + pattern.replace(/:[a-zA-Z]+/g, "([^/]+)") + "$");
    const m = hash.match(rx);
    if (m) {
      matched = routes[pattern];
      const keys = (pattern.match(/:[a-zA-Z]+/g) || []).map(k => k.slice(1));
      keys.forEach((k, idx) => { params[k] = m[idx + 1]; });
    }
  });
  
  if (!matched) {
    navigate("/dashboard");
    return;
  }
  
  // Guard access control based on user role
  if (matched.roles) {
    const role = authHelper.getUserRole(SYSTEM_KEY);
    if (!matched.roles.includes(role)) {
      toast.show("이 페이지에 접근할 수 있는 권한이 없습니다.", "warn");
      navigate("/dashboard");
      return;
    }
  }
  
  matched.fn(params);
}

// Initial initialization process
window.addEventListener("hashchange", resolveRoute);

document.addEventListener("DOMContentLoaded", async () => {
  // Pull database state from google sheet during startup
  await sheetAdapter.init();
  
  // Start router resolution
  resolveRoute();
});
