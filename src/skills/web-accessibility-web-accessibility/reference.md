# Accessibility Reference

> WCAG criteria, name resolution, audit rule IDs and the manual checklists. Decisions and red flags are in [SKILL.md](SKILL.md); code is in [examples/](examples/).

---

## Accessible name resolution

First one found wins:

1. `aria-labelledby` — the referenced element's text, and it beats everything below
2. `aria-label` — a string on the element itself
3. The element's own content — button text, link text, `alt` on an image
4. `title` — a last resort, unreliably announced and invisible to touch

`aria-labelledby` overrides visible content, so an element with both announces something a sighted
user cannot see. Where the visible text is already the name, add nothing.

**Non-negotiable:** icon-only controls carry `aria-label` or visually hidden text; every input has an
associated `<label>`; every meaningful image has `alt` text and every decorative one has `alt=""`.

## Contrast ratios

| Content                                          | AA    | AAA   |
| ------------------------------------------------ | ----- | ----- |
| Text under 18pt (or under 14pt bold)             | 4.5:1 | 7:1   |
| Text 18pt and over (or 14pt bold and over)       | 3:1   | 4.5:1 |
| UI component boundaries, focus indicators, icons | 3:1   | —     |

WCAG states the threshold in points, and 1pt = 1.333px — so "large" is **24px**, or **18.5px bold**,
not 18px. Applying the 3:1 row at 18px is a failure the table itself invites if the units are read
as pixels.

## Target size

| Criterion                    | Level | Requirement                                         |
| ---------------------------- | ----- | --------------------------------------------------- |
| 2.5.8 Target Size (Minimum)  | AA    | 24×24 CSS px, or 24px clear spacing between targets |
| 2.5.5 Target Size (Enhanced) | AAA   | 44×44 CSS px                                        |

Exempt: inline links within a sentence, browser-supplied controls, and cases where the size is
essential to the information (a map pin, for instance).

## WCAG 2.2

W3C Recommendation, October 2023; ISO/IEC 40500:2025. Nine criteria added over 2.1, and one removed.

**Added at Level A**

- **3.2.6 Consistent Help** — a help mechanism appears in the same relative order on every page that has it
- **3.3.7 Redundant Entry** — information already entered in a process is auto-filled or offered for selection

**Added at Level AA**

- **2.4.11 Focus Not Obscured (Minimum)** — the focused element is not entirely hidden by sticky headers, footers or overlays
- **2.5.7 Dragging Movements** — anything achieved by dragging has a single-pointer alternative
- **2.5.8 Target Size (Minimum)** — 24×24 px, or adequate spacing
- **3.3.8 Accessible Authentication** — no cognitive function test unless an alternative exists

**Added at Level AAA**

- **2.4.12 Focus Not Obscured (Enhanced)** — no part of the focus indicator is hidden
- **2.4.13 Focus Appearance** — the indicator is at least a 2px perimeter at 3:1 contrast
- **3.3.9 Accessible Authentication (Enhanced)** — stricter still

**Removed:** 4.1.1 Parsing, obsolete now that browsers recover from malformed markup consistently.

**Baseline expectations carried forward:** text alternatives for non-text content; information never
by colour alone; all functionality from the keyboard; no keyboard traps; visible focus; skip
navigation; errors identified with a suggested correction.

## Common audit rule IDs

The rule identifiers an automated audit reports, with the severity each carries. Useful for reading a
report and for deciding what blocks a build versus what is filed.

| Rule ID             | Impact   | What it caught                                       |
| ------------------- | -------- | ---------------------------------------------------- |
| `color-contrast`    | Serious  | Text below the required ratio against its background |
| `image-alt`         | Critical | An `<img>` with no `alt` attribute at all            |
| `label`             | Critical | A form control with no associated label              |
| `button-name`       | Critical | A button with no discernible accessible name         |
| `link-name`         | Serious  | A link with no discernible accessible name           |
| `landmark-one-main` | Moderate | The document has no `<main>`, or more than one       |
| `region`            | Moderate | Content sitting outside every landmark               |
| `heading-order`     | Moderate | Heading levels skipped, so the outline is wrong      |

Critical and serious findings are the sensible gate for CI; moderate ones are usually structural and
better fixed in a pass of their own. A rule can be suppressed per element, and every suppression
should carry a reason — an unexplained one is indistinguishable from an unfixed failure.

## Manual checks

Automated auditing finds roughly half of WCAG failures. The rest is these.

**Keyboard**

- [ ] Tab reaches every interactive element, in the order the page reads
- [ ] Enter and Space activate buttons; Enter follows links
- [ ] Escape closes dialogs and menus, and focus returns to what opened them
- [ ] Arrow keys move within composite widgets — menus, tabs, listboxes
- [ ] Nothing traps focus
- [ ] The focus indicator is visible at every stop, including over sticky headers

**Screen reader**

- [ ] Every image is either described or explicitly decorative
- [ ] Every input is announced with its label
- [ ] Errors are announced when they appear
- [ ] Headings form a sensible outline with no skipped levels
- [ ] Landmarks are present and distinguishable
- [ ] Dynamic updates are announced once, and not repeatedly

**Visual**

- [ ] Contrast clears 4.5:1 for text and 3:1 for UI
- [ ] No information carried by colour alone
- [ ] Text reflows at 200% zoom without horizontal scrolling
- [ ] Targets meet 24×24 px, or have the spacing that substitutes for it
- [ ] Animation respects `prefers-reduced-motion`

## Screen readers

| Screen reader | Platform  | Notes                               |
| ------------- | --------- | ----------------------------------- |
| NVDA          | Windows   | Free; the most widely used          |
| JAWS          | Windows   | Paid; common in enterprise contexts |
| VoiceOver     | macOS/iOS | Built in                            |
| TalkBack      | Android   | Built in                            |

Pair each with the browser its users pair it with — the combination changes the behaviour, so a
pattern verified in one is not verified in all.

## Specifications

- WCAG 2.2 quick reference — <https://www.w3.org/WAI/WCAG22/quickref/>
- What's new in WCAG 2.2 — <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
- ARIA Authoring Practices Guide — <https://www.w3.org/WAI/ARIA/apg/>

The APG is the reference for any widget with a keyboard contract: it states the roles, states and key
bindings each pattern owes, which is what to check a component library against.
