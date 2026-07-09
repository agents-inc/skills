# Electron Forge -- Build Hooks & Extending

> Lifecycle hooks, custom makers, extending Forge. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for forge.config.ts fundamentals.

---

## Build Lifecycle Overview

Forge hooks fire at specific points during the three-step build process:

```
start / package:
  generateAssets  -->  prePackage  -->  [packager runs]
                                       --> packageAfterCopy
                                       --> packageAfterPrune
                                       --> packageAfterExtract
                                       -->  postPackage

make:
  preMake  -->  [makers run]  -->  postMake (mutating)

publish:
  [publishers run]

every step:
  readPackageJson (mutating -- fires on every package.json read)
```

---

## Hook Examples

### prePackage: Validate or Generate Before Packaging

```typescript
// forge.config.ts
hooks: {
  prePackage: async (_config, platform, arch) => {
    console.log(`Packaging for ${platform}-${arch}`);
    // Generate license files, version stamps, or validate config
    await generateLicenseFile();
  },
},
```

### postMake: Rename or Process Artifacts

`postMake` is the only hook that can mutate the pipeline -- return a modified `MakeResult[]` to affect subsequent steps (like publishing).

```typescript
import type { ForgeMakeResult } from "@electron-forge/shared-types";

hooks: {
  postMake: async (_config, makeResults: ForgeMakeResult[]) => {
    // Example: rename artifacts to include version
    for (const result of makeResults) {
      for (const artifact of result.artifacts) {
        console.log(`Created: ${artifact}`);
      }
    }
    // Return modified results to affect publish step
    return makeResults;
  },
},
```

### readPackageJson: Inject Build-Time Values

Fires every time Forge reads `package.json`. Return a modified object to inject dynamic values.

```typescript
hooks: {
  readPackageJson: async (_config, packageJson) => {
    // Inject build timestamp or commit hash
    packageJson.buildInfo = {
      timestamp: new Date().toISOString(),
      commit: process.env.GITHUB_SHA ?? "local",
    };
    return packageJson;
  },
},
```

### packageAfterPrune: Post-Pruning Cleanup

Runs after devDependencies are removed from the packaged app directory.

```typescript
hooks: {
  packageAfterPrune: async (_config, buildPath) => {
    // Remove unnecessary files from the production bundle
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const unnecessaryFiles = ["README.md", "CHANGELOG.md", ".eslintrc"];
    for (const file of unnecessaryFiles) {
      const filePath = path.join(buildPath, file);
      await fs.rm(filePath, { force: true });
    }
  },
},
```

---

## Custom Makers

Custom makers extend `MakerBase` and implement `isSupportedOnCurrentPlatform()` plus the `make()` method.

```typescript
import { MakerBase, type MakerOptions } from "@electron-forge/maker-base";

interface MyMakerConfig {
  outputName?: string;
}

export class MakerPortable extends MakerBase<MyMakerConfig> {
  name = "portable";
  defaultPlatforms: string[] = ["win32"];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === "win32";
  }

  async make({
    dir, // path to packaged app directory
    makeDir, // path to output directory for artifacts
    targetArch, // target architecture (x64, arm64, etc.)
    appName, // application name
  }: MakerOptions): Promise<string[]> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const outputName = this.config.outputName ?? `${appName}-portable.exe`;
    const outputPath = path.join(makeDir, outputName);

    // Your custom packaging logic here
    await fs.cp(dir, outputPath, { recursive: true });

    // Return array of absolute paths to created artifacts
    return [outputPath];
  }
}
```

**Key rules:**

- `make()` must return an array of absolute paths to the artifacts created
- If an error occurs, reject the promise -- Forge stops the make process
- `this.config` provides the maker's configuration from forge.config.ts
- Register in forge.config.ts: `new MakerPortable({ outputName: "app-portable.exe" })`

---

## Hook Execution Order

**Hooks of the same type run in parallel** -- do not depend on execution order between multiple hooks. If you need sequential execution, chain the logic within a single hook function.

```typescript
// BAD: Two separate hooks that depend on each other
hooks: {
  prePackage: async () => { await stepOne(); },
  // This also fires as prePackage -- NO guaranteed order
},

// GOOD: Sequential logic in one hook
hooks: {
  prePackage: async (_config, platform, arch) => {
    await stepOne();
    await stepTwo(); // guaranteed to run after stepOne
  },
},
```
