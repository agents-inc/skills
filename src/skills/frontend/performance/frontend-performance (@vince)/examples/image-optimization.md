# Image Optimization

> Image formats, lazy loading, and Next.js Image patterns. See [core.md](core.md) for React runtime patterns.

---

## Image Format Constants

```typescript
// constants/image.ts
export const IMAGE_FORMATS = {
  AVIF_COMPRESSION_PERCENT: 40, // 30-50% smaller than JPEG
  WEBP_COMPRESSION_PERCENT: 30, // 25-35% smaller than JPEG
  BROWSER_SUPPORT_AVIF_PERCENT: 93,
  BROWSER_SUPPORT_WEBP_PERCENT: 97,
} as const;

export const IMAGE_SIZE_BUDGETS_KB = {
  HERO: 200,
  THUMBNAIL: 50,
} as const;
```

**Format priority:**

1. **AVIF** - Best compression (30-50% smaller than JPEG)
   - Browser support: 93% (2024)
   - Use with fallbacks

2. **WebP** - Good compression (25-35% smaller than JPEG)
   - Browser support: 97%
   - Recommended default

3. **JPEG** - Universal fallback
   - Supported everywhere

---

## Progressive Enhancement with Multiple Formats

### Good Example - Picture Element with Fallbacks

```html
<picture>
  <!-- AVIF: Best compression (30-50% smaller) -->
  <source
    srcset="
      /images/hero-400.avif   400w,
      /images/hero-800.avif   800w,
      /images/hero-1200.avif 1200w
    "
    type="image/avif"
  />

  <!-- WebP: Good compression (25-35% smaller) -->
  <source
    srcset="
      /images/hero-400.webp   400w,
      /images/hero-800.webp   800w,
      /images/hero-1200.webp 1200w
    "
    type="image/webp"
  />

  <!-- JPEG: Universal fallback -->
  <img
    src="/images/hero-800.jpg"
    srcset="
      /images/hero-400.jpg   400w,
      /images/hero-800.jpg   800w,
      /images/hero-1200.jpg 1200w
    "
    sizes="(max-width: 600px) 400px,
           (max-width: 1200px) 800px,
           1200px"
    alt="Hero image"
    loading="lazy"
    decoding="async"
    width="1200"
    height="600"
  />
</picture>
```

**Why good:** Browser chooses best supported format (AVIF > WebP > JPEG), serves appropriate size for viewport, smaller file sizes improve LCP, dimensions prevent CLS

### Bad Example - Single Format, No Responsive Sizes

```html
<img src="/images/hero-4k.jpg" alt="Hero" />
```

**Why bad:** Serves 4K image to mobile (wasted bandwidth), no modern format optimization (30-50% larger files), no lazy loading (blocks LCP), no dimensions (causes CLS)

---

## Lazy Loading Images

### Good Example - Lazy Load Below-Fold Images

```html
<img
  src="/image.jpg"
  alt="Description"
  loading="lazy"
  decoding="async"
  width="800"
  height="400"
/>
```

**Why good:** Defers loading until image near viewport, reduces initial page weight, faster Time to Interactive

### Bad Example - Lazy Loading Above-Fold Image

```html
<img src="/hero.jpg" alt="Hero" loading="lazy" width="1200" height="600" />
```

**Why bad:** Delays LCP element, poor perceived performance, lazy loading adds overhead for critical images

**When to use lazy loading:**

- Below-the-fold images
- Images in long pages
- Carousels and galleries

**When NOT to use:**

- Above-the-fold images (use `loading="eager"` or priority)
- Images needed for initial render

---

## Next.js Image Component

### Good Example - Priority for Above-Fold

```typescript
import Image from 'next/image';

export function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero image"
      width={1200}
      height={600}
      priority  // Preload for LCP
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    />
  );
}
```

**Why good:** Automatic format selection (AVIF/WebP), prevents layout shift (width/height required), blur placeholder improves perceived performance, priority flag preloads for LCP

### Good Example - Lazy Loading for Below-Fold

```typescript
import Image from 'next/image';

export function FeatureImage() {
  return (
    <Image
      src="/feature.jpg"
      alt="Feature"
      width={800}
      height={400}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    />
  );
}
```

**Why good:** Lazy loads by default (reduces initial page weight), blur placeholder shows while loading, automatic responsive images

**Next.js Image benefits:**

- Automatic format selection (AVIF/WebP)
- Lazy loading by default
- Prevents layout shift (width/height required)
- Blur placeholder for better UX

---

## Image Optimization Automation

### Build Script

```bash
#!/bin/bash
# scripts/optimize-images.sh

# Convert images to WebP and AVIF
for img in public/images/*.{jpg,png}; do
  filename="${img%.*}"

  # Convert to WebP (quality 80)
  cwebp -q 80 "$img" -o "${filename}.webp"

  # Convert to AVIF (quality 80)
  avif -q 80 "$img" -o "${filename}.avif"

  echo "Optimized: $img"
done
```

### package.json Integration

```json
// package.json
{
  "scripts": {
    "optimize:images": "bash scripts/optimize-images.sh",
    "prebuild": "bun run optimize:images"
  }
}
```

**Why good:** Automated image optimization in build pipeline, consistent quality across all images, no manual optimization needed
