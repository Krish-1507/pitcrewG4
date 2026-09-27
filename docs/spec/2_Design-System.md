# PitCrew Design System

## 1. Design thesis

PitCrew should look like serious engineering control software, not a generic AI chat app.

The interface communicates:

- current mission;
- current stage;
- active specialist/tool;
- what changed;
- what evidence exists;
- what decision the user must make;
- time/cost consumed;
- why a candidate survived or failed.

Avoid visual language that makes activity look more intelligent than it is. No fake thought streams, pulsing robot avatars, decorative neural networks, gratuitous gradients, glassmorphism, or dashboards filled with meaningless metrics.

The visual metaphor is **quiet mission control**.

---

## 2. Brand relationship

OpenPitStop and PitCrew should look related but not identical.

- OpenPitStop is the referee and can retain its cyan-heavy developer-tool identity.
- PitCrew is coordination and execution software.
- PitCrew uses neutral graphite surfaces with cyan for active engineering work.
- Evidence colors are reserved for actual status, not decoration.

Do not use green merely because an operation completed. Green means evidence-backed positive status.

---

## 3. Color tokens

### Surfaces

```css
--pc-bg:             #090C12;
--pc-bg-elevated:    #0D1119;
--pc-surface-1:      #111722;
--pc-surface-2:      #171E2B;
--pc-surface-3:      #1D2634;
--pc-border:         #2A3443;
--pc-border-strong:  #3A4658;
```

### Text

```css
--pc-text:           #F1F5F9;
--pc-text-muted:     #A8B3C2;
--pc-text-subtle:    #778396;
--pc-text-disabled:  #566172;
```

### Brand / interaction

```css
--pc-accent:         #22D3EE;
--pc-accent-soft:    #164E63;
--pc-focus:          #67E8F9;
```

### Evidence

```css
--pc-pass:           #3DDC97;
--pc-warning:        #F5B942;
--pc-fail:           #FF647C;
--pc-info:           #78A9FF;
--pc-unproven:       #B69CFF;
```

### Rules

- Green only means PASS/VERIFIED.
- Red only means FAIL/BLOCKED/destructive.
- Amber means approval, risk, partial coverage, or attention.
- Purple means UNPROVEN/insufficient evidence.
- Cyan means active/selected/current.
- No gradients in core product surfaces.
- Do not use pure black.
- WCAG AA text contrast minimum.

---

## 4. Typography

### UI

Preferred: **Inter**

Fallback:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
```

### Technical

Preferred: **JetBrains Mono**

Fallback:

```css
font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

### Scale

```text
Display:  32 / 40, 650
H1:       24 / 32, 650
H2:       20 / 28, 620
H3:       16 / 24, 620
Body:     14 / 21, 450
Small:    12 / 18, 500
Micro:    11 / 16, 550
Code:     12.5 / 19, 450
```

Avoid giant marketing typography inside the application.

---

## 5. Spacing and geometry

4 px base unit.

```text
1  = 4
2  = 8
3  = 12
4  = 16
5  = 20
6  = 24
8  = 32
10 = 40
12 = 48
16 = 64
```

Radius:

```text
small:  6px
medium: 9px
large:  12px
```

Use rounded containers sparingly. Do not wrap every block in a card.

---

## 6. Desktop shell

```text
Left navigation:     220-260 px
Main mission area:   flexible
Right inspector:     300-360 px, collapsible
Bottom technical:    optional resizable drawer
```

Primary surfaces:

- Mission;
- Arena;
- Repo Story;
- Browser Lab;
- Evidence;
- Technical Inspector.

---

## 7. Information architecture

### Left rail

- Projects
- Missions
- Repo Story
- Automations
- Skills
- Evidence
- Settings

### Main

Current mission artifact:

- CEO conversation;
- Build Contract;
- plan;
- candidate comparison;
- Browser QA;
- evidence summary.

### Right rail

- stage;
- specialists/tools;
- approvals;
- candidate branches;
- verification coverage;
- model/cost budget.

### Technical Inspector

- exact commands;
- stdout/stderr;
- files;
- diff;
- model metadata;
- candidate identity;
- sandbox;
- evidence refs.

---

## 8. Mission Header

Shows:

- mission title;
- project/repository;
- state;
- elapsed time;
- budget;
- Pause/Cancel.

Do not show fabricated percent complete.

---

## 9. Stage Ribbon

```text
UNDERSTAND > PLAN > BUILD > TEST > ATTACK > VERIFY > DONE
```

States:

- pending;
- current;
- completed with evidence;
- blocked;
- skipped/not configured.

A completed visual state requires a real event.

---

## 10. Specialist row

```text
Repository Scientist   ACTIVE    Inspecting payment flow
Implementer            WAITING
Browser QA             WAITING
OpenPitStop            WAITING
```

Do not anthropomorphize roles with faces or fake personalities.

---

## 11. Decision Card

Contains:

- decision;
- why PitCrew needs it;
- recommended option;
- consequences;
- actions.

Example:

```text
Runtime dependency required

The proposed implementation adds package X.
This changes the production dependency graph.

[Approve dependency] [Choose another approach] [Inspect package]
```

---

## 12. Candidate Card

Contains:

- candidate ID;
- hypothesis;
- changed files;
- test result;
- evidence state;
- elimination reason;
- cost/time.

No green winner state until final independent verification.

---

## 13. Evidence badges

Allowed values:

```text
VERIFIED
PASS
FAIL
BLOCKED
UNPROVEN
SKIPPED
NOT CONFIGURED
STALE
```

Badge color follows semantic token rules.

---

## 14. Merge Certificate

Human-readable outcome:

```text
READY TO APPLY

What changed
Why this candidate survived
What was tested
What remains unproven
Files changed
Approvals used
Replay evidence
```

Do not imply legal or security certification.

---

## 15. Candidate Arena

```text
               BASELINE
             /    |    \
            A     B     C
            |     |     |
          checks checks checks
            X     ✓     X
                  |
             OpenPitStop
```

Elimination explanation is one plain sentence.

Examples:

- Passed visible tests but failed concurrency reproduction.
- Modified an assertion in the failing test.
- Introduced a runtime dependency without approval.
- Passed target behavior and regression checks.

No racing-game visual clutter.

---

## 16. Repo Story

Semantic zoom:

### Level 0, product

```text
Sign in -> Dashboard -> Create invoice -> Pay -> Receipt
```

### Level 1, systems

```text
Web -> API -> Billing -> DB
             -> Email
```

### Level 2, modules

Routes, services, adapters, schemas.

### Level 3, code

Files and symbols.

### Trust overlay

- protected assumptions;
- unprotected assumptions;
- recent changes;
- security boundaries;
- test coverage;
- verification debt.

Start collapsed with 5-9 important concepts. Never default to a giant graph.

---

## 17. Browser Lab

Timeline:

```text
Scenario: Invite teammate

PASS  Sign in as admin
PASS  Open team settings
PASS  Submit invitation
FAIL  Retry after 500 response

Observed:
Invite action stays disabled permanently.

[Replay] [Trace] [Screenshot] [Network]
```

Modes:

- Observe
- Headless
- Take Over
- Replay
- Compare

Use a dedicated browser profile.

---

## 18. CLI design

CLI is first-class.

```text
 PITCREW

 Mission
 Fix duplicate checkout orders under concurrent requests

 UNDERSTAND  PASS
 PLAN        PASS
 BUILD       ACTIVE
 TEST        WAITING
 VERIFY      WAITING

 Crew
 ├─ Repository Scientist  done
 ├─ Implementer           candidate A
 ├─ Test Engineer         waiting
 └─ OpenPitStop           waiting

 Budget
 1 model call · 42s · cost unknown
```

Suggested commands:

```text
pitcrew
pitcrew "<mission>"
pitcrew open .
pitcrew explain
pitcrew map
pitcrew arena
pitcrew evidence
pitcrew verify
pitcrew replay <mission>
pitcrew apply <candidate>
pitcrew config
pitcrew doctor
```

Use static readable output in CI/non-TTY mode.

---

## 19. Motion

Use motion only to communicate state transitions.

- 120-180 ms local state;
- 180-260 ms panel transitions;
- subtle line animation for candidate fork;
- one pulse maximum for active work.

Avoid infinite glow, fake typing delays, looping thinking, parallax, and particles.

Honor reduced motion.

---

## 20. Iconography

Use one outline icon set.

- 16 or 18 px primary size;
- consistent stroke;
- icon status always has text;
- no generic robot/brain icons.

Suggested semantics:

- branch;
- shield;
- flask;
- terminal;
- file;
- check;
- warning;
- lock;
- graph;
- browser.

---

## 21. Content style

Write like engineering software.

Prefer:

> Candidate B failed the API regression check.

Avoid:

> Oops! Our brilliant AI teammate hit a little snag.

Prefer:

> Approval required: this changes the database schema.

Avoid:

> PitCrew needs your permission to work its magic.

Explanations state:

1. what happened;
2. why it matters;
3. what the user can do next.

---

## 22. Accessibility

Required:

- keyboard access to approvals;
- visible focus;
- screen-reader stage/status text;
- no color-only state;
- reduced motion;
- text zoom support;
- graph alternatives as lists;
- terminal output selectable;
- icon buttons labelled.

---

## 23. Responsive behavior

Optimized for desktop.

At narrow widths:

- right rail becomes drawer;
- Repo Story becomes list/tree before labels shrink;
- Arena becomes vertical;
- decision cards stay full-width;
- code/logs remain readable with horizontal scroll.

---

## 24. Anti-slop checklist

Reject UI containing:

- meaningless gradients;
- glow around every active element;
- excessive cards;
- huge generic hero copy;
- every panel centered;
- decorative metrics with no action;
- generic AI sparkle icons;
- fake real-time reasoning;
- unexplained animation;
- low-information dashboards;
- inconsistent spacing;
- visual complexity greater than information complexity.
