# Icons from @photoroom/icons

> Code examples for icon usage with Tailwind. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 7: Icons from @photoroom/icons

### Good Example - Import Pattern

```tsx
import { ExclamationTriangleIcon } from "@photoroom/icons/lib/monochromes";
import { SaveIcon, TrashIcon } from "@photoroom/icons/lib/monochromes";
```

**Why good:** Design system compliance, consistent icon sizing and styling, smaller bundle size

### Bad Example - External libraries

```tsx
import { Save } from "lucide-react";
import { FaSave } from "react-icons/fa";
```

**Why bad:** External libraries have inconsistent styling, increase bundle size, do not match design system

### Good Example - Icon with Tailwind classes

```tsx
<Icon className="h-4 w-4 shrink-0" />
<Icon className="h-5 w-5 text-gray-500" />
```

**Why good:** Icons use currentColor by default for color inheritance, explicit sizing with Tailwind, shrink-0 prevents icon compression in flex containers
