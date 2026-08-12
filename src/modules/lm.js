import { sheetAdapter } from "../shared/js/sheetAdapter.js";
import { authHelper } from "../shared/js/authHelper.js";

const SYSTEM_KEY = "LM";
const STATUS = { DRAFT: "DRAFT", SUBMITTED: "SUBMITTED", APPROVED: "APPROVED", REJECTED: "REJECTED", PRINTED: "PRINTED" };
const STATUS_LABEL = { DRAFT: "작성중", SUBMITTED: "승인대기", APPROVED: "승인완료", REJECTED: "반려", PRINTED: "발행완료" };

function generateCertNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateKey = `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
  
  const seqKey = "gxp_suite:seq:lm";
  let seq = JSON.parse(localStorage.getItem(seqKey) || "{}");
  if (seq.date !== dateKey) {
    seq = { date: dateKey, val: 0 };
  }
  seq.val += 1;
  localStorage.setItem(seqKey, JSON.stringify(seq));
  
  return `CERT-${dateKey}-${String(seq.val).padStart(4, "0")}`;
}

export const lmModule = {
  systemKey: SYSTEM_KEY,
  systemName: "[LM] 교육 이수 관리",
  
  getSidebarMenus(role) {
    const menus = [
      { href: "#/lm/dashboard", label: "대시보드" }
    ];
    if (role === "TRAINER" || role === "ADMIN") {
      menus.push({ href: "#/lm/new", label: "평가 기록 입력" });
      menus.push({ href: "#/lm/mine", label: "내 등록건" });
    }
    if (role === "QA" || role === "ADMIN") {
      menus.push({ href: "#/lm/approvals", label: "승인 대기" });
    }
    if (role === "QA" || role === "ADMIN" || role === "TRAINER") {
      menus.push({ href: "#/lm/print", label: "이수증 출력" });
    }
    menus.push({ href: "#/lm/audit", label: "감사추적" });
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
    
    // Calculate passing statistics
    let passedCount = 0;
    records.forEach(r => {
      try {
        const d = JSON.parse(r.dataJson);
        if (d.isPassed && r.status === STATUS.APPROVED) passedCount++;
      } catch(e){}
    });
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size:24px; color:var(--color-primary-dark);">${this.systemName} 대시보드</h2>
        <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">임직원의 GMP 교육 훈련 기록 및 이수 자격을 추적 검증합니다.</p>
      </div>
      
      <div class="grid cols-3">
        <div class="kpi">
          <div class="label">임시저장 교육건</div>
          <div class="value">${drafts}</div>
        </div>
        <div class="kpi">
          <div class="label">결재 대기</div>
          <div class="value" style="color:var(--color-warning);">${submitted}</div>
        </div>
        <div class="kpi">
          <div class="label">승인완료 이수증</div>
          <div class="value" style="color:var(--color-success);">${approved}</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:24px;">
        <h2>GMP 실습 모듈 바로가기</h2>
        <div style="display:flex; gap:12px;">
          ${role === "TRAINER" || role === "ADMIN" ? `
            <a href="#/lm/new" class="btn btn-primary">평가 결과 신규 입력</a>
            <a href="#/lm/mine" class="btn btn-secondary">내 평가 등록건 관리</a>
          ` : ""}
          ${role === "QA" || role === "ADMIN" ? `
            <a href="#/lm/approvals" class="btn btn-primary">이수 등록 승인 검토</a>
            <a href="#/lm/print" class="btn btn-secondary">이수증 및 증명서 출력</a>
          ` : ""}
        </div>
      </div>
    `;
  },

  renderNew(container) {
    const courses = sheetAdapter.getMasterData("COURSE");

    container.innerHTML = `
      <h2 style="margin-bottom:24px; color:var(--color-primary-dark);">평가 기록 신규 입력</h2>
      <div class="card">
        <h2>GMP 교육 평가 기록 등록</h2>
        
        <div id="validation-warnings-box" class="kpbma-notice-box" style="display:none; background-color:#FEF3C7; border-color:#F59E0B; color:#92400E; margin-bottom:16px;">
          <span class="icon">⚠️</span>
          <div class="content" id="validation-warnings-content"></div>
        </div>
        
        <form id="lm-form">
          <div class="form-row">
            <label class="req">사원 번호</label>
            <input id="lm-emp-no" required placeholder="예: E2026042">
          </div>
          <div class="form-row">
            <label class="req">성명</label>
            <input id="lm-emp-name" required placeholder="성명 입력">
          </div>
          <div class="form-row">
            <label class="req">부서명</label>
            <input id="lm-emp-dept" required placeholder="예: 품질관리팀">
          </div>
          <div class="form-row">
            <label class="req">교육 과정</label>
            <select id="lm-course-select" required>
              <option value="">-- 교육 선택 --</option>
              ${courses.map(m => `<option value="${window.esc(m.code)}" data-name="${window.esc(m.name)}">${window.esc(m.name)} (${window.esc(m.code)})</option>`).join("")}
            </select>
          </div>
          <input type="hidden" id="lm-course-code">
          <input type="hidden" id="lm-course-name">
          <div class="form-row">
            <label class="req">이수 시간</label>
            <input type="number" id="lm-hours" required value="8" style="width:120px;">
          </div>
          <div class="form-row">
            <label class="req">평가 점수 (0~100)</label>
            <div>
              <input type="number" id="lm-score" required placeholder="점수 입력" style="width:120px;">
              <small style="color:var(--color-text-muted); margin-left:10px;">* 합격 기준: 80점 이상</small>
              <div id="score-error" class="field-error" style="display:none;">점수는 0에서 100 사이의 숫자여야 합니다.</div>
            </div>
          </div>
          <div class="form-row">
            <label class="req">교육 실시일자</label>
            <input type="date" id="lm-date" required>
          </div>
          
          <div class="form-actions">
            <a href="#/lm/mine" class="btn btn-secondary">취소</a>
            <button type="submit" class="btn btn-primary" id="btn-submit-lm">DRAFT 저장</button>
          </div>
        </form>
      </div>
    `;
    
    // Set default date
    document.getElementById("lm-date").value = new Date().toISOString().split("T")[0];
    
    const empNoInput = document.getElementById("lm-emp-no");
    const courseSelect = document.getElementById("lm-course-select");
    const courseCodeInput = document.getElementById("lm-course-code");
    const courseNameInput = document.getElementById("lm-course-name");
    const scoreInput = document.getElementById("lm-score");
    const warnBox = document.getElementById("validation-warnings-box");
    const warnContent = document.getElementById("validation-warnings-content");
    const scoreErr = document.getElementById("score-error");
    
    // Inline validation warnings check
    const checkWarnings = () => {
      const empNo = empNoInput.value.trim();
      const courseCode = courseCodeInput.value.trim();
      const scoreVal = scoreInput.value.trim();
      
      let warnings = [];
      let scoreInvalid = false;
      
      // 1. Out-of-bounds warning
      if (scoreVal) {
        const score = parseFloat(scoreVal);
        if (isNaN(score) || score < 0 || score > 100) {
          scoreInvalid = true;
          warnings.push("<b>오류:</b> 평가 점수는 0점에서 100점 사이여야 합니다.");
          scoreErr.style.display = "block";
        } else {
          scoreErr.style.display = "none";
        }
      }
      
      // 2. Duplicate warning
      if (empNo && courseCode) {
        const records = sheetAdapter.getRecords(SYSTEM_KEY);
        const isDuplicate = records.some(r => {
          try {
            const data = JSON.parse(r.dataJson);
            return data.empNo === empNo && data.courseCode === courseCode;
          } catch(e){}
          return false;
        });
        if (isDuplicate) {
          warnings.push("<b>경고:</b> 이 임직원은 이미 해당 교육 과정(코드: " + courseCode + ")을 이수 완료했거나 이수 기록이 존재합니다. (중복 프로파일 감지)");
        }
      }
      
      if (warnings.length > 0) {
        warnContent.innerHTML = warnings.join("<br>");
        warnBox.style.display = "flex";
      } else {
        warnBox.style.display = "none";
      }
      
      return !scoreInvalid;
    };
    
    courseSelect.onchange = () => {
      const opt = courseSelect.options[courseSelect.selectedIndex];
      if (opt && opt.value) {
        courseCodeInput.value = opt.value;
        courseNameInput.value = opt.getAttribute("data-name");
      } else {
        courseCodeInput.value = "";
        courseNameInput.value = "";
      }
      checkWarnings();
    };

    empNoInput.oninput = checkWarnings;
    scoreInput.oninput = checkWarnings;
    
    document.getElementById("lm-form").onsubmit = e => {
      e.preventDefault();
      
      const isScoreValid = checkWarnings();
      if (!isScoreValid) {
        window.toast.show("입력값 오류를 수정하십시오.", "error");
        return;
      }
      
      const payload = {
        empNo: empNoInput.value.trim(),
        empName: document.getElementById("lm-emp-name").value.trim(),
        department: document.getElementById("lm-emp-dept").value.trim(),
        courseCode: courseCodeInput.value.trim(),
        courseName: document.getElementById("lm-course-name").value.trim(),
        hours: parseInt(document.getElementById("lm-hours").value, 10),
        score: parseFloat(scoreInput.value),
        testDate: document.getElementById("lm-date").value,
        passScore: 80
      };
      
      // Score determination
      payload.isPassed = payload.score >= payload.passScore;
      
      const user = authHelper.getCurrentUser();
      const id = `rec-lm-${Date.now()}`;
      
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
        action: "CREATE_RECORD",
        targetId: id,
        afterValue: payload,
        reason: "교육 훈련 기록 카드 DRAFT 생성"
      });
      
      window.toast.show("기록이 임시저장되었습니다.", "ok");
      window.location.hash = "#/lm/mine";
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
    let titleText = "내 등록 교육 이수 기록";
    let subText = "DRAFT 및 결재 대기 중인 교육 훈련 정보카드입니다.";
    if (viewType === "approvals") {
      titleText = "교육 이수 내역 QA 승인 대기 목록";
      subText = "QA 부서가 검토한 뒤 공식 이수증을 발행 서명하는 단계입니다.";
    } else if (viewType === "print") {
      titleText = "이수증 및 이수 이력 출력";
      subText = "공식 승인 완료된 교육 이수증(PDF)의 인쇄 목록입니다.";
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
          <button class="btn btn-primary sm" data-btn-print="${r.id}" style="padding:4px 8px; font-size:12px;">이수증 출력</button>
        `;
      }
      
      return `
        <tr>
          <td><b>${window.esc(r.docNumber || "미발행")}</b></td>
          <td>${window.esc(data.empName)} (${window.esc(data.empNo)})</td>
          <td>${window.esc(data.department)}</td>
          <td>${window.esc(data.courseName)}</td>
          <td>${window.esc(data.score)} 점</td>
          <td>
            <span class="badge ${data.isPassed ? 'approved' : 'rejected'}">
              ${data.isPassed ? '합격' : '불합격'}
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
              <th>이수증 번호</th>
              <th>교육 대상자</th>
              <th>부서</th>
              <th>교육 과정명</th>
              <th>평가 점수</th>
              <th>판정 결과</th>
              <th>상태</th>
              <th>등록자</th>
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
        if (confirm("이 기록의 승인을 요청하겠습니까?")) {
          const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
          rec.status = STATUS.SUBMITTED;
          sheetAdapter.saveRecord(SYSTEM_KEY, rec);
          
          sheetAdapter.saveAuditLog(SYSTEM_KEY, {
            category: "DATA",
            userId: authHelper.getCurrentUser().userId,
            action: "SUBMIT_RECORD",
            targetId: id,
            reason: "교육 훈련 증빙서 결재 승인요청"
          });
          
          window.toast.show("승인 대기 상태로 상신되었습니다.", "ok");
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
      btn.onclick = () => this.showCertificatePrint(id);
    });
  },

  showEditModal(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch(e){}
    
    const courses = sheetAdapter.getMasterData("COURSE");

    const content = `
      <h3>교육 평가 기록 수정</h3>
      <form id="lm-edit-form">
        <div class="form-row">
          <label class="req">사원 번호</label>
          <input id="edit-emp-no" value="${window.esc(data.empNo)}" required>
        </div>
        <div class="form-row">
          <label class="req">성명</label>
          <input id="edit-emp-name" value="${window.esc(data.empName)}" required>
        </div>
        <div class="form-row">
          <label class="req">부서명</label>
          <input id="edit-emp-dept" value="${window.esc(data.department)}" required>
        </div>
        <div class="form-row">
          <label class="req">교육 과정</label>
          <select id="edit-course-select" required>
            ${courses.map(m => `<option value="${window.esc(m.code)}" data-name="${window.esc(m.name)}" ${m.code === data.courseCode ? 'selected' : ''}>${window.esc(m.name)} (${window.esc(m.code)})</option>`).join("")}
          </select>
        </div>
        <input type="hidden" id="edit-course-code" value="${window.esc(data.courseCode)}">
        <input type="hidden" id="edit-course-name" value="${window.esc(data.courseName)}">
        <div class="form-row">
          <label class="req">이수 시간</label>
          <input type="number" id="edit-hours" value="${window.esc(data.hours)}" required style="width:120px;">
        </div>
        <div class="form-row">
          <label class="req">평가 점수</label>
          <div>
            <input type="number" id="edit-score" value="${window.esc(data.score)}" required style="width:120px;">
            <div id="edit-score-error" class="field-error" style="display:none;">점수는 0에서 100 사이여야 합니다.</div>
          </div>
        </div>
        <div class="form-row">
          <label class="req">교육 실시일자</label>
          <input type="date" id="edit-date" value="${window.esc(data.testDate)}" required>
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
      
      const courseSelect = document.getElementById("edit-course-select");
      const courseCodeInput = document.getElementById("edit-course-code");
      const courseNameInput = document.getElementById("edit-course-name");
      
      courseSelect.onchange = () => {
        const opt = courseSelect.options[courseSelect.selectedIndex];
        if (opt && opt.value) {
          courseCodeInput.value = opt.value;
          courseNameInput.value = opt.getAttribute("data-name");
        } else {
          courseCodeInput.value = "";
          courseNameInput.value = "";
        }
      };
      
      document.getElementById("lm-edit-form").onsubmit = e => {
        e.preventDefault();
        
        const scoreVal = parseFloat(document.getElementById("edit-score").value);
        const scoreErr = document.getElementById("edit-score-error");
        
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          scoreErr.style.display = "block";
          return;
        }
        
        const reason = document.getElementById("edit-reason").value.trim();
        const err = document.getElementById("edit-reason-error");
        
        if (reason.length < 5) {
          err.style.display = "block";
          return;
        }
        
        const updated = {
          empNo: document.getElementById("edit-emp-no").value.trim(),
          empName: document.getElementById("edit-emp-name").value.trim(),
          department: document.getElementById("edit-emp-dept").value.trim(),
          courseCode: document.getElementById("edit-course-code").value.trim(),
          courseName: document.getElementById("edit-course-name").value.trim(),
          hours: parseInt(document.getElementById("edit-hours").value, 10),
          score: scoreVal,
          testDate: document.getElementById("edit-date").value,
          passScore: 80
        };
        
        updated.isPassed = updated.score >= updated.passScore;
        
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
        
        window.toast.show("기록이 수정되었습니다.", "ok");
        window.modal.close();
        this.handleRoute("mine", document.getElementById("content-viewport"));
      };
    });
  },

  showSoftDeleteModal(id, onSuccess) {
    const content = `
      <h3>⚠️ 교육 이수 기록 삭제 통제</h3>
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
    const title = isApprove ? "교육이력서 QA 승인 전자서명" : "이수 반려 사유 입력";
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
          
          const users = sheetAdapter.getUsers();
          const me = users.find(u => u.userId === user.userId);
          
          if (String(me.password) !== String(pw)) {
            err.style.display = "block";
            return;
          }
          
          rec.status = STATUS.APPROVED;
          rec.docNumber = generateCertNumber();
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
            reason: "QA 교육 훈련 이수 등록 최종 승인"
          });
          
          window.toast.show("성공적으로 승인 완료되었습니다.", "ok");
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
            reason: `교육 이수 반려: ${reason}`
          });
          
          window.toast.show("기록이 반려 처리되었습니다.", "warn");
        }
        
        window.modal.close();
        onSuccess();
      };
    });
  },

  showCertificatePrint(id) {
    const rec = sheetAdapter.getRecords(SYSTEM_KEY).find(r => r.id === id);
    if (!rec) return;
    let data = {};
    try { data = JSON.parse(rec.dataJson); } catch (e) { }
    
    const user = authHelper.getCurrentUser();
    const companyName = JSON.parse(localStorage.getItem("gxp_suite:settings") || "[]")
      .find(s => s.key === "common:companyName")?.value || "㈜갬프연구소";
      
    // Set to PRINTED state
    rec.status = STATUS.PRINTED;
    sheetAdapter.saveRecord(SYSTEM_KEY, rec);
    
    sheetAdapter.saveAuditLog(SYSTEM_KEY, {
      category: "DATA",
      userId: user.userId,
      action: "PRINT_CERTIFICATE",
      targetId: rec.id,
      reason: `교육이수증 사본 인쇄 (이수증번호: ${rec.docNumber})`
    });
    
    const printHtml = `
      <div class="coa-printable" style="max-width: 650px; border: 3px double #0072CE; padding: 30px; text-align:center;">
        <h2 style="font-family:'Pretendard', sans-serif; font-size: 30px; font-weight: 800; color: #163A5F; margin-bottom:10px;">교 육 이 수 증</h2>
        <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:30px;">CERTIFICATE OF TRAINING</div>
        
        <div style="margin: 20px 0; text-align:left; font-size:14px; line-height:2.2; border: 1px solid var(--color-border); padding: 20px; border-radius:10px; background-color:#FAFCFF;">
          <div>• <b>이수번호:</b> ${window.esc(rec.docNumber)}</div>
          <div>• <b>교육 대상자:</b> ${window.esc(data.empName)} (${window.esc(data.empNo)})</div>
          <div>• <b>소속 부서:</b> ${window.esc(data.department)}</div>
          <div>• <b>교육 과정명:</b> ${window.esc(data.courseName)} (${window.esc(data.courseCode)})</div>
          <div>• <b>교육 일시:</b> ${window.esc(data.testDate)} (${window.esc(data.hours)}시간 이수)</div>
          <div>• <b>평가 결과:</b> 합격 (취득 점수: ${window.esc(data.score)}점)</div>
        </div>
        
        <p style="font-size:15px; line-height:1.8; color:#1F2933; margin: 30px 0;">
          위 사람은 관련 교육 과정을 이수하고 교육 훈련 평가 기준에<br>
          도달하였으므로 이 증서를 수여합니다.
        </p>
        
        <div style="font-size:16px; font-weight:700; color:var(--color-primary-dark); margin-top:40px;">
          ${window.esc(companyName)} QA부서 승인
        </div>
        
        <div style="display:flex; justify-content:space-around; margin-top:30px; border-top:1px dashed #ccc; padding-top:20px; font-size:11px; color:#666;">
          <div>
            <b>기록자 서명:</b> ID ${window.esc(rec.createdUser)}<br>
            (${window.formatKst(rec.createdAt)})
          </div>
          <div>
            <b>승인자 서명:</b> ID ${window.esc(rec.approvedBy || user.userId)}<br>
            (${window.formatKst(rec.approvedAt || rec.updatedAt)})
          </div>
        </div>
      </div>
    `;
    
    window.modal.open(`
      <div class="no-print" style="margin-bottom: 20px;">
        <h3>교육 이수증 출력 미리보기</h3>
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
      // Enlarge modal dialog size specifically for certificate print preview
      const modalEl = document.querySelector(".modal");
      if (modalEl) {
        modalEl.style.width = "720px";
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
        <p style="color:var(--color-text-muted); font-size:13px;">교육 결과 입력, 성적 평가 자동 판정, 이수증 서명 날인 등 수명주기에 관한 완전성 이력입니다.</p>
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
export default lmModule;
