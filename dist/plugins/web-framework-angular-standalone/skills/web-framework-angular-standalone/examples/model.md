# Two-Way Binding with model() Examples

> `model()` two-way binding for Angular 17+ standalone components. See [core.md](core.md) for standalone and signal basics.

---

## Pattern: model() for Two-Way Binding

### Good Example - model() creates two-way bindable signals

```typescript
// color-picker.component.ts
import { Component, input, model } from "@angular/core";

@Component({
  selector: "app-color-picker",
  standalone: true,
  template: `
    <div class="color-picker">
      <div class="preview" [style.background-color]="color()"></div>

      <input type="color" [value]="color()" (input)="onColorInput($event)" />

      <input
        type="text"
        [value]="color()"
        (input)="onColorInput($event)"
        [placeholder]="placeholder()"
      />

      @if (showAlpha()) {
        <input
          type="range"
          min="0"
          max="100"
          [value]="alpha()"
          (input)="onAlphaInput($event)"
        />
        <span>{{ alpha() }}%</span>
      }
    </div>
  `,
})
export class ColorPickerComponent {
  // Two-way bound value
  color = model("#000000");

  // Two-way bound alpha
  alpha = model(100);

  // Optional inputs
  placeholder = input("Enter color...");
  showAlpha = input(false);

  onColorInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.color.set(target.value);
  }

  onAlphaInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.alpha.set(Number(target.value));
  }
}
```

**Usage in parent:**

```html
<app-color-picker
  [(color)]="themeColor"
  [(alpha)]="themeAlpha"
  [showAlpha]="true"
/>
```

**Why good:** `model()` gives the parent `[(color)]` and the child a signal it can both read and write, with none of the `@Input` plus `@Output` pairing that used to be needed.

**When not to use it:** `input()` plus `output()` keeps the data flow one-way and is the better default. Reach for `model()` only where the child genuinely owns the edit — pickers, inputs, and other form-like controls.

---

## model() vs input() + output()

| Use Case                                | Approach   |
| --------------------------------------- | ---------- |
| Parent controls value, child only reads | `input()`  |
| Child emits events, parent handles      | `output()` |
| Both can read AND write the value       | `model()`  |
| Form-like components (pickers, inputs)  | `model()`  |
