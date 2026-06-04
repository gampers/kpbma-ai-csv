document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("resultForm")) initEntryPage();
    if (document.getElementById("resultsTable")) initListPage();
});

function collectResultForm(prefix) {
    const idFor = name => prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name;
    const get = name => document.getElementById(idFor(name)).value.trim();
    return {
        testDate: get("testDate"),
        productName: get("productName"),
        sampleName: get("sampleName"),
        lotNo: get("lotNo"),
        testItem: get("testItem"),
        specificationMethod: get("specificationMethod"),
        equipment: get("equipment"),
        resultValue: get("resultValue"),
        unit: get("unit")
    };
}

function initEntryPage() {
    const session = COAApp.initPage("entry", "Tester");
    if (!session) return;

    COAApp.populateEquipmentDatalist("equipmentOptions");
    document.getElementById("testDate").value = COAApp.todayKst();

    document.getElementById("resultForm").addEventListener("submit", function (event) {
        event.preventDefault();
        const data = collectResultForm("");
        const response = COAApp.createResult(data, session);
        if (!response.success) {
            COAApp.setAlert("entryAlert", response.errors, "danger");
            return;
        }

        COAApp.setAlert("entryAlert", `저장되었습니다. 문서번호: ${response.result.documentNo}`, "success");
        event.target.reset();
        document.getElementById("testDate").value = COAApp.todayKst();
    });
}

function initListPage() {
    const session = COAApp.initPage("list");
    if (!session) return;

    COAApp.populateEquipmentDatalist("editEquipmentOptions");

    ["keywordFilter", "statusFilter", "fromDateFilter", "toDateFilter"].forEach(id => {
        document.getElementById(id).addEventListener("input", () => renderResults(session));
    });

    document.getElementById("resetFilters").addEventListener("click", function () {
        ["keywordFilter", "statusFilter", "fromDateFilter", "toDateFilter"].forEach(id => {
            document.getElementById(id).value = "";
        });
        renderResults(session);
    });

    document.getElementById("resultsTable").addEventListener("click", function (event) {
        const button = event.target.closest("button");
        if (!button) return;
        const id = button.dataset.id;
        if (button.dataset.action === "edit") openEditPanel(id);
        if (button.dataset.action === "print") window.location.href = `coa-print.html?id=${encodeURIComponent(id)}`;
    });

    document.getElementById("cancelEdit").addEventListener("click", closeEditPanel);
    document.getElementById("editForm").addEventListener("submit", function (event) {
        event.preventDefault();
        const id = document.getElementById("editId").value;
        const reason = document.getElementById("editReason").value;
        const response = COAApp.updateResult(id, collectResultForm("edit"), reason, session);
        if (!response.success) {
            COAApp.setAlert("editAlert", response.errors, "danger");
            return;
        }
        COAApp.setAlert("resultListAlert", `수정되었습니다. 문서번호: ${response.result.documentNo}`, "success");
        closeEditPanel();
        renderResults(session);
        renderChangeHistory();
    });

    renderResults(session);
    renderChangeHistory();
}

function getFilteredResults() {
    const keyword = document.getElementById("keywordFilter").value.trim().toLowerCase();
    const status = document.getElementById("statusFilter").value;
    const fromDate = document.getElementById("fromDateFilter").value;
    const toDate = document.getElementById("toDateFilter").value;

    return COAApp.getResults().filter(item => {
        const text = [
            item.documentNo,
            item.productName,
            item.sampleName,
            item.lotNo,
            item.testItem,
            item.equipment,
            item.createdBy,
            item.createdByName
        ].join(" ").toLowerCase();

        if (keyword && !text.includes(keyword)) return false;
        if (status && item.status !== status) return false;
        if (fromDate && item.testDate < fromDate) return false;
        if (toDate && item.testDate > toDate) return false;
        return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderResults(session) {
    const target = document.getElementById("resultsTable");
    const rows = getFilteredResults();

    if (!rows.length) {
        target.innerHTML = '<div class="empty">조회된 시험결과가 없습니다.</div>';
        return;
    }

    target.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>문서번호</th>
                    <th>상태</th>
                    <th>시험일자</th>
                    <th>품목/검체</th>
                    <th>시험항목</th>
                    <th>결과</th>
                    <th>장비</th>
                    <th>작성자</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(item => {
                    const canEdit = item.status !== "Approved" && session.role === "Tester" && item.createdBy === session.userId;
                    const canPrint = item.status === "Approved";
                    return `
                        <tr>
                            <td class="mono">${COAApp.escapeHtml(item.documentNo)}</td>
                            <td>${COAApp.resultStatusBadge(item.status)}</td>
                            <td>${COAApp.escapeHtml(item.testDate)}</td>
                            <td>${COAApp.escapeHtml(item.productName || "-")} / ${COAApp.escapeHtml(item.sampleName || "-")}</td>
                            <td>${COAApp.escapeHtml(item.testItem || "-")}</td>
                            <td>${COAApp.escapeHtml(item.resultValue)} ${COAApp.escapeHtml(item.unit || "")}</td>
                            <td>${COAApp.escapeHtml(item.equipment)}</td>
                            <td>${COAApp.escapeHtml(item.createdByName)} (${COAApp.escapeHtml(item.createdBy)})</td>
                            <td>
                                <button class="btn secondary small" type="button" data-action="edit" data-id="${item.id}" ${canEdit ? "" : "disabled"}>수정</button>
                                <button class="btn accent small" type="button" data-action="print" data-id="${item.id}" ${canPrint ? "" : "disabled"}>출력</button>
                            </td>
                        </tr>
                    `;
                }).join("")}
            </tbody>
        </table>
    `;
}

function openEditPanel(id) {
    const result = COAApp.getResults().find(item => item.id === id);
    if (!result) return;

    document.getElementById("editId").value = result.id;
    document.getElementById("editTestDate").value = result.testDate || "";
    document.getElementById("editProductName").value = result.productName || "";
    document.getElementById("editSampleName").value = result.sampleName || "";
    document.getElementById("editLotNo").value = result.lotNo || "";
    document.getElementById("editTestItem").value = result.testItem || "";
    document.getElementById("editEquipment").value = result.equipment || "";
    document.getElementById("editSpecificationMethod").value = result.specificationMethod || "";
    document.getElementById("editResultValue").value = result.resultValue || "";
    document.getElementById("editUnit").value = result.unit || "";
    document.getElementById("editReason").value = "";
    COAApp.setAlert("editAlert", "", "info");
    document.getElementById("editPanel").classList.remove("hidden");
    document.getElementById("editPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditPanel() {
    document.getElementById("editPanel").classList.add("hidden");
    document.getElementById("editForm").reset();
}

function renderChangeHistory() {
    const target = document.getElementById("changeHistoryTable");
    const changes = COAApp.getChanges().sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    if (!changes.length) {
        target.innerHTML = '<div class="empty">변경 이력이 없습니다.</div>';
        return;
    }

    target.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>일시</th>
                    <th>문서번호</th>
                    <th>수정자</th>
                    <th>수정 사유</th>
                    <th>수정 전/후</th>
                </tr>
            </thead>
            <tbody>
                ${changes.map(change => `
                    <tr>
                        <td>${COAApp.formatDateTime(change.modifiedAt)}</td>
                        <td class="mono">${COAApp.escapeHtml(change.documentNo)}</td>
                        <td>${COAApp.escapeHtml(change.modifiedByName)} (${COAApp.escapeHtml(change.modifiedBy)})</td>
                        <td>${COAApp.escapeHtml(change.reason)}</td>
                        <td>${COAApp.escapeHtml(COAApp.diffSummary(change))}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}
