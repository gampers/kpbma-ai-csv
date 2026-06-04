document.addEventListener("DOMContentLoaded", function () {
    const session = COAApp.initPage("approval", "Approver");
    if (!session) return;

    document.getElementById("approvalTable").addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action='approve']");
        if (!button) return;
        const response = COAApp.approveResult(button.dataset.id, session);
        if (!response.success) {
            COAApp.setAlert("approvalAlert", response.message, "danger");
            return;
        }
        COAApp.setAlert("approvalAlert", `승인되었습니다. 문서번호: ${response.result.documentNo}`, "success");
        renderApprovalTable();
    });

    renderApprovalTable();
});

function renderApprovalTable() {
    const target = document.getElementById("approvalTable");
    const rows = COAApp.getResults()
        .filter(item => item.status === "Draft")
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (!rows.length) {
        target.innerHTML = '<div class="empty">승인 대기 중인 시험결과가 없습니다.</div>';
        return;
    }

    target.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>문서번호</th>
                    <th>시험일자</th>
                    <th>품목/검체</th>
                    <th>시험항목</th>
                    <th>결과</th>
                    <th>기준/방법</th>
                    <th>작성자</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(item => `
                    <tr>
                        <td class="mono">${COAApp.escapeHtml(item.documentNo)}</td>
                        <td>${COAApp.escapeHtml(item.testDate)}</td>
                        <td>${COAApp.escapeHtml(item.productName || "-")} / ${COAApp.escapeHtml(item.sampleName || "-")}</td>
                        <td>${COAApp.escapeHtml(item.testItem || "-")}</td>
                        <td>${COAApp.escapeHtml(item.resultValue)} ${COAApp.escapeHtml(item.unit || "")}</td>
                        <td>${COAApp.escapeHtml(item.specificationMethod)}</td>
                        <td>${COAApp.escapeHtml(item.createdByName)} (${COAApp.escapeHtml(item.createdBy)})</td>
                        <td><button class="btn small" type="button" data-action="approve" data-id="${item.id}">승인</button></td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}
