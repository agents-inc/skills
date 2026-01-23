import path from "path";
import { downloadTemplate } from "giget";
import { verbose } from "../utils/logger";
import { CACHE_DIR } from "../consts";
import { ensureDir, directoryExists } from "../utils/fs";
import { isLocalSource } from "./config";

/**
 * Options for fetching from a source
 */
export interface FetchOptions {
  /** Force fresh download, bypassing cache */
  forceRefresh?: boolean;
  /** Subdirectory within the repository to fetch */
  subdir?: string;
}

/**
 * Result of a fetch operation
 */
export interface FetchResult {
  /** Path to the fetched content */
  path: string;
  /** Whether the content was fetched from cache */
  fromCache: boolean;
  /** The source URL used */
  source: string;
}

/**
 * Get the cache directory for a specific source
 * Creates a sanitized directory name from the source URL
 * Preserves protocol prefix to avoid collisions between different platforms
 */
function getCacheDir(source: string): string {
  // Sanitize source URL for use as directory name
  // Keep protocol prefix to distinguish github:org/repo from gitlab:org/repo
  const sanitized = source
    .replace(/:/g, "-") // github:org/repo -> github-org/repo
    .replace(/[\/]/g, "-") // github-org/repo -> github-org-repo
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");

  return path.join(CACHE_DIR, "sources", sanitized);
}

/**
 * Fetch content from a source (local or remote)
 *
 * For local sources: validates the path exists
 * For remote sources: uses giget to download (with caching)
 */
export async function fetchFromSource(
  source: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const { forceRefresh = false, subdir } = options;

  // Handle local sources
  if (isLocalSource(source)) {
    return fetchFromLocalSource(source, subdir);
  }

  // Handle remote sources via giget
  return fetchFromRemoteSource(source, { forceRefresh, subdir });
}

/**
 * Fetch from a local file path
 */
async function fetchFromLocalSource(
  source: string,
  subdir?: string,
): Promise<FetchResult> {
  const fullPath = subdir ? path.join(source, subdir) : source;
  const absolutePath = path.isAbsolute(fullPath)
    ? fullPath
    : path.resolve(process.cwd(), fullPath);

  if (!(await directoryExists(absolutePath))) {
    throw new Error(`Local source not found: ${absolutePath}`);
  }

  verbose(`Using local source: ${absolutePath}`);

  return {
    path: absolutePath,
    fromCache: false,
    source,
  };
}

/**
 * Fetch from a remote source using giget
 */
async function fetchFromRemoteSource(
  source: string,
  options: FetchOptions,
): Promise<FetchResult> {
  const { forceRefresh = false, subdir } = options;
  const cacheDir = getCacheDir(source);

  // Build the full source URL with subdir if specified
  const fullSource = subdir ? `${source}/${subdir}` : source;

  verbose(`Fetching from remote: ${fullSource}`);
  verbose(`Cache directory: ${cacheDir}`);

  // Ensure cache directory parent exists
  await ensureDir(path.dirname(cacheDir));

  try {
    const result = await downloadTemplate(fullSource, {
      dir: cacheDir,
      force: forceRefresh,
      // giget options
      offline: false,
      preferOffline: !forceRefresh,
    });

    verbose(`Downloaded to: ${result.dir}`);

    return {
      path: result.dir,
      fromCache: false, // giget doesn't tell us, assume fresh
      source: fullSource,
    };
  } catch (error) {
    // Provide more helpful error messages
    throw wrapGigetError(error, source);
  }
}

/**
 * Wrap giget errors with more helpful messages
 */
function wrapGigetError(error: unknown, source: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  // Check for common error patterns
  if (message.includes("404") || message.includes("Not Found")) {
    return new Error(
      `Repository not found: ${source}\n\n` +
        `This could mean:\n` +
        `  - The repository doesn't exist\n` +
        `  - The repository is private and you need to set authentication\n` +
        `  - There's a typo in the URL\n\n` +
        `For private repositories, set the GIGET_AUTH environment variable:\n` +
        `  export GIGET_AUTH=ghp_your_github_token`,
    );
  }

  if (message.includes("401") || message.includes("Unauthorized")) {
    return new Error(
      `Authentication required for: ${source}\n\n` +
        `Set the GIGET_AUTH environment variable with a GitHub token:\n` +
        `  export GIGET_AUTH=ghp_your_github_token\n\n` +
        `Create a token at: https://github.com/settings/tokens\n` +
        `Required scope: repo (for private repos) or public_repo (for public)`,
    );
  }

  if (message.includes("403") || message.includes("Forbidden")) {
    return new Error(
      `Access denied to: ${source}\n\n` +
        `Your token may not have sufficient permissions.\n` +
        `Ensure your GIGET_AUTH token has the 'repo' scope for private repositories.`,
    );
  }

  if (
    message.includes("ENOTFOUND") ||
    message.includes("ETIMEDOUT") ||
    message.includes("network")
  ) {
    return new Error(
      `Network error fetching: ${source}\n\n` +
        `Please check your internet connection.\n` +
        `If you're behind a corporate proxy, you may need to set:\n` +
        `  export HTTPS_PROXY=http://your-proxy:port\n` +
        `  export FORCE_NODE_FETCH=true  # Required for Node 20+`,
    );
  }

  // Return original error with source context
  return new Error(`Failed to fetch ${source}: ${message}`);
}
