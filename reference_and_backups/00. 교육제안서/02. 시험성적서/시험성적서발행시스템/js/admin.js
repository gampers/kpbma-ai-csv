let adminSession = null;

document.addEventListener("DOMContentLoaded", function () {
    adminSession = COAApp.initPage("admin", "Approver");
    if (!adminSession) return;

    document.getElementById("accountForm").addEventListener("submit", function (event) {
        event.preventDefault();
        createAccount(event.target);
    });

    document.getElementById("accountsTable").addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action='toggle']");
        if (!button) return;
        toggleAccount(button.dataset.id);
    });

    renderAccounts();
});

function createAccount(form) {
    const id = document.getElementById("accountId").value.trim();
    const name = document.getElementById("accountName").value.trim();
    const password = document.getElementById("accountPassword").value;
    const role = document.getElementById("accountRole").value;
    const accounts = COAApp.getAccounts();

    if (!id || !name || !password || !role) {
        COAApp.setAlert("adminAlert", "필수 항목을 입력하세요.", "danger");
        return;
    }
    if (accounts.some(account => account.id === id)) {
        COAApp.setAlert("adminAlert", "이미 존재하는 사용자 ID입니다.", "danger");
        return;
    }

    accounts.push({
        id,
        password: COAApp.hashPassword(password),
        name,
        role,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: adminSession.userId
    });
    COAApp.saveAccounts(accounts);
    COAApp.addAuditLog("ACCOUNT_CREATE", `계정 생성: ${id} / 권한: ${COAApp.roleLabel(role)}`, id, adminSession);
    COAApp.setAlert("adminAlert", `계정이 생성되었습니다: ${id}`, "success");
    form.reset();
    renderAccounts();
}

function toggleAccount(id) {
    if (id === adminSession.userId) {
        COAApp.setAlert("adminAlert", "현재 로그인한 계정은 비활성화할 수 없습니다.", "danger");
        return;
    }

    const accounts = COAApp.getAccounts();
    const index = accounts.findIndex(account => account.id === id);
    if (index < 0) return;

    accounts[index].active = !accounts[index].active;
    COAApp.saveAccounts(accounts);
    COAApp.addAuditLog(
        "ACCOUNT_STATUS",
        `계정 ${accounts[index].active ? "활성화" : "비활성화"}: ${id}`,
        id,
        adminSession
    );
    renderAccounts();
}

function renderAccounts() {
    const target = document.getElementById("accountsTable");
    const accounts = COAApp.getAccounts().sort((a, b) => a.id.localeCompare(b.id));

    target.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>사용자 ID</th>
                    <th>사용자명</th>
                    <th>권한</th>
                    <th>상태</th>
                    <th>생성일시</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody>
                ${accounts.map(account => `
                    <tr>
                        <td class="mono">${COAApp.escapeHtml(account.id)}</td>
                        <td>${COAApp.escapeHtml(account.name)}</td>
                        <td>${COAApp.roleBadge(account.role)}</td>
                        <td>${account.active ? '<span class="status-badge approved">활성</span>' : '<span class="status-badge inactive">비활성</span>'}</td>
                        <td>${COAApp.formatDateTime(account.createdAt)}</td>
                        <td>
                            <button class="btn secondary small" type="button" data-action="toggle" data-id="${COAApp.escapeHtml(account.id)}">
                                ${account.active ? "비활성화" : "활성화"}
                            </button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}
