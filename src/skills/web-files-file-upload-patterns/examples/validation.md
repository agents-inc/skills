# File Upload — Validation Examples

> Checking a file before it moves. Decisions are in [SKILL.md](../SKILL.md); the ordering these
> follow is in [reference.md](../reference.md).

Everything here is user experience rather than security. The server repeats all of it.

---

## Pattern 6: Rule-based validator

Rules are built once from options and run in order, so cheap checks fail before expensive ones and
the caller gets every reason at once.

```typescript
// file-validator.ts
import { detectFileType } from "./file-type-detection";

interface ValidationRule {
  validate: (file: File) => Promise<boolean> | boolean;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface FileValidatorOptions {
  maxSizeBytes?: number;
  minSizeBytes?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  validateContent?: boolean;
  customRules?: ValidationRule[];
}

const BYTES_PER_MB = 1024 * 1024;

export class FileValidator {
  private rules: ValidationRule[] = [];

  constructor(options: FileValidatorOptions = {}) {
    this.buildRules(options);
  }

  private buildRules(options: FileValidatorOptions): void {
    const {
      maxSizeBytes,
      minSizeBytes,
      allowedTypes,
      allowedExtensions,
      validateContent = false,
      customRules = [],
    } = options;

    if (maxSizeBytes !== undefined) {
      this.rules.push({
        validate: (file) => file.size <= maxSizeBytes,
        message: `File must be smaller than ${maxSizeBytes / BYTES_PER_MB}MB`,
      });
    }

    if (minSizeBytes !== undefined) {
      this.rules.push({
        validate: (file) => file.size >= minSizeBytes,
        message: `File must be at least ${minSizeBytes} bytes`,
      });
    }

    if (allowedTypes?.length) {
      this.rules.push({
        validate: (file) => matchesAnyType(file.type, allowedTypes),
        message: `File type must be one of: ${allowedTypes.join(", ")}`,
      });
    }

    if (allowedExtensions?.length) {
      this.rules.push({
        validate: (file) => {
          const ext = "." + file.name.split(".").pop()?.toLowerCase();
          return allowedExtensions.includes(ext);
        },
        message: `File extension must be one of: ${allowedExtensions.join(", ")}`,
      });
    }

    // the only rule that reads the file itself, so it goes last
    if (validateContent && allowedTypes?.length) {
      this.rules.push({
        validate: async (file) => {
          const detected = await detectFileType(file);
          return (
            detected !== null && matchesAnyType(detected.mime, allowedTypes)
          );
        },
        message: "File content does not match declared type",
      });
    }

    this.rules.push(...customRules);
  }

  async validate(file: File): Promise<ValidationResult> {
    const errors: string[] = [];

    for (const rule of this.rules) {
      if (!(await rule.validate(file))) errors.push(rule.message);
    }

    return { valid: errors.length === 0, errors };
  }

  async validateMany(files: File[]): Promise<Map<File, ValidationResult>> {
    const results = new Map<File, ValidationResult>();
    for (const file of files) {
      results.set(file, await this.validate(file));
    }
    return results;
  }
}

export function matchesAnyType(mime: string, allowed: string[]): boolean {
  return allowed.some((type) =>
    type.endsWith("/*")
      ? mime.startsWith(type.replace("/*", "/"))
      : mime === type,
  );
}
```

---

## Pattern 7: Magic-byte detection

The signature identifies the container, which is not always the format. A ZIP signature covers
`.zip` and every Office document, so a match there triggers a second look at the archive's entry
names.

```typescript
// file-type-detection.ts
interface FileSignature {
  mime: string;
  extension: string;
  signature: number[];
  offset?: number;
}

const FILE_SIGNATURES: FileSignature[] = [
  { mime: "image/jpeg", extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  {
    mime: "image/png",
    extension: "png",
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mime: "image/gif", extension: "gif", signature: [0x47, 0x49, 0x46, 0x38] },
  // RIFF container — shared with WAV, so this alone is ambiguous
  {
    mime: "image/webp",
    extension: "webp",
    signature: [0x52, 0x49, 0x46, 0x46],
  },
  { mime: "image/bmp", extension: "bmp", signature: [0x42, 0x4d] },
  {
    mime: "image/tiff",
    extension: "tiff",
    signature: [0x49, 0x49, 0x2a, 0x00],
  },
  {
    mime: "image/x-icon",
    extension: "ico",
    signature: [0x00, 0x00, 0x01, 0x00],
  },
  // "%PDF"
  {
    mime: "application/pdf",
    extension: "pdf",
    signature: [0x25, 0x50, 0x44, 0x46],
  },
  {
    mime: "application/zip",
    extension: "zip",
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  { mime: "application/gzip", extension: "gz", signature: [0x1f, 0x8b] },
  {
    mime: "application/x-rar-compressed",
    extension: "rar",
    signature: [0x52, 0x61, 0x72, 0x21],
  },
  { mime: "audio/mpeg", extension: "mp3", signature: [0x49, 0x44, 0x33] },
  { mime: "audio/ogg", extension: "ogg", signature: [0x4f, 0x67, 0x67, 0x53] },
  {
    mime: "video/webm",
    extension: "webm",
    signature: [0x1a, 0x45, 0xdf, 0xa3],
  },
];

interface DetectionResult {
  mime: string;
  extension: string;
  confidence: "high" | "medium" | "low";
}

const HEADER_SIZE = 12;

export async function detectFileType(
  file: File,
): Promise<DetectionResult | null> {
  const buffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  for (const sig of FILE_SIGNATURES) {
    const offset = sig.offset ?? 0;
    const matches = sig.signature.every(
      (byte, index) => bytes[offset + index] === byte,
    );
    if (!matches) continue;

    if (sig.mime === "application/zip") {
      const detailedType = await detectZipBasedFormat(file);
      if (detailedType) return detailedType;
    }

    return {
      mime: sig.mime,
      extension: sig.extension,
      // a short signature collides more easily, so say so
      confidence: sig.signature.length >= 4 ? "high" : "medium",
    };
  }

  // no signature matched: fall back to what the file claims, flagged as weak
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  return {
    mime: file.type || "application/octet-stream",
    extension: ext,
    confidence: "low",
  };
}

/** Office formats are ZIPs; their entry names appear early enough to read. */
async function detectZipBasedFormat(
  file: File,
): Promise<DetectionResult | null> {
  const SAMPLE_SIZE = 1000;
  const buffer = await file.slice(0, SAMPLE_SIZE).arrayBuffer();
  const text = new TextDecoder().decode(buffer);

  const OFFICE_FORMATS = [
    {
      marker: "word/",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    },
    {
      marker: "xl/",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    },
    {
      marker: "ppt/",
      mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      extension: "pptx",
    },
  ];

  const found = OFFICE_FORMATS.find((f) => text.includes(f.marker));
  if (found) {
    return { mime: found.mime, extension: found.extension, confidence: "high" };
  }

  return { mime: "application/zip", extension: "zip", confidence: "high" };
}
```

A `low` confidence result is the extension talking, which is exactly what magic bytes were meant to
replace — treat it as unknown rather than as an answer.

---

## Pattern 8: Image dimensions

Loading the image is the expensive check, so the type and size checks run first and short-circuit.

```typescript
// image-validator.ts
interface ImageValidationOptions {
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: { width: number; height: number; tolerance?: number };
  maxSizeBytes?: number;
}

interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  dimensions?: { width: number; height: number };
}

const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_ASPECT_RATIO_TOLERANCE = 0.01;

export async function validateImage(
  file: File,
  options: ImageValidationOptions = {},
): Promise<ImageValidationResult> {
  if (!file.type.startsWith("image/")) {
    return { valid: false, errors: ["File is not an image"] };
  }

  const errors: string[] = [];

  if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
    errors.push(
      `Image must be smaller than ${options.maxSizeBytes / BYTES_PER_MB}MB`,
    );
  }

  const dimensions = await getImageDimensions(file);
  if (!dimensions) return { valid: false, errors: ["Failed to load image"] };

  if (options.maxWidth && dimensions.width > options.maxWidth) {
    errors.push(`Image width must not exceed ${options.maxWidth}px`);
  }
  if (options.maxHeight && dimensions.height > options.maxHeight) {
    errors.push(`Image height must not exceed ${options.maxHeight}px`);
  }
  if (options.minWidth && dimensions.width < options.minWidth) {
    errors.push(`Image width must be at least ${options.minWidth}px`);
  }
  if (options.minHeight && dimensions.height < options.minHeight) {
    errors.push(`Image height must be at least ${options.minHeight}px`);
  }

  if (options.aspectRatio) {
    const expected = options.aspectRatio.width / options.aspectRatio.height;
    const actual = dimensions.width / dimensions.height;
    // integer dimensions rarely divide to an exact ratio, so allow a tolerance
    const tolerance =
      options.aspectRatio.tolerance ?? DEFAULT_ASPECT_RATIO_TOLERANCE;

    if (Math.abs(actual - expected) > tolerance) {
      errors.push(
        `Image aspect ratio must be ${options.aspectRatio.width}:${options.aspectRatio.height}`,
      );
    }
  }

  return { valid: errors.length === 0, errors, dimensions };
}

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}
```

---

## Pattern 9: Validation hook

Ordered fail-fast, cheapest first, with the file only read once every metadata check has passed.

```typescript
// use-file-validation.ts
import { useCallback, useState } from "react";
import { matchesAnyType } from "./file-validator";
import { detectFileType } from "./file-type-detection";
import { validateImage } from "./image-validator";

interface ValidationState {
  validating: boolean;
  errors: string[];
  isValid: boolean | null;
}

interface UseFileValidationOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  validateContent?: boolean;
  imageOptions?: {
    maxWidth?: number;
    maxHeight?: number;
    minWidth?: number;
    minHeight?: number;
  };
}

const INITIAL_STATE: ValidationState = {
  validating: false,
  errors: [],
  isValid: null,
};

const BYTES_PER_MB = 1024 * 1024;

export function useFileValidation(options: UseFileValidationOptions = {}) {
  const [state, setState] = useState<ValidationState>(INITIAL_STATE);

  const validate = useCallback(
    async (file: File): Promise<boolean> => {
      setState({ validating: true, errors: [], isValid: null });

      const errors: string[] = [];

      if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
        errors.push(
          `File must be smaller than ${options.maxSizeBytes / BYTES_PER_MB}MB`,
        );
      }

      if (
        options.allowedTypes?.length &&
        !matchesAnyType(file.type, options.allowedTypes)
      ) {
        errors.push(
          `File type must be one of: ${options.allowedTypes.join(", ")}`,
        );
      }

      if (options.validateContent && options.allowedTypes?.length) {
        const detected = await detectFileType(file);
        if (detected && !matchesAnyType(detected.mime, options.allowedTypes)) {
          errors.push("File content does not match declared type");
        }
      }

      if (options.imageOptions && file.type.startsWith("image/")) {
        const imageResult = await validateImage(file, options.imageOptions);
        errors.push(...imageResult.errors);
      }

      const isValid = errors.length === 0;
      setState({ validating: false, errors, isValid });
      return isValid;
    },
    [options],
  );

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, validate, reset };
}
```

`isValid` starts `null` rather than `false`, so "not yet checked" and "checked and failed" are
distinguishable and the UI does not show an error before anything happened.
