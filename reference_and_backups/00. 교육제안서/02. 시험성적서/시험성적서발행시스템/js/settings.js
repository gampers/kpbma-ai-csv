let settingsSession = null;

document.addEventListener("DOMContentLoaded", function () {
    settingsSession = COAApp.initPage("settings", "Approver");
    if (!settingsSession) return;

    loadSettings();

    document.getElementById("settingsForm").addEventListener("submit", function (event) {
        event.preventDefault();
        saveSettings();
    });

    document.getElementById("manualBackupButton").addEventListener("click", function () {
        const filename = COAApp.runBackup(false);
        COAApp.setAlert("settingsAlert", `백업 파일이 생성되었습니다: ${filename}`, "success");
        loadSettings();
    });
});

function loadSettings() {
    const settings = COAApp.getSettings();
    document.getElementById("documentPrefix").value = settings.documentPrefix || "COA";
    document.getElementById("backupTime").value = settings.backupTime || "18:00";
    document.getElementById("autoBackupEnabled").value = String(settings.autoBackupEnabled !== false);
    document.getElementById("lastBackupDate").value = settings.lastBackupDate || "없음";
    document.getElementById("equipmentList").value = (settings.equipmentList || []).join("\n");
}

function saveSettings() {
    const settings = COAApp.getSettings();
    const prefix = document.getElementById("documentPrefix").value.trim() || "COA";
    const backupTime = document.getElementById("backupTime").value || "18:00";
    const autoBackupEnabled = document.getElementById("autoBackupEnabled").value === "true";
    const equipmentList = document.getElementById("equipmentList").value
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);

    COAApp.saveSettings({
        ...settings,
        documentPrefix: prefix,
        backupTime,
        autoBackupEnabled,
        equipmentList
    });
    COAApp.addAuditLog("SETTINGS_UPDATE", "환경설정 변경", "", settingsSession);
    COAApp.setAlert("settingsAlert", "설정이 저장되었습니다.", "success");
    loadSettings();
}
