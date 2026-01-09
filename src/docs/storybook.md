## Brief overview

Project-specific guidelines for creating consistent Storybook documentation for UI components in the cv-launch project. These rules ensure all component stories follow the same high-quality pattern and provide clear documentation for developers.

## File structure requirements

- Create `.stories.tsx` files in the same directory as components
- Use standard imports: `Meta`, `StoryObj` from `@storybook/react`, React, and `StoryWrapper` from `../internal/story/story`
- Include JSDoc API documentation as a comment block before the meta configuration
- Configure meta with `title: "Category/ComponentName"`, component reference, and `tags: ["autodocs"]`
- Export default meta and define `Story` type using `StoryObj<typeof meta>`

## API documentation standards

- Include comprehensive JSDoc comment with "## Component API Reference" heading
- Create prop tables using markdown format with columns: Prop, Type, Default, Description
- Document all component props with exact TypeScript types using union syntax for variants
- Include subcomponent props tables when applicable
- Use backticks around prop names and type values for proper formatting

## Required story patterns

- **Default**: Basic usage with default props wrapped in `StoryWrapper`
- **Variants**: Show all available variants in horizontal flex layout when applicable
- **DarkMode**: Demonstrate component in dark theme using `StoryWrapper` with `isDark` prop
- Use descriptive story names that clearly indicate what they demonstrate (avoid generic names like "Example1" or "Test")

## Design token integration

- Always use CSS custom properties from design tokens instead of hardcoded values
- Use `var(--space-X)` for spacing, `var(--color-X)` for colors, `var(--font-size-X)` for typography
- Apply design tokens in inline styles for story demonstrations
- Show components with different background contexts using design token variables

## Layout and styling conventions

- Use `StoryWrapper` component for all stories to ensure consistent styling and background
- Apply standard layout patterns: horizontal flex with gap and flexWrap, vertical flex with flexDirection column, or CSS grid for complex layouts
- Use `var(--space-5)` for standard gaps between elements in story layouts
- Demonstrate component states (default, active, disabled) in separate stories with vertical layout

## Interactive and complex components

- Create interactive stories using React hooks (useState) to demonstrate stateful behavior
- Show current state values below interactive components for clarity
- For compound components, demonstrate various configurations with realistic content
- Use representative data for table components and data displays
- Include examples showing components on different themed backgrounds

## Story completeness checklist

- Proper JSDoc API documentation for all component props
- At least Default, Variants (if applicable), and DarkMode stories
- Consistent use of StoryWrapper component
- Design token variables used instead of hardcoded values
- Descriptive and meaningful story names
- Examples showing all important variants and states
- Interactive examples for components with behavior
- TypeScript properly configured for all stories
- Layout patterns consistent with other components in the project
