# Firebase -- Security Rules Examples

> Firestore and Storage security rules: auth-based access, data validation, helper functions, and common patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

**Related examples:**

- [core.md](core.md) -- Firebase project setup, emulator suite
- [firestore.md](firestore.md) -- Firestore CRUD, queries, real-time listeners
- [auth.md](auth.md) -- Authentication flows
- [functions.md](functions.md) -- Cloud Functions v2, Admin SDK
- [storage.md](storage.md) -- File upload, download, delete

---

## Firestore Security Rules

```
// firestore.rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function: check if user owns the resource
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Helper function: check if user has admin custom claim
    function isAdmin() {
      return request.auth.token.admin == true;
    }

    // Posts collection
    match /posts/{postId} {
      // Anyone can read published posts; authors can read their own drafts
      allow read: if resource.data.published == true
                  || isOwner(resource.data.authorId);

      // Only authenticated users can create posts as themselves
      allow create: if isAuthenticated()
                    && request.resource.data.authorId == request.auth.uid
                    && request.resource.data.title is string
                    && request.resource.data.title.size() > 0
                    && request.resource.data.title.size() <= 200;

      // Authors can update their own posts
      allow update: if isOwner(resource.data.authorId)
                    && request.resource.data.authorId == resource.data.authorId;

      // Authors and admins can delete posts
      allow delete: if isOwner(resource.data.authorId) || isAdmin();

      // Subcollection: likes
      match /likes/{likeId} {
        allow read: if true;
        allow create: if isAuthenticated() && likeId == request.auth.uid;
        allow delete: if isAuthenticated() && likeId == request.auth.uid;
      }
    }

    // User profiles
    match /users/{userId} {
      allow read: if true;
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false; // Users cannot delete their own profile document
    }
  }
}
```

**Why good:** `rules_version = '2'` required for collection group queries, helper functions reduce duplication, granular read/write split into create/update/delete, data validation on create, ownership check prevents authorId spoofing on update, subcollection rules nested properly

---

## Storage Security Rules

```
// storage.rules
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Avatars: users can upload/read their own avatar
    match /avatars/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Documents: authenticated users can upload, only owner can read
    match /documents/{userId}/{fileName} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024;
    }

    // Deny everything else by default
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**Why good:** File size limits enforced in rules, content type validation for images, owner-based access control, default deny for unmatched paths

---

## Bad Example: Wide-Open Rules

```
// BAD: Wide-open security rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // DANGER: Anyone can read/write everything
    }
  }
}
```

**Why bad:** No authentication check, no access control, no data validation, entire database is public read/write -- this is the default test-mode rule and must NEVER be deployed to production

---

_For core concepts, see [SKILL.md](../SKILL.md). For quick reference tables, see [reference.md](../reference.md)._
