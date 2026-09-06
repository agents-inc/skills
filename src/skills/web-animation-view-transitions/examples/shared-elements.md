# View Transitions - Shared Element Examples

> Elements that travel between two views, continuing the numbering from [core.md](core.md).

**Prerequisites:** feature detection from [core.md](core.md) Pattern 1, and the naming rules in
[reference.md](../reference.md).

---

## Pattern 13: Basic Shared Element

### Good Example - Product List to Detail

```typescript
// shared-element-basic.ts

const HERO_TRANSITION_NAME = "product-hero";

interface Product {
  id: string;
  name: string;
  imageUrl: string;
}

let selectedProduct: Product | null = null;

function productImage(productId: string): HTMLElement | null {
  return document.querySelector(`[data-product-image="${productId}"]`);
}

function setSharedElementName(element: HTMLElement | null, name: string): void {
  if (element) element.style.viewTransitionName = name;
}

export function showProductDetail(product: Product): void {
  selectedProduct = product;

  const updateFn = () => {
    renderDetail(product);
    // The destination element is a different node; name it inside the callback
    setSharedElementName(productImage(product.id), HERO_TRANSITION_NAME);
  };

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  // The source element must carry the name before the old snapshot is taken
  setSharedElementName(productImage(product.id), HERO_TRANSITION_NAME);

  const transition = document.startViewTransition(updateFn);

  transition.finished.then(() => {
    setSharedElementName(productImage(product.id), "");
  });
}

export function backToList(products: Product[]): void {
  const returning = selectedProduct;

  const updateFn = () => {
    renderList(products);
    if (returning) {
      setSharedElementName(productImage(returning.id), HERO_TRANSITION_NAME);
    }
  };

  if (!document.startViewTransition || !returning) {
    updateFn();
    selectedProduct = null;
    return;
  }

  setSharedElementName(productImage(returning.id), HERO_TRANSITION_NAME);

  const transition = document.startViewTransition(updateFn);

  transition.finished.then(() => {
    setSharedElementName(productImage(returning.id), "");
    selectedProduct = null;
  });
}
```

`renderList` and `renderDetail` are the application's own render steps. Both emit an
`<img data-product-image="{id}">` for the product, and that attribute is the only thing the
transition code needs from the markup.

**CSS:**

```css
:root {
  --hero-duration: 300ms;
  --hero-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-group(product-hero) {
  animation-duration: var(--hero-duration);
  animation-timing-function: var(--hero-easing);
}

/* The two sides differ in aspect ratio; without this the snapshot squashes */
::view-transition-old(product-hero),
::view-transition-new(product-hero) {
  object-fit: cover;
}
```

**Why good:** The name goes on before the transition starts and on the destination inside the
callback — one name, two nodes, at the two moments the browser samples. Clearing it in `finished` is
what lets the return journey assign it again.

---

## Pattern 14: Several Elements Travelling Together

### Good Example - Card Expanding Into a Detail View

```typescript
// multi-shared-element.ts

const TRANSITION_NAMES = {
  image: (id: string) => `card-image-${id}`,
  title: (id: string) => `card-title-${id}`,
  container: (id: string) => `card-container-${id}`,
} as const;

type CardParts = {
  image: HTMLElement | null;
  title: HTMLElement | null;
  container: HTMLElement | null;
};

function findCardParts(cardId: string): CardParts {
  const container = document.querySelector<HTMLElement>(
    `[data-card="${cardId}"]`,
  );
  return {
    container,
    image: container?.querySelector<HTMLElement>("[data-card-image]") ?? null,
    title: container?.querySelector<HTMLElement>("[data-card-title]") ?? null,
  };
}

function nameCardParts(cardId: string, parts: CardParts): void {
  if (parts.image) {
    parts.image.style.viewTransitionName = TRANSITION_NAMES.image(cardId);
  }
  if (parts.title) {
    parts.title.style.viewTransitionName = TRANSITION_NAMES.title(cardId);
  }
  if (parts.container) {
    parts.container.style.viewTransitionName =
      TRANSITION_NAMES.container(cardId);
  }
}

function clearCardParts(parts: CardParts): void {
  [parts.container, parts.image, parts.title].forEach((el) => {
    if (el) el.style.viewTransitionName = "";
  });
}

export async function expandCard(cardId: string): Promise<void> {
  const updateFn = () => {
    renderExpandedCard(cardId);
    nameCardParts(cardId, findCardParts(cardId));
  };

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  nameCardParts(cardId, findCardParts(cardId));

  const transition = document.startViewTransition(updateFn);
  await transition.finished;

  clearCardParts(findCardParts(cardId));
}
```

`renderExpandedCard` is the application's own render step; the transition code only needs the
`data-card`, `data-card-image` and `data-card-title` attributes to survive it.

**CSS:**

```css
:root {
  --card-duration: 350ms;
  --card-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Every part carries the class, whether or not it currently carries a name */
[data-card],
[data-card-image],
[data-card-title] {
  view-transition-class: card-element;
}

::view-transition-group(.card-element) {
  animation-duration: var(--card-duration);
  animation-timing-function: var(--card-easing);
}
```

**Why good:** Each part carries the card id in its name, so several cards on one page never collide.
The name factories keep the source and destination spellings from drifting apart, which is the defect
that shows up as one part travelling and the rest cross-fading. A `view-transition-class` on the
parts lets one CSS rule cover all three groups rather than three near-identical rules.

---

## Pattern 15: Cross-Document Shared Elements

### Good Example - Product Gallery Across Two Documents

**list-page.html:**

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      @view-transition {
        navigation: auto;
      }

      .product-thumbnail {
        view-transition-name: product-hero;
      }
    </style>
    <script>
      // Name the thumbnail the navigation is heading towards
      window.addEventListener("pageswap", (e) => {
        if (!e.viewTransition) return;

        const targetUrl = new URL(e.activation.entry.url);
        const productId = targetUrl.searchParams.get("id");
        if (!productId) return;

        const thumbnail = document.querySelector(
          `[data-product="${productId}"] img`,
        );
        if (thumbnail) {
          thumbnail.style.viewTransitionName = "product-hero";
        }
      });
    </script>
  </head>
  <body>
    <ul class="product-grid">
      <li data-product="1">
        <a href="/product.html?id=1">
          <img src="/images/product-1.jpg" alt="Product 1" />
        </a>
      </li>
      <li data-product="2">
        <a href="/product.html?id=2">
          <img src="/images/product-2.jpg" alt="Product 2" />
        </a>
      </li>
    </ul>
  </body>
</html>
```

**product-page.html:**

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      :root {
        --hero-duration: 300ms;
        --hero-easing: cubic-bezier(0.4, 0, 0.2, 1);
      }

      @view-transition {
        navigation: auto;
      }

      .product-hero {
        view-transition-name: product-hero;
      }

      ::view-transition-group(product-hero) {
        animation-duration: var(--hero-duration);
        animation-timing-function: var(--hero-easing);
      }
    </style>
    <script>
      // Registered in <head> so the event is not missed
      window.addEventListener("pagereveal", (e) => {
        if (!e.viewTransition) return;

        const heroImage = document.querySelector(".product-hero");
        if (heroImage) {
          heroImage.style.viewTransitionName = "product-hero";
        }

        e.viewTransition.ready.then(() => {
          heroImage?.style.removeProperty("view-transition-name");
        });
      });
    </script>
  </head>
  <body>
    <article>
      <img class="product-hero" src="/images/product-1.jpg" alt="Product 1" />
      <h1>Product Name</h1>
      <p>Description...</p>
      <a href="/list.html">Back to list</a>
    </article>
  </body>
</html>
```

**Why good:** `pageswap` reads the destination URL, which is what lets the source name only the
thumbnail actually being navigated to instead of naming every one and colliding. The destination
clears its name at `ready` rather than `finished`, because the snapshots are already taken by then.

---

## Pattern 16: Names the Browser Derives

### Good Example - match-element for Lists (Chrome 137+, Safari 18.4+)

```css
:root {
  --product-transition-duration: 300ms;
}

.product-card {
  view-transition-name: match-element;
  view-transition-class: product;
}

::view-transition-group(.product) {
  animation-duration: var(--product-transition-duration);
  animation-timing-function: ease-out;
}
```

**Why good:** The browser tracks element identity itself, so a list of unknown length needs no
per-item scripting and no cleanup. The class is what gives the derived names something to be styled
by, since there is no name to write a selector against.

### Good Example - attr() Naming (Chrome 133+)

```html
<div class="card" id="product-001">Product 1</div>
<div class="card" id="product-002">Product 2</div>
```

```css
.card[id] {
  view-transition-name: attr(id type(<custom-ident>), none);
  view-transition-class: card;
}

::view-transition-group(.card) {
  animation-duration: var(--product-transition-duration);
}
```

**Why good:** The id is already unique per element, so it makes a valid name for free; the `none`
fallback keeps an element without an id out of the transition rather than breaking it.

---

## Pattern 17: Scoped Names for Repeated Components

### Good Example - Per-Instance Suffix

```typescript
// scoped-transitions.ts

const CARD_SCOPES = new Map<string, string>();

function generateScopeId(): string {
  return `scope-${Math.random().toString(36).slice(2, 9)}`;
}

function getScopedName(baseId: string, name: string): string {
  let scopeId = CARD_SCOPES.get(baseId);
  if (!scopeId) {
    scopeId = generateScopeId();
    CARD_SCOPES.set(baseId, scopeId);
  }
  return `${name}-${scopeId}`;
}

function cardImage(cardId: string): HTMLElement | null {
  return document.querySelector(`[data-card="${cardId}"] img`);
}

export function transitionScopedCard(
  cardId: string,
  updateFn: () => void,
): void {
  const scopedName = getScopedName(cardId, "card-hero");

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  const source = cardImage(cardId);
  if (source) source.style.viewTransitionName = scopedName;

  const transition = document.startViewTransition(() => {
    updateFn();
    const destination = cardImage(cardId);
    if (destination) destination.style.viewTransitionName = scopedName;
  });

  transition.finished.then(() => {
    const image = cardImage(cardId);
    if (image) image.style.viewTransitionName = "";
  });
}
```

**Why good:** The scope map keeps a component instance's name stable across repeat transitions while
keeping it distinct from another instance of the same component — the case a name derived from the
data id alone cannot cover.

---

## Pattern 18: Modal Growing From Its Trigger

### Good Example - Expansion and Return

```typescript
// modal-shared-transition.ts

const MODAL_ORIGIN_NAME = "modal-origin";

let currentOriginElement: HTMLElement | null = null;

export function openModalFromElement(
  triggerElement: HTMLElement,
  modalContent: string,
): void {
  currentOriginElement = triggerElement;

  const updateFn = () => {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content" data-modal-content>
        ${modalContent}
        <button data-close-modal>Close</button>
      </div>
    `;
    document.body.appendChild(modal);

    const modalContentEl = modal.querySelector<HTMLElement>(
      "[data-modal-content]",
    );
    if (modalContentEl) {
      modalContentEl.style.viewTransitionName = MODAL_ORIGIN_NAME;
    }
  };

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  triggerElement.style.viewTransitionName = MODAL_ORIGIN_NAME;

  const transition = document.startViewTransition(updateFn);

  transition.finished.then(() => {
    triggerElement.style.viewTransitionName = "";
  });
}

export function closeModal(): void {
  const modal = document.querySelector(".modal-overlay");
  if (!modal) return;

  const updateFn = () => modal.remove();

  if (!document.startViewTransition || !currentOriginElement) {
    updateFn();
    currentOriginElement = null;
    return;
  }

  // The trigger is the destination this time; the modal content is the source
  currentOriginElement.style.viewTransitionName = MODAL_ORIGIN_NAME;

  const modalContentEl = document.querySelector<HTMLElement>(
    "[data-modal-content]",
  );
  if (modalContentEl) {
    modalContentEl.style.viewTransitionName = MODAL_ORIGIN_NAME;
  }

  const transition = document.startViewTransition(updateFn);

  transition.finished.then(() => {
    if (currentOriginElement) {
      currentOriginElement.style.viewTransitionName = "";
    }
    currentOriginElement = null;
  });
}
```

**CSS:**

```css
:root {
  --modal-duration: 300ms;
}

::view-transition-group(modal-origin) {
  animation-duration: var(--modal-duration);
  animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
}
```

**Why good:** Holding the trigger element in a module variable is what makes the return journey
possible — by the time the modal closes, the click that opened it is long gone. Source and
destination swap roles between open and close while the name stays the same.
