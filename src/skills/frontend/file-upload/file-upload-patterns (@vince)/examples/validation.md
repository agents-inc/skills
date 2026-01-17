# File Validation Examples

> File validation patterns for MIME type, magic bytes, size, and image dimensions. Reference from [SKILL.md](../SKILL.md).

---

## Pattern 1: Comprehensive File Validator

### Validator Class with Multiple Rules

```typescript
// file-validator.ts
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

    // Size validation
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

    // MIME type validation
    if (allowedTypes?.length) {
      this.rules.push({
        validate: (file) => {
          return allowedTypes.some((type) => {
            if (type.endsWith('/*')) {
              return file.type.startsWith(type.replace('/*', '/'));
            }
            return file.type === type;
          });
        },
        message: `File type must be one of: ${allowedTypes.join(', ')}`,
      });
    }

    // Extension validation
    if (allowedExtensions?.length) {
      this.rules.push({
        validate: (file) => {
          const ext = '.' + file.name.split('.').pop()?.toLowerCase();
          return allowedExtensions.includes(ext);
        },
        message: `File extension must be one of: ${allowedExtensions.join(', ')}`,
      });
    }

    // Content validation (magic bytes)
    if (validateContent && allowedTypes?.length) {
      this.rules.push({
        validate: async (file) => {
          const actualType = await detectFileType(file);
          return actualType !== null && allowedTypes.includes(actualType);
        },
        message: 'File content does not match declared type',
      });
    }

    // Custom rules
    this.rules.push(...customRules);
  }

  async validate(file: File): Promise<ValidationResult> {
    const errors: string[] = [];

    for (const rule of this.rules) {
      const isValid = await rule.validate(file);
      if (!isValid) {
        errors.push(rule.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateMany(files: File[]): Promise<Map<File, ValidationResult>> {
    const results = new Map<File, ValidationResult>();

    for (const file of files) {
      results.set(file, await this.validate(file));
    }

    return results;
  }
}
```

**Why good:** Composable validation rules, async support for content validation, validates multiple files with individual results, custom rules extensibility

---

## Pattern 2: Magic Bytes Detection

### File Type Detection by Content

```typescript
// file-type-detection.ts
interface FileSignature {
  mime: string;
  extension: string;
  signature: number[];
  offset?: number;
}

// Common file signatures (magic bytes)
const FILE_SIGNATURES: FileSignature[] = [
  // Images
  { mime: 'image/jpeg', extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  {
    mime: 'image/png',
    extension: 'png',
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mime: 'image/gif', extension: 'gif', signature: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'image/bmp', extension: 'bmp', signature: [0x42, 0x4d] },
  {
    mime: 'image/tiff',
    extension: 'tiff',
    signature: [0x49, 0x49, 0x2a, 0x00],
  },
  {
    mime: 'image/x-icon',
    extension: 'ico',
    signature: [0x00, 0x00, 0x01, 0x00],
  },

  // Documents
  {
    mime: 'application/pdf',
    extension: 'pdf',
    signature: [0x25, 0x50, 0x44, 0x46],
  }, // %PDF

  // Archives
  {
    mime: 'application/zip',
    extension: 'zip',
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  { mime: 'application/gzip', extension: 'gz', signature: [0x1f, 0x8b] },
  {
    mime: 'application/x-rar-compressed',
    extension: 'rar',
    signature: [0x52, 0x61, 0x72, 0x21],
  },

  // Audio
  { mime: 'audio/mpeg', extension: 'mp3', signature: [0x49, 0x44, 0x33] },
  { mime: 'audio/wav', extension: 'wav', signature: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'audio/ogg', extension: 'ogg', signature: [0x4f, 0x67, 0x67, 0x53] },

  // Video
  { mime: 'video/webm', extension: 'webm', signature: [0x1a, 0x45, 0xdf, 0xa3] },
];

interface DetectionResult {
  mime: string;
  extension: string;
  confidence: 'high' | 'medium' | 'low';
}

const HEADER_SIZE = 12;

export async function detectFileType(
  file: File
): Promise<DetectionResult | null> {
  const buffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  for (const sig of FILE_SIGNATURES) {
    const offset = sig.offset ?? 0;
    const matches = sig.signature.every(
      (byte, index) => bytes[offset + index] === byte
    );

    if (matches) {
      // Check for ZIP-based formats (Office docs)
      if (sig.mime === 'application/zip') {
        const detailedType = await detectZipBasedFormat(file);
        if (detailedType) return detailedType;
      }

      return {
        mime: sig.mime,
        extension: sig.extension,
        confidence: sig.signature.length >= 4 ? 'high' : 'medium',
      };
    }
  }

  // Fallback to extension-based detection
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext) {
    return {
      mime: file.type || 'application/octet-stream',
      extension: ext,
      confidence: 'low',
    };
  }

  return null;
}

async function detectZipBasedFormat(
  file: File
): Promise<DetectionResult | null> {
  const SAMPLE_SIZE = 1000;
  const buffer = await file.slice(0, SAMPLE_SIZE).arrayBuffer();
  const text = new TextDecoder().decode(buffer);

  if (text.includes('word/')) {
    return {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      confidence: 'high',
    };
  }
  if (text.includes('xl/')) {
    return {
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      confidence: 'high',
    };
  }
  if (text.includes('ppt/')) {
    return {
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: 'pptx',
      confidence: 'high',
    };
  }

  return { mime: 'application/zip', extension: 'zip', confidence: 'high' };
}
```

**Why good:** Reads actual file bytes not metadata, detects Office documents within ZIP containers, provides confidence level, handles unknown files gracefully

---

## Pattern 3: Image Dimension Validator

### Validate Image Width, Height, and Aspect Ratio

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
  options: ImageValidationOptions = {}
): Promise<ImageValidationResult> {
  const errors: string[] = [];

  // Basic file validation
  if (!file.type.startsWith('image/')) {
    return { valid: false, errors: ['File is not an image'] };
  }

  if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
    errors.push(
      `Image must be smaller than ${options.maxSizeBytes / BYTES_PER_MB}MB`
    );
  }

  // Load image to get dimensions
  const dimensions = await getImageDimensions(file);

  if (!dimensions) {
    return { valid: false, errors: ['Failed to load image'] };
  }

  // Dimension validation
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

  // Aspect ratio validation
  if (options.aspectRatio) {
    const expectedRatio =
      options.aspectRatio.width / options.aspectRatio.height;
    const actualRatio = dimensions.width / dimensions.height;
    const tolerance =
      options.aspectRatio.tolerance ?? DEFAULT_ASPECT_RATIO_TOLERANCE;

    if (Math.abs(actualRatio - expectedRatio) > tolerance) {
      errors.push(
        `Image aspect ratio must be ${options.aspectRatio.width}:${options.aspectRatio.height}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    dimensions,
  };
}

async function getImageDimensions(
  file: File
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

**Why good:** Validates file type before loading, cleans up object URL, returns dimensions for display, aspect ratio tolerance prevents false negatives from rounding

---

## Pattern 4: Combined Validation Hook

### Use Validation in React Components

```typescript
// use-file-validation.ts
import { useCallback, useState } from 'react';

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

export function useFileValidation(options: UseFileValidationOptions = {}) {
  const [state, setState] = useState<ValidationState>(INITIAL_STATE);

  const validate = useCallback(
    async (file: File): Promise<boolean> => {
      setState({ validating: true, errors: [], isValid: null });

      const errors: string[] = [];

      // Size validation
      if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
        const maxMB = options.maxSizeBytes / (1024 * 1024);
        errors.push(`File must be smaller than ${maxMB}MB`);
      }

      // Type validation
      if (options.allowedTypes?.length) {
        const isAllowed = options.allowedTypes.some((type) => {
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.replace('/*', '/'));
          }
          return file.type === type;
        });

        if (!isAllowed) {
          errors.push(
            `File type must be one of: ${options.allowedTypes.join(', ')}`
          );
        }
      }

      // Content validation (magic bytes)
      if (options.validateContent && options.allowedTypes?.length) {
        const detected = await detectFileType(file);
        if (detected) {
          const contentAllowed = options.allowedTypes.some((type) => {
            if (type.endsWith('/*')) {
              return detected.mime.startsWith(type.replace('/*', '/'));
            }
            return detected.mime === type;
          });

          if (!contentAllowed) {
            errors.push('File content does not match declared type');
          }
        }
      }

      // Image dimension validation
      if (options.imageOptions && file.type.startsWith('image/')) {
        const imageResult = await validateImage(file, options.imageOptions);
        errors.push(...imageResult.errors);
      }

      const isValid = errors.length === 0;
      setState({ validating: false, errors, isValid });

      return isValid;
    },
    [options]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    validate,
    reset,
  };
}
```

### Usage Example

```typescript
function ImageUploader() {
  const { validating, errors, isValid, validate, reset } = useFileValidation({
    maxSizeBytes: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    validateContent: true,
    imageOptions: {
      minWidth: 200,
      minHeight: 200,
      maxWidth: 4000,
      maxHeight: 4000,
    },
  });

  const handleFileSelected = async (file: File) => {
    const valid = await validate(file);
    if (valid) {
      // Proceed with upload
    }
  };

  return (
    <div>
      <FileDropzone
        onFilesSelected={(files) => handleFileSelected(files[0])}
        accept={['image/jpeg', 'image/png', 'image/webp']}
        disabled={validating}
      />

      {validating && <p>Validating...</p>}

      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}

      {isValid && <p>File is valid!</p>}
    </div>
  );
}
```

**Why good:** Encapsulates all validation logic, provides loading state, returns errors as array for display, reusable across components

---

## Anti-Pattern Examples

### What NOT to Do

```typescript
// ANTI-PATTERN: Extension only validation
const isImage = (file: File) => /\.(jpg|png|gif)$/i.test(file.name);
// Problem: malware.exe renamed to photo.jpg passes!

// ANTI-PATTERN: MIME type only validation
const isPDF = (file: File) => file.type === 'application/pdf';
// Problem: MIME type is user-controlled and can be spoofed!

// ANTI-PATTERN: Client-only validation
const handleUpload = async (file: File) => {
  if (isValidImage(file)) {
    await upload(file);
  }
};
// Problem: Server MUST also validate - client can be bypassed!

// ANTI-PATTERN: Reading entire file for validation
const validateContent = async (file: File) => {
  const content = await file.text(); // Reads entire file!
  return content.startsWith('%PDF');
};
// Problem: 1GB file will freeze the browser!
```

### Correct Approaches

```typescript
// CORRECT: Multiple validation layers
async function validateFile(file: File): Promise<boolean> {
  // 1. Quick checks first (fail fast)
  if (file.size > MAX_SIZE) return false;

  // 2. Extension check (quick)
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext ?? '')) return false;

  // 3. MIME type check (quick)
  if (!ALLOWED_TYPES.includes(file.type)) return false;

  // 4. Magic bytes check (reads only first few bytes)
  const detected = await detectFileType(file);
  if (!detected || !ALLOWED_TYPES.includes(detected.mime)) return false;

  // 5. Server will validate again!
  return true;
}
```

---

_Extended examples: [core.md](core.md) | [progress.md](progress.md) | [preview.md](preview.md) | [s3-upload.md](s3-upload.md) | [resumable.md](resumable.md) | [accessibility.md](accessibility.md)_
