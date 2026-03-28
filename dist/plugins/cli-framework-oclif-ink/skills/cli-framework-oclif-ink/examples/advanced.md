# oclif + Ink - Advanced Examples

> Advanced patterns for complex CLI applications. See [core.md](core.md) for essential patterns first.

**Prerequisites**: Understand command structure, Ink components, and hooks from core examples.

---

## Pattern 1: Multi-Step Wizard with State Management

For complex wizards, separate state from UI. Use an external store or `useReducer` to manage wizard data outside the component tree.

### Store Pattern (External State)

```typescript
// src/stores/wizard-store.ts
// Use your preferred state management solution.
// This example shows the store interface -- adapt to your tool.

type WizardStep = "approach" | "stack" | "skills" | "confirm" | "complete";

interface WizardState {
  step: WizardStep;
  approach: "stack" | "category" | null;
  selectedStack: string | null;
  selectedSkills: string[];
  isLoading: boolean;
  error: string | null;

  setStep: (step: WizardStep) => void;
  setApproach: (approach: "stack" | "category") => void;
  selectStack: (stackId: string) => void;
  toggleSkill: (skillId: string) => void;
  reset: () => void;
  canProceed: () => boolean;
}
```

### Using Store in Ink Component

```tsx
// src/components/wizard.tsx
import React, { useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { Select, Spinner } from "@inkjs/ui";

// Assuming a store hook: useWizardStore(selector) => state slice
// Adapt to your state management solution's API

export const Wizard: React.FC = () => {
  const { exit } = useApp();
  const step = useWizardStore((s) => s.step);
  const isLoading = useWizardStore((s) => s.isLoading);
  const error = useWizardStore((s) => s.error);

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (isLoading) {
    return <Spinner label="Loading..." />;
  }

  return (
    <Box flexDirection="column">
      {step === "approach" && <ApproachStep />}
      {step === "stack" && <StackStep />}
      {step === "skills" && <SkillsStep />}
      {step === "confirm" && <ConfirmStep onComplete={() => exit()} />}
    </Box>
  );
};
```

**Why good:** State lives outside React tree (testable independently), selective subscriptions prevent unnecessary re-renders, store actions callable from effects.

---

## Pattern 2: Reusable Wizard with Back/Forward Navigation

```tsx
// src/components/multi-step-wizard.tsx
import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { TextInput, Select, MultiSelect, ConfirmInput } from "@inkjs/ui";

interface WizardStep {
  id: string;
  title: string;
  component: React.FC<StepProps>;
}

interface StepProps {
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  data: Record<string, unknown>;
}

interface MultiStepWizardProps {
  steps: WizardStep[];
  onComplete: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export const MultiStepWizard: React.FC<MultiStepWizardProps> = ({
  steps,
  onComplete,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wizardData, setWizardData] = useState<Record<string, unknown>>({});
  const { exit } = useApp();

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      exit();
    }
  });

  const handleNext = useCallback(
    (stepData: Record<string, unknown>) => {
      const newData = { ...wizardData, ...stepData };
      setWizardData(newData);

      if (currentIndex === steps.length - 1) {
        onComplete(newData);
        exit();
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentIndex, steps.length, wizardData, onComplete, exit],
  );

  const handleBack = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  const CurrentStepComponent = steps[currentIndex].component;

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text dimColor>
          Step {currentIndex + 1} of {steps.length}:{" "}
        </Text>
        <Text bold>{steps[currentIndex].title}</Text>
      </Box>

      <CurrentStepComponent
        onNext={handleNext}
        onBack={handleBack}
        data={wizardData}
      />

      <Box marginTop={1}>
        <Text dimColor>
          {currentIndex > 0 && "Backspace: Go back | "}ESC: Cancel
        </Text>
      </Box>
    </Box>
  );
};

// Step implementations
export const NameStep: React.FC<StepProps> = ({ onNext, data }) => (
  <Box flexDirection="column">
    <Text>Enter project name:</Text>
    <TextInput
      placeholder="my-project"
      defaultValue={(data.name as string) ?? ""}
      onSubmit={(name) => onNext({ name })}
    />
  </Box>
);

export const FrameworkStep: React.FC<StepProps> = ({ onNext, onBack }) => {
  useInput((_input, key) => {
    if (key.backspace) onBack();
  });

  return (
    <Box flexDirection="column">
      <Text>Select framework:</Text>
      <Select
        options={[
          { label: "React", value: "react" },
          { label: "Vue", value: "vue" },
          { label: "Svelte", value: "svelte" },
        ]}
        onChange={(value) => onNext({ framework: value })}
      />
    </Box>
  );
};

export const FeaturesStep: React.FC<StepProps> = ({ onNext, onBack }) => {
  useInput((_input, key) => {
    if (key.backspace) onBack();
  });

  return (
    <Box flexDirection="column">
      <Text>Select features (Space to toggle, Enter to confirm):</Text>
      <MultiSelect
        options={[
          { label: "TypeScript", value: "typescript" },
          { label: "ESLint", value: "eslint" },
          { label: "Prettier", value: "prettier" },
          { label: "Testing", value: "testing" },
        ]}
        onSubmit={(values) => onNext({ features: values })}
      />
    </Box>
  );
};

// Usage
const wizardSteps: WizardStep[] = [
  { id: "name", title: "Project Name", component: NameStep },
  { id: "framework", title: "Framework", component: FrameworkStep },
  { id: "features", title: "Features", component: FeaturesStep },
];
```

**Why good:** Reusable wizard pattern, back/forward navigation, state preserved across steps, escape-to-cancel.

---

## Pattern 3: Progress Indicators

```tsx
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Spinner, ProgressBar, StatusMessage } from "@inkjs/ui";

interface Task {
  id: string;
  title: string;
  run: () => Promise<void>;
}

type TaskStatus = "pending" | "running" | "complete" | "error";

const TASK_COLORS = {
  pending: "gray",
  running: "blue",
  complete: "green",
  error: "red",
} as const;

export const TaskProgress: React.FC<{
  tasks: Task[];
  onComplete: () => void;
  onError: (error: Error) => void;
}> = ({ tasks, onComplete, onError }) => {
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>(
    Object.fromEntries(tasks.map((t) => [t.id, "pending"])),
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const runTasks = async () => {
      for (const task of tasks) {
        setStatuses((s) => ({ ...s, [task.id]: "running" }));
        try {
          await task.run();
          setStatuses((s) => ({ ...s, [task.id]: "complete" }));
        } catch (err) {
          setStatuses((s) => ({ ...s, [task.id]: "error" }));
          const taskError = err instanceof Error ? err : new Error(String(err));
          setError(taskError);
          onError(taskError);
          return;
        }
      }
      onComplete();
    };
    runTasks();
  }, [tasks, onComplete, onError]);

  const completedCount = Object.values(statuses).filter(
    (s) => s === "complete",
  ).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>Progress: </Text>
        <ProgressBar value={progress} />
        <Text> {progress}%</Text>
      </Box>
      <Box flexDirection="column">
        {tasks.map((task) => {
          const status = statuses[task.id];
          return (
            <Box key={task.id}>
              {status === "running" ? (
                <Spinner />
              ) : (
                <Text color={TASK_COLORS[status]}> </Text>
              )}
              <Text color={status === "pending" ? "gray" : undefined}>
                {" "}
                {task.title}
              </Text>
            </Box>
          );
        })}
      </Box>
      {error && <StatusMessage variant="error">{error.message}</StatusMessage>}
    </Box>
  );
};
```

---

## Pattern 4: Plugin Architecture

### Creating a Plugin

```typescript
// my-plugin/src/commands/hello.ts
import { Command, Flags } from "@oclif/core";

export class Hello extends Command {
  static summary = "Say hello from plugin";
  static flags = { name: Flags.string({ char: "n", default: "World" }) };

  async run(): Promise<void> {
    const { flags } = await this.parse(Hello);
    this.log(`Hello, ${flags.name}! (from plugin)`);
  }
}
```

```json
// my-plugin/package.json
{
  "name": "@myorg/cli-plugin-hello",
  "oclif": {
    "commands": { "strategy": "pattern", "target": "./dist/commands" },
    "hooks": { "init": "./dist/hooks/init" }
  },
  "dependencies": { "@oclif/core": "^4.x" }
}
```

### Registering and Installing Plugins

```json
// Host CLI package.json
{
  "oclif": {
    "plugins": [
      "@oclif/plugin-help",
      "@oclif/plugin-autocomplete",
      "@oclif/plugin-plugins",
      "@myorg/cli-plugin-hello"
    ]
  }
}
```

```bash
# With @oclif/plugin-plugins, users can install plugins at runtime
mycli plugins install @myorg/cli-plugin-extra
mycli plugins                     # List installed
mycli plugins uninstall @myorg/cli-plugin-extra
```

---

## Pattern 5: Custom Ink Hooks

### Step Focus Management

```tsx
import { useState, useCallback } from "react";
import { useInput } from "ink";

interface UseStepFocusOptions {
  steps: string[];
  initialStep?: string;
  onStepChange?: (step: string) => void;
  loop?: boolean;
}

export const useStepFocus = ({
  steps,
  initialStep,
  onStepChange,
  loop = false,
}: UseStepFocusOptions) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialStep) {
      const index = steps.indexOf(initialStep);
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => {
      const next = i + 1;
      if (next >= steps.length) return loop ? 0 : i;
      onStepChange?.(steps[next]);
      return next;
    });
  }, [steps, loop, onStepChange]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((i) => {
      const prev = i - 1;
      if (prev < 0) return loop ? steps.length - 1 : i;
      onStepChange?.(steps[prev]);
      return prev;
    });
  }, [steps, loop, onStepChange]);

  return {
    currentStep: steps[currentIndex],
    currentIndex,
    goToNext,
    goToPrevious,
    isFirst: currentIndex === 0,
    isLast: currentIndex === steps.length - 1,
  };
};
```

### Async Task Hook

```tsx
import { useState, useCallback, useEffect, useRef } from "react";

interface UseAsyncTaskOptions<T> {
  task: () => Promise<T>;
  immediate?: boolean;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

export const useAsyncTask = <T>({
  task, immediate = false, onSuccess, onError,
}: UseAsyncTaskOptions<T>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await task();
      if (mountedRef.current) { setResult(data); onSuccess?.(data); }
    } catch (err) {
      if (mountedRef.current) {
        const taskError = err instanceof Error ? err : new Error(String(err));
        setError(taskError);
        onError?.(taskError);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [task, onSuccess, onError]);

  useEffect(() => {
    if (immediate) execute();
    return () => { mountedRef.current = false; };
  }, [immediate, execute]);

  return { execute, isLoading, result, error };
};
```

**Why good:** Mounted ref prevents state updates after unmount, cleanup on effect teardown, reusable across components.

---

## Pattern 6: Error Boundary for Ink

Error boundaries must be class components (React limitation). Useful for catching render errors in complex Ink UIs.

```tsx
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Box, Text } from "ink";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="red"
            padding={1}
          >
            <Text color="red" bold>
              An error occurred
            </Text>
            <Text color="red">{this.state.error?.message}</Text>
          </Box>
        )
      );
    }
    return this.props.children;
  }
}
```

---

## Pattern 7: Cancelable Long-Running Operations

```tsx
import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ProgressBar, Spinner } from "@inkjs/ui";

interface DownloadProgressProps {
  url: string;
  onComplete: () => void;
  onCancel: () => void;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  url,
  onComplete,
  onCancel,
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "downloading" | "complete" | "cancelled"
  >("downloading");
  const abortRef = useRef<AbortController | null>(null);

  useInput((input, key) => {
    if (input === "c" || key.escape) {
      abortRef.current?.abort();
      setStatus("cancelled");
      onCancel();
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const download = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        const contentLength =
          Number(response.headers.get("Content-Length")) || 0;
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          if (contentLength > 0)
            setProgress(Math.round((received / contentLength) * 100));
        }
        setStatus("complete");
        onComplete();
      } catch (err) {
        if ((err as Error).name !== "AbortError") throw err;
      }
    };

    download();
    return () => {
      controller.abort();
    }; // Cleanup on unmount
  }, [url, onComplete]);

  if (status === "cancelled")
    return <Text color="yellow">Download cancelled</Text>;
  if (status === "complete")
    return <Text color="green">Download complete</Text>;

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Spinner />
        <Text> Downloading...</Text>
      </Box>
      <ProgressBar value={progress} />
      <Text dimColor>Press 'c' or ESC to cancel</Text>
    </Box>
  );
};
```

**Why good:** AbortController for cancellation, cleanup on unmount, keyboard cancel support, progress streaming.

---

## Pattern 8: JSON Output Mode with Ink Fallback

```typescript
// src/commands/list.ts
import { Command, Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { SkillsList } from "../components/skills-list.js";

interface Skill {
  id: string;
  name: string;
  installed: boolean;
}

export class List extends Command {
  static summary = "List available skills";
  static enableJsonFlag = true;

  static flags = {
    installed: Flags.boolean({ char: "i", description: "Only installed" }),
  };

  async run(): Promise<Skill[]> {
    const { flags } = await this.parse(List);
    const skills = await this.fetchSkills();
    const filtered = flags.installed ? skills.filter((s) => s.installed) : skills;

    // JSON mode: return data, skip UI
    if (this.jsonEnabled()) return filtered;

    // Interactive mode: render UI
    const { waitUntilExit } = render(<SkillsList skills={filtered} />);
    await waitUntilExit();

    return filtered;
  }

  private async fetchSkills(): Promise<Skill[]> { return []; }
}
```

**Why good:** Dual mode (JSON for scripts, interactive for humans), same return type for both paths.

---

## Pattern 9: @inkjs/ui Theming

```tsx
import { extendTheme, defaultTheme, ThemeProvider } from "@inkjs/ui";

export const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: () => ({ color: "cyan" }),
        label: () => ({ color: "gray" }),
      },
    },
    Select: {
      styles: {
        focusIndicator: () => ({ color: "cyan" }),
        label: ({ isFocused }) => ({ color: isFocused ? "cyan" : undefined }),
      },
    },
  },
});

// Wrap your app
export const App: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={customTheme}>{children}</ThemeProvider>
);
```
