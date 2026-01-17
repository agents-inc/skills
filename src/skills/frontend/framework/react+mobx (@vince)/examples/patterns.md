# React + MobX - Advanced Patterns

> Advanced component patterns for complex use cases. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related Examples:**
- [core.md](core.md) - Basic component structure, observer wrapper
- [mobx-reactivity.md](mobx-reactivity.md) - Avoiding useEffect/useMemo with MobX
- [hooks.md](hooks.md) - Custom hooks with stores
- [i18n.md](i18n.md) - useTranslation patterns

---

## Pattern 6: Promise-Based Modal Pattern

### Good Example - Promise-based confirmation modal

```typescript
import { useCallback, useMemo, useRef, useState } from "react";

import { noop } from "lodash";

export type UseConfirmModalProps<T> = {
  defaultConfirmValue?: T;
  defaultCancelValue?: T;
  defaultIsOpen?: boolean;
};

export const useConfirmModal = <T,>({
  defaultConfirmValue,
  defaultCancelValue,
  defaultIsOpen = false,
}: UseConfirmModalProps<T> = {}) => {
  const [isOpen, setIsOpen] = useState(defaultIsOpen);
  const resolveRef = useRef<(value: [boolean, T | undefined]) => void>(noop);

  const openConfirmModal = useCallback(() => {
    return new Promise<[boolean, T | undefined]>((resolve) => {
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  return useMemo(() => [
    openConfirmModal,
    {
      isOpen,
      onConfirm: (value?: T) => {
        resolveRef.current([true, value ?? defaultConfirmValue]);
        setIsOpen(false);
      },
      onCancel: (value?: T) => {
        resolveRef.current([false, value ?? defaultCancelValue]);
        setIsOpen(false);
      },
    },
  ] as const, [openConfirmModal, isOpen, defaultConfirmValue, defaultCancelValue]);
};
```

**Why good:** async/await flow for modal confirmation, generic type enables custom return values, tuple return with `as const` preserves types

### Good Example - Using confirm modal in a flow

```typescript
import { useTranslation } from "react-i18next";

import { ConfirmModal } from "components/ConfirmModal";

import { useConfirmModal } from "hooks/useConfirmModal";

export const DeleteButton = observer(() => {
  const { t } = useTranslation();
  const [openConfirm, confirmProps] = useConfirmModal();

  const handleDelete = async () => {
    const [confirmed] = await openConfirm();

    if (confirmed) {
      await deleteItem();
    }
  };

  return (
    <>
      <button onClick={handleDelete}>
        {t("common.delete")}
      </button>
      <ConfirmModal
        {...confirmProps}
        title={t("delete.confirm.title")}
        message={t("delete.confirm.message")}
      />
    </>
  );
});
```

**Why good:** clean async/await flow, modal state encapsulated in hook, spread props pattern for modal configuration
