# Original User Request

## 2026-06-04T17:45:07+09:00

Merge 6 separate virtual GMP training systems (COA, LM, ELB, RIM, SEM, CVM) into a single, comprehensive Vite SPA software, completely integrated with a Google Sheets database using Google Apps Script (GAS) Web App APIs, where user sidebar visibility and workflow functions are strictly controlled via a role-based access matrix.

Working directory: D:\05 GemVS
Integrity mode: development

---

## Requirements

### R1. Unified Single Page Application (SPA)
* Merge all 6 separate systems into a single-entry Vite project with a clean hash-based router.
* Establish a unified layout consisting of a top bar, dynamic sidebar, content viewport, and regulatory disclaimer footer.
* Enforce KPBMA brand colors (`#0072CE`, `#163A5F`) and pretendard font family defined in `src/shared/css/common.css`.

### R2. Dynamic Menu Control (Role-Based Access Matrix)
* Maintain a single session and integrated accounts system.
* Provide an account creation UI inside the Admin console where administrators can dynamically set role matrices for each of the 6 systems.
* Hide system menus on the sidebar if the logged-in user's role for that specific system is set to "NONE".

### R3. Implementation of All 6 GMP Training Modules
* Implement full operational UI and lifecycle state machine transitions for:
  1. **COA**: Result entry, pass/fail determination, approval e-Signature, and controlled PDF print.
  2. **LM**: Training records entry, score determination, certificate printing, and validation warnings.
  3. **ELB**: Append-only log entry, locking record upon submittal, and logbook copy printing.
  4. **RIM**: Material receive/use logs, negative quantity blocker, and expiry tracking.
  5. **SEM**: Scoring evaluation, grade auto-calculation (A/B/C), and ASL enrollment.
  6. **CVM**: Equipment cleaning sampling inputs, multi-point AND compliance determination, and validation summary print.

### R4. Local-First & Background Sync Database Architecture
* Utilize the provided GAS API URL (`https://script.google.com/macros/s/AKfycbw6sIa42MarGyJYoMsUX96ysMn7HlTCoq1UBtLjqH5FDPXIY5h_bZ_4GKojAi7eqmW3QA/exec`) to sync data.
* Load initial data into localStorage cache for 0ms instantaneous GUI responses, and sync write changes in the background asynchronously.

### R5. Dual-Tab Audit Trail & Record Protections
* Render physically separate tabs for System Security Logs and Data Audit Trails inside each module panel.
* Block hard deletion of rows (use Soft Delete via status flags) and require modification reasons with before/after state captures.

### R6. Administrative Demo Reset Control
* Add a 'DB Factory Reset' button in Admin settings that clears remote sheets and local cache, re-inserting 3 standard seed accounts (`admin`, `tester`, `approver`).

---

## Acceptance Criteria

### Compilation & Build Integrity
- [ ] Running `npm run build` must complete with exit code 0, generating a single bundle in `dist/` containing `index.html`.
- [ ] No module resolution errors for shared imports (`sheetAdapter.js`, `authHelper.js`, `common.css`).

### Authorization Matrix & UI Control
- [ ] Creating a new account with `role_coa = 'NONE'` and logging in must result in the complete omission of the "시험성적서(COA)" menu from the sidebar.
- [ ] Logging in as `TESTER` role for COA must allow entry submission but display disabled "Approve" button, while logging in as `APPROVER` role must allow approval sign-off.

### Data Sync & Record Locking
- [ ] Inserting any record or user in the UI must write a background sync request queue to the local storage, which silently posts data to the Google Sheets without locking or freezing the UI.
- [ ] Approved records in the database must be flagged and rendered in the GUI as Read-only, disabling all inputs and edit actions.

### Audit Log Separation
- [ ] Security events (e.g., login, create user, role change) must only display in the "System & Security Logs" tab.
- [ ] Operational events (e.g., record create, approve, reason-tracked modify) must only display in the "Data Audit Trail" tab.

### Database Reset
- [ ] Triggering the reset button as ADMIN must clear all database sheets (records and audit_logs) and write default rows for `admin`, `tester`, and `approver` into the `users` sheet.
