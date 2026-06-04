let selectedResultId = "";
let currentSession = null;

document.addEventListener("DOMContentLoaded", function () {
    currentSession = COAApp.initPage("print");
    if (!currentSession) return;

    const params = new URLSearchParams(window.location.search);
    selectedResultId = params.get("id") || "";

    document.getElementById("coaKeyword").addEventListener("input", renderOptions);
    document.getElementById("coaSelect").addEventListener("change", function (event) {
        selectedResultId = event.target.value;
        renderPreview();
    });
    document.getElementById("previewButton").addEventListener("click", renderPreview);
    document.getElementById("printButton").addEventListener("click", printSelected);

    renderOptions();
    renderPreview();
});

function approvedResults() {
    const keyword = document.getElementById("coaKeyword").value.trim().toLowerCase();
    return COAApp.getResults()
        .filter(item => item.status === "Approved")
        .filter(item => {
            if (!keyword) return true;
            return [item.documentNo, item.productName, item.sampleName, item.lotNo, item.testItem]
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        })
        .sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt));
}

function renderOptions() {
    const rows = approvedResults();
    const select = document.getElementById("coaSelect");

    if (!rows.length) {
        select.innerHTML = '<option value="">승인 완료 결과 없음</option>';
        selectedResultId = "";
        renderPreview();
        return;
    }

    if (!selectedResultId || !rows.some(item => item.id === selectedResultId)) {
        selectedResultId = rows[0].id;
    }

    select.innerHTML = rows.map(item => `
        <option value="${item.id}" ${item.id === selectedResultId ? "selected" : ""}>
            ${COAApp.escapeHtml(item.documentNo)} / ${COAApp.escapeHtml(item.productName || "-")} / ${COAApp.escapeHtml(item.testItem || "-")}
        </option>
    `).join("");
}

function renderPreview(resultOverride) {
    const result = resultOverride || COAApp.getResults().find(item => item.id === selectedResultId);
    const printButton = document.getElementById("printButton");
    const target = document.getElementById("printArea");

    if (!result || result.status !== "Approved") {
        target.innerHTML = '<div class="panel"><div class="empty">출력할 승인 완료 결과를 선택하세요.</div></div>';
        printButton.disabled = true;
        return;
    }

    printButton.disabled = false;
    target.innerHTML = buildCoaHtml(result);
}

function buildCoaHtml(result) {
    const issuedAt = result.issuedAt || new Date().toISOString();
    const issuedByName = result.issuedByName || currentSession.userName;
    const issuedBy = result.issuedBy || currentSession.userId;

    return `
        <article class="coa-document">
            <h1>시험성적서</h1>
            <div class="coa-meta">
                <div><strong>문서번호</strong><span class="mono">${COAApp.escapeHtml(result.documentNo)}</span></div>
                <div><strong>발행일자</strong><span>${COAApp.formatDateTime(issuedAt)}</span></div>
                <div><strong>출력자</strong><span>${COAApp.escapeHtml(issuedByName)} (${COAApp.escapeHtml(issuedBy)})</span></div>
                <div><strong>상태</strong><span>승인완료</span></div>
                <div><strong>품목명</strong><span>${COAApp.escapeHtml(result.productName || "-")}</span></div>
                <div><strong>검체명</strong><span>${COAApp.escapeHtml(result.sampleName || "-")}</span></div>
                <div><strong>제조번호/Lot No.</strong><span>${COAApp.escapeHtml(result.lotNo || "-")}</span></div>
                <div><strong>시험일자</strong><span>${COAApp.escapeHtml(result.testDate)}</span></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>시험항목</th>
                        <th>시험기준/방법</th>
                        <th>장비명</th>
                        <th>결과값</th>
                        <th>정밀도</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${COAApp.escapeHtml(result.testItem || "-")}</td>
                        <td>${COAApp.escapeHtml(result.specificationMethod)}</td>
                        <td>${COAApp.escapeHtml(result.equipment)}</td>
                        <td>${COAApp.escapeHtml(result.resultValue)} ${COAApp.escapeHtml(result.unit || "")}</td>
                        <td>${COAApp.escapeHtml(result.precisionText || "±1% 이내")}</td>
                    </tr>
                </tbody>
            </table>

            <div class="signature-grid">
                <div class="signature-box">
                    <strong>시험자</strong><br>
                    ${COAApp.escapeHtml(result.createdByName)} (${COAApp.escapeHtml(result.createdBy)})<br>
                    ${COAApp.formatDateTime(result.createdAt)}
                </div>
                <div class="signature-box">
                    <strong>승인자</strong><br>
                    ${COAApp.escapeHtml(result.approvedByName)} (${COAApp.escapeHtml(result.approvedBy)})<br>
                    ${COAApp.formatDateTime(result.approvedAt)}
                </div>
                <div class="signature-box">
                    <strong>출력자</strong><br>
                    ${COAApp.escapeHtml(issuedByName)} (${COAApp.escapeHtml(issuedBy)})<br>
                    ${COAApp.formatDateTime(issuedAt)}
                </div>
            </div>
        </article>
    `;
}

function printSelected() {
    const response = COAApp.issueResult(selectedResultId, currentSession);
    if (!response.success) {
        COAApp.setAlert("coaAlert", response.message, "danger");
        return;
    }

    COAApp.setAlert("coaAlert", `출력 이력이 기록되었습니다. 문서번호: ${response.result.documentNo}`, "success");
    renderPreview(response.result);
    document.body.classList.add("printing");
    window.setTimeout(function () {
        window.print();
        document.body.classList.remove("printing");
    }, 100);
}
