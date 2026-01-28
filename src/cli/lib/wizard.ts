// =============================================================================
// src/cli/lib/wizard.ts
// =============================================================================
// Wizard state machine for skills selection
// Uses matrix-loader and matrix-resolver for data and logic
// =============================================================================

import * as p from "@clack/prompts";
import pc from "picocolors";
import type {
  MergedSkillsMatrix,
  ResolvedStack,
  SkillOption,
  SelectionValidation,
} from "../types-matrix";
import {
  getTopLevelCategories,
  getSubcategories,
  getAvailableSkills,
  validateSelection,
  isCategoryAllDisabled,
  getDependentSkills,
  resolveAlias,
  type SkillCheckOptions,
} from "./matrix-resolver";

// =============================================================================
// Constants
// =============================================================================

const BACK_VALUE = "__back__";
const CONTINUE_VALUE = "__continue__";
const EXPERT_MODE_VALUE = "__expert_mode__";

// =============================================================================
// Types
// =============================================================================

type WizardStep =
  | "approach"
  | "stack"
  | "stack_review"
  | "category"
  | "subcategory"
  | "confirm";

interface WizardState {
  currentStep: WizardStep;
  selectedSkills: string[];
  history: WizardStep[];
  currentTopCategory: string | null;
  currentSubcategory: string | null;
  visitedCategories: Set<string>;
  selectedStack: ResolvedStack | null;
  lastSelectedCategory: string | null;
  lastSelectedSubcategory: string | null;
  lastSelectedSkill: string | null;
  /** When true, disables conflict checking - allows any skill combination */
  expertMode: boolean;
}

export interface WizardResult {
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  validation: SelectionValidation;
}

// =============================================================================
// State Machine
// =============================================================================

interface WizardOptions {
  /** Pre-selected skill IDs (for update mode) */
  initialSkills?: string[];
  /** Whether local skills were discovered (auto-enables expert mode) */
  hasLocalSkills?: boolean;
}

function createInitialState(options: WizardOptions = {}): WizardState {
  const hasInitialSkills =
    options.initialSkills && options.initialSkills.length > 0;

  return {
    // Start at category if we have initial skills (update mode)
    currentStep: hasInitialSkills ? "category" : "approach",
    selectedSkills: options.initialSkills ? [...options.initialSkills] : [],
    history: [],
    currentTopCategory: null,
    currentSubcategory: null,
    visitedCategories: new Set(),
    selectedStack: null,
    lastSelectedCategory: null,
    lastSelectedSubcategory: null,
    lastSelectedSkill: null,
    // Auto-enable expert mode when local skills exist (dependencies can't be checked)
    expertMode: options.hasLocalSkills ?? false,
  };
}

function pushHistory(state: WizardState): void {
  state.history.push(state.currentStep);
}

function popHistory(state: WizardState): WizardStep | null {
  return state.history.pop() || null;
}

/**
 * Recursively collect all skills that depend on the given skill
 * If deselecting A removes B, and B has dependents C, also includes C
 */
function collectAllDependents(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string[] {
  const allDependents: string[] = [];
  const visited = new Set<string>();
  const queue = [skillId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Get direct dependents of current skill
    const directDependents = getDependentSkills(
      current,
      currentSelections,
      matrix,
    );

    for (const dependent of directDependents) {
      if (!visited.has(dependent) && !allDependents.includes(dependent)) {
        allDependents.push(dependent);
        queue.push(dependent);
      }
    }
  }

  return allDependents;
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Clear terminal and move cursor to top
 * Provides clean display for each wizard step
 */
export function clearTerminal(): void {
  process.stdout.write("\x1B[2J\x1B[0f");
}

/**
 * Render selections as a formatted header
 * Exported for use in init.ts final output
 */
export function renderSelectionsHeader(
  selectedSkills: string[],
  matrix: MergedSkillsMatrix,
): void {
  if (selectedSkills.length === 0) {
    return;
  }

  // Group skills by top-level category
  const byCategory: Record<string, string[]> = {};

  for (const skillId of selectedSkills) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    // Find top-level category
    const category = matrix.categories[skill.category];
    const topCategory = category?.parent || skill.category;
    const topCategoryDef = matrix.categories[topCategory];
    const categoryName = topCategoryDef?.name || topCategory;

    if (!byCategory[categoryName]) {
      byCategory[categoryName] = [];
    }
    byCategory[categoryName].push(skill.alias || skill.name);
  }

  // Print header
  console.log("\n" + pc.dim("─".repeat(50)));
  console.log(pc.bold("  Selected:"));
  for (const [category, skills] of Object.entries(byCategory)) {
    console.log(`  ${pc.cyan(category)}: ${skills.join(", ")}`);
  }
  console.log(pc.dim("─".repeat(50)) + "\n");
}

/**
 * Show current selections as a persistent header before each prompt
 */
function showSelectionsHeader(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): void {
  renderSelectionsHeader(state.selectedSkills, matrix);
}

function formatSkillOption(option: SkillOption): {
  value: string;
  label: string;
  hint?: string;
} {
  let label = option.name;
  // Hint is always the skill description
  const hint: string | undefined = option.description;

  // Label changes based on state
  if (option.selected) {
    label = pc.green(`✓ ${option.name}`);
  } else if (option.disabled) {
    // Extract short reason from disabledReason (e.g., "Select a framework first (requires React)")
    // Take just the part before " (requires"
    const shortReason =
      option.disabledReason?.split(" (")[0]?.toLowerCase() ||
      "requirements not met";
    label = pc.dim(`${option.name} (disabled, ${shortReason})`);
  } else if (option.discouraged) {
    label = `${option.name} (not recommended)`;
  } else if (option.recommended) {
    label = `${option.name} ${pc.green("(recommended)")}`;
  }

  return {
    value: option.id,
    label,
    hint,
  };
}

function formatStackOption(stack: ResolvedStack): {
  value: string;
  label: string;
  hint: string;
} {
  return {
    value: stack.id,
    label: stack.name,
    hint: stack.description,
  };
}

/**
 * Create the Expert Mode toggle option
 * Shows current state and allows toggling
 */
function formatExpertModeOption(expertMode: boolean): {
  value: string;
  label: string;
  hint: string;
} {
  if (expertMode) {
    return {
      value: EXPERT_MODE_VALUE,
      label: pc.yellow("Expert Mode: ON"),
      hint: "click to disable - currently allowing any skill combination",
    };
  }
  return {
    value: EXPERT_MODE_VALUE,
    label: pc.dim("Expert Mode: OFF"),
    hint: "click to enable - allows combining conflicting skills",
  };
}

// =============================================================================
// Wizard Steps
// =============================================================================

async function stepApproach(
  state: WizardState,
): Promise<"scratch" | "stack" | "expert_mode" | symbol> {
  clearTerminal();

  // Show current expert mode status if enabled
  if (state.expertMode) {
    console.log(
      pc.yellow("\n  Expert Mode is ON") +
        pc.dim(" - conflict checking disabled\n"),
    );
  }

  const result = await p.select({
    message: "How would you like to set up your stack?",
    options: [
      {
        value: "stack",
        label: "Use a pre-built template",
        hint: "recommended - quickly get started with a curated selection",
      },
      {
        value: "scratch",
        label: "Start from scratch",
        hint: "choose each skill yourself",
      },
      formatExpertModeOption(state.expertMode),
    ],
  });

  return result as "scratch" | "stack" | "expert_mode" | symbol;
}

async function stepSelectStack(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const options = matrix.suggestedStacks.map(formatStackOption);

  const result = await p.select({
    message: "Select a stack:",
    options: [{ value: BACK_VALUE, label: pc.dim("Back") }, ...options],
  });

  return result as string | symbol;
}

const EDIT_VALUE = "__edit__";
const CONFIRM_VALUE = "__confirm__";

async function stepStackReview(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);

  const result = await p.select({
    message: "What would you like to do?",
    options: [
      { value: BACK_VALUE, label: pc.dim("Back") },
      { value: EDIT_VALUE, label: "Edit selections" },
      {
        value: CONFIRM_VALUE,
        label: pc.green("Confirm and continue (recommended)"),
      },
    ],
  });

  return result as string | symbol;
}

async function stepSelectTopCategory(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const topCategories = getTopLevelCategories(matrix);
  const unvisitedCategories = topCategories.filter(
    (catId) => !state.visitedCategories.has(catId),
  );

  // Build options for categories (no icons, no descriptions)
  const categoryOptions = topCategories.map((catId) => {
    const cat = matrix.categories[catId];
    return {
      value: catId,
      label: cat.name,
    };
  });

  // Navigation options - Back at top
  const topNavOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [{ value: BACK_VALUE, label: pc.dim("Back") }];

  // Continue at bottom (if selections exist)
  const bottomNavOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [];

  if (state.selectedSkills.length > 0) {
    bottomNavOptions.push({
      value: CONTINUE_VALUE,
      label: pc.green("Continue"),
    });
  }

  const result = await p.select({
    message: `Select a category to configure (${unvisitedCategories.length} remaining):`,
    options: [...topNavOptions, ...categoryOptions, ...bottomNavOptions],
    initialValue: state.lastSelectedCategory || undefined,
  });

  return result as string | symbol;
}

async function stepSelectSubcategory(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const topCategory = state.currentTopCategory;
  if (!topCategory) {
    return BACK_VALUE;
  }

  const subcategories = getSubcategories(topCategory, matrix);
  const topCat = matrix.categories[topCategory];
  const checkOptions: SkillCheckOptions = { expertMode: state.expertMode };

  // Build options for subcategories (no descriptions, show selected skill name or disabled state)
  const subcategoryOptions = subcategories.map((subId) => {
    const sub = matrix.categories[subId];
    const skills = getAvailableSkills(
      subId,
      state.selectedSkills,
      matrix,
      checkOptions,
    );
    const selectedInCategory = skills.filter((s) => s.selected);
    const hasSelection = selectedInCategory.length > 0;

    // Check if all skills in this category are disabled
    const categoryDisabled = isCategoryAllDisabled(
      subId,
      state.selectedSkills,
      matrix,
      checkOptions,
    );

    let label: string;
    if (hasSelection) {
      label = `${sub.name} ${pc.green(`(${selectedInCategory[0].name} selected)`)}`;
    } else if (categoryDisabled.disabled) {
      // All skills are disabled - show the category as disabled with reason
      const shortReason =
        categoryDisabled.reason?.toLowerCase() || "requirements not met";
      label = pc.dim(`${sub.name} (disabled, ${shortReason})`);
    } else if (sub.required) {
      label = `${sub.name} ${pc.yellow("(required)")}`;
    } else {
      label = sub.name;
    }

    return {
      value: subId,
      label,
    };
  });

  // Navigation options - just Back
  const navigationOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [{ value: BACK_VALUE, label: pc.dim("Back") }];

  const result = await p.select({
    message: `${topCat.name} - Select a subcategory:`,
    options: [...navigationOptions, ...subcategoryOptions],
    initialValue: state.lastSelectedSubcategory || undefined,
  });

  return result as string | symbol;
}

async function stepSelectSkill(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();
  showSelectionsHeader(state, matrix);
  const subcategoryId = state.currentSubcategory;
  if (!subcategoryId) {
    return BACK_VALUE;
  }

  const subcategory = matrix.categories[subcategoryId];
  const checkOptions: SkillCheckOptions = { expertMode: state.expertMode };
  const skills = getAvailableSkills(
    subcategoryId,
    state.selectedSkills,
    matrix,
    checkOptions,
  );

  // Build skill options - keep original order, don't reorder
  const skillOptions = skills.map(formatSkillOption);

  // Navigation options - just Back
  const navigationOptions: Array<{
    value: string;
    label: string;
    hint?: string;
  }> = [{ value: BACK_VALUE, label: pc.dim("Back") }];

  const allOptions = [...navigationOptions, ...skillOptions];

  const result = await p.select({
    message: `${subcategory.name}:`,
    options: allOptions,
    initialValue: state.lastSelectedSkill || undefined,
  });

  return result as string | symbol;
}

async function stepConfirm(
  state: WizardState,
  matrix: MergedSkillsMatrix,
): Promise<string | symbol> {
  clearTerminal();

  // Show selected skills
  console.log("\n" + pc.bold("Selected Skills:"));

  if (state.selectedSkills.length === 0) {
    console.log(pc.dim("  No skills selected"));
  } else {
    for (const skillId of state.selectedSkills) {
      const skill = matrix.skills[skillId];
      if (skill) {
        const category = matrix.categories[skill.category];
        console.log(
          `  ${pc.green("+")} ${skill.name} ${pc.dim(`(${category?.name || skill.category})`)}`,
        );
      }
    }
  }

  // Validate and show warnings/errors
  const validation = validateSelection(state.selectedSkills, matrix);

  if (validation.errors.length > 0) {
    console.log("\n" + pc.red(pc.bold("Errors:")));
    for (const error of validation.errors) {
      console.log(`  ${pc.red("x")} ${error.message}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.log("\n" + pc.yellow(pc.bold("Warnings:")));
    for (const warning of validation.warnings) {
      console.log(`  ${pc.yellow("!")} ${warning.message}`);
    }
  }

  console.log("");

  const result = await p.select({
    message: validation.valid
      ? "Confirm your selection?"
      : "Selection has errors. What would you like to do?",
    options: [
      { value: BACK_VALUE, label: pc.dim("Back") },
      ...(validation.valid
        ? [{ value: "confirm", label: pc.green("Confirm and continue") }]
        : []),
    ],
  });

  return result as string | symbol;
}

// =============================================================================
// Main Wizard Loop
// =============================================================================

export async function runWizard(
  matrix: MergedSkillsMatrix,
  options: WizardOptions = {},
): Promise<WizardResult | null> {
  // Check if matrix contains local skills
  const hasLocalSkills = Object.values(matrix.skills).some(
    (skill) => skill.local === true,
  );

  const state = createInitialState({
    ...options,
    hasLocalSkills,
  });

  // Show message if expert mode was auto-enabled due to local skills
  if (hasLocalSkills && state.expertMode) {
    console.log(
      pc.yellow("\n  Local skills detected") +
        pc.dim(" - Expert Mode enabled (dependency checking disabled)\n"),
    );
  }

  while (true) {
    switch (state.currentStep) {
      case "approach": {
        const result = await stepApproach(state);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === EXPERT_MODE_VALUE) {
          // Toggle expert mode and stay on same screen
          state.expertMode = !state.expertMode;
          break;
        }

        if (result === "stack") {
          pushHistory(state);
          state.currentStep = "stack";
        } else {
          pushHistory(state);
          state.currentStep = "category";
        }
        break;
      }

      case "stack": {
        const result = await stepSelectStack(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          state.currentStep = popHistory(state) || "approach";
          break;
        }

        // Apply stack selection
        const stack = matrix.suggestedStacks.find((s) => s.id === result);
        if (stack) {
          state.selectedStack = stack;
          state.selectedSkills = [...stack.allSkillIds];

          // Go to stack review
          pushHistory(state);
          state.currentStep = "stack_review";
        }
        break;
      }

      case "stack_review": {
        const result = await stepStackReview(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          // Clear stack selection and go back to stack selection
          state.selectedStack = null;
          state.selectedSkills = [];
          state.currentStep = popHistory(state) || "stack";
          break;
        }

        if (result === EDIT_VALUE) {
          // Go to category view to edit selections
          pushHistory(state);
          state.currentStep = "category";
          break;
        }

        if (result === CONFIRM_VALUE) {
          // Go to confirm step
          pushHistory(state);
          state.currentStep = "confirm";
          break;
        }
        break;
      }

      case "category": {
        const result = await stepSelectTopCategory(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          // Back from category goes to approach
          state.currentStep = popHistory(state) || "approach";
          break;
        }

        if (result === CONTINUE_VALUE) {
          // Continue to confirmation - track for cursor restoration
          state.lastSelectedCategory = CONTINUE_VALUE;
          pushHistory(state);
          state.currentStep = "confirm";
          break;
        }

        // Track last selected category for cursor restoration
        state.lastSelectedCategory = result as string;

        // Check if this category has subcategories
        const subcategories = getSubcategories(result as string, matrix);
        if (subcategories.length > 0) {
          pushHistory(state);
          state.currentTopCategory = result as string;
          state.currentStep = "subcategory";
        } else {
          // Category has no subcategories, skip
          p.log.info(
            `${matrix.categories[result as string]?.name || result} has no subcategories`,
          );
        }
        break;
      }

      case "subcategory": {
        const result = await stepSelectSubcategory(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          // Back from subcategory marks category as visited and goes back
          if (state.currentTopCategory) {
            state.visitedCategories.add(state.currentTopCategory);
          }
          state.currentTopCategory = null;
          state.lastSelectedSubcategory = null;
          state.currentStep = popHistory(state) || "category";
          break;
        }

        // Track last selected subcategory for cursor restoration
        state.lastSelectedSubcategory = result as string;

        // Selected a subcategory - go to skill selection
        state.currentSubcategory = result as string;

        // Loop on skill selection until Back is pressed
        while (true) {
          const skillResult = await stepSelectSkill(state, matrix);

          if (p.isCancel(skillResult)) {
            return null;
          }

          if (skillResult === BACK_VALUE) {
            state.currentSubcategory = null;
            state.lastSelectedSkill = null;
            // Go back to subcategory list
            break;
          }

          // Selected a skill - check if disabled first
          const selectedSkillId = skillResult as string;
          state.lastSelectedSkill = selectedSkillId;

          // Check if skill is disabled - if so, do nothing (just refresh the view)
          const skillOptions = getAvailableSkills(
            state.currentSubcategory!,
            state.selectedSkills,
            matrix,
          );
          const selectedOption = skillOptions.find(
            (s) => s.id === selectedSkillId,
          );

          if (selectedOption?.disabled) {
            // Skill is disabled - can't select it, just continue to refresh view
            continue;
          }

          const subcategory = matrix.categories[state.currentSubcategory!];
          const alreadySelected =
            state.selectedSkills.includes(selectedSkillId);

          if (alreadySelected) {
            // Check for dependent skills before deselecting
            const allDependents = collectAllDependents(
              selectedSkillId,
              state.selectedSkills,
              matrix,
            );

            if (allDependents.length > 0) {
              // Show confirmation dialog with dependent skill names
              const dependentNames = allDependents
                .map((id) => matrix.skills[id]?.name || id)
                .join(", ");
              const skillName =
                matrix.skills[resolveAlias(selectedSkillId, matrix)]?.name ||
                selectedSkillId;

              const shouldDeselect = await p.confirm({
                message: `Deselecting ${skillName} will also remove: ${dependentNames}. Continue?`,
                initialValue: false,
              });

              if (p.isCancel(shouldDeselect) || !shouldDeselect) {
                // User cancelled or said no - keep skill selected
                continue;
              }

              // Cascade deselect all dependents
              const toRemove = new Set([selectedSkillId, ...allDependents]);
              state.selectedSkills = state.selectedSkills.filter(
                (id) => !toRemove.has(id),
              );
            } else {
              // No dependents - simple deselect
              const index = state.selectedSkills.indexOf(selectedSkillId);
              if (index > -1) {
                state.selectedSkills.splice(index, 1);
              }
            }
          } else {
            // Select - if exclusive, remove others from same category first
            if (subcategory?.exclusive) {
              state.selectedSkills = state.selectedSkills.filter((id) => {
                const skill = matrix.skills[id];
                return skill?.category !== state.currentSubcategory;
              });
            }
            // Add the selected skill
            state.selectedSkills.push(selectedSkillId);
          }

          // Stay in skill selection loop - require explicit Back to leave
        }
        break;
      }

      case "confirm": {
        const result = await stepConfirm(state, matrix);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          state.currentStep = popHistory(state) || "category";
          break;
        }

        if (result === "confirm") {
          const validation = validateSelection(state.selectedSkills, matrix);
          return {
            selectedSkills: state.selectedSkills,
            selectedStack: state.selectedStack,
            validation,
          };
        }
        break;
      }
    }
  }
}
