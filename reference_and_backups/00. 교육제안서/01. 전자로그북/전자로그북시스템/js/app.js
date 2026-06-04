// ===== 전자로그북 기록 시스템 - 공통 모듈 (app.js) =====

// ===== 시스템 초기화 =====
function initSystem() {
    if (!localStorage.getItem('accounts')) {
        const defaultAdmin = {
            id: 'admin',
            password: hashPassword('admin123!'),
            name: '관리자',
            role: 'Manager',
            createdAt: new Date().toISOString(),
            passwordChangedAt: new Date().toISOString(),
            active: true
        };
        localStorage.setItem('accounts', JSON.stringify([defaultAdmin]));
    }

    if (!localStorage.getItem('systemSettings')) {
        const defaultSettings = {
            autoLogoutMinutes: 15,
            passwordPolicy: {
                minLength: 8,
                requireUppercase: true,
                requireNumber: true,
                requireSpecialChar: true,
                changeIntervalDays: 90
            },
            equipmentList: ['HPLC-001', 'GC-001', 'Balance-001', 'Dissolution-001', 'Karl Fischer-001']
        };
        localStorage.setItem('systemSettings', JSON.stringify(defaultSettings));
    }

    if (!localStorage.getItem('logRecords')) localStorage.setItem('logRecords', '[]');
    if (!localStorage.getItem('auditTrail')) localStorage.setItem('auditTrail', '[]');
}

// ===== 비밀번호 해시 (실습용 간단 해시) =====
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(36);
}

// ===== 인증 관련 =====
function login(userId, password) {
    const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
    const account = accounts.find(a => a.id === userId && a.active);

    if (!account) return { success: false, message: '존재하지 않는 계정이거나 비활성화된 계정입니다.' };
    if (account.password !== hashPassword(password)) return { success: false, message: '비밀번호가 일치하지 않습니다.' };

    // 세션 저장
    const session = {
        userId: account.id,
        userName: account.name,
        role: account.role,
        loginTime: new Date().toISOString()
    };
    sessionStorage.setItem('currentSession', JSON.stringify(session));

    // 감사추적 기록
    addAuditLog('LOGIN', account.id, account.name, '로그인 성공');

    return { success: true, session: session };
}

function logout(reason) {
    const session = getCurrentSession();
    if (session) {
        const detail = reason || '로그아웃';
        addAuditLog('LOGOUT', session.userId, session.userName, detail);
    }
    sessionStorage.removeItem('currentSession');
    window.location.href = 'index.html';
}

function getCurrentSession() {
    const data = sessionStorage.getItem('currentSession');
    return data ? JSON.parse(data) : null;
}

function requireAuth() {
    initSystem();
    const session = getCurrentSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

function requireManager() {
    const session = requireAuth();
    if (session && session.role !== 'Manager') {
        alert('Manager 권한이 필요합니다.');
        window.location.href = 'dashboard.html';
        return null;
    }
    return session;
}

// ===== 감사추적 =====
function addAuditLog(eventType, userId, userName, detail) {
    const trail = JSON.parse(localStorage.getItem('auditTrail') || '[]');
    trail.push({
        eventId: generateUUID(),
        eventType: eventType,
        userId: userId,
        userName: userName,
        timestamp: new Date().toISOString(),
        detail: detail
    });
    localStorage.setItem('auditTrail', JSON.stringify(trail));
}

// ===== UUID 생성 =====
function generateUUID() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, function() {
        return Math.floor(Math.random() * 16).toString(16);
    });
}

// ===== 실시간 시계 (KST) =====
function startClock() {
    function updateClock() {
        const now = new Date();
        const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000 - now.getTimezoneOffset() * 60 * 1000));
        const formatted = formatDateTime(now);
        const el = document.getElementById('clock');
        if (el) el.textContent = 'KST ' + formatted;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// ===== 자동 로그아웃 =====
let autoLogoutTimer = null;
let warningTimer = null;

function startAutoLogout() {
    const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    const minutes = settings.autoLogoutMinutes || 15;
    const ms = minutes * 60 * 1000;
    const warningMs = ms - 60000; // 1분 전 경고

    resetAutoLogout();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetAutoLogout, { passive: true });
    });
}

function resetAutoLogout() {
    const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    const minutes = settings.autoLogoutMinutes || 15;
    const ms = minutes * 60 * 1000;

    if (autoLogoutTimer) clearTimeout(autoLogoutTimer);
    if (warningTimer) clearTimeout(warningTimer);

    // 경고 숨기기
    const warningEl = document.getElementById('logoutWarning');
    if (warningEl) warningEl.style.display = 'none';

    // 1분 전 경고
    if (ms > 60000) {
        warningTimer = setTimeout(function() {
            const warningEl = document.getElementById('logoutWarning');
            if (warningEl) {
                warningEl.style.display = 'block';
                warningEl.textContent = '1분 후 자동 로그아웃됩니다. 활동을 계속하려면 화면을 클릭하세요.';
            }
        }, ms - 60000);
    }

    // 자동 로그아웃
    autoLogoutTimer = setTimeout(function() {
        logout('자동 로그아웃 (' + minutes + '분 비활동)');
    }, ms);
}

// ===== 상단바 렌더링 =====
function renderTopbar(session) {
    const roleBadge = session.role === 'Manager'
        ? '<span class="user-badge manager">Manager</span>'
        : '<span class="user-badge">Operator</span>';

    return `
    <div class="topbar">
        <div class="topbar-left">
            <img src="BandiView_자산 3.png" alt="CI" class="ci-logo">
            <h1>전자로그북 기록 시스템</h1>
        </div>
        <div class="topbar-right">
            <div id="clock"></div>
            <div class="user-info">
                ${roleBadge}
                <span>${session.userName} (${session.userId})</span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="logout()">로그아웃</button>
        </div>
    </div>`;
}

// ===== 네비게이션 렌더링 =====
function renderNav(currentPage, role) {
    const items = [
        { href: 'dashboard.html', label: '대시보드', page: 'dashboard' },
        { href: 'logbook.html', label: '로그 기록', page: 'logbook' },
        { href: 'history.html', label: '이력 조회', page: 'history' }
    ];

    if (role === 'Manager') {
        items.push({ href: 'admin.html', label: '계정 관리', page: 'admin' });
        items.push({ href: 'settings.html', label: '시스템 설정', page: 'settings' });
        items.push({ href: 'audit.html', label: '감사추적', page: 'audit' });
    }

    const links = items.map(item => {
        const active = item.page === currentPage ? ' active' : '';
        return `<a href="${item.href}" class="${active}">${item.label}</a>`;
    }).join('');

    return `<nav class="nav">${links}</nav>`;
}

// ===== 공통 페이지 초기화 =====
function initPage(pageName) {
    const session = requireAuth();
    if (!session) return null;

    const header = document.getElementById('header');
    if (header) {
        header.innerHTML = renderTopbar(session) + renderNav(pageName, session.role);
    }

    startClock();
    startAutoLogout();

    // 푸터 삽입
    const footerHtml = renderPageFooter();
    document.body.insertAdjacentHTML('beforeend', footerHtml);

    return session;
}

// ===== 페이지 푸터 (광고) =====
function renderPageFooter() {
    return `
    <div class="page-footer">
        <div class="footer-brand">
            <img src="BandiView_자산 3.png" alt="CI">
            <span class="footer-tagline">GMP AX 교육과정 | 바이브코딩을 활용한 EndUser GMP 소프트웨어 개발 및 CSV 실습</span>
        </div>
        <div class="footer-sub">Vibe Coding &times; GMP Automation &times; CSV Compliance &times; Software Development Practice</div>
    </div>`;
}

// ===== 유틸리티 함수 =====
function formatDateTime(date) {
    if (typeof date === 'string') date = new Date(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== 비밀번호 정책 검증 =====
function validatePassword(password) {
    const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    const policy = settings.passwordPolicy || {};
    const errors = [];

    if (policy.minLength && password.length < policy.minLength) {
        errors.push(`최소 ${policy.minLength}자 이상이어야 합니다.`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('대문자를 포함해야 합니다.');
    }
    if (policy.requireNumber && !/[0-9]/.test(password)) {
        errors.push('숫자를 포함해야 합니다.');
    }
    if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?]/.test(password)) {
        errors.push('특수문자를 포함해야 합니다.');
    }

    return { valid: errors.length === 0, errors: errors };
}
