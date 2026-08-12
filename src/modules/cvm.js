import { sheetAdapter } from "../shared/js/sheetAdapter.js";
import { authHelper } from "../shared/js/authHelper.js";

const SYSTEM_KEY = "CVM";
const STATUS = { DRAFT: "DRAFT", SUBMITTED: "SUBMITTED", APPROVED: "APPROVED", REJECTED: "REJECTED" };
const STATUS_LABEL = { DRAFT: "작성중", SUBMITTED: "승인대기", APPROVED: "승인완료", REJECTED: "반려" };

function generateValidationDocNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateKey = `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
  
  const seqKey = "gxp_suite:seq:cvm";
  let seq = JSON.parse(localStorage.getItem(seqKey) || "{}");
  if (seq.date !== dateKey) {
    seq = { date: dateKey, val: 0 };
  }
  seq.val += 1;
  localStorage.setItem(seqKey, JSON.stringify(seq));
  
  return `VAL-${dateKey}-${String(seq.val).padStart(3, "0")}`;
}

export const cvmModule = {
  systemKey: SYSTEM_KEY,
  systemName: "[CVM] 세척 검증 결과",
  
  getSidebarMenus(role) {
    const menus = [
      { href: "#/cvm/dashboard", label: "대시보드" }
    ];
    if (role === "VAL" || role === "ADMIN") {
      menus.push({ href: "#/cvm/new", label: "검증 결과 입력" });
      menus.push({ href: "#/cvm/mine", label: "내 작성건" });
    }
    if (role === "QA" || role === "ADMIN") {
      menus.push({ href: "#/cvm/approvals", label: "승인 대기" });
    }
    menus.push({ href: "#/cvm/records", label: "검증서 출력" });
    menus.push({ href: "#/cvm/audit", label: "감사추적" });
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
    } else if (subRoute === "records") {
      this.renderReportList(container);
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
    
    let compliantCount = 0;
    records.forEach(r => {
      try {
        const d = JSON.parse(r.dataJson);
        if (r.status === STATUS.APPROVED && d.isCompliant) compliantCount++;
      } catch(e){}
    });
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">${this.systemName} 대시보드</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">생산 설비 세척 공정 검증을 위한 잔류물 다점(Multi-point) 샘플링 데이터를 분석 및 보증합니다.</p>
      </div>
      
      <div class="grid cols-3">
        <div class="kpi">
          <div class="label">임시저장 검증건</div>
          <div class="value">${drafts} 건</div>
        </div>
        <div class="kpi">
          <div class="label">승인 대기</div>
          <div class="value" style="color:var(--color-warning);">${submitted} 건</div>
        </div>
        <div class="kpi">
          <div class="label">적격 검증서 (Compliant)</div>
          <div class="value" style="color:var(--color-success);">${compliantCount} 건</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:24px;">
        <h2>세척 밸리데이션(Cleaning Validation) 업무</h2>
        <div style="display:flex; gap:12px; margin-top:12px;">
          ${role === "VAL" || role === "ADMIN" ? `
            <a href="#/cvm/new" class="btn btn-primary">신규 검증 측정값 입력</a>
            <a href="#/cvm/mine" class="btn btn-secondary">내 검증 작성 카드 목록</a>
          ` : ""}
          ${role === "QA" || role === "ADMIN" ? `
            <a href="#/cvm/approvals" class="btn btn-primary">검증 승인 서명 대기</a>
          ` : ""}
          <a href="#/cvm/records" class="btn btn-secondary">검증 보고서 인쇄/대장</a>
        </div>
      </div>
    `;
  },

  renderNew(container) {
    const equipments = sheetAdapter.getMasterData("EQUIPMENT");

    container.innerHTML = `
      <h2 style="margin-bottom:24px; color:var(--color-primary-dark);">세척 검증 측정값 입력</h2>
      <div class="card">
        <h2>세척 잔류물 다점 샘플링 측정값 입력 (3점 스왑법)</h2>
        
        <div id="cvm-compliance-preview" class="kpbma-notice-box" style="display:none; background-color:var(--color-primary-soft); border-color:#0072CE; color:var(--color-primary-dark); margin-bottom:16px;">
          <span class="icon">🔍</span>
          <div class="content" id="cvm-compliance-preview-content"></div>
        </div>
        
        <form id="cvm-form">
          <div class="form-row">
            <label class="req">대상 설비 선택</label>
            <select id="cvm-equip-select" required>
              <option value="">-- 설비 선택 --</option>
              ${equipments.map(m => `<option value="${window.esc(m.code)}" data-name="${window.esc(m.name)}">${window.esc(m.name)} (${window.esc(m.code)})</option>`).join("")}
            </select>
          </div>
          <input type="hidden" id="cvm-equip-id">
          <input type="hidden" id="cvm-equip-name">
          <div class="form-row">
            <label class="req">세척 수행일자</label>
            <input type="date" id="cvm-date" required>
          </div>
          <div class="form-row">
            <label class="req">허용 한계치 (Limit)</label>
            <input type="number" step="any" id="cvm-limit" required value="10.0" style="width:160px;">
            <span style="font-weight:700; margin-left:8px;">ppm (또는 μg/swab)</span>
          </div>
          
          <h4 style="margin:20px 0 10px; color:var(--color-primary-dark); font-size:14px; border-bottom:1px solid var(--color-border); padding-bottom:6px;">샘플링 포인트별 분석 잔류값</h4>
          
          <div class="form-row">
            <label class="req">Point 1 (스왑부 A)</label>
            <input type="number" step="any" id="cvm-pt1" required value="1.2" style="width:160px;">
          </div>
          <div class="form-row">
            <label class="req">Point 2 (스왑부 B)</label>
            <input type="number" step="any" id="cvm-pt2" required value="0.8" style="width:160px;">
          </div>
          <div class="form-row">
            <label class="req">Point 3 (스왑부 C)</label>
            <input type="number" step="any" id="cvm-pt3" required value="2.4" style="width:160px;">
          </div>
          
          <div class="form-actions">
            <a href="#/cvm/mine" class="btn btn-secondary">취소</a>
            <button type="submit" class="btn btn-primary">DRAFT 임시저장</button>
          </div>
        </form>
      </div>
    `;
    
    document.getElementById("cvm-date").value = new Date().toISOString().split("T")[0];
    
    const equipSelect = document.getElementById("cvm-equip-select");
    const equipIdInput = document.getElementById("cvm-equip-id");
    const equipNameInput = document.getElementById("cvm-equip-name");
    
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
    
    const limitIn = document.getElementById("cvm-limit");
    const pt1In = document.getElementById("cvm-pt1");
    const pt2In = document.getElementById("cvm-pt2");
    const pt3In = document.getElementById("cvm-pt3");
    const previewBox = document.getElementById("cvm-compliance-preview");
    const previewContent = document.getElementById("cvm-compliance-preview-content");
    
    const updatePreview = () => {
      const limit = parseFloat(limitIn.value || 0);
      const pt1 = parseFloat(pt1In.value || 0);
      const pt2 = parseFloat(pt2In.value || 0);
      const pt3 = parseFloat(pt3In.value || 0);
      
      // Multi-point AND compliance determination
      const isCompliant = pt1 <= limit && pt2 <= limit && pt3 <= limit;
      
      let resText = "";
      let color = "var(--color-primary)";
      if (isCompliant) {
        resText = "적합 (모든 포인트 합격)";
        color = "var(--color-success)";
      } else {
        resText = "부적합 (최소 1개 이상 허용치 초과!)";
        color = "var(--color-danger)";
      }
      
      previewContent.innerHTML = `
        <b>세척 잔류 분석 판정:</b> <span style="color:${color}; font-weight:800; font-size:15px;">${resText}</span> 
        (허용한계: ${limit} ppm | 측정: Pt1=${pt1}, Pt2=${pt2}, Pt3=${pt3})
      `;
      previewBox.style.display = "flex";
    };
    
    limitIn.oninput = updatePreview;
    pt1In.oninput = updatePreview;
    pt2In.oninput = updatePreview;
    pt3In.oninput = updatePreview;
    updatePreview();
    
    document.getElementById("cvm-form").onsubmit = e => {
      e.preventDefault();
      
      const limit = parseFloat(limitIn.value);
      const pt1 = parseFloat(pt1In.value);
      const pt2 = parseFloat(pt2In.value);
      const pt3 = parseFloat(pt3In.value);
      
      const payload = {
        equipmentId: document.getElementById("cvm-equip-id").value.trim(),
        equipmentName: document.getElementById("cvm-equip-name").value.trim(),
        cleaningDate: document.getElementById("cvm-date").value,
        samplingLimit: limit,
        point1: pt1,
        point2: pt2,
        point3: pt3,
        isCompliant: pt1 <= limit && pt2 <= limit && pt3 <= limit
      };
      
      const user = authHelper.getCurrentUser();
      const id = `rec-cvm-${Date.now()}`;
      
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
        action: "CREATE_VALIDATION_RECORD",
        targetId: id,
        afterValue: payload,
        reason: `설비 세척 검증 데이터 입력 및 임시저장 (적격판정: ${payload.isCompliant ? '적격' : '부적격'})`
      });
      
      window.toast.show("기록이 임시저장되었습니다.", "ok");
      window.location.hash = "#/cvm/mine";
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

  renderReportList(container) {
    const records = sheetAdapter.getRecords(SYSTEM_KEY).filter(r => r.status === STATUS.APPROVED);
    this.renderRecordsTable(container, records, "print");
  },

  renderRecordsTable(container, records, viewType) {
    let titleText = "내 세척 검증 기록";
    let subText = "DRAFT 및 결재 대기 중인 세척 측정 데이터입니다.";
    if (viewType === "approvals") {
      titleText = "세척 검증 결과 QA 승인 대기";
      subText = "모든 측정 포인트 잔류값이 한계 미만인지 대조한 후 서명하십시오.";
    } else if (viewType === "print") {
      titleText = "설비 세척 검증서 발행/인쇄";
      subText = "최종 QA 부서 서명이 확인된 정식 세척 벨리데이션 성적서입니다.";
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
      } else if (viewType === "print") {
        actionHtml += `
          <button class="btn btn-primary sm" data-btn-print="${r.id}" style="padding:4px 8px; font-size:12px;">검증서 인쇄 미리보기</button>
        `;
      }
      
      return `
        <tr>
          <td><b>${window.esc(r.docNumber || "미발행")}</b></td>
          <td><code>${window.esc(data.equipmentId)}</code></td>
          <td>${window.esc(data.equipmentName)}</td>
          <td>${window.esc(data.cleaningDate)}</td>
          <td>Pt1: ${window.esc(data.point1)} | Pt2: ${window.esc(data.point2)} | Pt3: ${window.esc(data.point3)} (한계: ${window.esc(data.samplingLimit)})</td>
          <td>
            <span class="badge ${data.isCompliant ? 'approved' : 'rejected'}">
              ${data.isCompliant ? '적격 (PASS)' : '부적격 (FAIL)'}
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
              <th>문서 번호</th>
              <th>설비 ID</th>
              <th>설비명</th>
              <th>세척 일시</th>
              <th>포인트별 검사값 (Limit)</th>
              <th>종합 판정</th>
              <th>상태</th>
              <th>작성자</th>
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
        if (confirm("이 검증 기록의 QA 승인을 결재 요청하겠습니까?")) {
          const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
          rec.status = STATUS.SUBMITTED;
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: authHelper.getCurrentUser().userId,
            action: "SUBMIT_RECORD",
            targetId: id,
            reason: "설비 세척 검증기록 결재선 상신"
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
    
    container.querySelectorAll("[data-btn-print]").forEach(btn => {
      const id = btn.getAttribute("data-btn-print");
      btn.onclick = () => this.showValidationPrint(id);
    });
  },

  showEditModal(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch (e){}
    
    const equipments = sheetAdapter.getMasterData("EQUIPMENT");
    
    const content = `
      <h3>세척 검증 결과 수정</h3>
      <form id="cvm-edit-form">
        <div class="form-row">
          <label class="req">대상 설비 선택</label>
          <select id="edit-equip-select" required>
            <option value="">-- 설비 선택 --</option>
            ${equipments.map(m => `<option value="${window.esc(m.code)}" data-name="${window.esc(m.name)}" ${m.code === data.equipmentId ? 'selected' : ''}>${window.esc(m.name)} (${window.esc(m.code)})</option>`).join("")}
          </select>
        </div>
        <input type="hidden" id="edit-equip-id" value="${window.esc(data.equipmentId)}">
        <input type="hidden" id="edit-equip-name" value="${window.esc(data.equipmentName)}">
        <div class="form-row">
          <label class="req">세척 수행일자</label>
          <input type="date" id="edit-date" value="${window.esc(data.cleaningDate)}" required>
        </div>
        <div class="form-row">
          <label class="req">허용 한계치</label>
          <input type="number" step="any" id="edit-limit" value="${window.esc(data.samplingLimit)}" required style="width:160px;">
        </div>
        <div class="form-row">
          <label class="req">Point 1</label>
          <input type="number" step="any" id="edit-pt1" value="${window.esc(data.point1)}" required style="width:160px;">
        </div>
        <div class="form-row">
          <label class="req">Point 2</label>
          <input type="number" step="any" id="edit-pt2" value="${window.esc(data.point2)}" required style="width:160px;">
        </div>
        <div class="form-row">
          <label class="req">Point 3</label>
          <input type="number" step="any" id="edit-pt3" value="${window.esc(data.point3)}" required style="width:160px;">
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
      
      const editEquipSelect = document.getElementById("edit-equip-select");
      const editEquipId = document.getElementById("edit-equip-id");
      const editEquipName = document.getElementById("edit-equip-name");
      
      editEquipSelect.onchange = () => {
        const opt = editEquipSelect.options[editEquipSelect.selectedIndex];
        if (opt && opt.value) {
          editEquipId.value = opt.value;
          editEquipName.value = opt.getAttribute("data-name");
        } else {
          editEquipId.value = "";
          editEquipName.value = "";
        }
      };
      
      document.getElementById("cvm-edit-form").onsubmit = e => {
        e.preventDefault();
        
        const reason = document.getElementById("edit-reason").value.trim();
        const err = document.getElementById("edit-reason-error");
        
        if (reason.length < 5) {
          err.style.display = "block";
          return;
        }
        
        const limit = parseFloat(document.getElementById("edit-limit").value);
        const pt1 = parseFloat(document.getElementById("edit-pt1").value);
        const pt2 = parseFloat(document.getElementById("edit-pt2").value);
        const pt3 = parseFloat(document.getElementById("edit-pt3").value);
        
        const updated = {
          equipmentId: document.getElementById("edit-equip-id").value.trim(),
          equipmentName: document.getElementById("edit-equip-name").value.trim(),
          cleaningDate: document.getElementById("edit-date").value,
          samplingLimit: limit,
          point1: pt1,
          point2: pt2,
          point3: pt3,
          isCompliant: pt1 <= limit && pt2 <= limit && pt3 <= limit
        };
        
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
        
        window.toast.show("측정 데이터가 수정되었습니다.", "ok");
        window.modal.close();
        this.handleRoute("mine", document.getElementById("content-viewport"));
      };
    });
  },

  showSoftDeleteModal(id, onSuccess) {
    const content = `
      <h3>⚠️ 세척검증 데이터 삭제 통제</h3>
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
    const title = isApprove ? "세척 검증 최종 승인 전자서명" : "반려 사유 입력";
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
        let data = {};
        try { data = JSON.parse(rec.dataJson); } catch (e){}
        
        if (isApprove) {
          const pw = document.getElementById("sig-pw").value;
          const err = document.getElementById("sig-pw-error");
          
          const users = sheetAdapter.getUsers();
          const me = users.find(u => u.userId === user.userId);
          
          if (String(me.password) !== String(pw)) {
            err.style.display = "block";
            return;
          }
          
          rec.status = STATUS.APPROVED;
          rec.docNumber = generateValidationDocNumber();
          rec.approvedBy = user.userId;
          rec.approvedAt = new Date().toISOString();
          rec.updatedUser = user.userId;
          rec.updatedAt = rec.approvedAt;
          
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: user.userId,
            action: "APPROVE_CLEANING",
            targetId: id,
            reason: `설비 세척 검증 최종 승인 완료 (설비ID: ${data.equipmentId}, 판정: ${data.isCompliant ? '적격' : '부적격'})`
          });
          
          window.toast.show("성공적으로 세척 검증 승인이 서명 날인되었습니다.", "ok");
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
            action: "REJECT_CLEANING",
            targetId: id,
            reason: `세척 검증 기록 반려: ${reason}`
          });
          
          window.toast.show("기록이 반려 처리되었습니다.", "warn");
        }
        
        window.modal.close();
        onSuccess();
      };
    });
  },

  showValidationPrint(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch (e) { }
    
    const user = authHelper.getCurrentUser();
    const companyName = JSON.parse(localStorage.getItem("gxp_suite:settings") || "[]")
      .find(s => s.key === "common:companyName")?.value || "㈜갬프연구소";
      
    // Write Data audit log
    sheetAdapter.saveAuditLog(SYSTEM_KEY, {
      category: "DATA",
      userId: user.userId,
      action: "PRINT_CLEANING_REPORT",
      targetId: rec.id,
      reason: `세척 검증 보고서 인쇄 (보고서 번호: ${rec.docNumber})`
    });
    
    const printHtml = `
      <div class="coa-printable" style="max-width: 700px; padding: 30px; border: 2px solid #0072CE;">
        <h2 style="font-family:'Pretendard', sans-serif; font-size: 26px; font-weight: 800; text-align:center; color: #163A5F; margin-bottom:6px;">세 척 검 증 서</h2>
        <div style="text-align:center; font-size:12px; font-weight:700; color:var(--color-text-muted); margin-bottom:24px;">CLEANING VALIDATION SUMMARY REPORT</div>
        
        <table class="doc-table" style="width:100%; border-collapse:collapse; margin-bottom:24px;">
          <tr>
            <th style="width:25%;">검증서 번호 (Doc No)</th>
            <td style="width:25%;">${window.esc(rec.docNumber)}</td>
            <th style="width:25%;">설비 번호 (Equipment ID)</th>
            <td style="width:25%;"><code>${window.esc(data.equipmentId)}</code></td>
          </tr>
          <tr>
            <th>설 비 명</th>
            <td>${window.esc(data.equipmentName)}</td>
            <th>세척 수행일</th>
            <td>${window.esc(data.cleaningDate)}</td>
          </tr>
          <tr>
            <th>수행 허용한계 (Limit)</th>
            <td colspan="3">${window.esc(data.samplingLimit)} ppm 이하</td>
          </tr>
          <tr>
            <th>스왑 포인트 A (Pt 1)</th>
            <td>${window.esc(data.point1)} ppm</td>
            <td style="background:#F2F5F8; font-weight:700;">판정 결과 Pt 1</td>
            <td><span style="font-weight:700; color:${data.point1 <= data.samplingLimit ? 'green' : 'red'};">${data.point1 <= data.samplingLimit ? 'PASS' : 'FAIL'}</span></td>
          </tr>
          <tr>
            <th>스왑 포인트 B (Pt 2)</th>
            <td>${window.esc(data.point2)} ppm</td>
            <td style="background:#F2F5F8; font-weight:700;">판정 결과 Pt 2</td>
            <td><span style="font-weight:700; color:${data.point2 <= data.samplingLimit ? 'green' : 'red'};">${data.point2 <= data.samplingLimit ? 'PASS' : 'FAIL'}</span></td>
          </tr>
          <tr>
            <th>스왑 포인트 C (Pt 3)</th>
            <td>${window.esc(data.point3)} ppm</td>
            <td style="background:#F2F5F8; font-weight:700;">판정 결과 Pt 3</td>
            <td><span style="font-weight:700; color:${data.point3 <= data.samplingLimit ? 'green' : 'red'};">${data.point3 <= data.samplingLimit ? 'PASS' : 'FAIL'}</span></td>
          </tr>
          <tr>
            <th>다항목 종합 판정</th>
            <td colspan="3">
              <span style="font-size:16px; font-weight:800; color:${data.isCompliant ? '#065F46' : '#991B1B'}">
                설비 세척 ${data.isCompliant ? '적격 승인 (COMPLIANT)' : '부적격 판정 (NON-COMPLIANT)'}
              </span>
            </td>
          </tr>
        </table>
        
        <div style="font-size:12px; margin-top:20px; line-height:1.7; color:#333;">
          * 본 검증서는 3개 스왑 포인트의 분석 수치가 모두 허용치 한계 이하를 만족하는 **다항목 교차 판정(Multi-point AND Compliance)** 규격을 입증합니다.
        </div>
        
        <div class="stamp-row" style="margin-top:30px;">
          <div class="stamp">
            <div class="ttl">PREPARED BY (검증 실무자)</div>
            <div class="body">
              ID: ${window.esc(rec.createdUser)}<br>
              서명일시: ${window.formatKst(rec.createdAt)}
            </div>
          </div>
          <div class="stamp">
            <div class="ttl">APPROVED BY (QA 품질 보증 부서장)</div>
            <div class="body">
              ID: ${window.esc(rec.approvedBy || user.userId)}<br>
              서명일시: ${window.formatKst(rec.approvedAt || rec.updatedAt)}
            </div>
          </div>
        </div>
        
        <div style="margin-top:30px; border-top: 1px dashed #aaa; padding-top:12px; font-size:10px; text-align:center; color:#555;">
          본 사본은 ${window.esc(companyName)}의 품질 시스템 하에 공식 전자 승인된 문서입니다.<br>
          [출력자 ID: ${window.esc(user.userId)} | 출력 수행일시: ${window.formatKst()}]
        </div>
      </div>
    `;
    
    window.modal.open(`
      <div class="no-print" style="margin-bottom: 20px;">
        <h3>세척 검증 성적서 출력 미리보기</h3>
        <p style="font-size:12px; color:var(--color-text-muted);">
          아래의 '출력하기' 버튼을 누르면 인쇄 다이얼로그를 통해 출력 및 저장이 가능합니다.
        </p>
      </div>
      <!-- Scrollable Wrapper for small viewport compatibility -->
      <div class="printable-scroll-wrap" style="max-height: 60vh; overflow: auto; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; margin-bottom: 15px;">
        ${printHtml}
      </div>
      <div class="form-actions no-print">
        <button class="btn btn-secondary" id="btn-preview-close">닫기</button>
        <button class="btn btn-primary" id="btn-do-print">출력하기 (window.print)</button>
      </div>
    `, () => {
      // Enlarge modal dialog size specifically for cleaning validation print preview
      const modalEl = document.querySelector(".modal");
      if (modalEl) {
        modalEl.style.width = "780px";
        modalEl.style.maxWidth = "95vw";
      }

      document.getElementById("btn-preview-close").onclick = () => {
        window.modal.close();
        this.handleRoute("records", document.getElementById("content-viewport"));
      };
      
      document.getElementById("btn-do-print").onclick = () => {
        window.print();
      };
    });
  },

  renderAudit(container) {
    let activeTab = "data";
    
    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 style="font-size:20px; color:var(--color-primary-dark);">${this.systemName} 감사추적 (Audit Trail)</h2>
        <p style="color:var(--color-text-muted); font-size:13px;">세척 검증 측정점 수집, 다점 AND 합격 판정 연산 및 QA 서명 승인의 데이터 완전성 이력입니다.</p>
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
export default cvmModule;
