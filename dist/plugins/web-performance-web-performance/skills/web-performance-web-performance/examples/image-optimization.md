# Image Optimization

> Image formats, lazy loading, and responsive image patterns. See [core.md](core.md) for React runtime patterns.

---

## Image Format Priority

```typescript
// constants/image.ts
export const IMAGE_FORMATS = {
  AVIF_SIZE_REDUCTION_PERCENT: 40, // 30-50% smaller than JPEG
  WEBP_SIZE_REDUCTION_PERCENT: 30, // 25-35% smaller than JPEG
} as const;

export const IMAGE_SIZE_BUDGETS_KB = {
  HERO: 200,
  THUMBNAIL: 50,
} as const;
```

**Format priority (prefer in order):**

1. **AVIF** - Best compression (30-50% smaller than JPEG), ~95% browser support (2026)
2. **WebP** - Good compression (25-35% smaller), ~97% browser support
3. **JPEG** - Universal fallback

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

**Why good:** Browser chooses best supported format (AVIF > WebP > JPEG), serves appropriate size for viewport, smaller file sizes improve LCP, explicit dimensions prevent CLS

### Bad Example - Single Format, No Responsive Sizes

```html
<img src="/images/hero-4k.jpg" alt="Hero" />
```

**Why bad:** Serves 4K image to mobile (wasted bandwidth), no modern format optimization (30-50% larger files), no lazy loading, no dimensions (causes CLS)

---

## Lazy Loading Images

### Good Example - Lazy Load Below-Fold Images

```html
<img
  src="/image.webp"
  alt="Description"
  loading="lazy"
  decoding="async"
  width="800"
  height="400"
/>
```

**Why good:** Defers loading until image nears viewport, reduces initial page weight, faster Time to Interactive

### Bad Example - Lazy Loading Above-Fold Image

```html
<!-- Delays LCP! -->
<img src="/hero.jpg" alt="Hero" loading="lazy" width="1200" height="600" />
```

**Why bad:** Delays LCP element, poor perceived performance, lazy loading adds network round-trip for critical images

**When to use lazy loading:**

- Below-the-fold images
- Images in long pages
- Carousels and galleries

**When NOT to use:**

- Above-the-fold / hero images (use `loading="eager"` + `fetchpriority="high"`)
- Images needed for initial render (LCP candidates)

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
  avifenc -s 6 -q 80 "$img" -o "${filename}.avif"

  echo "Optimized: $img"
done
```

### package.json Integration

```json
{
  "scripts": {
    "optimize:images": "bash scripts/optimize-images.sh",
    "prebuild": "bun run optimize:images"
  }
}
```

**Why good:** Automated image optimization in build pipeline, consistent quality across all images, no manual optimization needed
