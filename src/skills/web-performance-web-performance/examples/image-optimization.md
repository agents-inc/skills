# Performance — Images

> Formats, responsive sources and lazy loading. Format and weight tables are in [reference.md](../reference.md).

Images are typically the largest share of a page's bytes and the usual LCP element, so format and
dimensions move the metric more than anything else on this page.

---

## Serving the best format the browser supports

```html
<picture>
  <source
    srcset="
      /images/hero-400.avif   400w,
      /images/hero-800.avif   800w,
      /images/hero-1200.avif 1200w
    "
    type="image/avif"
  />
  <source
    srcset="
      /images/hero-400.webp   400w,
      /images/hero-800.webp   800w,
      /images/hero-1200.webp 1200w
    "
    type="image/webp"
  />
  <img
    src="/images/hero-800.jpg"
    srcset="
      /images/hero-400.jpg   400w,
      /images/hero-800.jpg   800w,
      /images/hero-1200.jpg 1200w
    "
    sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
    alt="Hero"
    width="1200"
    height="600"
    decoding="async"
  />
</picture>
```

**Why good:** the browser takes the first `<source>` whose type it supports and the narrowest
`srcset` entry that satisfies `sizes`, so a phone downloads a 400-pixel AVIF where a desktop
downloads a 1200-pixel one. The `<img>` is both the fallback and the element the attributes apply
to — `alt`, `width` and `height` belong there rather than on the sources.

```html
<!-- Bad -->
<img src="/images/hero-4k.jpg" alt="Hero" />
```

**Why bad:** one enormous file for every device, in the largest format, with no reserved space.

`sizes` describes the layout, not the file. Getting it wrong is the common failure: a value that
overstates the rendered width makes the browser pick a larger file than it needs, and the whole
`srcset` buys nothing.

---

## Lazy loading, and where not to

```html
<!-- Below the fold: defer it -->
<img
  src="/image.webp"
  alt="Description"
  loading="lazy"
  decoding="async"
  width="800"
  height="400"
/>

<!-- Above the fold: fetch it immediately and early -->
<img
  src="/hero.avif"
  alt="Hero"
  fetchpriority="high"
  decoding="async"
  width="1200"
  height="600"
/>
```

**Why good:** deferring what is off-screen removes it from the initial load entirely, while the LCP
candidate gets the opposite treatment.

```html
<!-- Bad -->
<img src="/hero.jpg" alt="Hero" loading="lazy" width="1200" height="600" />
```

**Why bad:** `loading="lazy"` delays discovery of the element that defines LCP, so the metric it was
meant to improve gets worse.

**Lazy:** below-fold images, long pages, gallery and carousel items past the first.
**Eager:** the LCP candidate, anything in the first viewport, anything needed for the first paint.

---

## Generating the formats

Conversion belongs in the build rather than in anyone's hands: the source stays a single original,
and the derivatives are reproducible.

```bash
# Quality 80 is the usual point where the artefacts stop being visible
cwebp -q 80 "$source" -o "${base}.webp"
avifenc -s 6 -q 80 "$source" -o "${base}.avif"
```

The decisions worth carrying between projects are the quality setting, which widths to emit, and
whether conversion runs as a build step or as a check that fails when a committed image has no
derivatives. AVIF encoding is slow enough that it belongs in a cached step rather than on every
build.
