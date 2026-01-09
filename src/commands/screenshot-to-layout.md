# Screenshot to Layout

Recreate the layout shown in the provided screenshot as raw JSX with CSS.

## Target App: $ARGUMENTS

## Instructions

Use the **frontend-developer** agent to implement this layout.

### Phase 1: Raw Implementation (This Command)

Generate a visually accurate recreation of the screenshot using:

1. **Plain JSX/TSX** - No design system components. Use semantic HTML elements (`div`, `button`, `table`, `nav`, etc.)

2. **CSS Modules** - Create a `.module.scss` file with styles that visually match the screenshot:
   - Layout structure (flexbox/grid)
   - Approximate spacing (use rem values)
   - Colors as they appear (hex/rgb, not tokens)
   - Typography (font sizes, weights)
   - Borders, shadows, radius as they appear

3. **Focus on:**
   - Correct layout structure and hierarchy
   - Visual fidelity to the screenshot
   - Reasonable approximations (not pixel-perfect)

4. **Don't worry about:**
   - Design tokens
   - Existing components
   - Exact pixel measurements
   - Interactive states (hover, focus)
   - Data fetching / state management

### Output

Create two files in the target app:
- `[page-name].tsx` - The JSX structure
- `[page-name].module.scss` - The styles

Use mock data that matches what's visible in the screenshot.

### Phase 2: Component Integration (Separate Step)

After reviewing the raw implementation, the user will iterate with requests like:
- "Replace the header section with my Card component"
- "Use my Button component for these actions"
- "Swap the table for my Table component"

This allows gradual integration with the design system while maintaining visual intent.

---

## Notes for the Agent

- Analyze the screenshot thoroughly before generating code
- Identify the major sections (nav, header, sidebar, main, footer)
- Note the visual hierarchy and spacing patterns
- Use semantic class names that describe purpose (`.sidebar`, `.actionBar`, `.userCell`)
- Comment sections to make Phase 2 replacement easier