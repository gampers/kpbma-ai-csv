# Design Guide Based on the KPBMA Education Team Tone & Manner

Document Version: v1.0  
Purpose: This document defines a practical design guideline for education landing pages, proposals, and mock-up system UI by combining the public education portal structure of the Korea Pharmaceutical and Bio-Pharma Manufacturers Association (KPBMA) with the visual direction of GAMP Lab’s AI-based CSV hands-on training proposal.

---

## 1. Design Direction Summary

This design combines the **credibility of an association-led education portal** with the **modern interface of a hands-on SaaS-style training program**.

Core keywords:

- Official
- Trustworthy
- Education application-oriented
- Clear communication of schedule, status, and course information
- Modern card-based SaaS interface
- Restrained blue tone suitable for GMP, CSV, and DI professional training

Recommended headline:

> Build the system to be validated — a new standard for practical CSV training.

Supporting message:

> Participants build an educational GMP system using AI-based vibe coding and practice the full CSV lifecycle from URS, RA, FS/DS, DQ/IOQ, RTM, to VSR.

Regulatory clarification statement:

> The hands-on system used in this course is an educational mock-up system and does not replace a formal computerized system or validated electronic record system in an actual GMP operating environment.

---

## 2. Reference Structure from the Public Education Portal

The public KPBMA education website has the following structural characteristics.

### 2.1 Top Utility Area

- Certificate confirmation
- Member company verification
- Sign-up
- Login

### 2.2 Main Education Categories

- Pharmaceutical Manufacturing / Import Manager Training
- GMP
- Pharmaceutical Marketing & MR
- e-Learning
- Seminars & Forums
- Notices

### 2.3 Main Information Structure

- Currently recruiting courses
- Notices
- Education schedule
- Quick Menu

### 2.4 Course Application Structure

- Offline training
- Mandatory legal training
- e-Learning
- Certification courses
- Specialized training
- Course detail / Course application CTA

### 2.5 Quick Menu Items

- Course application
- Training completion confirmation
- Frequently asked questions
- Contact information
- Business registration certificate / Bankbook copy

---

## 3. Brand Tone

### 3.1 Overall Impression

| Item | Direction |
|---|---|
| Visual tone | Credible education institution + modern hands-on training |
| Mood | Calm, professional, clear |
| Information density | Medium to high, structured with cards and spacing |
| Graphic style | Cards, badges, schedules, and notice boxes rather than excessive decoration |
| Emphasis method | Blue color, bold typography, and status badges |

### 3.2 Directions to Avoid

- Excessively flashy startup-style graphics
- Overuse of gradients
- Casual illustrations that do not fit regulatory education
- Overstated claims such as “AI automates everything”
- Expressions that may cause the mock-up system to be mistaken for an actual GMP operating system

---

## 4. Color System

The following palette combines the blue-based impression of the KPBMA education portal with GAMP Lab’s SaaS-style blue tone.

| Token | Hex | Usage |
|---|---:|---|
| `--color-primary` | `#0072CE` | Main CTA, links, active tabs, emphasis text |
| `--color-primary-dark` | `#163A5F` | Header, main title, navy background |
| `--color-primary-soft` | `#EAF5FF` | Notice boxes, selected card background |
| `--color-cyan` | `#00A6B2` | Secondary point, icons, status emphasis |
| `--color-bg` | `#FFFFFF` | Default background |
| `--color-bg-muted` | `#F5F7FA` | Section background, secondary card area |
| `--color-border` | `#DDE3EA` | Cards, tables, dividers |
| `--color-text` | `#1F2933` | Main body text |
| `--color-text-muted` | `#667085` | Descriptions and secondary information |
| `--color-success` | `#12B76A` | Available, completed status |
| `--color-warning` | `#F79009` | Scheduled, requires attention |
| `--color-danger` | `#F04438` | Closed, error, caution |

### 4.1 Recommended Usage Ratio

- White / Light Gray: 70%
- Navy / Black Text: 15%
- Primary Blue: 10%
- Cyan / Status Colors: 5%

### 4.2 Background Principles

- Use white as the primary background.
- Use light gray or soft blue backgrounds to separate sections.
- Use dark navy backgrounds only for headers or top bars in system mock-ups.

---

## 5. Typography

### 5.1 Recommended Fonts

- Primary: Pretendard
- Secondary: Noto Sans KR
- Tertiary: Spoqa Han Sans Neo
- For mixed English and numeric content: Inter may be used together.

### 5.2 Type Scale

| Usage | Size | Weight | Line Height |
|---|---:|---:|---:|
| Hero Title | 48–56px | 700–800 | 1.15 |
| Page Title | 40–48px | 700–800 | 1.2 |
| Section Title | 30–36px | 700 | 1.25 |
| Subsection Title | 24–28px | 700 | 1.3 |
| Card Title | 20–24px | 700 | 1.35 |
| Body Large | 18px | 400–500 | 1.6 |
| Body | 16px | 400 | 1.6 |
| Caption | 13–14px | 400–500 | 1.45 |
| Badge | 12–14px | 600–700 | 1 |

### 5.3 Typography Principles

- Keep main titles short and strong.
- Keep body copy to two or three concise sentences.
- In tables and schedules, make dates, times, and statuses immediately visible.
- Clearly expose core keywords such as AI, DI, CSV, and GMP in the course title.

---

## 6. Layout System

### 6.1 Basic Container

| Item | Recommended Value |
|---|---:|
| Max Width | 1200px |
| Desktop Padding | 40px |
| Tablet Padding | 32px |
| Mobile Padding | 20px |
| Section Gap | 80–120px |
| Card Gap | 24px |
| Border Radius | 16–24px |

### 6.2 Grid

- Desktop: 12-column grid
- Tablet: 6-column grid
- Mobile: 1-column stack
- Use 3-column or 2-column layouts for card-based information.
- Place Day 1 and Day 2 curriculum tables side by side on desktop.

---

## 7. Page Information Architecture

A course detail page or landing page should follow the structure below.

1. Hero
2. Course overview
3. Why this training is needed
4. System participants will build
5. Hands-on topic selection or system candidates
6. Two-day curriculum
7. Participant deliverables
8. CSV document package
9. Target audience and preparation requirements
10. Instructors
11. Application process and inquiry
12. Footer notice and disclaimers

---

## 8. Component Guide

### 8.1 Header

Structure:

- Left: KPBMA or course logo area
- Center: Overview / Curriculum / Practice System / Deliverables / Application / Contact
- Right: Course application CTA

Style:

- White background
- 1px bottom border
- Sticky header may be applied
- CTA button uses Primary Blue

### 8.2 Hero

Structure:

- Top badge: `Specialized Training · GMP/DI Hands-on Training`
- Main headline
- Supporting description
- Key meta information
- Two CTA buttons
- Practice system mock-up image on the right or below

Example copy:

```text
AI Vibe Coding-Based
Data Integrity Solution Development and CSV Hands-on Training

Participants implement an educational GMP system
and validate the full CSV lifecycle through documents and testing.

2 days · 14 hours | 30 participants · 6 teams | Theory 5h + Practice 9h
```

CTA:

- Primary: Apply for Training
- Secondary: View Curriculum

### 8.3 Course Summary Card

Course summary card items:

- Duration: 2 days / Total 14 hours
- Capacity: 30 participants / 5 people per team × 6 teams
- Target audience: QA, CSV/DI, QC, Production, Engineering, IT, R&D
- Level: Basic GMP understanding recommended / No coding experience required
- Deliverables: Hands-on system + CSV document package

### 8.4 Status Badge

| Status | Label | Style |
|---|---|---|
| Recruiting | `Recruiting` | Blue background, white text |
| Available | `Available` | Green background, white text |
| Scheduled | `Scheduled` | Orange background, white text |
| Closed | `Closed` | Gray background, dark text |
| Completed | `Completed` | Light gray background, muted text |

### 8.5 Curriculum Table

Principles:

- Separate Day 1 and Day 2.
- Distinguish theory and practice with badges.
- Make time, type, and main content easy to scan.
- Highlight practice sessions with soft blue or soft mint badges.

Example:

| Time | Type | Main Content |
|---|---|---|
| 09:00–10:30 | Theory | Introduction to CSV / Part 11 / Annex 11 and the design phase |
| 10:40–12:00 | Theory | Vibe coding and GxP application methodology |
| 13:00–14:30 | Practice | Solution concept design and URS writing |
| 14:30–16:00 | Practice | Risk assessment and FS/DS writing |
| 16:00–17:00 | Practice | Initial system implementation |

### 8.6 Quick Menu

Placement:

- Desktop: Right-side floating menu or lower section block
- Mobile: Bottom sticky menu or card-style links

Items:

- Course application
- Training completion confirmation
- Frequently asked questions
- Contact information
- Download training materials

### 8.7 Notice Box

Usage:

- Preparation requirements
- Corporate laptop security restriction notice
- Educational mock-up system notice
- Google Sheets database usage scope notice

Style:

- Soft blue background
- Left-side icon or check mark
- Bold title, regular body text

Example:

```text
Hands-on System Notice
The system built in this course is an educational mock-up system.
Google Sheets is used as an educational data repository and does not replace an actual GMP operating database.
```

---

## 9. Practice System UI Design

### 9.1 System Concept

The practice system should be designed as an educational mock-up SaaS.  
The interface may resemble an actual GMP system, but it must include an “Educational Use Only” indication to prevent regulatory misunderstanding.

### 9.2 UI Structure

- Top Bar: System name, current time, user role, logout
- Side or Tab Navigation: Dashboard, Record Entry, Record Search, Approval, Audit Trail, System Settings
- Main Panel: Card-based or table-based work screen
- Footer or Caption: `Training Mock-up System`

### 9.3 Recommended Screens

1. Login screen
2. Dashboard
3. Record entry screen
4. Record search screen
5. Approval screen
6. Audit trail screen
7. PDF / document output screen
8. User and role management screen

### 9.4 System Colors

| UI Area | Recommended Color |
|---|---|
| Top Bar | `#163A5F` |
| Active Tab | `#0072CE` |
| Background | `#F5F7FA` |
| Panel / Card | `#FFFFFF` |
| Border | `#DDE3EA` |
| Success Action | `#12B76A` |
| Critical Action | `#F04438` |

---

## 10. Google Sheets Database Design Criteria

When Google Sheets is used as an educational database, the following principles should be reflected in both the UI and documentation.

### 10.1 Expression Principles

Recommended expressions:

> Educational data repository

> Mock-up database

> Practice data storage area

Expressions to avoid:

> GMP-qualified database

> Part 11 validated database

> Formal operating database

### 10.2 On-Screen Notice

The following notice should be displayed in the system footer or settings screen.

```text
This system is an educational mock-up system for CSV hands-on training.
Google Sheets is used as an educational data repository and does not replace a formal database in an actual GMP operating environment.
```

### 10.3 Example Sheet Structure

| Sheet Name | Purpose |
|---|---|
| `users` | Users, roles, and team information |
| `records` | Main data such as COA records or equipment usage records |
| `workflow` | Draft, review, and approval status |
| `audit_trail` | Event logs such as create, modify, approve, and print |
| `config` | Document numbering rules, criteria, and system settings |
| `test_result` | IOQ execution results |

---

## 11. Content Copy Guide

### 11.1 Hero Copy

```text
Build the system to be validated —
a new standard for practical CSV training.
```

### 11.2 Supporting Copy

```text
Using AI-based vibe coding, participants build an educational GMP system
and experience data integrity, electronic records, audit trail,
and CSV validation points across the full system lifecycle.
```

### 11.3 Differentiation Copy

```text
This is not a simple document-writing exercise.
Participants build the system themselves and validate that system themselves.
```

### 11.4 Deliverables Copy

```text
At the end of the training, participants will have a working educational GMP system
and a complete CSV document package including URS, RA, FS/DS, DQ/IOQ, RTM, and VSR.
```

### 11.5 Cautionary Copy

```text
This course is a hands-on training program for practical understanding.
The system and data repository built during the course are educational mock-ups.
For actual operational use, separate security assessment, data integrity assessment,
change control, and validation are required.
```

---

## 12. Detailed Page Wireframe

### 12.1 Desktop

```text
[Header]
Logo | Overview | Curriculum | Practice System | Deliverables | Application | [Apply]

[Hero]
Badge
Main headline
Description
Meta chips
[Apply for Training] [View Curriculum]
System mock-up image

[Course Overview]
5-column summary cards

[Why This Training Is Needed]
3 pain-point cards

[System Participants Will Build]
System candidate cards and selected examples

[Two-Day Curriculum]
Day 1 table | Day 2 table

[Participant Deliverables]
5 deliverable rows or cards

[Target Audience and Preparation Requirements]
Target table | Preparation notice

[Instructors]
Instructor cards

[Application and Inquiry]
Process steps | Contact box

[Footer]
Disclaimer / Educational mock-up notice
```

### 12.2 Mobile

```text
[Sticky Header]
Logo | Menu | Apply

[Hero]
Badge
Main headline
Description
CTA
Meta chips stacked

[Cards]
1-column stack

[Curriculum]
Day 1 accordion
Day 2 accordion

[Quick Menu]
Bottom sticky or block cards
```

---

## 13. Proposal Slide Design Criteria

### 13.1 Cover Slide

- White background
- Top-left: message for the association or education team
- Center: large title
- Bottom: duration, capacity, author, inquiry
- Point color: Primary Blue

### 13.2 Body Slides

Recommended structure:

- Small section title at the top
- Large core message
- Two or three cards
- Bottom summary box

### 13.3 Curriculum Slide

- Split Day 1 / Day 2
- Theory / Practice badges
- Schedule-centered layout
- Short text only

### 13.4 System Example Slide

- Browser mock-up frame
- Address bar
- System name
- Tab menu
- Main work screen
- CSV validation points at the bottom

---

## 14. Accessibility and Operation Standards

- Body text should be at least 16px.
- Button labels should use clear action-oriented wording.
- Do not distinguish status by color alone; include status text.
- Tables should switch to card format or horizontal scrolling on mobile.
- Place the course application CTA at both the top and bottom of the page.
- Display contact information clearly in a dedicated box.

---

## 15. Implementation Priority

1. Course detail page hero and course summary cards
2. Two-day curriculum table
3. Participant deliverables section
4. Practice system mock-up UI
5. Google Sheets database usage notice
6. Application process and inquiry section
7. Proposal slide template

---

## 16. Final Design Principles

The center of this training design is not “AI” itself, but the **hands-on, end-to-end experience of CSV**.  
AI should be positioned as a tool that helps participants build systems quickly, while the central message should be organized around the following three points.

1. Participants build the system themselves.
2. Participants validate the system through the CSV lifecycle.
3. Participants leave with a system and document package that can serve as practical reference assets.

Final message:

> AI-assisted development. CSV-driven validation. Practical GMP system training.
