import { sheetAdapter } from "../shared/js/sheetAdapter.js";
import { authHelper } from "../shared/js/authHelper.js";

const SYSTEM_KEY = "COA";
const STATUS = { DRAFT: "DRAFT", SUBMITTED: "SUBMITTED", APPROVED: "APPROVED", REJECTED: "REJECTED", PRINTED: "PRINTED" };
const STATUS_LABEL = { DRAFT: "작성중", SUBMITTED: "승인대기", APPROVED: "승인완료", REJECTED: "반려", PRINTED: "출력완료" };

function generateDocNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateKey = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  
  const seqKey = "gxp_suite:seq:coa";
  let seq = JSON.parse(localStorage.getItem(seqKey) || "{}");
  if (seq.date !== dateKey) {
    seq = { date: dateKey, val: 0 };
  }
  seq.val += 1;
  localStorage.setItem(seqKey, JSON.stringify(seq));
  
  return `COA-${dateKey}-${String(seq.val).padStart(3, "0")}`;
}

export const coaModule = {
  systemKey: SYSTEM_KEY,
  systemName: "[COA] 시험성적서 발행",
  
  getSidebarMenus(role) {
    const menus = [
      { href: "#/coa/dashboard", label: "대시보드" }
    ];
    if (role === "TESTER" || role === "ADMIN") {
      menus.push({ href: "#/coa/new", label: "결과 입력" });
      menus.push({ href: "#/coa/mine", label: "내 작성건" });
    }
    if (role === "APPROVER" || role === "ADMIN") {
      menus.push({ href: "#/coa/approvals", label: "승인 대기" });
    }
    if (role === "APPROVER" || role === "ADMIN" || role === "TESTER") {
      menus.push({ href: "#/coa/print", label: "COA 출력" });
    }
    menus.push({ href: "#/coa/audit", label: "감사추적" });
    return menus;
  },

  handleRoute(subRoute, container) {
    if (subRoute === "dashboard" || subRoute === "") {
      this.renderDashboard(container);
    } else if (subRoute === "new") {
      this.renderNewForm(container);
    } else if (subRoute === "mine") {
      this.renderMine(container);
    } else if (subRoute === "approvals") {
      this.renderApprovals(container);
    } else if (subRoute === "print") {
      this.renderPrintList(container);
    } else if (subRoute === "audit") {
      this.renderAudit(container);
    } else {
      container.innerHTML = `<h3>알 수 없는 경로입니다.</h3>`;
    }
  },

  renderDashboard(container) {
    const role = authHelper.getUserRole(SYSTEM_KEY);
    const records = sheetAdapter.getRecords(SYSTEM_KEY);
    
    const drafts = records.filter(r => r.status === STATUS.DRAFT).length;
    const submitted = records.filter(r => r.status === STATUS.SUBMITTED).length;
    const approved = records.filter(r => r.status === STATUS.APPROVED || r.status === STATUS.PRINTED).length;
    const rejected = records.filter(r => r.status === STATUS.REJECTED).length;
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">${this.systemName} 대시보드</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">시험 결과 분석성적서(COA) 등록 및 결재 라이프사이클을 통제합니다.</p>
      </div>
      
      <div class="card">
        <h2>성적서 결재 프로세스 모니터링</h2>
        <div class="grid cols-4">
          <div class="kpi">
            <div class="label">작성중 (DRAFT)</div>
            <div class="value">${drafts}</div>
          </div>
          <div class="kpi">
            <div class="label">검토/승인 대기</div>
            <div class="value" style="color:var(--color-warning);">${submitted}</div>
          </div>
          <div class="kpi">
            <div class="label">승인 완료</div>
            <div class="value" style="color:var(--color-success);">${approved}</div>
          </div>
          <div class="kpi">
            <div class="label">반려 처리</div>
            <div class="value" style="color:var(--color-danger);">${rejected}</div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h2>역할별 바로가기</h2>
        <div style="display:flex; gap:12px;">
          ${role === "TESTER" || role === "ADMIN" ? `
            <a href="#/coa/new" class="btn btn-primary">시험 결과 신규 입력</a>
            <a href="#/coa/mine" class="btn btn-secondary">내 성적 기록서 관리</a>
          ` : ""}
          ${role === "APPROVER" || role === "ADMIN" ? `
            <a href="#/coa/approvals" class="btn btn-primary">승인 서명 대기건 검토</a>
            <a href="#/coa/print" class="btn btn-secondary">성적서 인쇄 및 배포</a>
          ` : ""}
        </div>
      </div>
    `;
  },

  renderNewForm(container) {
    const products = sheetAdapter.getMasterData("PRODUCT");
    const equipments = sheetAdapter.getMasterData("EQUIPMENT");

    container.innerHTML = `
      <h2 style="margin-bottom:24px; color:var(--color-primary-dark);">시험 결과 신규 입력</h2>
      <div class="card">
        <h2>성적 입력 (임시저장 DRAFT 상태로 생성됩니다)</h2>
        <form id="coa-form">
          <div class="form-row">
            <label class="req">제품명</label>
            <select id="coa-product" required>
              <option value="">-- 제품 선택 --</option>
              ${products.map(m => `<option value="${window.esc(m.name)}">${window.esc(m.name)}</option>`).join("")}
            </select>
          </div>
          <div class="form-row">
            <label class="req">Lot Number</label>
            <input id="coa-lot" required placeholder="예: LOT-2026-A01">
          </div>
          <div class="form-row">
            <label class="req">시험 일자</label>
            <input type="date" id="coa-date" required>
          </div>
          <div class="form-row">
            <label class="req">사용 분석 기기</label>
            <select id="coa-equip" required>
              <option value="">-- 기기 선택 --</option>
              ${equipments.map(m => `<option value="${window.esc(m.name)}">${window.esc(m.name)}</option>`).join("")}
            </select>
          </div>
          <div class="form-row">
            <label class="req">시험 규격 및 방법</label>
            <textarea id="coa-method" rows="3" required placeholder="USP-NF / EP / KHP 등 시험 기준 서술"></textarea>
          </div>
          <div class="form-row">
            <label class="req">적격 허용기준 (상한값)</label>
            <div>
              <input type="number" step="any" id="coa-criteria" required style="width:200px;">
              <small style="color:var(--color-text-muted); margin-left:10px;">* 입력된 기준 이하값일 때 '적격' 판정됩니다.</small>
            </div>
          </div>
          <div class="form-row">
            <label class="req">측정 결과값</label>
            <input type="number" step="any" id="coa-value" required style="width:200px;">
          </div>
          <div class="form-row">
            <label class="req">측정값 단위</label>
            <input id="coa-unit" required value="mg" style="width:120px;">
          </div>
          <div class="form-row">
            <label>시험 기록자</label>
            <input value="${window.esc(authHelper.getCurrentUser().name)} (${window.esc(authHelper.getCurrentUser().userId)})" readonly style="background:#eee;">
          </div>
          
          <div class="form-actions">
            <a href="#/coa/dashboard" class="btn btn-secondary">취소</a>
            <button type="submit" class="btn btn-primary" id="btn-submit-coa">성적 기록서 저장</button>
          </div>
        </form>
      </div>
    `;
    
    // Set default date
    document.getElementById("coa-date").value = new Date().toISOString().split("T")[0];
    
    document.getElementById("coa-form").onsubmit = e => {
      e.preventDefault();
      
      const user = authHelper.getCurrentUser();
      
      const criteria = parseFloat(document.getElementById("coa-criteria").value);
      const val = parseFloat(document.getElementById("coa-value").value);
      const isPassed = val <= criteria;
      
      const payload = {
        productName: document.getElementById("coa-product").value,
        lotNo: document.getElementById("coa-lot").value.trim(),
        testDate: document.getElementById("coa-date").value,
        equipment: document.getElementById("coa-equip").value,
        testMethod: document.getElementById("coa-method").value.trim(),
        acceptanceCriteria: criteria,
        resultValue: val,
        resultUnit: document.getElementById("coa-unit").value.trim(),
        isPassed
      };
      
      const id = `rec-coa-${Date.now()}`;
      
      sheetAdapter.saveRecord(SYSTEM_KEY, {
        id,
        docNumber: "", // Not approved yet
        status: STATUS.DRAFT,
        dataJson: JSON.stringify(payload),
        isDeleted: false,
        createdUser: user.userId,
        createdAt: new Date().toISOString()
      });
      
      // Log Data audit trail
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "DATA",
        userId: user.userId,
        action: "CREATE_RECORD",
        targetId: id,
        afterValue: payload,
        reason: "시험성적 신규 DRAFT 등록"
      });
      
      window.toast.show("시험 결과가 임시저장되었습니다.", "ok");
      window.location.hash = "#/coa/mine";
    };
  },

  renderMine(container) {
    const user = authHelper.getCurrentUser();
    const records = (user.userId === 'admin')
      ? sheetAdapter.getRecords(SYSTEM_KEY)
      : sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.createdUser === user.userId);
    
    this.renderRecordsTable(container, records, "mine");
  },

  renderApprovals(container) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.status === STATUS.SUBMITTED);
    
    this.renderRecordsTable(container, records, "approvals");
  },

  renderPrintList(container) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.status === STATUS.APPROVED || r.status === STATUS.PRINTED);
    
    this.renderRecordsTable(container, records, "print");
  },

  renderRecordsTable(container, records, viewType) {
    let titleText = "내 작성 시험성적 데이터";
    let subText = "DRAFT 및 결재 진행 상태의 기록 목록입니다.";
    if (viewType === "approvals") {
      titleText = "검토 및 승인 서명 대기 목록";
      subText = "시험자가 결재 요청한 원데이터 목록입니다. 신중하게 대조 검증한 후 서명하십시오.";
    } else if (viewType === "print") {
      titleText = "COA 성적서 인쇄 출력";
      subText = "최종 승인 서명이 완료된 정식 성적서 인쇄 목록입니다.";
    }
    
    const trs = records.map(r => {
      let data = {};
      try { data = JSON.parse(r.dataJson); } catch (e) { }
      
      let actionHtml = "";
      if (viewType === "mine") {
        if (r.status === STATUS.DRAFT || r.status === STATUS.REJECTED) {
          actionHtml += `
            <button class="btn btn-secondary sm" data-btn-edit="${r.id}" style="padding:4px 8px; font-size:12px;">수정</button>
            <button class="btn btn-primary sm" data-btn-submit="${r.id}" style="padding:4px 8px; font-size:12px;">결재요청</button>
            <button class="btn btn-danger sm" data-btn-delete="${r.id}" style="padding:4px 8px; font-size:12px;">삭제</button>
          `;
        } else {
          actionHtml += `<span style="font-size:12px; color:var(--color-text-muted);">수정 불가 (잠금)</span>`;
        }
      } else if (viewType === "approvals") {
        actionHtml += `
          <button class="btn btn-primary sm" data-btn-approve="${r.id}" style="padding:4px 8px; font-size:12px;">승인날인</button>
          <button class="btn btn-danger sm" data-btn-reject="${r.id}" style="padding:4px 8px; font-size:12px;">반려</button>
        `;
      } else if (viewType === "print") {
        actionHtml += `
          <button class="btn btn-primary sm" data-btn-print="${r.id}" style="padding:4px 8px; font-size:12px;">성적서 인쇄 미리보기</button>
        `;
      }
      
      return `
        <tr>
          <td><b>${window.esc(r.docNumber || "미발행")}</b></td>
          <td>${window.esc(data.productName)}</td>
          <td>${window.esc(data.lotNo)}</td>
          <td>${window.esc(data.testDate)}</td>
          <td>${window.esc(data.resultValue)} / ${window.esc(data.acceptanceCriteria)} ${window.esc(data.resultUnit)}</td>
          <td>
            <span class="badge ${data.isPassed ? 'approved' : 'rejected'}">
              ${data.isPassed ? '적격' : '부적합'}
            </span>
          </td>
          <td><span class="badge ${r.status.toLowerCase()}">${STATUS_LABEL[r.status]}</span></td>
          <td>${window.esc(r.createdUser)}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join("");
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">${titleText}</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">${subText}</p>
      </div>
      
      <div class="card">
        <table class="list">
          <thead>
            <tr>
              <th>성적서 번호</th>
              <th>제품명</th>
              <th>Lot No</th>
              <th>시험일자</th>
              <th>측정치 / 규격</th>
              <th>판정</th>
              <th>결재상태</th>
              <th>기록자</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--color-text-muted);">조회 대상 레코드가 없습니다.</td></tr>` : trs}
          </tbody>
        </table>
      </div>
    `;
    
    // Bind actions
    container.querySelectorAll("[data-btn-edit]").forEach(btn => {
      const id = btn.getAttribute("data-btn-edit");
      btn.onclick = () => this.showEditModal(id);
    });
    
    container.querySelectorAll("[data-btn-submit]").forEach(btn => {
      const id = btn.getAttribute("data-btn-submit");
      btn.onclick = () => {
        if (confirm("이 기록을 제출하고 승인을 요청합니까? 제출 후 수정은 잠금 해제 전까지 불가합니다.")) {
          const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
          rec.status = STATUS.SUBMITTED;
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: authHelper.getCurrentUser().userId,
            action: "SUBMIT_RECORD",
            targetId: id,
            reason: "결재라인 승인요청 제출"
          });
          
          window.toast.show("승인대기 상태로 제출되었습니다.", "ok");
          this.handleRoute(viewType, container);
        }
      };
    });
    
    container.querySelectorAll("[data-btn-delete]").forEach(btn => {
      const id = btn.getAttribute("data-btn-delete");
      btn.onclick = () => {
        this.showSoftDeleteModal(id, () => this.handleRoute(viewType, container));
      };
    });
    
    container.querySelectorAll("[data-btn-approve]").forEach(btn => {
      const id = btn.getAttribute("data-btn-approve");
      btn.onclick = () => this.showSignatureModal(id, true, () => this.handleRoute(viewType, container));
    });
    
    container.querySelectorAll("[data-btn-reject]").forEach(btn => {
      const id = btn.getAttribute("data-btn-reject");
      btn.onclick = () => this.showSignatureModal(id, false, () => this.handleRoute(viewType, container));
    });
    
    container.querySelectorAll("[data-btn-print]").forEach(btn => {
      const id = btn.getAttribute("data-btn-print");
      btn.onclick = () => this.showPrintPreview(id);
    });
  },

  showEditModal(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch (e) { }
    
    const content = `
      <h3>시험 성적서 기록 수정</h3>
      <form id="coa-edit-form">
        <div class="form-row">
          <label class="req">제품명</label>
          <select id="edit-product" required>
            ${sheetAdapter.getMasterData("PRODUCT").map(m => `<option value="${window.esc(m.name)}" ${m.name === data.productName ? 'selected' : ''}>${window.esc(m.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <label class="req">Lot No</label>
          <input id="edit-lot" value="${window.esc(data.lotNo)}" required>
        </div>
        <div class="form-row">
          <label class="req">시험 일자</label>
          <input type="date" id="edit-date" value="${window.esc(data.testDate)}" required>
        </div>
        <div class="form-row">
          <label class="req">사용 기기</label>
          <select id="edit-equip" required>
            ${sheetAdapter.getMasterData("EQUIPMENT").map(m => `<option value="${window.esc(m.name)}" ${m.name === data.equipment ? 'selected' : ''}>${window.esc(m.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <label class="req">시험방법/규격</label>
          <textarea id="edit-method" rows="3" required>${window.esc(data.testMethod)}</textarea>
        </div>
        <div class="form-row">
          <label class="req">적격 상한기준</label>
          <input type="number" step="any" id="edit-criteria" value="${window.esc(data.acceptanceCriteria)}" required style="width:200px;">
        </div>
        <div class="form-row">
          <label class="req">결과 측정값</label>
          <input type="number" step="any" id="edit-value" value="${window.esc(data.resultValue)}" required style="width:200px;">
        </div>
        <div class="form-row">
          <label class="req">단위</label>
          <input id="edit-unit" value="${window.esc(data.resultUnit)}" required style="width:120px;">
        </div>
        
        <div class="form-row" style="background:#FFF5F5; padding:10px; border-radius:8px;">
          <label class="req" style="color:var(--color-danger)">수정 사유</label>
          <div>
            <input id="edit-reason" placeholder="수정 사유를 5자 이상 기입하십시오." required style="border-color:var(--color-danger);">
            <div id="edit-reason-error" class="field-error" style="display:none;">수정 사유는 5자 이상 입력해야 합니다.</div>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-edit-close">취소</button>
          <button type="submit" class="btn btn-primary">수정사항 저장</button>
        </div>
      </form>
    `;
    
    window.modal.open(content, () => {
      document.getElementById("btn-edit-close").onclick = window.modal.close;
      
      document.getElementById("coa-edit-form").onsubmit = e => {
        e.preventDefault();
        
        const reason = document.getElementById("edit-reason").value.trim();
        const err = document.getElementById("edit-reason-error");
        
        if (reason.length < 5) {
          err.style.display = "block";
          return;
        }
        
        const updated = {
          productName: document.getElementById("edit-product").value.trim(),
          lotNo: document.getElementById("edit-lot").value.trim(),
          testDate: document.getElementById("edit-date").value,
          equipment: document.getElementById("edit-equip").value.trim(),
          testMethod: document.getElementById("edit-method").value.trim(),
          acceptanceCriteria: parseFloat(document.getElementById("edit-criteria").value),
          resultValue: parseFloat(document.getElementById("edit-value").value),
          resultUnit: document.getElementById("edit-unit").value.trim()
        };
        
        updated.isPassed = updated.resultValue <= updated.acceptanceCriteria;
        
        const user = authHelper.getCurrentUser();
        
        const oldJson = rec.dataJson;
        rec.dataJson = JSON.stringify(updated);
        rec.status = STATUS.DRAFT; // Reset to draft
        rec.updatedUser = user.userId;
        rec.updatedAt = new Date().toISOString();
        
        sheetAdapter.saveRecord(SYSTEM_KEY, rec);
        
        sheetAdapter.saveAuditLog(SYSTEM_KEY, {
          category: "DATA",
          userId: user.userId,
          action: "UPDATE_DATA",
          targetId: id,
          beforeValue: oldJson,
          afterValue: rec.dataJson,
          reason: reason
        });
        
        window.toast.show("변경 사항이 기록되었습니다.", "ok");
        window.modal.close();
        
        // Refresh view
        this.handleRoute("mine", document.getElementById("content-viewport"));
      };
    });
  },

  showSoftDeleteModal(id, onSuccess) {
    const content = `
      <h3>⚠️ 성적서 기록 삭제 통제</h3>
      <p class="desc">
        이 레코드를 삭제하시겠습니까? 물리적 삭제는 불가능하며, soft delete(isDeleted=true) 처리됩니다.<br>
        삭제 행위 역시 감사추적의 대상이며, 사유 입력이 필수입니다.
      </p>
      <form id="delete-reason-form">
        <div class="form-row">
          <label class="req" style="color:var(--color-danger)">삭제 사유</label>
          <div>
            <input id="del-reason" placeholder="삭제 사유를 5자 이상 입력하세요." required>
            <div id="del-reason-error" class="field-error" style="display:none;">사유는 최소 5자 이상이어야 합니다.</div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-del-close">취소</button>
          <button type="submit" class="btn btn-danger">레코드 Soft-Delete</button>
        </div>
      </form>
    `;
    
    window.modal.open(content, () => {
      document.getElementById("btn-del-close").onclick = window.modal.close;
      
      document.getElementById("delete-reason-form").onsubmit = e => {
        e.preventDefault();
        const reason = document.getElementById("del-reason").value.trim();
        const err = document.getElementById("del-reason-error");
        
        if (reason.length < 5) {
          err.style.display = "block";
          return;
        }
        
        const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
        rec.isDeleted = true;
        
        const user = authHelper.getCurrentUser();
        sheetAdapter.saveRecord(SYSTEM_KEY, rec);
        
        sheetAdapter.saveAuditLog(SYSTEM_KEY, {
          category: "DATA",
          userId: user.userId,
          action: "DELETE_RECORD",
          targetId: id,
          beforeValue: rec.dataJson,
          afterValue: "isDeleted: true",
          reason: reason
        });
        
        window.toast.show("성공적으로 삭제 처리되었습니다.", "ok");
        window.modal.close();
        onSuccess();
      };
    });
  },

  showSignatureModal(id, isApprove, onSuccess) {
    const title = isApprove ? "COA 검토 승인 전자서명" : "성적 반려 사유 입력";
    const user = authHelper.getCurrentUser();
    
    const content = `
      <h3>${title}</h3>
      <form id="sig-form">
        ${isApprove ? `
          <div class="kpbma-notice-box" style="margin-bottom:12px; padding:10px;">
            <span class="icon">🔒</span>
            <div class="content" style="font-size:12px;">
              <b>21 CFR Part 11 전자서명 규정 준수 고지</b><br>
              본 승인 서명은 종이 서명과 법적으로 동일한 효력을 가지며 본인의 암호 확인이 필요합니다.
            </div>
          </div>
          <div class="form-row">
            <label>서명자명</label>
            <input value="${window.esc(user.name)}" readonly style="background:#eee;">
          </div>
          <div class="form-row">
            <label class="req">비밀번호 확인</label>
            <div>
              <input type="text" style="-webkit-text-security: disc;" autocomplete="off" id="sig-pw" required placeholder="암호 입력">
              <div id="sig-pw-error" class="field-error" style="display:none;">비밀번호가 올바르지 않습니다.</div>
            </div>
          </div>
        ` : `
          <div class="form-row">
            <label class="req" style="color:var(--color-danger)">반려 사유</label>
            <div>
              <input id="sig-reason" placeholder="반려 사유를 5자 이상 입력하세요." required>
              <div id="sig-reason-error" class="field-error" style="display:none;">사유는 최소 5자 이상이어야 합니다.</div>
            </div>
          </div>
        `}
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-sig-close">취소</button>
          <button type="submit" class="btn ${isApprove ? 'btn-primary' : 'btn-danger'}">${isApprove ? '승인 서명 날인' : '반려 처리'}</button>
        </div>
      </form>
    `;
    
    window.modal.open(content, () => {
      document.getElementById("btn-sig-close").onclick = window.modal.close;
      
      document.getElementById("sig-form").onsubmit = e => {
        e.preventDefault();
        
        const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
        
        if (isApprove) {
          const pw = document.getElementById("sig-pw").value;
          const err = document.getElementById("sig-pw-error");
          
          // Verify PW against sheetAdapter
          const users = sheetAdapter.getUsers();
          const me = users.find(u => u.userId === user.userId);
          
          if (String(me.password) !== String(pw)) {
            err.style.display = "block";
            return;
          }
          
          rec.status = STATUS.APPROVED;
          rec.docNumber = generateDocNumber();
          rec.approvedBy = user.userId;
          rec.approvedAt = new Date().toISOString();
          rec.updatedUser = user.userId;
          rec.updatedAt = rec.approvedAt;
          
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: user.userId,
            action: "APPROVE_RECORD",
            targetId: id,
            reason: "검토 확인 및 승인서 전자날인 완료"
          });
          
          window.toast.show("성공적으로 승인되었습니다.", "ok");
        } else {
          const reason = document.getElementById("sig-reason").value.trim();
          const err = document.getElementById("sig-reason-error");
          
          if (reason.length < 5) {
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
            reason: `성적서 결재 반려: ${reason}`
          });
          
          window.toast.show("성적서가 반려 처리되었습니다.", "warn");
        }
        
        window.modal.close();
        onSuccess();
      };
    });
  },

  showPrintPreview(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch (e) { }
    
    const user = authHelper.getCurrentUser();
    const companyName = JSON.parse(localStorage.getItem("gxp_suite:settings") || "[]")
      .find(s => s.key === "common:companyName")?.value || "㈜갬프연구소";
      
    // Update status to PRINTED and save audit log
    rec.status = STATUS.PRINTED;
    sheetAdapter.saveRecord(SYSTEM_KEY, rec);
    
    sheetAdapter.saveAuditLog(SYSTEM_KEY, {
      category: "DATA",
      userId: user.userId,
      action: "PRINT_COA",
      targetId: rec.id,
      reason: `성적서 공식 사본 인쇄 (문서번호: ${rec.docNumber})`
    });
    
    const printableHtml = `
      <div class="coa-printable">
        <h1 style="font-family:'Pretendard', sans-serif; font-size: 26px; font-weight: 800; letter-spacing: 0.1em; color: #000;">CERTIFICATE OF ANALYSIS</h1>
        <div class="coa-sub" style="text-transform:uppercase; font-size:12px; font-weight:700; margin-bottom:30px;">품질 분석 검사 시험 성적서</div>
        
        <table class="doc-table">
          <tr>
            <th>성적서 번호 (Doc No)</th>
            <td>${window.esc(rec.docNumber)}</td>
            <th>Lot 번호 (Lot No)</th>
            <td>${window.esc(data.lotNo)}</td>
          </tr>
          <tr>
            <th>제 품 명 (Product Name)</th>
            <td>${window.esc(data.productName)}</td>
            <th>시험 일자 (Test Date)</th>
            <td>${window.esc(data.testDate)}</td>
          </tr>
          <tr>
            <th>사용 분석기기 (Equipment)</th>
            <td colspan="3">${window.esc(data.equipment)}</td>
          </tr>
          <tr>
            <th>시험 기준/규격 (Method)</th>
            <td colspan="3">${window.esc(data.testMethod)}</td>
          </tr>
          <tr>
            <th>적격 허용기준 (Criteria)</th>
            <td colspan="3">${window.esc(data.acceptanceCriteria)} ${window.esc(data.resultUnit)} 이하</td>
          </tr>
          <tr>
            <th>측정 결과값 (Result Value)</th>
            <td colspan="3"><b>${window.esc(data.resultValue)} ${window.esc(data.resultUnit)}</b></td>
          </tr>
          <tr>
            <th>최종 품질판정 (Disposition)</th>
            <td colspan="3">
              <span style="font-size:16px; font-weight:800; color:${data.isPassed ? '#065F46' : '#991B1B'}">
                ${data.isPassed ? '적격 (PASS)' : '부적합 (FAIL)'}
              </span>
            </td>
          </tr>
        </table>
        
        <div class="stamp-row">
          <div class="stamp">
            <div class="ttl">PREPARED BY (시험 기록자)</div>
            <div class="body">
              ID: ${window.esc(rec.createdUser)}<br>
              서명일시: ${window.formatKst(rec.createdAt)}
            </div>
          </div>
          <div class="stamp">
            <div class="ttl">APPROVED BY (품질 승인자)</div>
            <div class="body">
              ID: ${window.esc(rec.approvedBy || user.userId)}<br>
              서명일시: ${window.formatKst(rec.approvedAt || rec.updatedAt)}
            </div>
          </div>
        </div>
        
        <div class="footer-note" style="margin-top:40px; text-align:center; font-size:11px; color:#666; border-top:1px dashed #aaa; padding-top:15px; line-height:1.6;">
          본 문서는 ${window.esc(companyName)}의 품질 보증 승인을 통해 전자서명 발행된 공식 성적서 사본입니다.<br>
          [출력 수행자 ID: ${window.esc(user.userId)} | 출력 일시: ${window.formatKst()}]
        </div>
      </div>
    `;
    
    window.modal.open(`
      <div class="no-print" style="margin-bottom: 20px;">
        <h3>성적서 인쇄 미리보기</h3>
        <p style="font-size:12px; color:var(--color-text-muted);">
          아래의 '출력하기' 버튼을 누르면 브라우저 인쇄 다이얼로그를 통해 PDF 저장 또는 물리 프린터 출력을 할 수 있습니다.
        </p>
      </div>
      <!-- Scrollable Wrapper for small viewport compatibility -->
      <div class="printable-scroll-wrap" style="max-height: 60vh; overflow: auto; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; margin-bottom: 15px;">
        ${printableHtml}
      </div>
      <div class="form-actions no-print">
        <button class="btn btn-secondary" id="btn-preview-close">닫기</button>
        <button class="btn btn-primary" id="btn-do-print">출력하기 (window.print)</button>
      </div>
    `, () => {
      // Enlarge modal dialog size specifically for print preview
      const modalEl = document.querySelector(".modal");
      if (modalEl) {
        modalEl.style.width = "880px";
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
        <p style="color:var(--color-text-muted); font-size:13px;">성적서 생성, 변경, 승인 서명 날인 등 데이터 수명주기에 관한 전체 완전성 이력입니다.</p>
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
export default coaModule;
