document.addEventListener("DOMContentLoaded", function () {
    COAApp.initSystem();

    if (COAApp.getCurrentSession()) {
        window.location.href = "dashboard.html";
        return;
    }

    const form = document.getElementById("loginForm");
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        const userId = document.getElementById("userId").value;
        const password = document.getElementById("password").value;
        const result = COAApp.login(userId, password);

        if (!result.success) {
            COAApp.setAlert("loginAlert", result.message, "danger");
            return;
        }

        window.location.href = "dashboard.html";
    });
});
