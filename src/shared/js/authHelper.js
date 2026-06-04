// Authentication & Role-Based Access Control (RBAC) Helper
import { sheetAdapter } from "./sheetAdapter.js";

const SESSION_KEY = "gxp_suite:session";
let timeoutTimer = null;

export const authHelper = {
  // Login user and set session
  login(userId, password) {
    const users = sheetAdapter.getUsers();
    const user = users.find(u => u.userId === userId && String(u.password) === String(password));
    
    if (!user) {
      return { success: false, message: "ID 또는 비밀번호가 올바르지 않습니다." };
    }
    
    if (user.status !== "ACTIVE") {
      return { success: false, message: "이 계정은 현재 비활성화 상태입니다. 관리자에게 문의하세요." };
    }
    
    const session = {
      userId: user.userId,
      name: user.name,
      roles: {
        coa: user.role_coa || "NONE",
        lm: user.role_lm || "NONE",
        elb: user.role_elb || "NONE",
        rim: user.role_rim || "NONE",
        sem: user.role_sem || "NONE",
        cvm: user.role_cvm || "NONE"
      },
      loginAt: new Date().toISOString()
    };
    
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    
    // Save login log to System Security Audit Trail
    sheetAdapter.saveAuditLog("SYSTEM", {
      category: "SECURITY",
      userId: user.userId,
      action: "USER_LOGIN",
      targetId: user.userId,
      reason: "시스템 로그온 성공"
    });
    
    this.startSessionTimer();
    return { success: true, user: session };
  },

  // Logout and clear session
  logout(systemName = "SYSTEM", reason = "사용자 로그오프") {
    const session = this.getCurrentUser();
    if (session) {
      sheetAdapter.saveAuditLog(systemName, {
        category: "SECURITY",
        userId: session.userId,
        action: "USER_LOGOUT",
        targetId: session.userId,
        reason: reason
      });
    }
    
    sessionStorage.removeItem(SESSION_KEY);
    this.clearSessionTimer();
    
    // Redirect to login page inside the system context
    window.location.hash = "#/login";
  },

  // Get current logged-in user session
  getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  },

  // Check if current user is logged in
  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  // Get role of current user for a specific system
  getUserRole(systemKey) {
    const user = this.getCurrentUser();
    if (!user) return "NONE";
    return user.roles[systemKey.toLowerCase()] || "NONE";
  },

  // Verify route access against system-level permissions
  guardRoute(systemKey, allowedRoles = []) {
    if (!this.isLoggedIn()) {
      window.location.hash = "#/login";
      return false;
    }
    
    const role = this.getUserRole(systemKey);
    if (!allowedRoles.includes(role)) {
      alert(`접근 권한이 없습니다. (필요 권한: ${allowedRoles.join(", ")})`);
      window.location.hash = "#/dashboard";
      return false;
    }
    return true;
  },

  // Session Timeout Timer management
  startSessionTimer(timeoutMinutes = 10) {
    this.clearSessionTimer();
    
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    const resetTimer = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(() => {
        this.logout("SYSTEM", "장시간 무반응으로 인한 자동 세션 만료 (10분)");
        alert("보안을 위해 장시간 입력이 없어 자동 로그아웃되었습니다.");
      }, timeoutMs);
    };

    // Watch for key user actions to defer timeout
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keypress", resetTimer);
    window.addEventListener("click", resetTimer);
    
    // Store cleanup method on instance to remove event listeners on logout
    this._cleanupEvents = () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keypress", resetTimer);
      window.removeEventListener("click", resetTimer);
    };

    resetTimer();
  },

  clearSessionTimer() {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    if (this._cleanupEvents) {
      this._cleanupEvents();
      this._cleanupEvents = null;
    }
  }
};
export default authHelper;
