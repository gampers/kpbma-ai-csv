document.addEventListener("DOMContentLoaded", function () {
    const session = COAApp.initPage("audit", "Approver");
    if (!session) return;

    populateEventTypes();
    ["auditKeyword", "auditEventType", "auditFromDate", "auditToDate"].forEach(id => {
        document.getElementById(id).addEventListener("input", renderAudit);
    });
    document.getElementById("auditReset").addEventListener("click", function () {
        ["auditKeyword", "auditEventType", "auditFromDate", "auditToDate"].forEach(id => {
            document.getElementById(id).value = "";
        });
        renderAudit();
    });

    renderAudit();
});

function populateEventTypes() {
    const select = document.getElementById("auditEventType");
    const types = [...new Set(COAApp.getAudit().map(item => item.eventType))].sort();
    select.innerHTML = '<option value="">전체</option>' + types.map(type => `
        <option value="${COAApp.escapeHtml(type)}">${COAApp.escapeHtml(type)}</option>
    `).join("");
}

function renderAudit() {
    const keyword = document.getElementById("auditKeyword").value.trim().toLowerCase();
    const eventType = document.getElementById("auditEventType").value;
    const fromDate = document.getElementById("auditFromDate").value;
    const toDate = document.getElementById("auditToDate").value;
    const target = document.getElementById("auditTable");

    const rows = COAApp.getAudit()
        .filter(item => {
            const eventDate = COAApp.formatDate(item.timestamp);
            const text = [item.eventType, item.userId, item.userName, item.detail, item.targetId]
                .join(" ")
                .toLowerCase();

            if (keyword && !text.includes(keyword)) return false;
            if (eventType && item.eventType !== eventType) return false;
            if (fromDate && eventDate < fromDate) return false;
            if (toDate && eventDate > toDate) return false;
            return true;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!rows.length) {
        target.innerHTML = '<div class="empty">조회된 Audit Trail이 없습니다.</div>';
        return;
    }

    target.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>일시(KST)</th>
                    <th>이벤트</th>
                    <th>사용자</th>
                    <th>상세내용</th>
                    <th>대상 ID</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(item => `
                    <tr>
                        <td>${COAApp.formatDateTime(item.timestamp)}</td>
                        <td class="mono">${COAApp.escapeHtml(item.eventType)}</td>
                        <td>${COAApp.escapeHtml(item.userName)} (${COAApp.escapeHtml(item.userId)})</td>
                        <td>${COAApp.escapeHtml(item.detail)}</td>
                        <td class="mono">${COAApp.escapeHtml(item.targetId || "-")}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}
