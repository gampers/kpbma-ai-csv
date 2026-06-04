// ===== 시험성적서 발행 시스템(COA) - 공통 모듈 =====
(function () {
    const KEYS = {
        accounts: "coa_accounts",
        results: "coa_testResults",
        changes: "coa_changeHistory",
        audit: "coa_auditTrail",
        settings: "coa_systemSettings",
        session: "coa_currentSession"
    };

    const FIELD_LABELS = {
        testDate: "시험일자",
        productName: "품목명",
        sampleName: "검체명",
        lotNo: "제조번호/Lot No.",
        testItem: "시험항목",
        specificationMethod: "시험기준/방법",
        equipment: "장비명",
        resultValue: "결과값",
        unit: "단위"
    };

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.warn("Storage read failed:", key, error);
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i += 1) {
            hash = ((hash << 5) - hash) + password.charCodeAt(i);
            hash |= 0;
        }
        return "hash_" + Math.abs(hash).toString(36);
    }

    function generateId(prefix) {
        return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }

    function initSystem() {
        if (!localStorage.getItem(KEYS.accounts)) {
            write(KEYS.accounts, [
                {
                    id: "tester",
                    password: hashPassword("tester123!"),
                    name: "시험자",
                    role: "Tester",
                    active: true,
                    createdAt: new Date().toISOString(),
                    createdBy: "system"
                },
                {
                    id: "approver",
                    password: hashPassword("approver123!"),
                    name: "승인자",
                    role: "Approver",
                    active: true,
                    createdAt: new Date().toISOString(),
                    createdBy: "system"
                }
            ]);
        }

        if (!localStorage.getItem(KEYS.results)) write(KEYS.results, []);
        if (!localStorage.getItem(KEYS.changes)) write(KEYS.changes, []);
        if (!localStorage.getItem(KEYS.audit)) write(KEYS.audit, []);

        if (!localStorage.getItem(KEYS.settings)) {
            write(KEYS.settings, {
                documentPrefix: "COA",
                backupTime: "18:00",
                lastBackupDate: null,
                autoBackupEnabled: true,
                equipmentList: ["HPLC-001", "GC-001", "Balance-001", "UV-001"]
            });
        }
    }

    function formatDateTime(value) {
        if (!value) return "-";
        const date = value instanceof Date ? value : new Date(value);
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }).formatToParts(date).reduce((acc, part) => {
            acc[part.type] = part.value;
            return acc;
        }, {});
        return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    }

    function formatDate(value) {
        if (!value) return "-";
        const date = value instanceof Date ? value : new Date(value);
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(date).reduce((acc, part) => {
            acc[part.type] = part.value;
            return acc;
        }, {});
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function todayKst() {
        return formatDate(new Date());
    }

    function currentTimeKst() {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Seoul",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).formatToParts(new Date()).reduce((acc, part) => {
            acc[part.type] = part.value;
            return acc;
        }, {});
        return `${parts.hour}:${parts.minute}`;
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    function getAccounts() {
        return read(KEYS.accounts, []);
    }

    function saveAccounts(accounts) {
        write(KEYS.accounts, accounts);
    }

    function getResults() {
        return read(KEYS.results, []);
    }

    function saveResults(results) {
        write(KEYS.results, results);
    }

    function getChanges() {
        return read(KEYS.changes, []);
    }

    function saveChanges(changes) {
        write(KEYS.changes, changes);
    }

    function getAudit() {
        return read(KEYS.audit, []);
    }

    function saveAudit(audit) {
        write(KEYS.audit, audit);
    }

    function getSettings() {
        return read(KEYS.settings, {});
    }

    function saveSettings(settings) {
        write(KEYS.settings, settings);
    }

    function getCurrentSession() {
        return readSession();
    }

    function readSession() {
        try {
            const raw = sessionStorage.getItem(KEYS.session);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function addAuditLog(eventType, detail, targetId, actor) {
        const session = actor || getCurrentSession();
        const audit = getAudit();
        audit.push({
            id: generateId("aud"),
            eventType,
            userId: session ? session.userId : "system",
            userName: session ? session.userName : "system",
            timestamp: new Date().toISOString(),
            detail,
            targetId: targetId || ""
        });
        saveAudit(audit);
    }

    function login(userId, password) {
        initSystem();
        const id = (userId || "").trim();
        const account = getAccounts().find(item => item.id === id);

        if (!account || !account.active) {
            addAuditLog("LOGIN_FAIL", `로그인 실패: ${id || "미입력"} 계정 없음 또는 비활성`);
            return { success: false, message: "존재하지 않거나 비활성화된 계정입니다." };
        }

        if (account.password !== hashPassword(password || "")) {
            addAuditLog("LOGIN_FAIL", `로그인 실패: ${id} 비밀번호 불일치`, "", {
                userId: account.id,
                userName: account.name
            });
            return { success: false, message: "비밀번호가 일치하지 않습니다." };
        }

        const session = {
            userId: account.id,
            userName: account.name,
            role: account.role,
            loginTime: new Date().toISOString()
        };
        sessionStorage.setItem(KEYS.session, JSON.stringify(session));
        addAuditLog("LOGIN", "로그인 성공", "", session);
        return { success: true, session };
    }

    function logout(reason) {
        const session = getCurrentSession();
        if (session) addAuditLog("LOGOUT", reason || "로그아웃", "", session);
        sessionStorage.removeItem(KEYS.session);
        window.location.href = "index.html";
    }

    function requireAuth() {
        initSystem();
        const session = getCurrentSession();
        if (!session) {
            window.location.href = "index.html";
            return null;
        }
        return session;
    }

    function requireRole(roles) {
        const session = requireAuth();
        if (!session) return null;
        const allowed = Array.isArray(roles) ? roles : [roles];
        if (!allowed.includes(session.role)) {
            alert("접근 권한이 없습니다.");
            window.location.href = "dashboard.html";
            return null;
        }
        return session;
    }

    function roleLabel(role) {
        return role === "Approver" ? "승인자" : "시험자";
    }

    function statusLabel(status) {
        return status === "Approved" ? "승인완료" : "미승인";
    }

    function renderHeader(activePage, session) {
        const navItems = [
            { href: "dashboard.html", page: "dashboard", label: "대시보드", roles: ["Tester", "Approver"] },
            { href: "result-entry.html", page: "entry", label: "시험결과 입력", roles: ["Tester"] },
            { href: "result-list.html", page: "list", label: "결과 조회/수정", roles: ["Tester", "Approver"] },
            { href: "approval.html", page: "approval", label: "승인", roles: ["Approver"] },
            { href: "coa-print.html", page: "print", label: "성적서 출력", roles: ["Tester", "Approver"] },
            { href: "admin.html", page: "admin", label: "계정 관리", roles: ["Approver"] },
            { href: "settings.html", page: "settings", label: "환경설정", roles: ["Approver"] },
            { href: "audit.html", page: "audit", label: "Audit Trail", roles: ["Approver"] }
        ];

        const header = document.getElementById("header");
        if (!header) return;

        const links = navItems
            .filter(item => item.roles.includes(session.role))
            .map(item => `<a href="${item.href}" class="${item.page === activePage ? "active" : ""}">${item.label}</a>`)
            .join("");

        const roleClass = session.role === "Approver" ? "approver" : "tester";
        header.innerHTML = `
            <div class="topbar">
                <div class="topbar-left">
                    <h1>시험성적서 발행 시스템</h1>
                    <div class="system-subtitle">COA 발행 시스템 CSV 실습</div>
                </div>
                <div class="topbar-right">
                    <div id="clock" class="clock"></div>
                    <div class="user-pill">
                        <span class="role-badge ${roleClass}">${roleLabel(session.role)}</span>
                        <span>${escapeHtml(session.userName)} (${escapeHtml(session.userId)})</span>
                    </div>
                    <button class="btn secondary small" type="button" onclick="COAApp.logout()">로그아웃</button>
                </div>
            </div>
            <nav class="nav">${links}</nav>
        `;
    }

    function initPage(activePage, roles) {
        const session = roles ? requireRole(roles) : requireAuth();
        if (!session) return null;
        renderHeader(activePage, session);
        startClock();
        startBackupWatcher();
        const footer = document.createElement("div");
        footer.className = "page-footer";
        footer.textContent = "GMP CSV 실습용 소프트웨어 | COA 발행 시스템";
        document.body.appendChild(footer);
        return session;
    }

    function startClock() {
        const clock = document.getElementById("clock");
        if (!clock) return;
        function tick() {
            clock.textContent = "KST " + formatDateTime(new Date());
        }
        tick();
        window.setInterval(tick, 1000);
    }

    function validateResult(data) {
        const errors = [];
        if (!data.testDate) errors.push("시험일자를 입력하세요.");
        if (!data.specificationMethod) errors.push("시험기준/방법을 입력하세요.");
        if (!data.equipment) errors.push("시험 장비명을 입력하세요.");
        if (!data.resultValue) errors.push("결과값을 입력하세요.");
        return errors;
    }

    function generateDocumentNumber(testDate) {
        const settings = getSettings();
        const prefix = (settings.documentPrefix || "COA").trim() || "COA";
        const dateKey = String(testDate || todayKst()).replace(/-/g, "");
        const pattern = `${prefix}-${dateKey}-`;
        const used = getResults()
            .map(result => result.documentNo)
            .filter(docNo => docNo && docNo.startsWith(pattern))
            .map(docNo => parseInt(docNo.slice(pattern.length), 10))
            .filter(Number.isFinite);
        const next = used.length ? Math.max(...used) + 1 : 1;
        return `${pattern}${String(next).padStart(3, "0")}`;
    }

    function createResult(data, session) {
        const errors = validateResult(data);
        if (errors.length) return { success: false, errors };

        const result = {
            id: generateId("res"),
            documentNo: generateDocumentNumber(data.testDate),
            status: "Draft",
            testDate: data.testDate,
            productName: data.productName || "",
            sampleName: data.sampleName || "",
            lotNo: data.lotNo || "",
            testItem: data.testItem || "",
            specificationMethod: data.specificationMethod,
            equipment: data.equipment,
            resultValue: data.resultValue,
            unit: data.unit || "",
            precisionText: "±1% 이내",
            createdBy: session.userId,
            createdByName: session.userName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            approvedBy: null,
            approvedByName: null,
            approvedAt: null,
            issuedBy: null,
            issuedByName: null,
            issuedAt: null
        };

        const results = getResults();
        results.push(result);
        saveResults(results);
        addAuditLog("RESULT_CREATE", `시험결과 입력: ${result.documentNo}`, result.id, session);
        return { success: true, result };
    }

    function normalizeEditableData(data) {
        return {
            testDate: data.testDate || "",
            productName: data.productName || "",
            sampleName: data.sampleName || "",
            lotNo: data.lotNo || "",
            testItem: data.testItem || "",
            specificationMethod: data.specificationMethod || "",
            equipment: data.equipment || "",
            resultValue: data.resultValue || "",
            unit: data.unit || ""
        };
    }

    function updateResult(resultId, data, reason, session) {
        const results = getResults();
        const index = results.findIndex(result => result.id === resultId);
        if (index < 0) return { success: false, errors: ["대상 결과를 찾을 수 없습니다."] };

        const current = results[index];
        if (current.status === "Approved") {
            return { success: false, errors: ["승인 완료된 결과는 수정할 수 없습니다."] };
        }

        if (session.role !== "Tester" || current.createdBy !== session.userId) {
            return { success: false, errors: ["본인이 작성한 미승인 결과만 수정할 수 있습니다."] };
        }

        const nextData = normalizeEditableData(data);
        const errors = validateResult(nextData);
        if (!reason || !reason.trim()) errors.push("수정 사유를 입력하세요.");
        if (errors.length) return { success: false, errors };

        const beforeValues = {};
        const afterValues = {};
        Object.keys(nextData).forEach(key => {
            if ((current[key] || "") !== nextData[key]) {
                beforeValues[key] = current[key] || "";
                afterValues[key] = nextData[key];
            }
        });

        if (!Object.keys(afterValues).length) {
            return { success: false, errors: ["변경된 항목이 없습니다."] };
        }

        results[index] = {
            ...current,
            ...nextData,
            updatedAt: new Date().toISOString()
        };
        saveResults(results);

        const changes = getChanges();
        changes.push({
            id: generateId("chg"),
            resultId: current.id,
            documentNo: current.documentNo,
            reason: reason.trim(),
            beforeValues,
            afterValues,
            modifiedBy: session.userId,
            modifiedByName: session.userName,
            modifiedAt: new Date().toISOString()
        });
        saveChanges(changes);

        addAuditLog("RESULT_UPDATE", `시험결과 수정: ${current.documentNo} / 사유: ${reason.trim()}`, current.id, session);
        return { success: true, result: results[index] };
    }

    function approveResult(resultId, session) {
        if (session.role !== "Approver") return { success: false, message: "승인자 권한이 필요합니다." };
        const results = getResults();
        const index = results.findIndex(result => result.id === resultId);
        if (index < 0) return { success: false, message: "대상 결과를 찾을 수 없습니다." };
        if (results[index].status === "Approved") return { success: false, message: "이미 승인된 결과입니다." };

        results[index] = {
            ...results[index],
            status: "Approved",
            approvedBy: session.userId,
            approvedByName: session.userName,
            approvedAt: new Date().toISOString()
        };
        saveResults(results);
        addAuditLog("RESULT_APPROVE", `시험결과 승인: ${results[index].documentNo}`, resultId, session);
        return { success: true, result: results[index] };
    }

    function issueResult(resultId, session) {
        const results = getResults();
        const index = results.findIndex(result => result.id === resultId);
        if (index < 0) return { success: false, message: "대상 결과를 찾을 수 없습니다." };
        if (results[index].status !== "Approved") return { success: false, message: "승인 완료된 결과만 출력할 수 있습니다." };

        results[index] = {
            ...results[index],
            issuedBy: session.userId,
            issuedByName: session.userName,
            issuedAt: new Date().toISOString()
        };
        saveResults(results);
        addAuditLog("COA_PRINT", `시험성적서 출력: ${results[index].documentNo}`, resultId, session);
        return { success: true, result: results[index] };
    }

    function setAlert(elementId, message, type) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (!message) {
            el.className = "alert";
            el.textContent = "";
            return;
        }
        el.className = `alert show ${type || "info"}`;
        el.textContent = Array.isArray(message) ? message.join(" ") : message;
    }

    function populateEquipmentDatalist(listId) {
        const list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = getSettings().equipmentList
            .map(item => `<option value="${escapeHtml(item)}"></option>`)
            .join("");
    }

    function resultStatusBadge(status) {
        const cls = status === "Approved" ? "approved" : "draft";
        return `<span class="status-badge ${cls}">${statusLabel(status)}</span>`;
    }

    function roleBadge(role) {
        const cls = role === "Approver" ? "approver" : "tester";
        return `<span class="role-badge ${cls}">${roleLabel(role)}</span>`;
    }

    function diffSummary(change) {
        return Object.keys(change.afterValues || {}).map(key => {
            const label = FIELD_LABELS[key] || key;
            return `${label}: "${change.beforeValues[key] || ""}" → "${change.afterValues[key] || ""}"`;
        }).join(" / ");
    }

    function collectBackupPayload() {
        return {
            exportedAt: new Date().toISOString(),
            exportedAtKst: formatDateTime(new Date()),
            accounts: getAccounts(),
            testResults: getResults(),
            changeHistory: getChanges(),
            auditTrail: getAudit(),
            systemSettings: getSettings()
        };
    }

    function downloadJson(filename, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function runBackup(auto) {
        const settings = getSettings();
        const date = todayKst();
        const filename = `COA_BACKUP_${date.replace(/-/g, "")}_${auto ? "AUTO" : "MANUAL"}.json`;
        downloadJson(filename, collectBackupPayload());
        settings.lastBackupDate = date;
        saveSettings(settings);
        addAuditLog(auto ? "AUTO_BACKUP" : "MANUAL_BACKUP", `${auto ? "자동" : "수동"} 백업 실행: ${filename}`);
        return filename;
    }

    function maybeRunAutoBackup() {
        const settings = getSettings();
        if (!settings.autoBackupEnabled || !settings.backupTime) return;
        const today = todayKst();
        if (settings.lastBackupDate === today) return;
        if (currentTimeKst() >= settings.backupTime) runBackup(true);
    }

    function startBackupWatcher() {
        maybeRunAutoBackup();
        window.setInterval(maybeRunAutoBackup, 60000);
    }

    window.COAApp = {
        KEYS,
        FIELD_LABELS,
        initSystem,
        hashPassword,
        generateId,
        login,
        logout,
        requireAuth,
        requireRole,
        initPage,
        getCurrentSession,
        addAuditLog,
        getAccounts,
        saveAccounts,
        getResults,
        saveResults,
        getChanges,
        saveChanges,
        getAudit,
        saveAudit,
        getSettings,
        saveSettings,
        createResult,
        updateResult,
        approveResult,
        issueResult,
        validateResult,
        generateDocumentNumber,
        populateEquipmentDatalist,
        setAlert,
        resultStatusBadge,
        roleBadge,
        roleLabel,
        statusLabel,
        diffSummary,
        runBackup,
        formatDateTime,
        formatDate,
        todayKst,
        escapeHtml
    };

    initSystem();
}());
