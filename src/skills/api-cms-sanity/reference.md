# Sanity Reference

> CLI commands, GROQ cheat sheet, type helpers, and quick-lookup tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Sanity CLI Commands

### Project Setup

```bash
# Install Sanity CLI globally (or use npx)
npm install -g sanity

# Initialize a new Sanity project
npx sanity init

# Start Sanity Studio (local dev)
npx sanity dev

# Build Studio for deployment
npx sanity build

# Deploy Studio to Sanity hosting
npx sanity deploy
```

### Type Generation

```bash
# Extract schema to JSON
npx sanity schema extract
# Creates: schema.json

# Generate TypeScript types from schema + GROQ queries
npx sanity typegen generate

# Watch mode (re-generates on changes)
npx sanity typegen generate --watch
```

### Dataset Management

```bash
# List datasets
npx sanity dataset list

# Create a dataset
npx sanity dataset create <name>

# Export dataset
npx sanity dataset export <dataset> <output-file>

# Import dataset
npx sanity dataset import <input-file> <dataset>
```

### CORS Management

```bash
# List CORS origins
npx sanity cors list

# Add a CORS origin
npx sanity cors add http://localhost:3000

# Delete a CORS origin
npx sanity cors delete http://localhost:3000
```

---

## Environment Variables

```bash
# .env.local
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_API_TOKEN=sk...          # Server-only — never expose to client
```

---

## GROQ Quick Reference

### Filters

| Pattern        | GROQ                                                 |
| -------------- | ---------------------------------------------------- |
| All of type    | `*[_type == "post"]`                                 |
| Multiple types | `*[_type in ["post", "page"]]`                       |
| By slug        | `*[_type == "post" && slug.current == $slug][0]`     |
| By reference   | `*[_type == "post" && references($authorId)]`        |
| Boolean        | `*[_type == "post" && published == true]`            |
| Comparison     | `*[_type == "post" && publishedAt > "2024-01-01"]`   |
| Pattern match  | `*[_type == "post" && title match "sanity*"]`        |
| Array contains | `*[_type == "post" && "typescript" in tags]`         |
| Has field      | `*[_type == "post" && defined(featuredImage)]`       |
| Combined (AND) | `*[_type == "post" && published && count(tags) > 0]` |
| Combined (OR)  | `*[published == true \|\| _id in path("drafts.**")]` |

### Projections

| Pattern             | GROQ                                       |
| ------------------- | ------------------------------------------ |
| Specific fields     | `{ _id, title, slug }`                     |
| Rename field        | `{ "postTitle": title }`                   |
| All fields          | `{ ... }`                                  |
| All + computed      | `{ ..., "excerpt": pt::text(body) }`       |
| Dereference         | `{ "author": author->{ name, image } }`    |
| Array dereference   | `{ "tags": tags[]->{ title } }`            |
| Nested array fields | `{ content[]{ _type, _key } }`             |
| Conditional fields  | `{ ..., _type == "post" => { body } }`     |
| Coalesce            | `{ "name": coalesce(displayName, email) }` |
| Count               | `{ "tagCount": count(tags) }`              |

### Ordering and Slicing

| Pattern         | GROQ                                      |
| --------------- | ----------------------------------------- |
| Ascending       | `\| order(publishedAt asc)`               |
| Descending      | `\| order(publishedAt desc)`              |
| Multi-field     | `\| order(priority desc, _createdAt asc)` |
| First item      | `[0]`                                     |
| First N items   | `[0...10]` (non-inclusive end)            |
| Inclusive range | `[0..9]` (inclusive end)                  |
| Offset          | `[10...20]`                               |
| Parameterized   | `[$start...$end]`                         |

### Joins and References

| Pattern             | GROQ                                                        |
| ------------------- | ----------------------------------------------------------- |
| Follow reference    | `author->{ name }`                                          |
| Nested reference    | `image{ asset->{ url } }`                                   |
| Array of references | `categories[]->{ title }`                                   |
| Reverse reference   | `"posts": *[_type == "post" && references(^._id)]{ title }` |
| Filter by reference | `*[references("author-id")]`                                |

### Special Variables

| Variable | Meaning                                                |
| -------- | ------------------------------------------------------ |
| `*`      | All documents in the dataset                           |
| `@`      | Current document in scope                              |
| `^`      | Parent document (used in subqueries)                   |
| `$param` | Query parameter (passed via `client.fetch` second arg) |

### Built-in Functions

| Function                              | Description                              |
| ------------------------------------- | ---------------------------------------- |
| `count(array)`                        | Number of elements in array              |
| `defined(field)`                      | True if field has a value                |
| `coalesce(a, b, ...)`                 | First non-null value                     |
| `round(num)` / `round(num, decimals)` | Round a number                           |
| `lower(str)` / `upper(str)`           | Case conversion                          |
| `pt::text(portableText)`              | Convert Portable Text to plain text      |
| `array::unique(arr)`                  | Remove duplicates                        |
| `array::compact(arr)`                 | Remove null values                       |
| `array::join(arr, separator)`         | Join array to string                     |
| `references(id)`                      | True if document references the given ID |
| `select(cond => val, ...)`            | Conditional value selection              |
| `score(expr)`                         | Scoring for search relevance             |

---

## Schema Field Types

| Type        | Description                                   |
| ----------- | --------------------------------------------- |
| `string`    | Plain text string                             |
| `text`      | Multi-line text (no formatting)               |
| `number`    | Numeric value                                 |
| `boolean`   | True/false                                    |
| `date`      | Date without time                             |
| `datetime`  | Date with time                                |
| `slug`      | URL-safe string (accessed via `.current`)     |
| `url`       | Validated URL string                          |
| `email`     | Validated email string                        |
| `image`     | Image with optional hotspot/crop              |
| `file`      | Uploaded file                                 |
| `array`     | Array of items (requires `of` property)       |
| `object`    | Inline object (not a document)                |
| `block`     | Portable Text block (rich text)               |
| `reference` | Reference to another document (requires `to`) |
| `geopoint`  | Latitude/longitude point                      |

---

## Image URL Builder Methods

| Method              | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `.width(px)`        | Set width in pixels                                                   |
| `.height(px)`       | Set height in pixels                                                  |
| `.size(w, h)`       | Set both width and height                                             |
| `.fit(mode)`        | Resize mode: `clip`, `crop`, `fill`, `fillmax`, `max`, `scale`, `min` |
| `.auto(type)`       | Auto-format: `'format'` serves WebP/AVIF when supported               |
| `.format(fmt)`      | Force format: `jpg`, `pjpg`, `png`, `webp`                            |
| `.quality(q)`       | JPEG/WebP quality (0-100)                                             |
| `.blur(amount)`     | Apply Gaussian blur                                                   |
| `.sharpen(amount)`  | Apply sharpening                                                      |
| `.flipHorizontal()` | Flip horizontally                                                     |
| `.flipVertical()`   | Flip vertically                                                       |
| `.rect(x, y, w, h)` | Crop to specific rectangle                                            |
| `.focalPoint(x, y)` | Set focal point (0.0-1.0)                                             |
| `.url()`            | Return the final URL string                                           |

---

## Portable Text Component Types

| Component Key | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| `types`       | Custom block types (image, code, callout, video embed) |
| `marks`       | Inline annotations (link, highlight, footnote)         |
| `block`       | Block-level styles (h1-h6, blockquote, normal)         |
| `list`        | List types (bullet, number)                            |
| `listItem`    | List item rendering                                    |
| `hardBreak`   | Line break rendering                                   |

---

## Client Methods Quick Reference

| Method                                  | Description                                         |
| --------------------------------------- | --------------------------------------------------- |
| `client.fetch(query, params?)`          | Execute a GROQ query                                |
| `client.create(doc)`                    | Create a new document (auto-generates `_id`)        |
| `client.createOrReplace(doc)`           | Create or fully replace (requires `_id`)            |
| `client.createIfNotExists(doc)`         | Create only if `_id` doesn't exist                  |
| `client.patch(id).set({}).commit()`     | Update specific fields                              |
| `client.patch(id).unset([]).commit()`   | Remove fields                                       |
| `client.patch(id).inc({}).commit()`     | Increment numeric fields                            |
| `client.patch(id).dec({}).commit()`     | Decrement numeric fields                            |
| `client.patch(id).insert(...).commit()` | Insert into arrays                                  |
| `client.delete(id)`                     | Delete a document                                   |
| `client.transaction()...commit()`       | Group mutations atomically                          |
| `client.listen(query)`                  | Subscribe to real-time changes (returns Observable) |
| `client.getDocument(id)`                | Fetch a single document by ID                       |
