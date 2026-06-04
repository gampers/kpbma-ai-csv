(function () {
  "use strict";

  const DB_NAME = "coa_mvp_db";
  const DB_STORE = "kv";
  const DEFAULT_ACCOUNT = { user_id: "admin", password_plain: "1234", active: true };
  const APP_KEYS = {
    accounts: "accounts",
    criteria: "criteria",
    records: "records",
    audit: "audit_events",
    draft: "draft_record",
    authMeta: "auth_meta"
  };

  const state = {
    storage: null,
    storageMode: "unknown",
    session: null,
    timeoutCheckTimer: null,
    draftSaveTimer: null,
    step: 1,
    criteria: null,
    currentResult: null,
    resultInputKey: "",
    draft: null,
    confirmedRecord: null,
    records: [],
    auditEvents: []
  };

  const el = {};

  class AppStorage {
    constructor() {
      this.db = null;
      this.mode = "indexeddb";
      this.prefix = "coa_mvp:";
    }

    async init() {
      try {
        this.db = await this.openDb();
        await this.set("healthcheck", { ok: true, t: Date.now() });
        await this.remove("healthcheck");
      } catch (err) {
        this.mode = "localstorage";
      }
      return this.mode;
    }

    openDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE, { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
      });
    }

    tx(mode, callback) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(DB_STORE, mode);
          const store = tx.objectStore(DB_STORE);
          const request = callback(store);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("IndexedDB tx failed"));
        } catch (err) {
          reject(err);
        }
      });
    }

    async get(key, fallbackValue = null) {
      if (this.mode === "localstorage") {
        const raw = localStorage.getItem(this.prefix + key);
        return raw ? JSON.parse(raw) : fallbackValue;
      }
      const row = await this.tx("readonly", (store) => store.get(key));
      if (!row || typeof row.value === "undefined") {
        return fallbackValue;
      }
      return row.value;
    }

    async set(key, value) {
      if (this.mode === "localstorage") {
        localStorage.setItem(this.prefix + key, JSON.stringify(value));
        return;
      }
      await this.tx("readwrite", (store) => store.put({ key, value }));
    }

    async remove(key) {
      if (this.mode === "localstorage") {
        localStorage.removeItem(this.prefix + key);
        return;
      }
      await this.tx("readwrite", (store) => store.delete(key));
    }
  }

  function formatKst(date = new Date()) {
    const utc = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
    const kst = new Date(utc + 9 * 60 * 60 * 1000);
    const yyyy = kst.getFullYear();
    const mm = String(kst.getMonth() + 1).padStart(2, "0");
    const dd = String(kst.getDate()).padStart(2, "0");
    const hh = String(kst.getHours()).padStart(2, "0");
    const mi = String(kst.getMinutes()).padStart(2, "0");
    const ss = String(kst.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  function fileTs(date = new Date()) {
    const kst = formatKst(date).replace(/[-:]/g, "").replace(" ", "_");
    return kst;
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function parseAllowedTexts(raw) {
    return String(raw || "")
      .split(/[\n,]/g)
      .map((x) => normalizeText(x))
      .filter(Boolean);
  }

  function normalizeNumericInput(raw) {
    return String(raw || "").trim().replace(",", ".");
  }

  function isNumericWith2Decimals(raw) {
    return /^-?\d+(\.\d{1,2})?$/.test(raw);
  }

  function round1(num) {
    return Math.round(num * 10) / 10;
  }

  function escapeCsvCell(value) {
    const s = String(value ?? "");
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return `"${s.replace(/"/g, "\"\"")}"`;
    }
    return s;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inputKeyFromForm() {
    return [
      el.sampleId.value.trim(),
      el.lotNo.value.trim(),
      el.textValue.value.trim(),
      normalizeNumericInput(el.numericValue.value)
    ].join("|");
  }

  async function sha256Hex(input) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function appendAudit(action, target, changeDetail) {
    const event = {
      timestamp: formatKst(),
      user_id: state.session ? state.session.user_id : "system",
      action,
      target,
      change_detail: changeDetail || ""
    };
    const seed = [event.timestamp, event.user_id, event.action, event.target, event.change_detail].join("|");
    event.checksum = await sha256Hex(seed);
    state.auditEvents.push(event);
    await state.storage.set(APP_KEYS.audit, state.auditEvents);
  }

  function setMsg(element, text, mode) {
    element.textContent = text || "";
    element.classList.remove("error", "warn");
    if (mode) {
      element.classList.add(mode);
    }
  }

  function pick(id) {
    el[id] = document.getElementById(id);
  }

  function bindElements() {
    [
      "loginView", "appView", "loginForm", "loginId", "loginPw", "loginMsg", "sessionInfo",
      "logoutBtn", "tabWizard", "tabSettings", "wizardPanel", "settingsPanel", "storageModeBadge",
      "stepLabel", "progressBar", "step1", "step2", "step3", "step4", "step5",
      "critMin", "critMax", "critTexts", "timeoutMin", "saveCriteriaBtn", "toStep2Btn", "criteriaMsg",
      "sampleId", "lotNo", "textValue", "numericValue", "calcBtn", "backTo1Btn", "draftStatus", "inputMsg",
      "resultView", "toStep4Btn", "backTo2Btn", "resultMsg",
      "failReason", "confirmBtn", "backTo3Btn", "confirmMsg",
      "reportPreview", "printReportBtn", "newRecordBtn", "reportMsg",
      "exportAuditBtn", "exportRecordsBtn", "resetDataBtn", "settingsMsg",
      "recordSearchInput", "recordStatusFilter", "recordCount", "recordTableBody"
    ].forEach(pick);
  }

  async function seedDefaults() {
    const accounts = await state.storage.get(APP_KEYS.accounts, []);
    if (!accounts.length) {
      await state.storage.set(APP_KEYS.accounts, [DEFAULT_ACCOUNT]);
    }
    const authMeta = await state.storage.get(APP_KEYS.authMeta, null);
    if (!authMeta) {
      await state.storage.set(APP_KEYS.authMeta, { failed_attempts: 0, lock_until: null });
    }
    const records = await state.storage.get(APP_KEYS.records, []);
    const audit = await state.storage.get(APP_KEYS.audit, []);
    state.records = records;
    state.auditEvents = audit;
    state.criteria = await state.storage.get(APP_KEYS.criteria, null);
    state.draft = await state.storage.get(APP_KEYS.draft, null);
  }

  function renderAuthView() {
    if (!state.session) {
      el.loginView.classList.remove("hidden");
      el.appView.classList.add("hidden");
      return;
    }
    el.loginView.classList.add("hidden");
    el.appView.classList.remove("hidden");
    el.sessionInfo.textContent = `사용자: ${state.session.user_id} · 로그인: ${state.session.login_at} · 자동 로그아웃: ${state.session.timeout_min}분`;
    el.storageModeBadge.textContent = `Storage: ${state.storageMode}`;
  }

  function touchActivity() {
    if (!state.session) return;
    state.session.last_activity_at = Date.now();
  }

  function startTimeoutWatcher() {
    stopTimeoutWatcher();
    state.timeoutCheckTimer = setInterval(async () => {
      if (!state.session) return;
      const limitMs = state.session.timeout_min * 60 * 1000;
      if (Date.now() - state.session.last_activity_at > limitMs) {
        await appendAudit("LOGOUT_TIMEOUT", "session", `auto logout after ${state.session.timeout_min} min`);
        logoutInternal(true);
      }
    }, 3000);
  }

  function stopTimeoutWatcher() {
    if (state.timeoutCheckTimer) {
      clearInterval(state.timeoutCheckTimer);
      state.timeoutCheckTimer = null;
    }
  }

  function logoutInternal(isTimeout) {
    stopTimeoutWatcher();
    clearDraftSaveTimer();
    state.session = null;
    state.currentResult = null;
    state.resultInputKey = "";
    state.confirmedRecord = null;
    el.draftStatus.textContent = "";
    renderAuthView();
    if (isTimeout) {
      setMsg(el.loginMsg, "자동 로그아웃되었습니다. 다시 로그인하세요.", "warn");
    } else {
      setMsg(el.loginMsg, "로그아웃되었습니다.");
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const id = el.loginId.value.trim();
    const pw = el.loginPw.value;

    const authMeta = await state.storage.get(APP_KEYS.authMeta, { failed_attempts: 0, lock_until: null });
    if (authMeta.lock_until && Date.now() < authMeta.lock_until) {
      const remain = Math.ceil((authMeta.lock_until - Date.now()) / 1000);
      setMsg(el.loginMsg, `로그인 잠금 상태입니다. ${remain}초 후 재시도하세요.`, "error");
      return;
    }

    const accounts = await state.storage.get(APP_KEYS.accounts, []);
    const found = accounts.find((a) => a.user_id === id && a.active);
    if (!found || found.password_plain !== pw) {
      authMeta.failed_attempts += 1;
      let msg = `로그인 실패 (${authMeta.failed_attempts}/5)`;
      if (authMeta.failed_attempts >= 5) {
        authMeta.failed_attempts = 0;
        authMeta.lock_until = Date.now() + 60 * 1000;
        msg = "로그인 5회 실패로 1분 잠금되었습니다.";
      }
      await state.storage.set(APP_KEYS.authMeta, authMeta);
      await appendAudit("LOGIN_FAIL", "auth", `id=${id}`);
      setMsg(el.loginMsg, msg, "error");
      return;
    }

    authMeta.failed_attempts = 0;
    authMeta.lock_until = null;
    await state.storage.set(APP_KEYS.authMeta, authMeta);
    state.session = {
      user_id: found.user_id,
      login_at: formatKst(),
      last_activity_at: Date.now(),
      timeout_min: state.criteria && state.criteria.auto_logout_min ? state.criteria.auto_logout_min : 5
    };
    await appendAudit("LOGIN_SUCCESS", "auth", `id=${id}`);
    renderAuthView();
    hydrateCriteriaForm();
    hydrateDraftForm();
    showStep(1);
    showWizardTab();
    startTimeoutWatcher();
    setMsg(el.loginMsg, "");
    el.loginPw.value = "";
  }

  function hydrateCriteriaForm() {
    if (!state.criteria) return;
    el.critMin.value = state.criteria.numeric_min;
    el.critMax.value = state.criteria.numeric_max;
    el.critTexts.value = state.criteria.allowed_texts.join(", ");
    el.timeoutMin.value = state.criteria.auto_logout_min;
  }

  function hydrateDraftForm() {
    if (!state.draft) {
      el.draftStatus.textContent = "";
      return;
    }
    el.sampleId.value = state.draft.sample_id || "";
    el.lotNo.value = state.draft.lot_no || "";
    el.textValue.value = state.draft.text_raw || "";
    el.numericValue.value = state.draft.numeric_input || "";
    el.failReason.value = state.draft.fail_reason || "";
    el.draftStatus.textContent = state.draft.updated_at ? `임시저장 복구: ${state.draft.updated_at}` : "";
    if (state.draft.current_result) {
      state.currentResult = state.draft.current_result;
      state.resultInputKey = inputKeyFromForm();
      renderResult(state.currentResult);
    }
    if (state.draft.locked && state.draft.record_id) {
      el.sampleId.disabled = true;
      el.lotNo.disabled = true;
      el.textValue.disabled = true;
      el.numericValue.disabled = true;
      el.calcBtn.disabled = true;
      const found = state.records.find((r) => r.record_id === state.draft.record_id);
      state.confirmedRecord = found || null;
      if (found) {
        renderReport(found);
      }
      el.draftStatus.textContent = "확정된 레코드입니다. 수정할 수 없습니다.";
    }
  }

  function showStep(step) {
    state.step = step;
    ["step1", "step2", "step3", "step4", "step5"].forEach((id, idx) => {
      if (idx + 1 === step) {
        el[id].classList.remove("hidden");
      } else {
        el[id].classList.add("hidden");
      }
    });
    el.stepLabel.textContent = `${step}/5`;
    el.progressBar.style.width = `${step * 20}%`;
    touchActivity();
  }

  function showWizardTab() {
    el.tabWizard.classList.add("active");
    el.tabSettings.classList.remove("active");
    el.wizardPanel.classList.remove("hidden");
    el.settingsPanel.classList.add("hidden");
  }

  function showSettingsTab() {
    el.tabWizard.classList.remove("active");
    el.tabSettings.classList.add("active");
    el.wizardPanel.classList.add("hidden");
    el.settingsPanel.classList.remove("hidden");
    renderRecordList();
  }

  function getFilteredRecords() {
    const keyword = normalizeText(el.recordSearchInput.value);
    const status = el.recordStatusFilter.value;

    return state.records
      .filter((record) => {
        if (status !== "all" && record.judgement_status !== status) {
          return false;
        }
        if (!keyword) return true;
        const haystack = [
          record.record_id,
          record.sample_id,
          record.lot_no
        ].map((v) => normalizeText(v)).join("|");
        return haystack.includes(keyword);
      })
      .sort((a, b) => b.record_id.localeCompare(a.record_id));
  }

  function renderRecordList() {
    const filtered = getFilteredRecords();
    el.recordCount.textContent = `조회 결과: ${filtered.length}건 / 전체 ${state.records.length}건`;

    if (!filtered.length) {
      el.recordTableBody.innerHTML = "<tr><td colspan=\"6\">조회 결과가 없습니다.</td></tr>";
      return;
    }

    el.recordTableBody.innerHTML = filtered
      .map((r) => {
        return `<tr>
          <td>${escapeHtml(r.created_at)}</td>
          <td>${escapeHtml(r.record_id)}</td>
          <td>${escapeHtml(r.sample_id)}</td>
          <td>${escapeHtml(r.lot_no)}</td>
          <td>${escapeHtml(r.judgement_status)}</td>
          <td><button type="button" class="table-btn" data-record-id="${escapeHtml(r.record_id)}">불러오기</button></td>
        </tr>`;
      })
      .join("");
  }

  function openRecordFromHistory(recordId) {
    const found = state.records.find((r) => r.record_id === recordId);
    if (!found) {
      setMsg(el.settingsMsg, "선택한 기록을 찾을 수 없습니다.", "error");
      return;
    }

    state.confirmedRecord = found;
    renderReport(found);
    showWizardTab();
    showStep(5);
    setMsg(el.reportMsg, `기록 ${found.record_id}를 불러왔습니다. 인쇄/PDF 저장이 가능합니다.`);
  }

  async function saveCriteria() {
    const minRaw = String(el.critMin.value).trim();
    const maxRaw = String(el.critMax.value).trim();
    const timeout = Number(el.timeoutMin.value);
    const texts = parseAllowedTexts(el.critTexts.value);

    if (!minRaw || !maxRaw || Number.isNaN(Number(minRaw)) || Number.isNaN(Number(maxRaw))) {
      setMsg(el.criteriaMsg, "min/max 숫자 기준을 입력하세요.", "error");
      return false;
    }
    if (Number(minRaw) > Number(maxRaw)) {
      setMsg(el.criteriaMsg, "min은 max보다 작거나 같아야 합니다.", "error");
      return false;
    }
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30) {
      setMsg(el.criteriaMsg, "자동 로그아웃은 1~30분 범위여야 합니다.", "error");
      return false;
    }
    if (!texts.length) {
      setMsg(el.criteriaMsg, "허용 텍스트 목록을 최소 1개 이상 입력하세요.", "error");
      return false;
    }

    state.criteria = {
      numeric_min: Number(minRaw),
      numeric_max: Number(maxRaw),
      allowed_texts: texts,
      auto_logout_min: timeout,
      updated_at: formatKst(),
      updated_by: state.session.user_id
    };
    await state.storage.set(APP_KEYS.criteria, state.criteria);
    state.session.timeout_min = timeout;
    await appendAudit("CRITERIA_UPDATE", "criteria", JSON.stringify({
      min: state.criteria.numeric_min,
      max: state.criteria.numeric_max,
      allowed_count: state.criteria.allowed_texts.length,
      timeout_min: state.criteria.auto_logout_min
    }));
    renderAuthView();
    setMsg(el.criteriaMsg, "허용기준이 저장되었습니다.");
    return true;
  }

  async function runJudgement() {
    const sampleId = el.sampleId.value.trim();
    const lotNo = el.lotNo.value.trim();
    const textRaw = el.textValue.value;
    const numRawInput = normalizeNumericInput(el.numericValue.value);

    if (!sampleId || !lotNo || !textRaw || !numRawInput) {
      const result = {
        status: "판정불가",
        reason: "필수 입력값 누락",
        sample_id: sampleId,
        lot_no: lotNo,
        text_raw: textRaw,
        numeric_input: numRawInput
      };
      state.currentResult = result;
      state.resultInputKey = inputKeyFromForm();
      renderResult(result);
      await persistDraft();
      setMsg(el.inputMsg, "필수값을 채워야 판정할 수 있습니다.", "error");
      return;
    }

    if (!isNumericWith2Decimals(numRawInput)) {
      setMsg(el.inputMsg, "숫자값은 소수점 최대 2자리 형식이어야 합니다. (예: -12.34)", "error");
      return;
    }

    const numeric = Number(numRawInput);
    if (Number.isNaN(numeric)) {
      setMsg(el.inputMsg, "숫자값을 확인하세요.", "error");
      return;
    }

    const display = round1(numeric);
    if (!state.criteria) {
      const result = {
        status: "판정불가",
        reason: "허용기준 미설정",
        sample_id: sampleId,
        lot_no: lotNo,
        text_raw: textRaw,
        text_norm: normalizeText(textRaw),
        numeric_raw: numeric,
        numeric_display: display
      };
      state.currentResult = result;
      state.resultInputKey = inputKeyFromForm();
      renderResult(result);
      await persistDraft();
      setMsg(el.inputMsg, "기준이 설정되지 않아 판정불가입니다.", "warn");
      showStep(3);
      return;
    }

    const textNorm = normalizeText(textRaw);
    const textPass = state.criteria.allowed_texts.includes(textNorm);
    const numberPass = numeric >= state.criteria.numeric_min && numeric <= state.criteria.numeric_max;
    let status = "부적합";
    let reason = "";
    if (textPass && numberPass) {
      status = "적합";
      reason = "허용기준 충족";
    } else {
      const reasons = [];
      if (!textPass) reasons.push("텍스트 기준 불일치");
      if (!numberPass) reasons.push("숫자 기준 범위 이탈");
      reason = reasons.join(", ");
    }

    const result = {
      status,
      reason,
      sample_id: sampleId,
      lot_no: lotNo,
      text_raw: textRaw,
      text_norm: textNorm,
      numeric_raw: numeric,
      numeric_display: display,
      numeric_range: `${state.criteria.numeric_min} ~ ${state.criteria.numeric_max}`
    };
    state.currentResult = result;
    state.resultInputKey = inputKeyFromForm();
    renderResult(result);
    await persistDraft();
    el.draftStatus.textContent = `임시저장됨: ${formatKst()}`;
    setMsg(el.inputMsg, "자동 판정을 완료했습니다.");
    setMsg(el.resultMsg, "");
    showStep(3);
  }

  function renderResult(result) {
    const rows = [
      ["샘플 ID", result.sample_id || "-"],
      ["배치번호", result.lot_no || "-"],
      ["텍스트 입력 원값", result.text_raw || "-"],
      ["텍스트 정규화값", result.text_norm || "-"],
      ["숫자 입력 원값", result.numeric_raw ?? result.numeric_input ?? "-"],
      ["숫자 표시값(소수1자리)", result.numeric_display ?? "-"],
      ["판정 사용 범위", result.numeric_range || "-"],
      ["판정 상태", result.status || "-"],
      ["판정 근거", result.reason || "-"]
    ];
    el.resultView.innerHTML = rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("");
    if (result.status === "판정불가") {
      setMsg(el.resultMsg, "판정불가 상태입니다. 기준/입력을 확인하세요.", "warn");
    }
  }

  async function persistDraft() {
    const draft = {
      sample_id: el.sampleId.value.trim(),
      lot_no: el.lotNo.value.trim(),
      text_raw: el.textValue.value,
      numeric_input: normalizeNumericInput(el.numericValue.value),
      fail_reason: el.failReason.value,
      current_result: state.currentResult,
      locked: state.draft ? !!state.draft.locked : false,
      record_id: state.draft ? state.draft.record_id || null : null,
      updated_at: formatKst()
    };
    state.draft = draft;
    await state.storage.set(APP_KEYS.draft, draft);
  }

  function clearDraftSaveTimer() {
    if (!state.draftSaveTimer) return;
    clearTimeout(state.draftSaveTimer);
    state.draftSaveTimer = null;
  }

  function scheduleDraftSave() {
    if (!state.session) return;
    if (state.draft && state.draft.locked) return;

    clearDraftSaveTimer();
    state.draftSaveTimer = setTimeout(async () => {
      try {
        await persistDraft();
        el.draftStatus.textContent = `임시저장됨: ${formatKst()}`;
      } catch (err) {
        console.error(err);
        el.draftStatus.textContent = "임시저장 실패";
      }
    }, 250);
  }

  async function confirmJudgement() {
    if (!state.currentResult) {
      setMsg(el.confirmMsg, "먼저 자동 판정을 실행하세요.", "error");
      return;
    }
    if (state.currentResult.status === "판정불가") {
      setMsg(el.confirmMsg, "판정불가 상태는 확정할 수 없습니다.", "error");
      return;
    }
    if (inputKeyFromForm() !== state.resultInputKey) {
      setMsg(el.confirmMsg, "입력값이 변경되었습니다. 자동 판정을 다시 실행하세요.", "error");
      return;
    }

    const failReason = el.failReason.value.trim();
    if (state.currentResult.status === "부적합" && !failReason) {
      setMsg(el.confirmMsg, "부적합 시 사유 입력은 필수입니다.", "error");
      return;
    }
    if (state.currentResult.status === "적합") {
      el.failReason.value = "";
    }

    const duplicated = state.records.find((r) =>
      r.sample_id === state.currentResult.sample_id &&
      r.lot_no === state.currentResult.lot_no
    );
    if (duplicated) {
      const okDuplicate = window.confirm("동일한 샘플 ID + Lot 조합 기록이 이미 존재합니다. 그래도 새로 확정할까요?");
      if (!okDuplicate) {
        setMsg(el.confirmMsg, "중복 확정을 취소했습니다.", "warn");
        return;
      }
    }

    const record = {
      record_id: `REC_${Date.now()}`,
      sample_id: state.currentResult.sample_id,
      lot_no: state.currentResult.lot_no,
      text_raw: state.currentResult.text_raw,
      text_norm: state.currentResult.text_norm,
      numeric_raw: state.currentResult.numeric_raw,
      numeric_display: state.currentResult.numeric_display,
      judgement_status: state.currentResult.status,
      fail_reason: el.failReason.value.trim(),
      criteria_snapshot: {
        numeric_min: state.criteria.numeric_min,
        numeric_max: state.criteria.numeric_max,
        allowed_texts: [...state.criteria.allowed_texts]
      },
      locked: true,
      created_by: state.session.user_id,
      created_at: formatKst()
    };

    state.records.push(record);
    await state.storage.set(APP_KEYS.records, state.records);

    state.confirmedRecord = record;
    state.draft = {
      sample_id: record.sample_id,
      lot_no: record.lot_no,
      text_raw: record.text_raw,
      numeric_input: String(record.numeric_raw),
      fail_reason: record.fail_reason,
      current_result: state.currentResult,
      locked: true,
      record_id: record.record_id,
      updated_at: formatKst()
    };
    await state.storage.set(APP_KEYS.draft, state.draft);
    await appendAudit("JUDGEMENT_CONFIRM", "record", JSON.stringify({
      record_id: record.record_id,
      status: record.judgement_status
    }));
    renderRecordList();

    el.sampleId.disabled = true;
    el.lotNo.disabled = true;
    el.textValue.disabled = true;
    el.numericValue.disabled = true;
    el.calcBtn.disabled = true;
    clearDraftSaveTimer();
    el.draftStatus.textContent = "확정 완료: 이 레코드는 잠금 상태입니다.";

    setMsg(el.confirmMsg, "판정이 확정되어 잠금 처리되었습니다.");
    renderReport(record);
    showStep(5);
  }

  function renderReport(record) {
    const rows = [
      ["레코드 ID", record.record_id],
      ["샘플 ID", record.sample_id],
      ["배치번호", record.lot_no],
      ["작성자 ID", record.created_by],
      ["생성 시각(KST)", record.created_at],
      ["텍스트 원값", record.text_raw],
      ["텍스트 정규화값", record.text_norm],
      ["숫자 원값", record.numeric_raw],
      ["숫자 표시값(소수1자리)", record.numeric_display],
      ["숫자 허용범위", `${record.criteria_snapshot.numeric_min} ~ ${record.criteria_snapshot.numeric_max}`],
      ["최종 판정", record.judgement_status],
      ["부적합 사유", record.fail_reason || "-"]
    ];
    el.reportPreview.innerHTML = rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("");
  }

  function reportFileBase(record) {
    return `COA_${record.sample_id}_${record.lot_no}_${fileTs()}`;
  }

  async function printReport() {
    if (!state.confirmedRecord) {
      setMsg(el.reportMsg, "확정된 레코드가 없습니다.", "error");
      return;
    }
    const r = state.confirmedRecord;
    const title = reportFileBase(r);
    const hv = escapeHtml;
    const html = `
<!doctype html>
<html lang="ko"><head><meta charset="UTF-8">
<title>${hv(title)}</title>
<style>
body { font-family: "Noto Sans KR", "Malgun Gothic", sans-serif; margin: 30px; color: #1f2a2e; }
h1 { margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; margin-top: 14px; }
th, td { border: 1px solid #8a9491; padding: 8px; text-align: left; font-size: 14px; }
th { background: #f2f6f4; width: 30%; }
.meta { color: #475569; font-size: 12px; }
</style></head>
<body>
<h1>COA 시험성적서 자동판정 보고서</h1>
<p class="meta">생성시각(KST): ${hv(formatKst())} / 작성자: ${hv(r.created_by)}</p>
<table>
<tr><th>레코드 ID</th><td>${hv(r.record_id)}</td></tr>
<tr><th>샘플 ID</th><td>${hv(r.sample_id)}</td></tr>
<tr><th>배치번호</th><td>${hv(r.lot_no)}</td></tr>
<tr><th>텍스트 원값</th><td>${hv(r.text_raw)}</td></tr>
<tr><th>텍스트 정규화값</th><td>${hv(r.text_norm)}</td></tr>
<tr><th>숫자 원값</th><td>${hv(r.numeric_raw)}</td></tr>
<tr><th>숫자 표시값(소수1자리)</th><td>${hv(r.numeric_display)}</td></tr>
<tr><th>숫자 허용범위</th><td>${hv(`${r.criteria_snapshot.numeric_min} ~ ${r.criteria_snapshot.numeric_max}`)}</td></tr>
<tr><th>최종 판정</th><td>${hv(r.judgement_status)}</td></tr>
<tr><th>부적합 사유</th><td>${hv(r.fail_reason || "-")}</td></tr>
</table>
</body></html>`;
    const win = window.open("", "_blank", "width=980,height=760");
    if (!win) {
      setMsg(el.reportMsg, "팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.", "error");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    await appendAudit("REPORT_PRINT", "report", JSON.stringify({ record_id: r.record_id }));
    setMsg(el.reportMsg, "인쇄 창을 열었습니다. PDF 저장 시 파일명을 지정하세요.");
  }

  async function startNewRecord() {
    state.currentResult = null;
    state.resultInputKey = "";
    state.confirmedRecord = null;
    state.draft = null;
    clearDraftSaveTimer();
    await state.storage.remove(APP_KEYS.draft);
    el.sampleId.value = "";
    el.lotNo.value = "";
    el.textValue.value = "";
    el.numericValue.value = "";
    el.failReason.value = "";
    el.resultView.innerHTML = "";
    el.reportPreview.innerHTML = "";
    el.sampleId.disabled = false;
    el.lotNo.disabled = false;
    el.textValue.disabled = false;
    el.numericValue.disabled = false;
    el.calcBtn.disabled = false;
    el.draftStatus.textContent = "";
    setMsg(el.reportMsg, "새 판정을 시작할 수 있습니다.");
    showStep(2);
  }

  async function saveTextFile(text, fname, msgElement, label) {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fname,
          types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        setMsg(msgElement, `${label} 저장 완료: ${fname}`);
        return true;
      } catch (err) {
        if (!err || err.name !== "AbortError") {
          setMsg(msgElement, "파일 저장 API 실패. 다운로드 방식으로 전환합니다.", "warn");
        } else {
          return false;
        }
      }
    }

    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(msgElement, `${label} 다운로드 완료: ${fname}`);
    return true;
  }

  async function exportAuditCsv() {
    await appendAudit("AUDIT_EXPORT", "audit", `count=${state.auditEvents.length}`);
    const header = "timestamp,user_id,action,target,change_detail,checksum";
    const lines = state.auditEvents.map((e) =>
      [
        e.timestamp,
        e.user_id,
        e.action,
        e.target,
        e.change_detail,
        e.checksum
      ].map(escapeCsvCell).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const fname = `AUDIT_${fileTs()}.csv`;

    await saveTextFile(csv, fname, el.settingsMsg, "Audit CSV");
  }

  async function exportRecordsCsv() {
    await appendAudit("RECORD_EXPORT", "records", `count=${state.records.length}`);
    const header = "record_id,created_at,created_by,sample_id,lot_no,text_raw,text_norm,numeric_raw,numeric_display,judgement_status,fail_reason,numeric_min,numeric_max";
    const lines = state.records.map((r) =>
      [
        r.record_id,
        r.created_at,
        r.created_by,
        r.sample_id,
        r.lot_no,
        r.text_raw,
        r.text_norm,
        r.numeric_raw,
        r.numeric_display,
        r.judgement_status,
        r.fail_reason || "",
        r.criteria_snapshot?.numeric_min ?? "",
        r.criteria_snapshot?.numeric_max ?? ""
      ].map(escapeCsvCell).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const fname = `RECORDS_${fileTs()}.csv`;
    await saveTextFile(csv, fname, el.settingsMsg, "판정기록 CSV");
  }

  async function resetPracticeData() {
    const ok = window.confirm("실습 데이터를 초기화합니다. 진행할까요?");
    if (!ok) return;

    state.criteria = null;
    state.records = [];
    state.draft = null;
    state.currentResult = null;
    state.confirmedRecord = null;
    state.auditEvents = [];

    await state.storage.set(APP_KEYS.criteria, null);
    await state.storage.set(APP_KEYS.records, []);
    await state.storage.set(APP_KEYS.draft, null);
    await state.storage.set(APP_KEYS.audit, []);
    await state.storage.set(APP_KEYS.authMeta, { failed_attempts: 0, lock_until: null });

    await appendAudit("DATA_RESET", "app", "manual reset by admin");
    hydrateCriteriaForm();
    renderRecordList();
    await startNewRecord();
    setMsg(el.settingsMsg, "초기화 완료. 기준/판정/Audit가 재설정되었습니다.");
  }

  function bindEvents() {
    el.loginForm.addEventListener("submit", handleLoginSubmit);

    el.logoutBtn.addEventListener("click", async () => {
      await appendAudit("LOGOUT_MANUAL", "session", "user logout");
      logoutInternal(false);
    });

    el.tabWizard.addEventListener("click", showWizardTab);
    el.tabSettings.addEventListener("click", showSettingsTab);

    el.saveCriteriaBtn.addEventListener("click", saveCriteria);
    el.toStep2Btn.addEventListener("click", async () => {
      if (!state.criteria) {
        setMsg(el.criteriaMsg, "실사용 모드에서는 허용기준 저장 후 다음 단계로 진행하세요.", "warn");
        return;
      }
      await persistDraft();
      showStep(2);
    });
    el.backTo1Btn.addEventListener("click", async () => {
      await persistDraft();
      showStep(1);
    });

    el.calcBtn.addEventListener("click", runJudgement);
    el.backTo2Btn.addEventListener("click", async () => {
      await persistDraft();
      showStep(2);
    });
    el.toStep4Btn.addEventListener("click", async () => {
      if (!state.currentResult) {
        setMsg(el.resultMsg, "먼저 자동 판정을 수행하세요.", "error");
        return;
      }
      if (inputKeyFromForm() !== state.resultInputKey) {
        setMsg(el.resultMsg, "입력값이 변경되었습니다. 자동 판정을 다시 실행하세요.", "error");
        return;
      }
      el.failReason.disabled = state.currentResult.status !== "부적합";
      await persistDraft();
      showStep(4);
    });

    el.backTo3Btn.addEventListener("click", async () => {
      await persistDraft();
      showStep(3);
    });
    el.confirmBtn.addEventListener("click", confirmJudgement);

    el.printReportBtn.addEventListener("click", printReport);
    el.newRecordBtn.addEventListener("click", startNewRecord);

    el.exportAuditBtn.addEventListener("click", exportAuditCsv);
    el.exportRecordsBtn.addEventListener("click", exportRecordsCsv);
    el.resetDataBtn.addEventListener("click", resetPracticeData);
    el.recordSearchInput.addEventListener("input", renderRecordList);
    el.recordStatusFilter.addEventListener("change", renderRecordList);
    el.recordTableBody.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("button[data-record-id]")) {
        const recordId = target.getAttribute("data-record-id");
        if (recordId) {
          openRecordFromHistory(recordId);
        }
      }
    });

    [el.sampleId, el.lotNo, el.textValue, el.numericValue, el.failReason].forEach((input) => {
      input.addEventListener("input", () => {
        if (state.currentResult && inputKeyFromForm() !== state.resultInputKey) {
          setMsg(el.resultMsg, "입력 변경됨: 자동 판정을 다시 실행하세요.", "warn");
        }
        scheduleDraftSave();
      });
    });

    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach((evt) => {
      document.addEventListener(evt, touchActivity, { passive: true });
    });
  }

  async function init() {
    bindElements();
    state.storage = new AppStorage();
    state.storageMode = await state.storage.init();
    await seedDefaults();
    bindEvents();
    renderAuthView();
    renderRecordList();
    setMsg(el.loginMsg, "로그인 후 시작하세요.");
    if (state.storageMode === "localstorage") {
      setMsg(el.loginMsg, "IndexedDB 사용 불가로 localStorage 폴백 모드입니다.", "warn");
    }
  }

  init().catch((err) => {
    console.error(err);
    alert("초기화 중 오류가 발생했습니다. 콘솔을 확인하세요.");
  });
})();
