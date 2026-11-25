# Design taste (frontend)

Use this skill when building, restyling or reviewing a user-facing page:
Mission Control views, landing pages, dashboards or component screens.

Adapted for PitCrew from the open `design-taste-frontend` skill
(Leonxlnx/taste-skill, MIT) with its checker-and-finish-gate philosophy.

## Rules

1. **One design system.** One font pairing, one spacing scale, one accent
   colour family. Every screen uses it; nothing is styled one-off.
2. **Plain copy with a voice.** Write like the product speaks. No "supercharge
   your workflow", no exclamation-mark feature lists, no emoji section heads.
3. **Real content over placeholders.** Real labels, real numbers from real
   state. Mission Control shows real daemon events only, never fake progress.
4. **One section per screen, equal edges.** A screen does one job; padding is
   symmetric; alignment is consistent at every breakpoint.
5. **Motion earns its place.** One entrance, one or two deliberate moments.
   No decorative gradients, no glow, no parallax noise. UI rules from
   AGENTS.md §14 always win.
6. **Check in a real browser.** Use the Browser QA Lab (or the taste checker)
   to confirm layout, contrast and interaction on desktop and phone widths.
   A page that was not rendered was not verified.

## Constraints

- Edits happen inside the candidate worktree, like any other change.
- Green claims need evidence: a rendered page with a passing check sequence,
  not a description of what the page will look like.
