import { sheetAdapter } from "./shared/js/sheetAdapter.js";
import { authHelper } from "./shared/js/authHelper.js";
import logoCi from "../한국제약바이오협회 CI.png";
import { coaModule } from "./modules/coa.js";
import { lmModule } from "./modules/lm.js";
import { elbModule } from "./modules/elb.js";
import { rimModule } from "./modules/rim.js";
import { semModule } from "./modules/sem.js";
import { cvmModule } from "./modules/cvm.js";

// Global modules list
const MODULES = {
  coa: coaModule,
  lm: lmModule,
  elb: elbModule,
  rim: rimModule,
  sem: semModule,
  cvm: cvmModule
};

// Global Helpers
window.esc = function(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};

window.formatKst = function(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Global Toast System
window.toast = {
  show(msg, kind = "info") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.innerHTML = `<span>${kind === "ok" ? "✓" : kind === "error" ? "✗" : "ℹ"}</span> ${msg}`;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 3500);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }
};

// Global Modal System
window.modal = {
  open(htmlContent, onMount) {
    const root = document.getElementById("modal-root");
    if (!root) return;
    root.innerHTML = `<div class="modal-bg"><div class="modal">${htmlContent}</div></div>`;
    if (onMount) onMount(root);
  },
  close() {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }
};

// Settings helper
function getSetting(key) {
  const settings = JSON.parse(localStorage.getItem("gxp_suite:settings") || "[]");
  const s = settings.find(item => item.key === key);
  return s ? s.value : "";
}

function saveSetting(key, value) {
  const settings = JSON.parse(localStorage.getItem("gxp_suite:settings") || "[]");
  const idx = settings.findIndex(item => item.key === key);
  if (idx > -1) {
    settings[idx].value = value;
  } else {
    settings.push({ key, value, system: "COMMON" });
  }
  localStorage.setItem("gxp_suite:settings", JSON.stringify(settings));
}

// Global Shell rendering flag
let shellRendered = false;

// Initialize app
async function initApp() {
  // Run DB sync in background to prevent UI block if Google Sheets fetch hangs
  sheetAdapter.init().then(() => {
    console.log("Database background sync complete.");
  }).catch(err => {
    console.warn("Background database sync failed: ", err);
  });
  
  // Set session timeout from settings
  const timeoutVal = parseInt(getSetting("common:sessionTimeout") || "10", 10);
  if (authHelper.isLoggedIn()) {
    authHelper.startSessionTimer(timeoutVal);
  }
  
  // Listen for hashchange
  window.addEventListener("hashchange", handleRouting);
  
  // Perform initial route
  handleRouting();
}

// Main Routing Handler
function handleRouting() {
  const hash = window.location.hash || "#/launcher";
  
  // Cleanup login canvas components if we navigate away
  if (window.loginCanvasObserver) {
    window.loginCanvasObserver.disconnect();
    window.loginCanvasObserver = null;
  }
  if (window.loginCanvasAnimId) {
    cancelAnimationFrame(window.loginCanvasAnimId);
    window.loginCanvasAnimId = null;
  }
  
  // 1. SSO Check: If not logged in, redirect to login
  if (!authHelper.isLoggedIn()) {
    if (hash !== "#/login") {
      window.location.hash = "#/login";
      return;
    }
    renderLoginView();
    return;
  }
  
  // If user is logged in but goes to login page, redirect to launcher
  if (hash === "#/login") {
    window.location.hash = "#/launcher";
    return;
  }
  
  // Determine if it is a module route or a system console route
  if (hash.startsWith("#/coa/") || hash.startsWith("#/lm/") || hash.startsWith("#/elb/") || hash.startsWith("#/rim/") || hash.startsWith("#/sem/") || hash.startsWith("#/cvm/")) {
    const parts = hash.split("/");
    const moduleKey = parts[1]; // e.g. coa
    const subRoute = parts.slice(2).join("/"); // e.g. dashboard, new, mine, approvals...
    
    // Check permission
    const role = authHelper.getUserRole(moduleKey.toUpperCase());
    if (role === "NONE") {
      alert(`해당 시스템(${moduleKey.toUpperCase()})에 대한 접근 권한이 없습니다. (역할: NONE)`);
      window.location.hash = "#/launcher";
      return;
    }
    
    renderGlobalShell(moduleKey, subRoute);
  } else if (hash === "#/launcher") {
    renderGlobalShell("launcher");
  } else if (hash.startsWith("#/admin/")) {
    const parts = hash.split("/");
    const subRoute = parts[2]; // users, settings, audit
    
    // Admin check: Allow if admin user or has ADMIN role in any system
    const user = authHelper.getCurrentUser();
    const hasAdmin = user.userId === "admin" || Object.values(user.roles).includes("ADMIN");
    if (!hasAdmin) {
      alert("관리자 콘솔에 접근 권한이 없습니다.");
      window.location.hash = "#/launcher";
      return;
    }
    
    renderGlobalShell("admin", subRoute);
  } else {
    // Default fallback
    window.location.hash = "#/launcher";
  }
}

// 2. Render Login View
function renderLoginView() {
  shellRendered = false; // Reset shell state
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="login-wrap">
      <div class="aurora-bg">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
        <div class="blob blob-4"></div>
      </div>
      <canvas id="login-bg-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:2;"></canvas>
      <div class="login-box" id="login-box-card">
        <div class="logo-area" style="text-align: center; margin-bottom: 24px;">
          <img src="${logoCi}" alt="KPBMA CI" style="max-width: 512px; height: auto; display: block; margin: 0 auto;">
        </div>
        <h1>교육팀 CSV 실습 자료 통합 포털</h1>
        <div class="sub">AI-Based 데이터 완전성(DI) 및 CSV 교육 실습용 포털 v2</div>
        
        <form id="login-form">
          <div class="form-row" style="grid-template-columns: 100px 1fr; margin-bottom: 12px;">
            <label class="req">사용자 ID</label>
            <input id="lg-id" autocomplete="off" placeholder="ID 입력">
          </div>
          <div class="form-row" style="grid-template-columns: 100px 1fr; margin-bottom: 20px;">
            <label class="req">비밀번호</label>
            <input id="lg-pw" type="password" autocomplete="off" placeholder="비밀번호 입력">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; border-radius:8px;">로그인</button>
        </form>
        
        <div class="field" style="margin-top: 15px;">
          <label style="font-size:12.5px; font-weight:700; color:var(--color-text-muted);">데모 시드 계정 자동 완성</label>
          <select id="lg-seed-select" style="width:100%; padding:8px; margin-top:4px; border: 1px solid var(--color-border); border-radius:var(--radius-input);">
            <option value="">-- 계정 선택 --</option>
            <option value="admin:admin">통합관리자 (admin / admin)</option>
            <option value="tester:tester">시험자/훈련자 (tester / tester)</option>
            <option value="approver:approver">승인권자/QA (approver / approver)</option>
          </select>
        </div>
      </div>
    </div>
  `;
  
  // Interactive Life & Data Pulse Wave Background Effect
  const canvas = document.getElementById("login-bg-canvas");
  const wrap = document.querySelector(".login-wrap");
  if (canvas && wrap) {
    const ctx = canvas.getContext("2d");
    let width = canvas.width = wrap.clientWidth;
    let height = canvas.height = wrap.clientHeight;
    
    // Resize Observer for responsive canvas
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        width = canvas.width = entry.contentRect.width;
        height = canvas.height = entry.contentRect.height;
      }
    });
    resizeObserver.observe(wrap);
    
    // Mouse state
    let mouse = { x: null, y: null, radius: 220 };
    
    wrap.addEventListener("mousemove", e => {
      const rect = wrap.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    
    wrap.addEventListener("mouseleave", () => {
      mouse.x = null;
      mouse.y = null;
    });
    
    // 3 Waves configuration (pharma-themed frequencies and speeds)
    const waves = [
      {
        yBase: height * 0.5,
        amplitude: 90,
        frequency: 0.002,
        phase: 0,
        speed: 0.0084, // 0.012 * 0.7
        color: "rgba(0, 114, 206, ", // Primary Blue
        lineWidth: 3.5,
        angle: 0,
        angleRange: 0.22, // Max rotation angle in radians (approx 12.6 degrees)
        angleSpeedMultiplier: 0.175 // 0.25 * 0.7
      },
      {
        yBase: height * 0.5,
        amplitude: 60,
        frequency: 0.0035,
        phase: Math.PI / 3,
        speed: -0.0112, // -0.016 * 0.7
        color: "rgba(0, 166, 178, ", // Neon Cyan
        lineWidth: 2.5,
        angle: 0,
        angleRange: 0.18,
        angleSpeedMultiplier: -0.224 // -0.32 * 0.7
      },
      {
        yBase: height * 0.5,
        amplitude: 40,
        frequency: 0.005,
        phase: Math.PI * 2 / 3,
        speed: 0.0056, // 0.008 * 0.7
        color: "rgba(179, 215, 255, ", // Soft Blue
        lineWidth: 1.8,
        angle: 0,
        angleRange: 0.14,
        angleSpeedMultiplier: 0.126 // 0.18 * 0.7
      }
    ];
    
    // Particles flowing along waves
    const particles = [];
    const particleCount = 60;
    
    class WaveParticle {
      constructor(waveIndex) {
        this.waveIndex = waveIndex;
        this.x = Math.random() * width;
        this.speed = (Math.random() * 2.0 + 1.2) * 0.7; // 0.7x speed
        this.radius = Math.random() * 3.0 + 1.8;
        this.alpha = Math.random() * 0.4 + 0.4;
        this.history = [];
        this.maxHistory = Math.floor(Math.random() * 8) + 8; // Trail length
      }
      
      update(waveYMap) {
        this.x += this.speed;
        
        // Wrap around screen boundaries
        if (this.x > width) {
          this.x = 0;
          this.history = [];
        }
        
        // Find Y coordinate from wave's Y map (interpolated or closest x)
        const closestX = Math.round(this.x);
        const yOnWave = waveYMap[closestX] !== undefined ? waveYMap[closestX] : (height * 0.5);
        this.y = yOnWave + (Math.sin(this.x * 0.05) * 4); // Add subtle offset oscillation
        
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > this.maxHistory) {
          this.history.shift();
        }
      }
      
      draw(waveColor) {
        if (this.history.length < 2) return;
        
        // Draw trailing path as a spindle-shaped glowing streak (no distinct round head)
        for (let i = 1; i < this.history.length; i++) {
          const pt1 = this.history[i - 1];
          const pt2 = this.history[i];
          
          // Calculate progress from tail (0) to head (1)
          const progress = i / (this.history.length - 1);
          
          // Spindle shape envelope: thin at tail, thickest near the front, then tapers slightly at head
          const shapeFactor = Math.sin(progress * Math.PI * 0.95 + 0.05);
          const currentWidth = this.radius * (0.15 + 0.85 * shapeFactor);
          
          // Opacity fades out towards the tail
          const currentAlpha = this.alpha * 0.7 * shapeFactor;
          
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.strokeStyle = waveColor + currentAlpha + ")";
          ctx.lineWidth = currentWidth;
          ctx.lineCap = "round";
          
          // Apply a subtle glow shadow directly to the segment
          ctx.shadowBlur = 6;
          ctx.shadowColor = waveColor.includes("166") ? "#00A6B2" : "#0072CE";
          
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset
        }
      }
    }
    
    // Initialize particles distributed across the waves
    for (let i = 0; i < particleCount; i++) {
      particles.push(new WaveParticle(i % waves.length));
    }
    
    let animFrameId;
    function animate() {
      ctx.clearRect(0, 0, width, height);
      
      // Update wave base positions and dynamic flow angles
      waves.forEach(w => {
        w.yBase = height * 0.5;
        w.phase += w.speed;
        // Swing the angle between positive (top-left to bottom-right) and negative (bottom-left to top-right)
        w.angle = Math.sin(w.phase * w.angleSpeedMultiplier) * w.angleRange;
      });
      
      // Store the y-coordinates of each wave across all screen x-values
      // to map particles to them and draw them
      const waveYMaps = waves.map(() => new Float32Array(width + 1));
      
      // 1. Compute and draw the waves
      waves.forEach((w, waveIdx) => {
        const yMap = waveYMaps[waveIdx];
        
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          // Base Y calculation including rotation factor:
          // Center coordinate is used as reference pivot, (x - width/2) * Math.tan(angle) tilts the line
          let y = w.yBase + (x - width / 2) * Math.tan(w.angle) + Math.sin((x * Math.cos(w.angle)) * w.frequency + w.phase) * w.amplitude;
          
          // Apply mouse cursor distortion
          if (mouse.x !== null && mouse.y !== null) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (dist < mouse.radius) {
              const force = (mouse.radius - dist) / mouse.radius;
              // Push the wave lines vertically away from the cursor
              const pushDirection = dy >= 0 ? 1 : -1;
              y += pushDirection * force * 80;
            }
          }
          
          // Save computed Y for particles (fill in step gaps)
          for (let step = 0; step < 4; step++) {
            if (x + step <= width) {
              yMap[x + step] = y;
            }
          }
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        // Draw the main glowing wave line
        ctx.strokeStyle = w.color + "0.3)"; // Base wave opacity
        ctx.lineWidth = w.lineWidth;
        ctx.stroke();
      });
      
      // 2. Update and draw particles along their mapped waves
      particles.forEach(p => {
        p.update(waveYMaps[p.waveIndex]);
        p.draw(waves[p.waveIndex].color);
      });
      
      animFrameId = requestAnimationFrame(animate);
      window.loginCanvasAnimId = animFrameId; // Save for cleanup
    }
    animate();
    
    // Save observer to prevent leaks
    window.loginCanvasObserver = resizeObserver;
  }
  
  // Seed select auto-population
  document.getElementById("lg-seed-select").onchange = function(e) {
    const val = e.target.value;
    if (val) {
      const [id, pw] = val.split(":");
      document.getElementById("lg-id").value = id;
      document.getElementById("lg-pw").value = pw;
    }
  };
  
  document.getElementById("login-form").onsubmit = e => {
    e.preventDefault();
    const id = document.getElementById("lg-id").value.trim();
    const pw = document.getElementById("lg-pw").value;
    
    if (!id || !pw) {
      window.toast.show("ID와 비밀번호를 입력해주세요.", "warn");
      return;
    }
    
    const res = authHelper.login(id, pw);
    if (res.success) {
      window.toast.show(`${res.user.name}님 환영합니다.`, "ok");
      // Set session timeout from settings on login
      const timeoutVal = parseInt(getSetting("common:sessionTimeout") || "10", 10);
      authHelper.startSessionTimer(timeoutVal);
      window.location.hash = "#/launcher";
    } else {
      window.toast.show(window.esc(res.message), "error");
    }
  };
}

// Sidebar Menu Icon Helper
function getMenuIcon(label) {
  const size = 16;
  const color = "currentColor";
  
  if (label.includes("시스템 선택") || label.includes("홈")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
  }
  if (label.includes("계정")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
  }
  if (label.includes("기준정보")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l-7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
  }
  if (label.includes("설정")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
  }
  if (label.includes("대시보드")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`;
  }
  if (label.includes("입력") || label.includes("등록") || label.includes("신규")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>`;
  }
  if (label.includes("작성") || label.includes("등록") || label.includes("조회") || label.includes("목록") || label.includes("기록")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
  }
  if (label.includes("승인")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  }
  if (label.includes("출력") || label.includes("인쇄")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;
  }
  if (label.includes("감사추적") || label.includes("로그")) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
  }
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="menu-icon"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="6" r="2"></circle><circle cx="12" cy="18" r="2"></circle></svg>`;
}

// 3. Render Global Shell (Top Bar + Sidebar + Viewport + Footer)
function renderGlobalShell(activeModuleKey, subRoute = "") {
  const user = authHelper.getCurrentUser();
  const companyName = getSetting("common:companyName") || "교육팀";
  
  // Determine active role in the header
  let activeRoleText = "통합 권한";
  let activeRoleBadge = "ADMIN";
  if (activeModuleKey !== "launcher" && activeModuleKey !== "admin") {
    const role = authHelper.getUserRole(activeModuleKey.toUpperCase());
    activeRoleBadge = role;
    if (role === "ADMIN") activeRoleText = "관리자";
    else if (role === "TESTER" || role === "TRAINER" || role === "OPERATOR" || role === "QC" || role === "VAL") activeRoleText = "기록자(실무자)";
    else if (role === "APPROVER" || role === "QA" || role === "MANAGER") activeRoleText = "승인권자";
  } else if (user.userId === "admin") {
    activeRoleText = "통합 관리자";
    activeRoleBadge = "ADMIN";
  }
  
  // Render sidebar menu items
  let sidebarHtml = "";
  if (activeModuleKey === "launcher" || activeModuleKey === "admin") {
    // System-level Sidebar
    sidebarHtml = `
      <div class="group">시스템 포털</div>
      <a href="#/launcher" class="${activeModuleKey === 'launcher' ? 'active' : ''}">${getMenuIcon("시스템 선택")}<span>시스템 선택(홈)</span></a>
      <a href="#/admin/users" class="${activeModuleKey === 'admin' && subRoute === 'users' ? 'active' : ''}">${getMenuIcon("계정")}<span>통합 계정관리</span></a>
      <a href="#/admin/master" class="${activeModuleKey === 'admin' && subRoute === 'master' ? 'active' : ''}">${getMenuIcon("기준정보")}<span>통합 기준정보 관리</span></a>
      <a href="#/admin/settings" class="${activeModuleKey === 'admin' && subRoute === 'settings' ? 'active' : ''}">${getMenuIcon("설정")}<span>통합 환경설정</span></a>
      <a href="#/admin/audit" class="${activeModuleKey === 'admin' && subRoute === 'audit' ? 'active' : ''}">${getMenuIcon("감사추적")}<span>통합 감사추적</span></a>
      <div style="padding: 16px 24px;" class="no-print">
        <button class="btn btn-danger sm" id="btn-sidebar-reset" style="width:100%; border-radius:8px;">DB 팩토리 리셋</button>
      </div>
    `;
  } else {
    // Module-level Sidebar
    const module = MODULES[activeModuleKey];
    const userRole = authHelper.getUserRole(activeModuleKey.toUpperCase());
    const menus = module.getSidebarMenus(userRole);
    
    const menuLinks = menus.map(m => {
      const active = window.location.hash === m.href ? "class='active'" : "";
      return `<a ${active} href="${m.href}">${getMenuIcon(m.label)}<span>${m.label}</span></a>`;
    }).join("");
    
    sidebarHtml = `
      <div style="padding: 12px 16px 16px;" class="no-print">
        <a class="btn btn-secondary sm" href="#/launcher" style="width:100%; justify-content:center; border-radius:8px;">⊞ 시스템 선택</a>
      </div>
      <div class="group">${module.systemName}</div>
      ${menuLinks}
    `;
  }
  
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="kpbma-topbar no-print">
      <div class="brand" style="display: flex; align-items: center; gap: 20px;">
        <img src="${logoCi}" alt="한국제약바이오협회" style="height: 25px; vertical-align: middle;">
        <span class="title">CSV 실습 자료 통합 시스템</span>
      </div>
      <div class="user-info">
        <span><b>${window.esc(user.name)}</b> (${window.esc(user.userId)})</span>
        <span class="role-badge">${window.esc(activeRoleText)} (${window.esc(activeRoleBadge)})</span>
        <button class="btn btn-secondary sm" id="btn-global-logout" style="padding: 4px 12px; font-size:12px;">로그아웃</button>
      </div>
    </div>
    <div class="shell">
      <div class="sidenav no-print">
        ${sidebarHtml}
      </div>
      <div class="main-panel">
        <div id="content-viewport">
          <!-- Subviews rendered here -->
        </div>
        
        <!-- Strict Regulatory Disclaimer Footer -->
        <div class="kpbma-footer no-print">
          <div class="disclaimer">
            본 시스템은 CSV 실습 교육을 위한 가상 목업 시스템(Mock-up System)입니다.
          </div>
          <div style="margin-top: 8px;">© GAMPLAB AI-Based Data Integrity & CSV</div>
        </div>
      </div>
    </div>
  `;
  
  // Bind global buttons
  document.getElementById("btn-global-logout").onclick = () => {
    authHelper.logout("SYSTEM", "사용자 로그오프 버튼 누름");
  };
  
  const resetBtn = document.getElementById("btn-sidebar-reset");
  if (resetBtn) {
    resetBtn.onclick = () => {
      triggerDatabaseReset();
    };
  }
  
  // Render current viewport content
  const viewport = document.getElementById("content-viewport");
  if (activeModuleKey === "launcher") {
    renderLauncherContent(viewport);
  } else if (activeModuleKey === "admin") {
    renderAdminContent(subRoute, viewport);
  } else {
    // Delegate to module routing
    const module = MODULES[activeModuleKey];
    module.handleRoute(subRoute, viewport);
  }
}

// 4. Render Launcher (System list grid)
function renderLauncherContent(container) {
  const user = authHelper.getCurrentUser();
  
  const systemsData = [
    { key: "coa", num: "01", domain: "QC 영역", title: "시험성적서(COA) 발행", en: "Certificate of Analysis", desc: "시험 결과 입력 및 규격 자동판정, e-Signature 서명 날인, 승인된 전자기록 보안 잠금, 2개 탭 분리 감사추적(Audit Trail)." },
    { key: "lm", num: "02", domain: "QA / HR", title: "교육 이수 관리 시스템", en: "Learning Management", desc: "임직원 교육 이수 평가 기록 관리, 점수별 합격 자동 판정, 이수증(PDF) 출력 및 재교육 주기 관리, 중복 교육 방지." },
    { key: "elb", num: "03", domain: "생산 / QC", title: "전자로그북 시스템", en: "Electronic Logbook", desc: "분석/생산 장비의 사용 로그 전자 기록. append-only 불변 원칙 적용, 장비 사용 기록서 출력 및 통제. (수정/삭제 불가)" },
    { key: "rim", num: "04", domain: "QC 영역", title: "시약/표준품 재고 관리", en: "Reagent Inventory", desc: "시약 입고부터 사용 및 잔량 자동 계산, 음수 재고 차단, 유효기간 통제 및 폐기 승인 수불 이력 관리." },
    { key: "sem", num: "05", domain: "QA / 구매", title: "공급업체 평가 관리", en: "Supplier Evaluation", desc: "협력업체 평가 항목 점수 입력 시 등급 자동 판정(A/B/C/FAIL) 및 ASL(적격공급업체목록) 연동 관리." },
    { key: "cvm", num: "06", domain: "생산 영역", title: "세척 검증 결과 관리", en: "Cleaning Validation", desc: "생산 설비 세척 샘플링 포인트별 잔류물 입력값 대비 허용기준의 다항목 자동 판정(전체 AND) 및 검증서 관리." }
  ];
  
  const cardsHtml = systemsData
    .filter(sys => user.roles[sys.key] !== "NONE") // Omit systems with NONE role
    .map(sys => `
      <a class="system-card" href="#/${sys.key}/dashboard">
        <span class="badge-domain">${sys.domain}</span>
        <div class="num">${sys.num}</div>
        <div>
          <h3>${sys.title}</h3>
          <span style="font-size:11px; color:#94A3B8;">${sys.en}</span>
        </div>
        <p>${sys.desc}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--color-border); padding-top:12px; margin-top:8px;">
          <span class="action-link">시스템 열기 →</span>
        </div>
      </a>
    `).join("");
    
  container.innerHTML = `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size:24px; color:var(--color-primary-dark);">교육팀 CSV 실습 자료 통합 포털</h2>
      <p style="color:var(--color-text-muted); font-size:14px; margin-top:6px;">권한이 할당된 실습 모듈을 선택하여 프로세스를 시작하십시오.</p>
    </div>
    
    <div class="portal-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:24px; margin-top:24px;">
      ${cardsHtml}
    </div>
  `;
}

// 5. Render Admin Contents
function renderAdminContent(subRoute, container) {
  if (subRoute === "users") {
    renderUserManagement(container);
  } else if (subRoute === "master") {
    renderMasterDataManagement(container);
  } else if (subRoute === "settings") {
    renderGlobalSettings(container);
  } else if (subRoute === "audit") {
    renderGlobalSecurityLogs(container);
  }
}

// 5.4 Master Data Management Console
function renderMasterDataManagement(container) {
  let activeCategory = localStorage.getItem("gxp_suite:active_master_tab") || "PRODUCT";
  
  const categories = [
    { key: "PRODUCT", label: "제품명 (COA)" },
    { key: "EQUIPMENT", label: "기기 및 설비 (COA/ELB/CVM)" },
    { key: "COURSE", label: "교육과정 및 코드 (LM)" },
    { key: "REAGENT", label: "시약 및 코드 (RIM)" }
  ];
  
  const tabsHtml = categories.map(cat => `
    <div class="audit-tab ${activeCategory === cat.key ? 'active' : ''}" data-cat-tab="${cat.key}">
      ${cat.label}
    </div>
  `).join("");
  
  const items = sheetAdapter.getMasterData(activeCategory);
  
  const trs = items.map(item => `
    <tr>
      <td><code>${window.esc(item.code)}</code></td>
      <td><b>${window.esc(item.name)}</b></td>
      <td>
        <button class="btn btn-danger sm" data-master-del="${item.code}" style="padding:4px 8px; font-size:12px;">삭제</button>
      </td>
    </tr>
  `).join("");
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h2 style="font-size:20px; color:var(--color-primary-dark);">통합 기준정보 (Master Data) 관리</h2>
      <button class="btn btn-primary" id="btn-add-master">신규 기준정보 등록</button>
    </div>
    
    <div class="audit-tabs">
      ${tabsHtml}
    </div>
    
    <div class="card">
      <h2>기준정보 목록 (${categories.find(c => c.key === activeCategory).label})</h2>
      <table class="list">
        <thead>
          <tr>
            <th style="width:200px;">코드 (ID/Code)</th>
            <th>명칭 및 설명 (Name/Value)</th>
            <th style="width:100px;">작업</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--color-text-muted); padding:30px;">등록된 기준정보가 없습니다.</td></tr>` : trs}
        </tbody>
      </table>
    </div>
  `;
  
  container.querySelectorAll("[data-cat-tab]").forEach(tab => {
    tab.onclick = () => {
      const cat = tab.getAttribute("data-cat-tab");
      localStorage.setItem("gxp_suite:active_master_tab", cat);
      renderMasterDataManagement(container);
    };
  });
  
  container.querySelectorAll("[data-master-del]").forEach(btn => {
    const code = btn.getAttribute("data-master-del");
    btn.onclick = () => {
      if (confirm(`기준정보 [${code}] 항목을 삭제(비활성화) 처리하시겠습니까?`)) {
        sheetAdapter.deleteMasterDataItem(activeCategory, code);
        
        sheetAdapter.saveAuditLog("SYSTEM", {
          category: "SECURITY",
          userId: authHelper.getCurrentUser().userId,
          action: "DELETE_MASTER_DATA",
          targetId: `${activeCategory}:${code}`,
          reason: `기준정보 항목 삭제: 카테고리=${activeCategory}, 코드=${code}`
        });
        
        window.toast.show("기준정보가 삭제되었습니다.", "ok");
        setTimeout(() => { renderMasterDataManagement(container); }, 300);
      }
    };
  });
  
  document.getElementById("btn-add-master").onclick = () => {
    showMasterAddModal(activeCategory, container);
  };
}

function showMasterAddModal(defaultCategory, container) {
  const categories = [
    { key: "PRODUCT", label: "제품명 (COA)" },
    { key: "EQUIPMENT", label: "기기 및 설비 (COA/ELB/CVM)" },
    { key: "COURSE", label: "교육과정 및 코드 (LM)" },
    { key: "REAGENT", label: "시약 및 코드 (RIM)" }
  ];
  
  const categoryOptions = categories.map(cat => `
    <option value="${cat.key}" ${cat.key === defaultCategory ? 'selected' : ''}>${cat.label}</option>
  `).join("");
  
  const content = `
    <h3>신규 기준정보(Master Data) 등록</h3>
    <form id="master-add-form">
      <div class="form-row">
        <label class="req">카테고리</label>
        <select id="m-category" required>
          ${categoryOptions}
        </select>
      </div>
      <div class="form-row">
        <label class="req">코드 (Code/ID)</label>
        <input id="m-code" placeholder="예: PROD-03, EQ-05, RGT-03 등" required>
      </div>
      <div class="form-row">
        <label class="req">명칭/값</label>
        <input id="m-name" placeholder="예: 아세트아미노펜 정, HPLC 분석기 등" required>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-close-m">취소</button>
        <button type="submit" class="btn btn-primary">등록 저장</button>
      </div>
    </form>
  `;
  
  window.modal.open(content, () => {
    document.getElementById("btn-close-m").onclick = window.modal.close;
    
    document.getElementById("master-add-form").onsubmit = e => {
      e.preventDefault();
      
      const payload = {
        category: document.getElementById("m-category").value,
        code: document.getElementById("m-code").value.trim().toUpperCase(),
        name: document.getElementById("m-name").value.trim(),
        isDeleted: false
      };
      
      if (!payload.code || !payload.name) {
        window.toast.show("코드와 명칭을 모두 입력해 주세요.", "warn");
        return;
      }
      
      sheetAdapter.saveMasterDataItem(payload);
      
      sheetAdapter.saveAuditLog("SYSTEM", {
        category: "SECURITY",
        userId: authHelper.getCurrentUser().userId,
        action: "CREATE_MASTER_DATA",
        targetId: `${payload.category}:${payload.code}`,
        reason: `신규 기준정보 추가: 카테고리=${payload.category}, 코드=${payload.code}, 명칭=${payload.name}`
      });
      
      window.toast.show("신규 기준정보 항목이 추가되었습니다.", "ok");
      window.modal.close();
      
      localStorage.setItem("gxp_suite:active_master_tab", payload.category);
      setTimeout(() => { renderMasterDataManagement(container); }, 300);
    };
  });
}

// 5.1 Account Management Console
function renderUserManagement(container) {
  const users = sheetAdapter.getUsers();
  
  const trs = users.map(u => `
    <tr>
      <td><b>${window.esc(u.userId)}</b></td>
      <td>${window.esc(u.name)}</td>
      <td><span class="badge ${u.status === 'ACTIVE' ? 'approved' : 'rejected'}">${u.status}</span></td>
      <td><span style="font-size:11px; font-weight:700;">${window.esc(u.role_coa)}</span></td>
      <td><span style="font-size:11px; font-weight:700;">${window.esc(u.role_lm)}</span></td>
      <td><span style="font-size:11px; font-weight:700;">${window.esc(u.role_elb)}</span></td>
      <td><span style="font-size:11px; font-weight:700;">${window.esc(u.role_rim)}</span></td>
      <td><span style="font-size:11px; font-weight:700;">${window.esc(u.role_sem)}</span></td>
      <td><span style="font-size:11px; font-weight:700;">${window.esc(u.role_cvm)}</span></td>
      <td><button class="btn btn-secondary sm" data-user-edit="${u.userId}" style="padding:4px 8px; font-size:12px;">수정</button></td>
    </tr>
  `).join("");
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h2 style="font-size:20px; color:var(--color-primary-dark);">통합 계정 및 권한 매트릭스 관리</h2>
      <button class="btn btn-primary" id="btn-add-user">신규 계정 등록</button>
    </div>
    
    <div class="card">
      <h2>전체 임직원 계정 목록</h2>
      <table class="list">
        <thead>
          <tr>
            <th>사용자 ID</th>
            <th>이름</th>
            <th>상태</th>
            <th>COA</th>
            <th>LM</th>
            <th>ELB</th>
            <th>RIM</th>
            <th>SEM</th>
            <th>CVM</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>
    </div>
  `;
  
  // Event bindings
  document.getElementById("btn-add-user").onclick = () => showUserEditModal(null);
  
  container.querySelectorAll("[data-user-edit]").forEach(btn => {
    const userId = btn.getAttribute("data-user-edit");
    btn.onclick = () => showUserEditModal(userId);
  });
}

function showUserEditModal(userId) {
  const isEdit = !!userId;
  const users = sheetAdapter.getUsers();
  const userObj = isEdit ? users.find(u => u.userId === userId) : {
    userId: "", name: "", password: "", status: "ACTIVE",
    role_coa: "NONE", role_lm: "NONE", role_elb: "NONE", role_rim: "NONE", role_sem: "NONE", role_cvm: "NONE"
  };
  
  const title = isEdit ? "계정 정보 및 역할 매트릭스 수정" : "신규 계정 등록";
  
  const content = `
    <h3>${title}</h3>
    <form id="user-edit-form">
      <div class="form-row">
        <label class="req">사용자 ID</label>
        <input id="usr-id" value="${window.esc(userObj.userId)}" ${isEdit ? 'readonly style="background:#eee;"' : ''} required>
      </div>
      <div class="form-row">
        <label class="req">사용자명</label>
        <input id="usr-name" value="${window.esc(userObj.name)}" required>
      </div>
      <div class="form-row">
        <label class="req">비밀번호</label>
        <input id="usr-pw" type="password" value="${window.esc(userObj.password)}" required>
      </div>
      <div class="form-row">
        <label class="req">계정 상태</label>
        <select id="usr-status">
          <option value="ACTIVE" ${userObj.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE (활성)</option>
          <option value="INACTIVE" ${userObj.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE (비활성)</option>
        </select>
      </div>
      
      <h4 style="margin:20px 0 10px; color:var(--color-primary-dark); font-size:14px; border-bottom:1px solid var(--color-border); padding-bottom:6px;">6대 시스템 권한 설정 (Role Matrix)</h4>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-row" style="grid-template-columns: 80px 1fr;">
          <label>COA</label>
          <select id="usr-role-coa">
            <option value="NONE" ${userObj.role_coa === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="TESTER" ${userObj.role_coa === 'TESTER' ? 'selected' : ''}>TESTER</option>
            <option value="APPROVER" ${userObj.role_coa === 'APPROVER' ? 'selected' : ''}>APPROVER</option>
            <option value="ADMIN" ${userObj.role_coa === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 80px 1fr;">
          <label>LM</label>
          <select id="usr-role-lm">
            <option value="NONE" ${userObj.role_lm === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="TRAINER" ${userObj.role_lm === 'TRAINER' ? 'selected' : ''}>TRAINER</option>
            <option value="QA" ${userObj.role_lm === 'QA' ? 'selected' : ''}>QA</option>
            <option value="ADMIN" ${userObj.role_lm === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 80px 1fr;">
          <label>ELB</label>
          <select id="usr-role-elb">
            <option value="NONE" ${userObj.role_elb === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="OPERATOR" ${userObj.role_elb === 'OPERATOR' ? 'selected' : ''}>OPERATOR</option>
            <option value="MANAGER" ${userObj.role_elb === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
            <option value="ADMIN" ${userObj.role_elb === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 80px 1fr;">
          <label>RIM</label>
          <select id="usr-role-rim">
            <option value="NONE" ${userObj.role_rim === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="QC" ${userObj.role_rim === 'QC' ? 'selected' : ''}>QC</option>
            <option value="MANAGER" ${userObj.role_rim === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
            <option value="ADMIN" ${userObj.role_rim === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 80px 1fr;">
          <label>SEM</label>
          <select id="usr-role-sem">
            <option value="NONE" ${userObj.role_sem === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="QA" ${userObj.role_sem === 'QA' ? 'selected' : ''}>QA</option>
            <option value="MANAGER" ${userObj.role_sem === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
            <option value="ADMIN" ${userObj.role_sem === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns: 80px 1fr;">
          <label>CVM</label>
          <select id="usr-role-cvm">
            <option value="NONE" ${userObj.role_cvm === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="VAL" ${userObj.role_cvm === 'VAL' ? 'selected' : ''}>VAL</option>
            <option value="QA" ${userObj.role_cvm === 'QA' ? 'selected' : ''}>QA</option>
            <option value="ADMIN" ${userObj.role_cvm === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-close-usr">취소</button>
        <button type="submit" class="btn btn-primary">저장</button>
      </div>
    </form>
  `;
  
  window.modal.open(content, () => {
    document.getElementById("btn-close-usr").onclick = window.modal.close;
    
    document.getElementById("user-edit-form").onsubmit = e => {
      e.preventDefault();
      
      const payload = {
        userId: document.getElementById("usr-id").value.trim(),
        name: document.getElementById("usr-name").value.trim(),
        password: document.getElementById("usr-pw").value,
        status: document.getElementById("usr-status").value,
        role_coa: document.getElementById("usr-role-coa").value,
        role_lm: document.getElementById("usr-role-lm").value,
        role_elb: document.getElementById("usr-role-elb").value,
        role_rim: document.getElementById("usr-role-rim").value,
        role_sem: document.getElementById("usr-role-sem").value,
        role_cvm: document.getElementById("usr-role-cvm").value
      };
      
      const currentUser = authHelper.getCurrentUser();
      
      // Save User
      sheetAdapter.saveUser(payload);
      
      // Log Security Audit
      sheetAdapter.saveAuditLog("SYSTEM", {
        category: "SECURITY",
        userId: currentUser.userId,
        action: isEdit ? "EDIT_USER" : "CREATE_USER",
        targetId: payload.userId,
        reason: `사용자 권한 정보 생성/수정: ${payload.userId} (이름: ${payload.name})`
      });
      
      window.toast.show(`사용자 ${payload.userId} 정보가 업데이트되었습니다.`, "ok");
      window.modal.close();
      
      // Force reload to update UI
      setTimeout(() => { window.location.reload(); }, 300);
    };
  });
}

// 5.2 Settings Console
function renderGlobalSettings(container) {
  const companyName = getSetting("common:companyName") || "㈜갬프연구소";
  const timeoutVal = getSetting("common:sessionTimeout") || "10";
  
  container.innerHTML = `
    <h2 style="font-size:20px; color:var(--color-primary-dark); margin-bottom:20px;">통합 시스템 환경설정</h2>
    
    <div class="card">
      <h2>공통 보안 및 운영 설정</h2>
      <form id="settings-form">
        <div class="form-row">
          <label class="req">기관/회사명</label>
          <input id="set-company" value="${window.esc(companyName)}" required>
        </div>
        <div class="form-row">
          <label class="req">자동 로그아웃 시간 (분)</label>
          <input id="set-timeout" type="number" min="1" max="180" value="${window.esc(timeoutVal)}" required style="width:120px;">
          <small style="color:var(--color-text-muted); display:block; margin-top:6px;">지정된 시간 동안 마우스/키보드 입력이 없으면 세션이 안전하게 자동 종료됩니다.</small>
        </div>
        <div class="form-actions" style="justify-content:flex-start;">
          <button type="submit" class="btn btn-primary">설정 저장</button>
        </div>
      </form>
    </div>
    
    <div class="card" style="border:1px solid var(--color-danger); background-color:#FFF5F5;">
      <h2 style="color:var(--color-danger)">위험 통제: 전체 시스템 데이터 초기화 (DB Factory Reset)</h2>
      <p style="font-size:13px; color:var(--color-text); margin-bottom:16px; line-height:1.6;">
        <b>경고:</b> 이 버튼을 누르면 원격 구글 시트의 기록 및 로컬 웹브라우저 캐시가 모두 완전히 영구 삭제되며, 기본 시드 계정(admin, tester, approver)만 복구됩니다. 
        이 작업은 되돌릴 수 없으며, 모든 감사추적(Audit Trail) 내역도 통제 불가능한 상태로 리셋되므로, 데모 시연 및 실습 초기화 목적으로만 신중히 수행해 주십시오.
      </p>
      <button class="btn btn-danger" id="btn-db-reset">DB Factory Reset 실행</button>
    </div>
  `;
  
  document.getElementById("settings-form").onsubmit = e => {
    e.preventDefault();
    const newCompany = document.getElementById("set-company").value.trim();
    const newTimeout = document.getElementById("set-timeout").value.trim();
    
    saveSetting("common:companyName", newCompany);
    saveSetting("common:sessionTimeout", newTimeout);
    
    const user = authHelper.getCurrentUser();
    
    // Log Audit
    sheetAdapter.saveAuditLog("SYSTEM", {
      category: "SECURITY",
      userId: user.userId,
      action: "UPDATE_SYSTEM_SETTINGS",
      targetId: "SYSTEM",
      reason: `시스템 환경설정 변경 (회사명: ${newCompany}, 타임아웃: ${newTimeout}분)`
    });
    
    window.toast.show("시스템 환경설정이 성공적으로 저장되었습니다.", "ok");
    // Restart timer with new value
    authHelper.startSessionTimer(parseInt(newTimeout, 10));
    
    // Force reload to apply company name across layouts
    setTimeout(() => { window.location.reload(); }, 300);
  };
  
  document.getElementById("btn-db-reset").onclick = () => {
    triggerDatabaseReset();
  };
}

// Global reset handler
function triggerDatabaseReset() {
  const content = `
    <h3 style="color:var(--color-danger);">⚠️ DB 팩토리 초기화 승인 서명</h3>
    <p class="desc" style="color:var(--color-text);">
      전체 데이터베이스 리셋은 <b>위험 수준이 매우 높은 통제 액션</b>입니다.<br>
      초기화 작업을 실행하려면 서명자의 본인 비밀번호와 확인 사유를 입력하십시오.
    </p>
    <form id="reset-confirm-form">
      <div class="form-row">
        <label class="req">관리자 PW</label>
        <input type="password" id="reset-pw" required placeholder="비밀번호 입력">
        <div class="field-error" id="reset-pw-error" style="display:none;"></div>
      </div>
      <div class="form-row">
        <label class="req">실행 사유</label>
        <input type="text" id="reset-reason" required placeholder="실행 이유를 5자 이상 입력하세요.">
        <div class="field-error" id="reset-reason-error" style="display:none;"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-reset-cancel">취소</button>
        <button type="submit" class="btn btn-danger">DB 초기화 수행</button>
      </div>
    </form>
  `;
  
  window.modal.open(content, () => {
    document.getElementById("btn-reset-cancel").onclick = window.modal.close;
    
    document.getElementById("reset-confirm-form").onsubmit = async e => {
      e.preventDefault();
      
      const pwd = document.getElementById("reset-pw").value;
      const reason = document.getElementById("reset-reason").value.trim();
      const user = authHelper.getCurrentUser();
      
      const pwErr = document.getElementById("reset-pw-error");
      const reErr = document.getElementById("reset-reason-error");
      
      pwErr.style.display = "none";
      reErr.style.display = "none";
      
      // Match password
      const users = sheetAdapter.getUsers();
      const me = users.find(u => u.userId === user.userId);
      if (me.password !== pwd) {
        pwErr.textContent = "비밀번호가 올바르지 않습니다.";
        pwErr.style.display = "block";
        return;
      }
      
      if (!reason || reason.length < 5) {
        reErr.textContent = "사유를 5자 이상 입력해 주세요.";
        reErr.style.display = "block";
        return;
      }
      
      window.modal.close();
      window.toast.show("데이터베이스 공장 초기화를 진행 중입니다. 페이지가 새로고침됩니다...", "warn");
      
      // Write audit log first (best effort before reset clears it)
      sheetAdapter.saveAuditLog("SYSTEM", {
        category: "SECURITY",
        userId: user.userId,
        action: "DATABASE_FACTORY_RESET",
        targetId: "SYSTEM",
        reason: `전체 데이터 초기화 실행: ${reason}`
      });
      
      // Execute reset
      await sheetAdapter.resetDatabase();
    };
  });
}

// 5.3 통합 시스템 감사추적 (Global Audit Trail) Console
function renderGlobalSecurityLogs(container) {
  container.innerHTML = `
    <h2 style="font-size:20px; color:var(--color-primary-dark); margin-bottom:20px;">통합 시스템 감사추적 (Global Audit Trail)</h2>
    
    <div class="card no-print">
      <h2>감사추적 로그 검색 및 다차원 필터링</h2>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-top:12px;">
        <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
          <label style="padding-top:0; font-size:12px;">시스템 모듈</label>
          <select id="filt-system">
            <option value="ALL">-- 전체 모듈 --</option>
            <option value="SYSTEM">SYSTEM (공통/보안)</option>
            <option value="COA">COA (시험성적서)</option>
            <option value="LM">LM (교육관리)</option>
            <option value="ELB">ELB (전자로그북)</option>
            <option value="RIM">RIM (시약재고)</option>
            <option value="SEM">SEM (공급업체평가)</option>
            <option value="CVM">CVM (세척검증)</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
          <label style="padding-top:0; font-size:12px;">로그 카테고리</label>
          <select id="filt-category">
            <option value="ALL">-- 전체 카테고리 --</option>
            <option value="SECURITY">SECURITY (보안/접근)</option>
            <option value="DATA">DATA (업무 레코드 조작)</option>
          </select>
        </div>
        <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
          <label style="padding-top:0; font-size:12px;">사용자 ID</label>
          <input id="filt-userid" placeholder="ID 입력 검색">
        </div>
        <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
          <label style="padding-top:0; font-size:12px;">작업 내용 키워드</label>
          <input id="filt-keyword" placeholder="사유/작업명 검색">
        </div>
        <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
          <label style="padding-top:0; font-size:12px;">시작일자</label>
          <input type="date" id="filt-start">
        </div>
        <div class="form-row" style="grid-template-columns:1fr; margin-bottom:0;">
          <label style="padding-top:0; font-size:12px;">종료일자</label>
          <input type="date" id="filt-end">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
        <button class="btn btn-secondary" id="btn-filt-reset" style="padding:8px 16px;">필터 초기화</button>
        <button class="btn btn-primary" id="btn-filt-search" style="padding:8px 24px;">검색 조회</button>
      </div>
    </div>
    
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>감사추적 Audit Trail 목록 (보안 및 데이터 이원화 기록 통합)</h2>
        <button class="btn btn-secondary sm no-print" onclick="window.print()">🖨️ 인쇄 (Print)</button>
      </div>
      <table class="list" id="audit-table">
        <thead>
          <tr>
            <th style="width:160px;">일시 (KST)</th>
            <th style="width:100px;">시스템 모듈</th>
            <th style="width:100px;">카테고리</th>
            <th style="width:100px;">사용자 ID</th>
            <th style="width:140px;">보안/데이터 이벤트</th>
            <th style="width:140px;">대상 레코드 ID</th>
            <th>행위 및 세부 사유 (변경 전/후 포함)</th>
          </tr>
        </thead>
        <tbody id="audit-tbody">
          <!-- Dynamically populated -->
        </tbody>
      </table>
    </div>
  `;

  const searchBtn = document.getElementById("btn-filt-search");
  const resetBtn = document.getElementById("btn-filt-reset");
  
  const runFilter = () => {
    const sysVal = document.getElementById("filt-system").value;
    const catVal = document.getElementById("filt-category").value;
    const userVal = document.getElementById("filt-userid").value.trim().toLowerCase();
    const keywordVal = document.getElementById("filt-keyword").value.trim().toLowerCase();
    const startVal = document.getElementById("filt-start").value;
    const endVal = document.getElementById("filt-end").value;

    const allLogs = JSON.parse(localStorage.getItem("gxp_suite:audit_logs") || "[]");
    
    const filtered = allLogs.filter(l => {
      if (sysVal !== "ALL" && l.system !== sysVal) return false;
      if (catVal !== "ALL" && l.category !== catVal) return false;
      if (userVal && !String(l.userId).toLowerCase().includes(userVal)) return false;
      
      if (keywordVal) {
        const action = String(l.action).toLowerCase();
        const reason = String(l.reason).toLowerCase();
        const target = String(l.targetId).toLowerCase();
        const before = String(l.beforeValue).toLowerCase();
        const after = String(l.afterValue).toLowerCase();
        if (!action.includes(keywordVal) && !reason.includes(keywordVal) && !target.includes(keywordVal) && !before.includes(keywordVal) && !after.includes(keywordVal)) return false;
      }
      
      if (startVal) {
        const logDate = l.timestamp.split("T")[0];
        if (logDate < startVal) return false;
      }
      if (endVal) {
        const logDate = l.timestamp.split("T")[0];
        if (logDate > endVal) return false;
      }
      
      return true;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const tbody = document.getElementById("audit-tbody");
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--color-text-muted); padding:32px;">일치하는 감사 로그가 존재하지 않습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(l => {
      let details = l.reason || "";
      if (l.beforeValue || l.afterValue) {
        details += ` <br><small style="color:var(--color-text-muted); font-size:11px;">`;
        if (l.beforeValue) details += `[변경 전] ${l.beforeValue} `;
        if (l.afterValue) details += ` [변경 후] ${l.afterValue}`;
        details += `</small>`;
      }
      
      return `
        <tr>
          <td>${window.formatKst(l.timestamp)}</td>
          <td><span class="badge" style="background:#163A5F; color:#FFF; font-size:10px;">${window.esc(l.system)}</span></td>
          <td><span class="badge ${l.category === 'SECURITY' ? 'rejected' : 'approved'}" style="font-size:10px;">${l.category}</span></td>
          <td><b>${window.esc(l.userId)}</b></td>
          <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px;">${window.esc(l.action)}</code></td>
          <td><code style="font-size:11px;">${window.esc(l.targetId || "-")}</code></td>
          <td>${details}</td>
        </tr>
      `;
    }).join("");
  };

  searchBtn.onclick = runFilter;
  
  resetBtn.onclick = () => {
    document.getElementById("filt-system").value = "ALL";
    document.getElementById("filt-category").value = "ALL";
    document.getElementById("filt-userid").value = "";
    document.getElementById("filt-keyword").value = "";
    document.getElementById("filt-start").value = "";
    document.getElementById("filt-end").value = "";
    runFilter();
  };

  runFilter();
}

// Start App on page load
window.addEventListener("DOMContentLoaded", initApp);
