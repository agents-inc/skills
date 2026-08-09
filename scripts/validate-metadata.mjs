// Validates every src/skills/*/metadata.yaml against the structural limits of the
// metadata schema each file declares in its yaml-language-server header
// (agents-inc/cli — src/schemas/metadata.schema.json). The category and slug
// vocabularies are owned by the CLI and enforced by its build, so this check
// only requires them to be present; everything else mirrors the schema exactly.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const SKILLS_ROOT = new URL("../src/skills", import.meta.url).pathname;

const REQUIRED_FIELDS = [
  "author",
  "displayName",
  "cliDescription",
  "usageGuidance",
  "category",
  "slug",
];
const OPTIONAL_FIELDS = [
  "contentHash",
  "updated",
  "forkedFrom",
  "domain",
  "custom",
];
const KNOWN_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

const AUTHOR_PATTERN = /^@[a-z][a-z0-9-]*$/;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{7}$/;
const DISPLAY_NAME_MAX = 30;
const CLI_DESCRIPTION_MAX = 60;
const USAGE_GUIDANCE_MIN = 10;

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function validate(metadata) {
  const problems = [];

  for (const field of REQUIRED_FIELDS) {
    if (!isNonEmptyString(metadata[field]))
      problems.push(`${field} is missing or empty`);
  }
  for (const field of Object.keys(metadata)) {
    if (!KNOWN_FIELDS.has(field)) problems.push(`unknown field: ${field}`);
  }

  const {
    author,
    displayName,
    cliDescription,
    usageGuidance,
    contentHash,
    updated,
    domain,
    custom,
    forkedFrom,
  } = metadata;

  if (isNonEmptyString(author) && !AUTHOR_PATTERN.test(author)) {
    problems.push(`author must match ${AUTHOR_PATTERN} (got "${author}")`);
  }
  if (isNonEmptyString(displayName) && displayName.length > DISPLAY_NAME_MAX) {
    problems.push(
      `displayName is ${displayName.length} characters (max ${DISPLAY_NAME_MAX})`,
    );
  }
  if (
    isNonEmptyString(cliDescription) &&
    cliDescription.length > CLI_DESCRIPTION_MAX
  ) {
    problems.push(
      `cliDescription is ${cliDescription.length} characters (max ${CLI_DESCRIPTION_MAX})`,
    );
  }
  if (
    isNonEmptyString(usageGuidance) &&
    usageGuidance.length < USAGE_GUIDANCE_MIN
  ) {
    problems.push(
      `usageGuidance is ${usageGuidance.length} characters (min ${USAGE_GUIDANCE_MIN})`,
    );
  }
  if (
    contentHash !== undefined &&
    !(typeof contentHash === "string" && CONTENT_HASH_PATTERN.test(contentHash))
  ) {
    problems.push(`contentHash must match ${CONTENT_HASH_PATTERN}`);
  }
  if (updated !== undefined && typeof updated !== "string") {
    problems.push("updated must be a string");
  }
  if (domain !== undefined && !isNonEmptyString(domain)) {
    problems.push("domain must be a non-empty string");
  }
  if (custom !== undefined && typeof custom !== "boolean") {
    problems.push("custom must be a boolean");
  }
  if (forkedFrom !== undefined) {
    if (typeof forkedFrom !== "object" || forkedFrom === null) {
      problems.push("forkedFrom must be an object");
    } else {
      for (const field of ["skillId", "contentHash", "date"]) {
        if (!isNonEmptyString(forkedFrom[field]))
          problems.push(`forkedFrom.${field} is missing or empty`);
      }
    }
  }

  return problems;
}

const failures = [];
const skillDirs = readdirSync(SKILLS_ROOT).sort();

for (const dir of skillDirs) {
  const path = join(SKILLS_ROOT, dir, "metadata.yaml");

  let metadata;
  try {
    metadata = YAML.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push({
      dir,
      problems: [`unreadable or invalid YAML: ${error.message}`],
    });
    continue;
  }

  if (typeof metadata !== "object" || metadata === null) {
    failures.push({ dir, problems: ["metadata.yaml is not a mapping"] });
    continue;
  }

  const problems = validate(metadata);
  if (problems.length > 0) failures.push({ dir, problems });
}

if (failures.length > 0) {
  for (const { dir, problems } of failures) {
    for (const problem of problems) console.error(`${dir}: ${problem}`);
  }
  console.error(
    `\n${failures.length} of ${skillDirs.length} skills failed metadata validation.`,
  );
  process.exit(1);
}

console.log(`All ${skillDirs.length} skills pass metadata validation.`);
