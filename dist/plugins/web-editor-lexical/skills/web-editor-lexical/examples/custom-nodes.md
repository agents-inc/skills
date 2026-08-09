# Lexical - Custom Nodes

> Custom ElementNode, TextNode, DecoratorNode, and the NodeState API. See [SKILL.md](../SKILL.md) for which node type to extend and [core.md](core.md) for editor setup.

---

## Pattern 1: Custom ElementNode (Block-Level Container)

### Good Example - Callout Block

```typescript
import {
  ElementNode,
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

type CalloutVariant = "info" | "warning" | "error" | "success";

export type SerializedCalloutNode = Spread<
  { variant: CalloutVariant },
  SerializedElementNode
>;

export class CalloutNode extends ElementNode {
  __variant: CalloutVariant;

  static getType(): string {
    return "callout";
  }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__variant, node.__key);
  }

  constructor(variant: CalloutVariant = "info", key?: NodeKey) {
    super(key);
    this.__variant = variant;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-variant", this.__variant);
    element.className = config.theme.callout ?? "";
    return element;
  }

  updateDOM(prevNode: CalloutNode, dom: HTMLElement): boolean {
    if (prevNode.__variant !== this.__variant) {
      dom.setAttribute("data-variant", this.__variant);
    }
    // Return false: DOM element can be reused (no replacement needed)
    return false;
  }

  // JSON serialization
  static importJSON(serializedNode: SerializedCalloutNode): CalloutNode {
    return $createCalloutNode(serializedNode.variant).updateFromJSON(
      serializedNode,
    );
  }

  exportJSON(): SerializedCalloutNode {
    return {
      ...super.exportJSON(),
      variant: this.__variant,
    };
  }

  // Getters/setters follow Lexical conventions
  getVariant(): CalloutVariant {
    return this.getLatest().__variant;
  }

  setVariant(variant: CalloutVariant): this {
    const writable = this.getWritable();
    writable.__variant = variant;
    return writable;
  }
}

// $-prefixed factory and type guard (Lexical convention)
export function $createCalloutNode(
  variant: CalloutVariant = "info",
): CalloutNode {
  return $applyNodeReplacement(new CalloutNode(variant));
}

export function $isCalloutNode(
  node: LexicalNode | null | undefined,
): node is CalloutNode {
  return node instanceof CalloutNode;
}
```

**Why good:** `__variant` uses double-underscore convention, getWritable() ensures immutable consistency, $applyNodeReplacement enables node replacement, updateDOM returns false for DOM reuse, constructor has zero required args (needed for collaboration), type guard follows $-prefix convention

### Bad Example - Missing Conventions

```typescript
// BAD: Missing static getType and clone
// BAD: Constructor requires arguments (breaks collab/deserialization)
// BAD: Single underscore property (_variant)
// BAD: No $-prefixed factory function
// BAD: No $applyNodeReplacement wrapper

class CalloutNode extends ElementNode {
  _variant: string; // BAD: single underscore

  constructor(variant: string) {
    // BAD: no optional key parameter
    super();
    this._variant = variant;
  }

  createDOM() {
    const div = document.createElement("div");
    div.className = this._variant;
    return div;
  }

  // BAD: updateDOM missing -- defaults to replacing DOM every update
}

// BAD: No factory function means consumers use `new CalloutNode("info")`
// which doesn't support node replacement
```

**Why bad:** Missing getType/clone breaks serialization, required constructor args break collaboration, single underscore may be mangled by minifiers, no factory function bypasses node replacement system

---

## Pattern 2: Custom TextNode (Styled Text)

### Good Example - Colored Text Node

```typescript
import {
  TextNode,
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
} from "lexical";

const DEFAULT_COLOR = "";

export type SerializedColoredTextNode = Spread<
  { color: string },
  SerializedTextNode
>;

export class ColoredTextNode extends TextNode {
  __color: string;

  static getType(): string {
    return "colored-text";
  }

  static clone(node: ColoredTextNode): ColoredTextNode {
    return new ColoredTextNode(node.__text, node.__color, node.__key);
  }

  constructor(text: string = "", color: string = DEFAULT_COLOR, key?: NodeKey) {
    super(text, key);
    this.__color = color;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    if (this.__color) {
      element.style.color = this.__color;
    }
    return element;
  }

  updateDOM(
    prevNode: ColoredTextNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (prevNode.__color !== this.__color) {
      dom.style.color = this.__color || "";
    }
    return updated;
  }

  static importJSON(
    serializedNode: SerializedColoredTextNode,
  ): ColoredTextNode {
    return $createColoredTextNode(
      serializedNode.text,
      serializedNode.color,
    ).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedColoredTextNode {
    return {
      ...super.exportJSON(),
      color: this.__color,
    };
  }

  getColor(): string {
    return this.getLatest().__color;
  }

  setColor(color: string): this {
    const writable = this.getWritable();
    writable.__color = color;
    return writable;
  }
}

export function $createColoredTextNode(
  text: string = "",
  color: string = DEFAULT_COLOR,
): ColoredTextNode {
  return $applyNodeReplacement(new ColoredTextNode(text, color));
}

export function $isColoredTextNode(
  node: LexicalNode | null | undefined,
): node is ColoredTextNode {
  return node instanceof ColoredTextNode;
}
```

**Why good:** Extends TextNode preserving text formatting, calls super.createDOM/updateDOM for base text behavior, color applied via DOM style, all defaults allow zero-arg construction

---

## Pattern 3: DecoratorNode (Embedded Component)

### Good Example - Embedded Image

```typescript
import {
  DecoratorNode,
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";

export type SerializedImageNode = Spread<
  { src: string; alt: string; width: number; height: number },
  SerializedLexicalNode
>;

const DEFAULT_WIDTH = 0;
const DEFAULT_HEIGHT = 0;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __alt: string;
  __width: number;
  __height: number;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__alt,
      node.__width,
      node.__height,
      node.__key,
    );
  }

  constructor(
    src: string = "",
    alt: string = "",
    width: number = DEFAULT_WIDTH,
    height: number = DEFAULT_HEIGHT,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__width = width;
    this.__height = height;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    return span;
  }

  updateDOM(): boolean {
    // DecoratorNode DOM is managed by the decorate() component
    return false;
  }

  // The decorate method returns a React component
  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        alt={this.__alt}
        width={this.__width}
        height={this.__height}
        nodeKey={this.__key}
      />
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode(
      serializedNode.src,
      serializedNode.alt,
      serializedNode.width,
      serializedNode.height,
    ).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      src: this.__src,
      alt: this.__alt,
      width: this.__width,
      height: this.__height,
    };
  }

  // Required for DecoratorNode -- prevents text insertion
  isInline(): boolean {
    return true;
  }
}

export function $createImageNode(
  src: string,
  alt: string,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT,
): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, alt, width, height));
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}
```

**Why good:** DecoratorNode renders a React component via decorate(), createDOM returns a minimal container, the actual UI lives in the ImageComponent, isInline() controls block vs inline behavior, all properties are JSON-serializable

### Good Example - Image Component (used by DecoratorNode)

```typescript
import { useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey } from "lexical";
import type { NodeKey } from "lexical";

interface ImageComponentProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  nodeKey: NodeKey;
}

export function ImageComponent({
  src,
  alt,
  width,
  height,
  nodeKey,
}: ImageComponentProps) {
  const [editor] = useLexicalComposerContext();

  const handleDelete = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  return (
    <span className="image-wrapper">
      <img
        src={src}
        alt={alt}
        width={width || undefined}
        height={height || undefined}
      />
      <button
        className="image-delete"
        type="button"
        onClick={handleDelete}
        aria-label="Delete image"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </span>
  );
}
```

**Why good:** Decorator component accesses editor via context, mutations happen inside editor.update(), $getNodeByKey used for safe node lookup, accessible delete button

---

## Pattern 4: Registering Custom Nodes and Their Plugin

### Good Example - ImagePlugin with Node Validation

```typescript
import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodeToNearestRoot, COMMAND_PRIORITY_EDITOR } from "lexical";
import {
  INSERT_IMAGE_COMMAND,
  $createImageNode,
  ImageNode,
} from "./image-node";

export function ImagePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Validate that the node is registered
    if (!editor.hasNodes([ImageNode])) {
      throw new Error(
        "ImagePlugin: ImageNode not registered. Add it to initialConfig.nodes.",
      );
    }

    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (payload: { src: string; alt: string }) => {
        const imageNode = $createImageNode(payload.src, payload.alt);
        $insertNodeToNearestRoot(imageNode);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}

// In the editor setup:
// const EDITOR_NODES = [ImageNode, ...otherNodes];
// <ImagePlugin />
```

**Why good:** Validates node registration with editor.hasNodes(), throws a clear error message if missing, $insertNodeToNearestRoot handles insertion correctly regardless of selection state

---

## Pattern 5: NodeState API (v0.26+, Experimental)

The NodeState API allows attaching arbitrary state to any node without subclassing. State participates in reconciliation, history, and JSON serialization.

### Good Example - Attaching Metadata to Any Node

```typescript
import { createState, $getState, $setState } from "lexical";

// Define state with key and parse function
const commentState = createState("comment", {
  parse: (value: unknown) => (typeof value === "string" ? value : ""),
});

const highlightColorState = createState("highlightColor", {
  parse: (value: unknown) => (typeof value === "string" ? value : ""),
});

// Read state from any node
editor.read(() => {
  const node = $getNodeByKey(someKey);
  if (node) {
    const comment = $getState(node, commentState); // string
    const color = $getState(node, highlightColorState); // string
  }
});

// Write state to any node
editor.update(() => {
  const node = $getNodeByKey(someKey);
  if (node) {
    $setState(node, commentState, "This needs review");
    $setState(node, highlightColorState, "#ffeb3b");
  }
});
```

**Why good:** No subclassing needed, state is JSON-serializable automatically (stored under `$` key), parse function handles validation and defaults, works with any node type including RootNode

**Caveat:** The NodeState API is experimental. APIs may change in future Lexical versions without extended deprecation periods.

---

## Pattern 6: Node with $config (v0.33+)

The `$config` method reduces boilerplate by auto-generating `clone`, `importJSON`, `updateFromJSON`, `afterCloneFrom`, and `exportJSON`.

### Good Example - Simplified Node Definition

```typescript
import { ElementNode, type EditorConfig } from "lexical";

export class CollapsibleNode extends ElementNode {
  __isOpen: boolean;

  $config() {
    return this.config("collapsible", {
      extends: ElementNode,
    });
  }

  constructor(isOpen: boolean = true, key?: string) {
    super(key);
    this.__isOpen = isOpen;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("details");
    if (this.__isOpen) {
      element.setAttribute("open", "");
    }
    return element;
  }

  updateDOM(prevNode: CollapsibleNode, dom: HTMLDetailsElement): boolean {
    if (prevNode.__isOpen !== this.__isOpen) {
      if (this.__isOpen) {
        dom.setAttribute("open", "");
      } else {
        dom.removeAttribute("open");
      }
    }
    return false;
  }
}
```

**Why good:** $config eliminates manual clone/importJSON/exportJSON boilerplate, static getType inferred from config call, focus on the unique behavior (createDOM/updateDOM) only

**Caveat:** This approach requires Lexical v0.33+. Use the traditional pattern (Pattern 1-3) for broader version compatibility.
