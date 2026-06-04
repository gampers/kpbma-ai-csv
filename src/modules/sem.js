import { sheetAdapter } from "../shared/js/sheetAdapter.js";
import { authHelper } from "../shared/js/authHelper.js";

const SYSTEM_KEY = "SEM";
const STATUS = { DRAFT: "DRAFT", SUBMITTED: "SUBMITTED", APPROVED: "APPROVED", REJECTED: "REJECTED" };
const STATUS_LABEL = { DRAFT: "작성중", SUBMITTED: "승인대기", APPROVED: "승인완료", REJECTED: "반려" };

function calculateGrade(avgScore) {
  if (avgScore >= 90) return "A";
  if (avgScore >= 80) return "B";
  if (avgScore >= 70) return "C";
  return "FAIL";
}

function generateSupplierDocNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateKey = `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
  
  const seqKey = "gxp_suite:seq:sem";
  let seq = JSON.parse(localStorage.getItem(seqKey) || "{}");
  if (seq.date !== dateKey) {
    seq = { date: dateKey, val: 0 };
  }
  seq.val += 1;
  localStorage.setItem(seqKey, JSON.stringify(seq));
  
  return `SUP-${dateKey}-${String(seq.val).padStart(3, "0")}`;
}

export const semModule = {
  systemKey: SYSTEM_KEY,
  systemName: "[SEM] 공급업체 평가",
  
  getSidebarMenus(role) {
    const menus = [
      { href: "#/sem/dashboard", label: "대시보드" }
    ];
    if (role === "QA" || role === "ADMIN") {
      menus.push({ href: "#/sem/new", label: "평가 결과 입력" });
      menus.push({ href: "#/sem/mine", label: "내 작성건" });
    }
    if (role === "MANAGER" || role === "ADMIN") {
      menus.push({ href: "#/sem/approvals", label: "승인 대기" });
    }
    menus.push({ href: "#/sem/asl", label: "적격공급업체(ASL)" });
    menus.push({ href: "#/sem/audit", label: "감사추적" });
    return menus;
  },

  handleRoute(subRoute, container) {
    if (subRoute === "dashboard" || subRoute === "") {
      this.renderDashboard(container);
    } else if (subRoute === "new") {
      this.renderNew(container);
    } else if (subRoute === "mine") {
      this.renderMine(container);
    } else if (subRoute === "approvals") {
      this.renderApprovals(container);
    } else if (subRoute === "asl") {
      this.renderAsl(container);
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
    const approved = records.filter(r => r.status === STATUS.APPROVED).length;
    
    // Count active suppliers in ASL (Approved & Grade A, B, or C)
    let aslCount = 0;
    records.forEach(r => {
      try {
        const d = JSON.parse(r.dataJson);
        if (r.status === STATUS.APPROVED && d.grade !== "FAIL") {
          aslCount++;
        }
      } catch(e){}
    });
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">${this.systemName} 대시보드</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">GMP 원부자재 및 시약 공급업체의 평가 등급 산정 및 ASL(적격공급업체목록) 적격성을 추적합니다.</p>
      </div>
      
      <div class="grid cols-3">
        <div class="kpi">
          <div class="label">임시저장 평가 건</div>
          <div class="value">${drafts} 건</div>
        </div>
        <div class="kpi">
          <div class="label">승인 대기 건</div>
          <div class="value" style="color:var(--color-warning);">${submitted} 건</div>
        </div>
        <div class="kpi">
          <div class="label">적격공급업체(ASL) 등록 수</div>
          <div class="value" style="color:var(--color-success);">${aslCount} 개소</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:24px;">
        <h2>공급업체 평가 워크플로우</h2>
        <div style="display:flex; gap:12px; margin-top:12px;">
          ${role === "QA" || role === "ADMIN" ? `
            <a href="#/sem/new" class="btn btn-primary">신규 평가 결과 입력</a>
            <a href="#/sem/mine" class="btn btn-secondary">내 작성 평가 카드 관리</a>
          ` : ""}
          ${role === "MANAGER" || role === "ADMIN" ? `
            <a href="#/sem/approvals" class="btn btn-primary">승인 검토 대기건</a>
          ` : ""}
          <a href="#/sem/asl" class="btn btn-secondary">적격공급업체(ASL) 대장</a>
        </div>
      </div>
    `;
  },

  renderNew(container) {
    container.innerHTML = `
      <h2 style="margin-bottom:24px; color:var(--color-primary-dark);">공급업체 평가 결과 입력</h2>
      <div class="card">
        <h2>공급업체 다항목 점수 입력</h2>
        
        <div id="sem-score-preview" class="kpbma-notice-box" style="display:none; background-color:var(--color-primary-soft); border-color:#0072CE; color:var(--color-primary-dark); margin-bottom:16px;">
          <span class="icon">📊</span>
          <div class="content" id="sem-score-preview-content"></div>
        </div>
        
        <form id="sem-form">
          <div class="form-row">
            <label class="req">공급업체명</label>
            <input id="sem-supplier" required placeholder="예: (주)한미화학">
          </div>
          <div class="form-row">
            <label class="req">평가 일자</label>
            <input type="date" id="sem-date" required>
          </div>
          <div class="form-row">
            <label class="req">품질 평가 점수 (0~100)</label>
            <input type="number" min="0" max="100" id="sem-q-score" required value="90" style="width:120px;">
          </div>
          <div class="form-row">
            <label class="req">납기 준수 점수 (0~100)</label>
            <input type="number" min="0" max="100" id="sem-d-score" required value="85" style="width:120px;">
          </div>
          <div class="form-row">
            <label class="req">가격 경쟁력 점수 (0~100)</label>
            <input type="number" min="0" max="100" id="sem-c-score" required value="80" style="width:120px;">
          </div>
          <div class="form-row">
            <label class="req">고객 서비스 점수 (0~100)</label>
            <input type="number" min="0" max="100" id="sem-s-score" required value="85" style="width:120px;">
          </div>
          
          <div class="form-actions">
            <a href="#/sem/mine" class="btn btn-secondary">취소</a>
            <button type="submit" class="btn btn-primary">DRAFT 평가 임시저장</button>
          </div>
        </form>
      </div>
    `;
    
    document.getElementById("sem-date").value = new Date().toISOString().split("T")[0];
    
    const qIn = document.getElementById("sem-q-score");
    const dIn = document.getElementById("sem-d-score");
    const cIn = document.getElementById("sem-c-score");
    const sIn = document.getElementById("sem-s-score");
    const previewBox = document.getElementById("sem-score-preview");
    const previewContent = document.getElementById("sem-score-preview-content");
    
    const updatePreview = () => {
      const q = parseFloat(qIn.value || 0);
      const d = parseFloat(dIn.value || 0);
      const c = parseFloat(cIn.value || 0);
      const s = parseFloat(sIn.value || 0);
      
      const avg = (q + d + c + s) / 4;
      const grade = calculateGrade(avg);
      
      let gradeText = "";
      let color = "var(--color-primary)";
      if (grade === "A") { gradeText = "우수 등급 (ASL 자동 등재 대상)"; color = "var(--color-success)"; }
      else if (grade === "B") { gradeText = "적합 등급 (ASL 자동 등재 대상)"; color = "var(--color-success)"; }
      else if (grade === "C") { gradeText = "조건부 적격 등급 (ASL 조건부 등재)"; color = "var(--color-warning)"; }
      else { gradeText = "부적격 등급 (ASL 등재 제외!)"; color = "var(--color-danger)"; }
      
      previewContent.innerHTML = `
        <b>실시간 계산 결과:</b> 평균 점수 <b>${avg.toFixed(1)}점</b> | 판정 등급 <span style="color:${color}; font-weight:800; font-size:16px;">${grade}</span> (${gradeText})
      `;
      previewBox.style.display = "flex";
    };
    
    qIn.oninput = updatePreview;
    dIn.oninput = updatePreview;
    cIn.oninput = updatePreview;
    sIn.oninput = updatePreview;
    updatePreview(); // Trigger initial
    
    document.getElementById("sem-form").onsubmit = e => {
      e.preventDefault();
      
      const payload = {
        supplierName: document.getElementById("sem-supplier").value.trim(),
        evalDate: document.getElementById("sem-date").value,
        qualityScore: parseFloat(qIn.value),
        deliveryScore: parseFloat(dIn.value),
        costScore: parseFloat(cIn.value),
        serviceScore: parseFloat(sIn.value)
      };
      
      payload.averageScore = (payload.qualityScore + payload.deliveryScore + payload.costScore + payload.serviceScore) / 4;
      payload.grade = calculateGrade(payload.averageScore);
      payload.aslStatus = payload.grade !== "FAIL" ? "PENDING" : "FAIL"; // Enrolled only upon manager approval
      
      const user = authHelper.getCurrentUser();
      const id = `rec-sem-${Date.now()}`;
      
      sheetAdapter.saveRecord(SYSTEM_KEY, {
        id,
        docNumber: "",
        status: STATUS.DRAFT,
        dataJson: JSON.stringify(payload),
        isDeleted: false,
        createdUser: user.userId,
        createdAt: new Date().toISOString()
      });
      
      sheetAdapter.saveAuditLog(SYSTEM_KEY, {
        category: "DATA",
        userId: user.userId,
        action: "CREATE_EVALUATION",
        targetId: id,
        afterValue: payload,
        reason: `공급업체 평가 신규 DRAFT 입력 (평가등급: ${payload.grade})`
      });
      
      window.toast.show("평가 기록이 임시저장되었습니다.", "ok");
      window.location.hash = "#/sem/mine";
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

  renderRecordsTable(container, records, viewType) {
    let titleText = "내 등록 공급업체 평가 내역";
    let subText = "DRAFT 및 결재 대기 중인 공급업체 평가 목록입니다.";
    if (viewType === "approvals") {
      titleText = "공급업체 평가 QA 승인 대기 목록";
      subText = "평가 등급 판정이 유효한지 확인하고 승인 서명을 날인합니다.";
    }
    
    const trs = records.map(r => {
      let data = {};
      try { data = JSON.parse(r.dataJson); } catch (e) { }
      
      let actionHtml = "";
      if (viewType === "mine") {
        if (r.status === STATUS.DRAFT || r.status === STATUS.REJECTED) {
          actionHtml += `
            <button class="btn btn-secondary sm" data-btn-edit="${r.id}" style="padding:4px 8px; font-size:12px;">수정</button>
            <button class="btn btn-primary sm" data-btn-submit="${r.id}" style="padding:4px 8px; font-size:12px;">승인요청</button>
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
      }
      
      return `
        <tr>
          <td><b>${window.esc(r.docNumber || "미발행")}</b></td>
          <td>${window.esc(data.supplierName)}</td>
          <td>${window.esc(data.evalDate)}</td>
          <td>Q: ${window.esc(data.qualityScore)} | D: ${window.esc(data.deliveryScore)} | C: ${window.esc(data.costScore)} | S: ${window.esc(data.serviceScore)}</td>
          <td><b>${window.esc(data.averageScore.toFixed(1))} 점</b></td>
          <td>
            <span class="badge ${data.grade === 'FAIL' ? 'rejected' : 'approved'}">
              등급 ${data.grade}
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
              <th>결재 번호</th>
              <th>공급업체명</th>
              <th>평가 일자</th>
              <th>평가 배점 (Q | D | C | S)</th>
              <th>평균 점수</th>
              <th>산정 등급</th>
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
        if (confirm("이 평가 내역의 승인을 요청하겠습니까?")) {
          const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
          rec.status = STATUS.SUBMITTED;
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: authHelper.getCurrentUser().userId,
            action: "SUBMIT_RECORD",
            targetId: id,
            reason: "공급업체 평가 결재 승인요청"
          });
          
          window.toast.show("승인 대기 상태로 이송되었습니다.", "ok");
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
  },

  showEditModal(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch (e){}
    
    const content = `
      <h3>공급업체 평가 기록 수정</h3>
      <form id="sem-edit-form">
        <div class="form-row">
          <label class="req">공급업체명</label>
          <input id="edit-supplier" value="${window.esc(data.supplierName)}" required>
        </div>
        <div class="form-row">
          <label class="req">평가 일자</label>
          <input type="date" id="edit-date" value="${window.esc(data.evalDate)}" required>
        </div>
        <div class="form-row">
          <label class="req">품질 점수 (0~100)</label>
          <input type="number" min="0" max="100" id="edit-q-score" value="${window.esc(data.qualityScore)}" required style="width:120px;">
        </div>
        <div class="form-row">
          <label class="req">납기 점수 (0~100)</label>
          <input type="number" min="0" max="100" id="edit-d-score" value="${window.esc(data.deliveryScore)}" required style="width:120px;">
        </div>
        <div class="form-row">
          <label class="req">가격 점수 (0~100)</label>
          <input type="number" min="0" max="100" id="edit-c-score" value="${window.esc(data.costScore)}" required style="width:120px;">
        </div>
        <div class="form-row">
          <label class="req">서비스 점수 (0~100)</label>
          <input type="number" min="0" max="100" id="edit-s-score" value="${window.esc(data.serviceScore)}" required style="width:120px;">
        </div>
        
        <div class="form-row" style="background:#FFF5F5; padding:10px; border-radius:8px;">
          <label class="req" style="color:var(--color-danger)">수정 사유</label>
          <div>
            <input id="edit-reason" placeholder="수정 사유를 5자 이상 기입하십시오." required>
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
      
      document.getElementById("sem-edit-form").onsubmit = e => {
        e.preventDefault();
        
        const reason = document.getElementById("edit-reason").value.trim();
        const err = document.getElementById("edit-reason-error");
        
        if (reason.length < 5) {
          err.style.display = "block";
          return;
        }
        
        const updated = {
          supplierName: document.getElementById("edit-supplier").value.trim(),
          evalDate: document.getElementById("edit-date").value,
          qualityScore: parseFloat(document.getElementById("edit-q-score").value),
          deliveryScore: parseFloat(document.getElementById("edit-d-score").value),
          costScore: parseFloat(document.getElementById("edit-c-score").value),
          serviceScore: parseFloat(document.getElementById("edit-s-score").value)
        };
        
        updated.averageScore = (updated.qualityScore + updated.deliveryScore + updated.costScore + updated.serviceScore) / 4;
        updated.grade = calculateGrade(updated.averageScore);
        updated.aslStatus = updated.grade !== "FAIL" ? "PENDING" : "FAIL";
        
        const user = authHelper.getCurrentUser();
        const oldJson = rec.dataJson;
        rec.dataJson = JSON.stringify(updated);
        rec.status = STATUS.DRAFT;
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
        
        window.toast.show("평가 정보가 성공적으로 수정되었습니다.", "ok");
        window.modal.close();
        this.handleRoute("mine", document.getElementById("content-viewport"));
      };
    });
  },

  showSoftDeleteModal(id, onSuccess) {
    const content = `
      <h3>⚠️ 공급업체 평가기록 삭제 통제</h3>
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
    const title = isApprove ? "평가 결과 최종 승인 전자서명" : "반려 사유 입력";
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
              <input type="password" id="sig-pw" required placeholder="암호 입력">
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
        let data = {};
        try { data = JSON.parse(rec.dataJson); } catch (e){}
        
        if (isApprove) {
          const pw = document.getElementById("sig-pw").value;
          const err = document.getElementById("sig-pw-error");
          
          const users = sheetAdapter.getUsers();
          const me = users.find(u => u.userId === user.userId);
          
          if (me.password !== pw) {
            err.style.display = "block";
            return;
          }
          
          rec.status = STATUS.APPROVED;
          rec.docNumber = generateSupplierDocNumber();
          
          // Enrolled to ASL if Grade is A, B or C
          if (data.grade !== "FAIL") {
            data.aslStatus = "ENROLLED";
          } else {
            data.aslStatus = "FAIL_NOT_ENROLLED";
          }
          
          rec.dataJson = JSON.stringify(data);
          rec.approvedBy = user.userId;
          rec.approvedAt = new Date().toISOString();
          rec.updatedUser = user.userId;
          rec.updatedAt = rec.approvedAt;
          
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: user.userId,
            action: "APPROVE_SUPPLIER",
            targetId: id,
            reason: `공급업체 평가 승인 및 ASL 등록 처리 (업체: ${data.supplierName}, 등급: ${data.grade})`
          });
          
          window.toast.show("성공적으로 승인 완료 및 적격업체 연동되었습니다.", "ok");
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
            action: "REJECT_SUPPLIER",
            targetId: id,
            reason: `평가 내역 반려: ${reason}`
          });
          
          window.toast.show("기록이 반려 처리되었습니다.", "warn");
        }
        
        window.modal.close();
        onSuccess();
      };
    });
  },

  renderAsl(container) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.status === STATUS.APPROVED);
    
    // Filter only those enrolled in ASL
    const aslList = records.filter(r => {
      try {
        const d = JSON.parse(r.dataJson);
        return d.aslStatus === "ENROLLED";
      } catch(e){}
      return false;
    });
    
    const trs = aslList.map(r => {
      let data = {};
      try { data = JSON.parse(r.dataJson); } catch (e) { }
      return `
        <tr>
          <td><b>${window.esc(r.docNumber)}</b></td>
          <td><b>${window.esc(data.supplierName)}</b></td>
          <td>${window.esc(data.evalDate)}</td>
          <td>${window.esc(data.averageScore.toFixed(1))} 점</td>
          <td><span class="badge approved">등급 ${window.esc(data.grade)}</span></td>
          <td><span class="badge approved" style="background-color:var(--color-primary-soft); color:var(--color-primary);">🟢 ACTIVE (등록완료)</span></td>
          <td>${window.esc(r.approvedBy)}</td>
          <td>${window.formatKst(r.approvedAt)}</td>
        </tr>
      `;
    }).join("");
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">적격공급업체 목록 (ASL - Active Supplier List)</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">평가 등급 A, B, C를 획득하여 품질 보증 승인된 적격 원자재 공급업체 관리 대장입니다.</p>
      </div>
      
      <div class="card">
        <table class="list">
          <thead>
            <tr>
              <th>ASL 번호</th>
              <th>공급업체명</th>
              <th>평가 완료일</th>
              <th>평가 점수</th>
              <th>등급</th>
              <th>ASL 상태</th>
              <th>QA 승인자</th>
              <th>등록 일시</th>
            </tr>
          </thead>
          <tbody>
            ${aslList.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--color-text-muted);">적격 등록된 공급업체가 없습니다.</td></tr>` : trs}
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
        <p style="color:var(--color-text-muted); font-size:13px;">업체 평가 점수 가산, 등급 자동 산출, ASL 등재 및 승인 서명 완전성 증빙 이력입니다.</p>
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
export default semModule;
