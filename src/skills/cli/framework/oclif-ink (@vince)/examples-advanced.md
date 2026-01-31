# oclif + Ink - Advanced Examples

> Advanced patterns for complex CLI applications. See [examples.md](examples.md) for core patterns first.

**Prerequisites**: Understand command structure, Ink components, and basic hooks from core examples.

---

## Pattern 1: State Management with Zustand

### Good Example - Wizard State Store

```typescript
// src/stores/wizard-store.ts
import { create } from "zustand";

type WizardStep = "approach" | "stack" | "skills" | "confirm" | "complete";

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface WizardState {
  // State
  step: WizardStep;
  approach: "stack" | "category" | null;
  selectedStack: string | null;
  selectedSkills: string[];
  availableSkills: Skill[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setStep: (step: WizardStep) => void;
  setApproach: (approach: "stack" | "category") => void;
  selectStack: (stackId: string) => void;
  toggleSkill: (skillId: string) => void;
  setSkills: (skills: Skill[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Computed
  canProceed: () => boolean;
}

const INITIAL_STATE = {
  step: "approach" as WizardStep,
  approach: null,
  selectedStack: null,
  selectedSkills: [],
  availableSkills: [],
  isLoading: false,
  error: null,
};

export const useWizardStore = create<WizardState>((set, get) => ({
  ...INITIAL_STATE,

  setStep: (step) => set({ step }),

  setApproach: (approach) => set({ approach, step: "stack" }),

  selectStack: (stackId) =>
    set({
      selectedStack: stackId,
      step: "skills",
    }),

  toggleSkill: (skillId) =>
    set((state) => ({
      selectedSkills: state.selectedSkills.includes(skillId)
        ? state.selectedSkills.filter((id) => id !== skillId)
        : [...state.selectedSkills, skillId],
    })),

  setSkills: (skills) => set({ availableSkills: skills }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(INITIAL_STATE),

  canProceed: () => {
    const state = get();
    switch (state.step) {
      case "approach":
        return state.approach !== null;
      case "stack":
        return state.selectedStack !== null;
      case "skills":
        return state.selectedSkills.length > 0;
      case "confirm":
        return true;
      default:
        return false;
    }
  },
}));
```

### Good Example - Using Store in Ink Component

```tsx
// src/components/wizard.tsx
import React, { useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { Select, Spinner } from "@inkjs/ui";
import { useWizardStore } from "../stores/wizard-store.js";
import { fetchSkills } from "../lib/api.js";

export const Wizard: React.FC = () => {
  const { exit } = useApp();

  // Select only what you need to prevent unnecessary re-renders
  const step = useWizardStore((s) => s.step);
  const isLoading = useWizardStore((s) => s.isLoading);
  const error = useWizardStore((s) => s.error);

  // Load skills on mount
  useEffect(() => {
    const loadSkills = async () => {
      useWizardStore.getState().setLoading(true);
      try {
        const skills = await fetchSkills();
        useWizardStore.getState().setSkills(skills);
      } catch (err) {
        useWizardStore
          .getState()
          .setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        useWizardStore.getState().setLoading(false);
      }
    };
    loadSkills();
  }, []);

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (isLoading) {
    return <Spinner label="Loading skills..." />;
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

const ApproachStep: React.FC = () => {
  const setApproach = useWizardStore((s) => s.setApproach);

  const options = [
    { label: "Choose a pre-built stack", value: "stack" },
    { label: "Select skills by category", value: "category" },
  ];

  return (
    <Box flexDirection="column">
      <Text bold>How would you like to configure your project?</Text>
      <Select
        options={options}
        onChange={(value) => setApproach(value as "stack" | "category")}
      />
    </Box>
  );
};

// Additional step components...
const StackStep: React.FC = () => {
  // Implementation...
  return <Text>Stack selection step</Text>;
};

const SkillsStep: React.FC = () => {
  // Implementation...
  return <Text>Skills selection step</Text>;
};

const ConfirmStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  // Implementation...
  return <Text>Confirmation step</Text>;
};
```

**Why good:** Zustand works seamlessly with Ink, selective subscriptions prevent re-renders, actions are outside React lifecycle.

---

## Pattern 2: Multi-step Wizard with Navigation

### Good Example - Full Wizard with Back/Forward Navigation

```tsx
// src/components/multi-step-wizard.tsx
import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Select, TextInput, MultiSelect, ConfirmInput } from "@inkjs/ui";

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

  useInput((input, key) => {
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
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const CurrentStepComponent = steps[currentIndex].component;

  return (
    <Box flexDirection="column" gap={1}>
      {/* Progress indicator */}
      <Box>
        <Text dimColor>
          Step {currentIndex + 1} of {steps.length}:{" "}
        </Text>
        <Text bold>{steps[currentIndex].title}</Text>
      </Box>

      {/* Step content */}
      <CurrentStepComponent
        onNext={handleNext}
        onBack={handleBack}
        data={wizardData}
      />

      {/* Navigation hint */}
      <Box marginTop={1}>
        <Text dimColor>
          {currentIndex > 0 && "Backspace: Go back | "}
          ESC: Cancel
        </Text>
      </Box>
    </Box>
  );
};

// Example step implementations
export const NameStep: React.FC<StepProps> = ({ onNext, data }) => {
  return (
    <Box flexDirection="column">
      <Text>Enter project name:</Text>
      <TextInput
        placeholder="my-project"
        defaultValue={(data.name as string) ?? ""}
        onSubmit={(name) => onNext({ name })}
      />
    </Box>
  );
};

export const FrameworkStep: React.FC<StepProps> = ({ onNext, onBack }) => {
  const options = [
    { label: "React", value: "react" },
    { label: "Vue", value: "vue" },
    { label: "Svelte", value: "svelte" },
  ];

  useInput((input, key) => {
    if (key.backspace) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Select framework:</Text>
      <Select
        options={options}
        onChange={(value) => onNext({ framework: value })}
      />
    </Box>
  );
};

export const FeaturesStep: React.FC<StepProps> = ({ onNext, onBack, data }) => {
  const options = [
    { label: "TypeScript", value: "typescript" },
    { label: "ESLint", value: "eslint" },
    { label: "Prettier", value: "prettier" },
    { label: "Testing", value: "testing" },
  ];

  useInput((input, key) => {
    if (key.backspace) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Select features (Space to toggle, Enter to confirm):</Text>
      <MultiSelect
        options={options}
        defaultValue={(data.features as string[]) ?? []}
        onChange={(values) => onNext({ features: values })}
      />
    </Box>
  );
};

export const ConfirmStep: React.FC<StepProps> = ({ onNext, onBack, data }) => {
  useInput((input, key) => {
    if (key.backspace) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Create project with these settings?</Text>
      <Box flexDirection="column" marginLeft={2}>
        <Text>Name: {data.name as string}</Text>
        <Text>Framework: {data.framework as string}</Text>
        <Text>Features: {(data.features as string[])?.join(", ")}</Text>
      </Box>
      <Box marginTop={1}>
        <ConfirmInput
          onConfirm={() => onNext({ confirmed: true })}
          onCancel={onBack}
        />
      </Box>
    </Box>
  );
};

// Usage
const wizardSteps: WizardStep[] = [
  { id: "name", title: "Project Name", component: NameStep },
  { id: "framework", title: "Framework", component: FrameworkStep },
  { id: "features", title: "Features", component: FeaturesStep },
  { id: "confirm", title: "Confirmation", component: ConfirmStep },
];
```

**Why good:** Reusable wizard pattern, navigation support, state preservation between steps.

---

## Pattern 3: Progress Indicators

### Good Example - Progress with Stages

```tsx
// src/components/task-progress.tsx
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Spinner, ProgressBar, StatusMessage } from "@inkjs/ui";

interface Task {
  id: string;
  title: string;
  run: () => Promise<void>;
}

interface TaskProgressProps {
  tasks: Task[];
  onComplete: () => void;
  onError: (error: Error) => void;
}

type TaskStatus = "pending" | "running" | "complete" | "error";

const TASK_SYMBOLS = {
  pending: " ",
  running: "",
  complete: "",
  error: "",
} as const;

const TASK_COLORS = {
  pending: "gray",
  running: "blue",
  complete: "green",
  error: "red",
} as const;

export const TaskProgress: React.FC<TaskProgressProps> = ({
  tasks,
  onComplete,
  onError,
}) => {
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>(
    Object.fromEntries(tasks.map((t) => [t.id, "pending"])),
  );
  const [currentTask, setCurrentTask] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const runTasks = async () => {
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        setCurrentTask(i);
        setTaskStatuses((s) => ({ ...s, [task.id]: "running" }));

        try {
          await task.run();
          setTaskStatuses((s) => ({ ...s, [task.id]: "complete" }));
        } catch (err) {
          setTaskStatuses((s) => ({ ...s, [task.id]: "error" }));
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

  const completedCount = Object.values(taskStatuses).filter(
    (s) => s === "complete",
  ).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Overall progress */}
      <Box>
        <Text>Progress: </Text>
        <ProgressBar value={progress} />
        <Text> {progress}%</Text>
      </Box>

      {/* Task list */}
      <Box flexDirection="column">
        {tasks.map((task, index) => {
          const status = taskStatuses[task.id];
          const symbol = TASK_SYMBOLS[status];
          const color = TASK_COLORS[status];

          return (
            <Box key={task.id}>
              {status === "running" ? (
                <Spinner />
              ) : (
                <Text color={color}>{symbol} </Text>
              )}
              <Text color={status === "pending" ? "gray" : undefined}>
                {task.title}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Error message */}
      {error && <StatusMessage variant="error">{error.message}</StatusMessage>}
    </Box>
  );
};
```

**Why good:** Visual progress tracking, individual task status, error handling with display.

---

## Pattern 4: Plugin Architecture

### Good Example - Creating an oclif Plugin

```typescript
// my-plugin/src/commands/hello.ts
import { Command, Flags } from "@oclif/core";

export class Hello extends Command {
  static summary = "Say hello from plugin";

  static flags = {
    name: Flags.string({ char: "n", default: "World" }),
  };

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
  "version": "1.0.0",
  "oclif": {
    "commands": {
      "strategy": "pattern",
      "target": "./dist/commands"
    },
    "hooks": {
      "init": "./dist/hooks/init"
    }
  },
  "dependencies": {
    "@oclif/core": "^4.x"
  }
}
```

```typescript
// my-plugin/src/hooks/init.ts
import { Hook } from "@oclif/core";

const hook: Hook.Init = async function () {
  // Plugin initialization logic
  this.log("Hello plugin initialized");
};

export default hook;
```

### Good Example - Using Plugins in Main CLI

```json
// main-cli/package.json
{
  "name": "mycli",
  "oclif": {
    "plugins": [
      "@oclif/plugin-help",
      "@oclif/plugin-autocomplete",
      "@myorg/cli-plugin-hello"
    ]
  }
}
```

### Good Example - User-installable Plugins

```json
// Enable user plugins in main CLI
{
  "oclif": {
    "plugins": ["@oclif/plugin-plugins"]
  }
}
```

```bash
# Users can now install plugins
mycli plugins install @myorg/cli-plugin-extra

# List installed plugins
mycli plugins

# Uninstall
mycli plugins uninstall @myorg/cli-plugin-extra
```

**Why good:** Plugins are separate npm packages, support user installation, proper hook integration.

---

## Pattern 5: Custom Hooks for CLI State

### Good Example - Custom Hook for Focus Management

```tsx
// src/hooks/use-step-focus.ts
import { useState, useCallback } from "react";
import { useInput } from "ink";

interface UseStepFocusOptions {
  steps: string[];
  initialStep?: string;
  onStepChange?: (step: string) => void;
  loop?: boolean;
}

interface UseStepFocusReturn {
  currentStep: string;
  currentIndex: number;
  goToStep: (step: string) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const useStepFocus = ({
  steps,
  initialStep,
  onStepChange,
  loop = false,
}: UseStepFocusOptions): UseStepFocusReturn => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialStep) {
      const index = steps.indexOf(initialStep);
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const currentStep = steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  const goToStep = useCallback(
    (step: string) => {
      const index = steps.indexOf(step);
      if (index >= 0) {
        setCurrentIndex(index);
        onStepChange?.(step);
      }
    },
    [steps, onStepChange],
  );

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => {
      const next = i + 1;
      if (next >= steps.length) {
        return loop ? 0 : i;
      }
      onStepChange?.(steps[next]);
      return next;
    });
  }, [steps, loop, onStepChange]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((i) => {
      const prev = i - 1;
      if (prev < 0) {
        return loop ? steps.length - 1 : i;
      }
      onStepChange?.(steps[prev]);
      return prev;
    });
  }, [steps, loop, onStepChange]);

  return {
    currentStep,
    currentIndex,
    goToStep,
    goToNext,
    goToPrevious,
    isFirst,
    isLast,
  };
};

// Usage in component
export const StepNavigator: React.FC = () => {
  const { currentStep, currentIndex, goToNext, goToPrevious, isFirst, isLast } =
    useStepFocus({
      steps: ["intro", "config", "confirm", "done"],
      onStepChange: (step) => console.log(`Moved to ${step}`),
    });

  useInput((input, key) => {
    if (key.rightArrow || key.tab) goToNext();
    if (key.leftArrow) goToPrevious();
  });

  return (
    <Box>
      <Text>
        Step {currentIndex + 1}: {currentStep}
      </Text>
    </Box>
  );
};
```

### Good Example - Custom Hook for Async Operations

```tsx
// src/hooks/use-async-task.ts
import { useState, useCallback, useEffect, useRef } from "react";

interface UseAsyncTaskOptions<T> {
  task: () => Promise<T>;
  immediate?: boolean;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

interface UseAsyncTaskReturn<T> {
  execute: () => Promise<void>;
  isLoading: boolean;
  result: T | null;
  error: Error | null;
  reset: () => void;
}

export const useAsyncTask = <T>({
  task,
  immediate = false,
  onSuccess,
  onError,
}: UseAsyncTaskOptions<T>): UseAsyncTaskReturn<T> => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await task();
      if (mountedRef.current) {
        setResult(data);
        onSuccess?.(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        const taskError = err instanceof Error ? err : new Error(String(err));
        setError(taskError);
        onError?.(taskError);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [task, onSuccess, onError]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [immediate, execute]);

  return { execute, isLoading, result, error, reset };
};
```

**Why good:** Reusable hooks, proper cleanup, handles mounted state.

---

## Pattern 6: Error Boundaries for CLI

### Good Example - Error Boundary Component

```tsx
// src/components/error-boundary.tsx
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
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
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
          <Box marginTop={1}>
            <Text dimColor>
              Please report this issue at https://github.com/myorg/mycli/issues
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Usage
export const App: React.FC = () => (
  <ErrorBoundary
    onError={(error, info) => {
      // Log to error tracking service
      console.error("CLI Error:", error, info);
    }}
    fallback={
      <Box>
        <Text color="red">Something went wrong. Please try again.</Text>
      </Box>
    }
  >
    <Wizard />
  </ErrorBoundary>
);
```

**Why good:** Catches render errors, provides fallback UI, reports errors to tracking.

---

## Pattern 7: Theming with @inkjs/ui

### Good Example - Custom Theme

```tsx
// src/lib/theme.ts
import { extendTheme, defaultTheme } from "@inkjs/ui";

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
        label: ({ isFocused }) => ({
          color: isFocused ? "cyan" : undefined,
        }),
      },
    },
    StatusMessage: {
      styles: {
        container: ({ variant }) => ({
          borderStyle: "round",
          borderColor:
            variant === "success"
              ? "green"
              : variant === "error"
                ? "red"
                : variant === "warning"
                  ? "yellow"
                  : "blue",
        }),
      },
    },
  },
});

// Usage
import { ThemeProvider } from "@inkjs/ui";

export const App: React.FC = () => (
  <ThemeProvider theme={customTheme}>
    <Wizard />
  </ThemeProvider>
);
```

**Why good:** Extends default theme, consistent styling, variant-based customization.

---

## Pattern 8: Handling Long-running Operations

### Good Example - Cancelable Operations with Cleanup

```tsx
// src/components/download-progress.tsx
import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ProgressBar, Spinner } from "@inkjs/ui";

interface DownloadProgressProps {
  url: string;
  destination: string;
  onComplete: () => void;
  onCancel: () => void;
}

const POLL_INTERVAL_MS = 100;

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  url,
  destination,
  onComplete,
  onCancel,
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "downloading" | "complete" | "cancelled"
  >("downloading");
  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "c" || key.escape) {
      abortControllerRef.current?.abort();
      setStatus("cancelled");
      onCancel();
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const download = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        const reader = response.body?.getReader();
        const contentLength =
          Number(response.headers.get("Content-Length")) || 0;

        if (!reader) throw new Error("No response body");

        let receivedLength = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          if (contentLength > 0) {
            setProgress(Math.round((receivedLength / contentLength) * 100));
          }
        }

        // Write to file (simplified)
        setStatus("complete");
        onComplete();
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Already handled in useInput
          return;
        }
        throw err;
      }
    };

    download();

    return () => {
      controller.abort();
    };
  }, [url, onComplete]);

  if (status === "cancelled") {
    return (
      <Box>
        <Text color="yellow">Download cancelled</Text>
      </Box>
    );
  }

  if (status === "complete") {
    return (
      <Box>
        <Text color="green">Download complete: {destination}</Text>
      </Box>
    );
  }

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

**Why good:** Proper abort handling, cleanup on unmount, cancel support, progress reporting.

---

## Pattern 9: JSON Output Mode

### Good Example - Commands with JSON Support

```typescript
// src/commands/list.ts
import { Command, Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { SkillsList } from "../components/skills-list.js";

interface Skill {
  id: string;
  name: string;
  category: string;
  installed: boolean;
}

export class List extends Command {
  static summary = "List available skills";
  static enableJsonFlag = true; // Adds --json flag

  static flags = {
    installed: Flags.boolean({
      char: "i",
      description: "Only show installed skills",
    }),
  };

  async run(): Promise<Skill[]> {
    const { flags } = await this.parse(List);

    const skills = await this.fetchSkills();
    const filtered = flags.installed
      ? skills.filter((s) => s.installed)
      : skills;

    // JSON mode - return data, no UI
    if (this.jsonEnabled()) {
      return filtered;
    }

    // Interactive mode - render UI
    const { waitUntilExit } = render(<SkillsList skills={filtered} />);
    await waitUntilExit();

    return filtered;
  }

  private async fetchSkills(): Promise<Skill[]> {
    // Fetch implementation
    return [];
  }
}
```

**Why good:** Supports both interactive and JSON output, enableJsonFlag auto-adds flag, returns typed data.

---

## Pattern 10: Subcommands with Topics

### Good Example - Organized Command Hierarchy

```
src/commands/
  config/
    get.ts      # mycli config get <key>
    set.ts      # mycli config set <key> <value>
    list.ts     # mycli config list
  skills/
    list.ts     # mycli skills list
    install.ts  # mycli skills install <name>
    remove.ts   # mycli skills remove <name>
```

```typescript
// src/commands/config/get.ts
import { Command, Args } from "@oclif/core";
import { config } from "../../lib/config.js";

export class ConfigGet extends Command {
  static summary = "Get a configuration value";

  static args = {
    key: Args.string({
      description: "Configuration key",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigGet);
    const value = config.get(args.key);

    if (value === undefined) {
      this.error(`Configuration key '${args.key}' not found`);
    }

    this.log(JSON.stringify(value, null, 2));
  }
}
```

```typescript
// src/commands/config/set.ts
import { Command, Args } from "@oclif/core";
import { config } from "../../lib/config.js";

export class ConfigSet extends Command {
  static summary = "Set a configuration value";

  static args = {
    key: Args.string({
      description: "Configuration key",
      required: true,
    }),
    value: Args.string({
      description: "Configuration value",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigSet);

    // Parse JSON if possible
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(args.value);
    } catch {
      parsedValue = args.value;
    }

    config.set(args.key, parsedValue);
    this.log(`Set ${args.key} = ${JSON.stringify(parsedValue)}`);
  }
}
```

**Why good:** Clear command hierarchy, consistent patterns across subcommands, auto-generated topics.
