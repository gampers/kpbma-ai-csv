# Project: GemVS Unified GxP Suite

## Architecture
We are merging 6 standalone virtual GMP training systems into a single-entry Vite SPA. The entry point is `index.html` at the project root.
- **Vite SPA**: A single SPA that dynamically renders modules in a unified layout shell.
- **Unified Shell**: Composed of:
  - Top Bar: Brand label, user name/ID, current system, and Logout.
  - Sidebar: Dynamic navigation menus that are shown/hidden based on the user's role-based access matrix for each system.
  - Content Viewport: Render area for active sub-modules.
  - Regulatory Disclaimer Footer: Displays educational mock-up notices.
- **Routing**: A hash-based router (`#/login`, `#/dashboard`, `#/coa`, `#/lm`, `#/elb`, `#/rim`, `#/sem`, `#/cvm`, `#/admin`).
- **Database Adapters**: `src/shared/js/sheetAdapter.js` acts as the sync wrapper. It caches write requests to local storage and syncs changes in the background via Apps Script Web App API (`https://script.google.com/macros/s/AKfycbw6sIa42MarGyJYoMsUX96ysMn7HlTCoq1UBtLjqH5FDPXIY5h_bZ_4GKojAi7eqmW3QA/exec`).
- **Audit Trails**: Two physically separate logs:
  - Security logs: login/logout, user creation, role changes (written to `SYSTEM` or module name under category `SECURITY`).
  - Operational audit logs: record creation, deletion, modifications with reasons (written to system module name under category `DATA`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Portal Layout & Router | Single-page framework with hash routing, shell elements, and KPBMA theme styles | None | DONE |
| 2 | SSO & Account Admin | Integrated login, dynamic sidebar matrix, user role assignment console | M1 | DONE |
| 3 | COA & LM Modules | COA lifecycle (entry, criteria, e-Sig, PDF), LM lifecycle (records, scores, cert print) | M2 | DONE |
| 4 | ELB & RIM Modules | ELB lifecycle (append-only logs, lock on submit, log print), RIM lifecycle (logs, negative blocker, expiry) | M2 | DONE |
| 5 | SEM & CVM Modules | SEM lifecycle (score, ASL enrollment), CVM lifecycle (cleaning multi-point AND compliance) | M2 | DONE |
| 6 | Reset Control & Seed | Admin Demo Reset button, database reset with default seed accounts | M2 | DONE |
| 7 | Full Suite Verification | End-to-end verification, build completion (`dist/index.html`), and layout compliance | M3, M4, M5, M6 | DONE |

## Interface Contracts
### `sheetAdapter` ↔ Application Modules
- `sheetAdapter.init()`: Initializes localStorage from seeds and pulls remote Google Sheet database data.
- `sheetAdapter.getUsers()`: Returns list of user objects.
- `sheetAdapter.saveUser(user)`: Saves user data and enqueues background sync.
- `sheetAdapter.getRecords(system)`: Returns all non-deleted records for a specific system (e.g. "COA", "LM", etc.).
- `sheetAdapter.saveRecord(system, record)`: Saves a record (with soft-delete flag) and enqueues sync.
- `sheetAdapter.getAuditLogs(system)`: Returns audit logs for a specific system/module.
- `sheetAdapter.saveAuditLog(system, log)`: Saves security/data audit events.
- `sheetAdapter.resetDatabase()`: Triggers Apps Script reset, clears localStorage, and reloads page.

### `authHelper` ↔ Shell Routing
- `authHelper.login(id, pw)`: Logs user in, generates session storage `gxp_suite:session`, records audit trail.
- `authHelper.logout(system, reason)`: Clears session storage, adds logout audit trail, redirects to login.
- `authHelper.getCurrentUser()`: Returns current session object.
- `authHelper.getUserRole(system)`: Returns role of user for given system (`ADMIN`, `TESTER`/`TRAINER`/`OPERATOR`/`QC`/`VAL`, `APPROVER`/`QA`/`MANAGER`, or `NONE`).

## Code Layout
- `index.html`: Main SPA application entry point.
- `src/main.js`: Main JS file holding shell layout, routing engine, and admin settings.
- `src/modules/`: Module-specific files:
  - `src/modules/coa.js`: COA logic.
  - `src/modules/lm.js`: LM logic.
  - `src/modules/elb.js`: ELB logic.
  - `src/modules/rim.js`: RIM logic.
  - `src/modules/sem.js`: SEM logic.
  - `src/modules/cvm.js`: CVM logic.
- `src/shared/`: Shared components:
  - `src/shared/js/sheetAdapter.js`: Sync adapter.
  - `src/shared/js/authHelper.js`: Auth helper.
  - `src/shared/css/common.css`: Theme CSS.
