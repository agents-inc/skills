import type {
  MergedSkillsMatrix,
  ResolvedSkill,
  SkillOption,
  SelectionValidation,
  ValidationError,
  ValidationWarning,
} from "../types-matrix";

/**
 * Resolve an alias or skill ID to a full skill ID
 * Returns the input unchanged if it's already a full ID or not found
 */
export function resolveAlias(
  aliasOrId: string,
  matrix: MergedSkillsMatrix,
): string {
  return matrix.aliases[aliasOrId] || aliasOrId;
}

/**
 * Get all skills that would be broken if a skill is deselected
 * Returns skills from currentSelections that require the given skillId
 */
export function getDependentSkills(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string[] {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) return [];

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );
  const dependents: string[] = [];

  for (const selectedId of resolvedSelections) {
    if (selectedId === fullId) continue;

    const selectedSkill = matrix.skills[selectedId];
    if (!selectedSkill) continue;

    for (const requirement of selectedSkill.requires) {
      if (requirement.needsAny) {
        // OR logic: only a problem if this is the ONLY satisfied requirement
        const satisfiedReqs = requirement.skillIds.filter((reqId) =>
          resolvedSelections.includes(reqId),
        );
        if (satisfiedReqs.length === 1 && satisfiedReqs[0] === fullId) {
          dependents.push(selectedId);
        }
      } else {
        // AND logic: if any required skill is the one being deselected
        if (requirement.skillIds.includes(fullId)) {
          dependents.push(selectedId);
        }
      }
    }
  }

  return dependents;
}

/**
 * Options for skill availability checks
 */
export interface SkillCheckOptions {
  /** When true, disables conflict and requirement checks (allows any combination) */
  expertMode?: boolean;
}

/**
 * Check if a skill is disabled based on current selections
 * A skill is disabled if:
 * 1. It conflicts with any selected skill
 * 2. Its requirements are not met (required skills not selected)
 *
 * In expert mode, conflicts are ignored (always returns false)
 */
export function isDisabled(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
  options?: SkillCheckOptions,
): boolean {
  // Expert mode disables all blocking
  if (options?.expertMode) {
    return false;
  }

  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  // Check conflicts: if any selected skill conflicts with this one
  for (const selectedId of currentSelections) {
    const selectedFullId = resolveAlias(selectedId, matrix);

    // Check if this skill has a conflict with the selected skill
    if (skill.conflictsWith.some((c) => c.skillId === selectedFullId)) {
      return true;
    }

    // Check if the selected skill has a conflict with this skill
    const selectedSkill = matrix.skills[selectedFullId];
    if (
      selectedSkill &&
      selectedSkill.conflictsWith.some((c) => c.skillId === fullId)
    ) {
      return true;
    }
  }

  // Check requirements: all required skills must be selected
  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  for (const requirement of skill.requires) {
    if (requirement.needsAny) {
      // OR logic: at least one of the required skills must be selected
      const hasAny = requirement.skillIds.some((reqId) =>
        resolvedSelections.includes(reqId),
      );
      if (!hasAny) {
        return true;
      }
    } else {
      // AND logic: all required skills must be selected
      const hasAll = requirement.skillIds.every((reqId) =>
        resolvedSelections.includes(reqId),
      );
      if (!hasAll) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get the reason why a skill is disabled
 * Returns undefined if the skill is not disabled
 */
export function getDisableReason(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  // Check conflicts
  for (const selectedId of resolvedSelections) {
    // Check if this skill has a conflict with the selected skill
    const conflict = skill.conflictsWith.find((c) => c.skillId === selectedId);
    if (conflict) {
      const selectedSkill = matrix.skills[selectedId];
      const selectedName = selectedSkill?.name || selectedId;
      return `${conflict.reason} (conflicts with ${selectedName})`;
    }

    // Check if the selected skill has a conflict with this skill
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const reverseConflict = selectedSkill.conflictsWith.find(
        (c) => c.skillId === fullId,
      );
      if (reverseConflict) {
        const selectedName = selectedSkill.name;
        return `${reverseConflict.reason} (conflicts with ${selectedName})`;
      }
    }
  }

  // Check requirements
  for (const requirement of skill.requires) {
    if (requirement.needsAny) {
      const hasAny = requirement.skillIds.some((reqId) =>
        resolvedSelections.includes(reqId),
      );
      if (!hasAny) {
        const requiredNames = requirement.skillIds
          .map((id) => matrix.skills[id]?.name || id)
          .join(" or ");
        return `${requirement.reason} (requires ${requiredNames})`;
      }
    } else {
      const missingIds = requirement.skillIds.filter(
        (reqId) => !resolvedSelections.includes(reqId),
      );
      if (missingIds.length > 0) {
        const missingNames = missingIds
          .map((id) => matrix.skills[id]?.name || id)
          .join(", ");
        return `${requirement.reason} (requires ${missingNames})`;
      }
    }
  }

  return undefined;
}

/**
 * Check if a skill is discouraged based on current selections
 * A skill is discouraged if any selected skill is in a discourages relationship with it
 */
export function isDiscouraged(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): boolean {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  // Check if any selected skill discourages this skill
  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (
      selectedSkill &&
      selectedSkill.discourages.some((d) => d.skillId === fullId)
    ) {
      return true;
    }

    // Check if this skill discourages the selected skill (bidirectional)
    if (skill.discourages.some((d) => d.skillId === selectedId)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the reason why a skill is discouraged
 * Returns undefined if the skill is not discouraged
 */
export function getDiscourageReason(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  // Check if any selected skill discourages this skill
  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const discourage = selectedSkill.discourages.find(
        (d) => d.skillId === fullId,
      );
      if (discourage) {
        return discourage.reason;
      }
    }

    // Check if this skill discourages the selected skill (bidirectional)
    const reverseDiscourage = skill.discourages.find(
      (d) => d.skillId === selectedId,
    );
    if (reverseDiscourage) {
      return reverseDiscourage.reason;
    }
  }

  return undefined;
}

/**
 * Check if a skill is recommended based on current selections
 * A skill is recommended if any selected skill recommends it
 */
export function isRecommended(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): boolean {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return false;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  // Check if any selected skill recommends this skill
  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (
      selectedSkill &&
      selectedSkill.recommends.some((r) => r.skillId === fullId)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get the reason why a skill is recommended
 * Returns undefined if the skill is not recommended
 */
export function getRecommendReason(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string | undefined {
  const fullId = resolveAlias(skillId, matrix);
  const skill = matrix.skills[fullId];

  if (!skill) {
    return undefined;
  }

  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  // Find the skill that recommends this one
  for (const selectedId of resolvedSelections) {
    const selectedSkill = matrix.skills[selectedId];
    if (selectedSkill) {
      const recommendation = selectedSkill.recommends.find(
        (r) => r.skillId === fullId,
      );
      if (recommendation) {
        return `${recommendation.reason} (recommended by ${selectedSkill.name})`;
      }
    }
  }

  return undefined;
}

/**
 * Validate a full set of skill selections
 * Returns errors for conflicts and missing requirements
 */
export function validateSelection(
  selections: string[],
  matrix: MergedSkillsMatrix,
): SelectionValidation {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const resolvedSelections = selections.map((s) => resolveAlias(s, matrix));

  // Check for conflicts between selected skills
  for (let i = 0; i < resolvedSelections.length; i++) {
    const skillA = matrix.skills[resolvedSelections[i]];
    if (!skillA) continue;

    for (let j = i + 1; j < resolvedSelections.length; j++) {
      const skillBId = resolvedSelections[j];
      const conflict = skillA.conflictsWith.find((c) => c.skillId === skillBId);
      if (conflict) {
        errors.push({
          type: "conflict",
          message: `${skillA.name} conflicts with ${matrix.skills[skillBId]?.name || skillBId}: ${conflict.reason}`,
          skills: [skillA.id, skillBId],
        });
      }
    }
  }

  // Check that all requirements are met
  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    for (const requirement of skill.requires) {
      if (requirement.needsAny) {
        const hasAny = requirement.skillIds.some((reqId) =>
          resolvedSelections.includes(reqId),
        );
        if (!hasAny) {
          errors.push({
            type: "missing_requirement",
            message: `${skill.name} requires one of: ${requirement.skillIds.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
            skills: [skillId, ...requirement.skillIds],
          });
        }
      } else {
        const missingIds = requirement.skillIds.filter(
          (reqId) => !resolvedSelections.includes(reqId),
        );
        if (missingIds.length > 0) {
          errors.push({
            type: "missing_requirement",
            message: `${skill.name} requires: ${missingIds.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
            skills: [skillId, ...missingIds],
          });
        }
      }
    }
  }

  // Check category exclusivity
  const categorySelections = new Map<string, string[]>();
  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    const existing = categorySelections.get(skill.category) || [];
    existing.push(skillId);
    categorySelections.set(skill.category, existing);
  }

  for (const [categoryId, skillIds] of categorySelections.entries()) {
    if (skillIds.length > 1) {
      // Check if category is exclusive
      const category = matrix.categories[categoryId];
      if (category?.exclusive) {
        errors.push({
          type: "category_exclusive",
          message: `Category "${category.name}" only allows one selection, but multiple selected: ${skillIds.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
          skills: skillIds,
        });
      }
    }
  }

  // Warnings for missing recommendations
  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;

    for (const recommendation of skill.recommends) {
      if (!resolvedSelections.includes(recommendation.skillId)) {
        // Check if the recommended skill exists and is not in conflict
        const recommendedSkill = matrix.skills[recommendation.skillId];
        if (recommendedSkill) {
          const hasConflict = recommendedSkill.conflictsWith.some((c) =>
            resolvedSelections.includes(c.skillId),
          );
          if (!hasConflict) {
            warnings.push({
              type: "missing_recommendation",
              message: `${skill.name} recommends ${recommendedSkill.name}: ${recommendation.reason}`,
              skills: [skillId, recommendation.skillId],
            });
          }
        }
      }
    }
  }

  // Warning for setup skills without corresponding usage skills
  for (const skillId of resolvedSelections) {
    const skill = matrix.skills[skillId];
    if (!skill || skill.providesSetupFor.length === 0) continue;

    const hasUsageSkill = skill.providesSetupFor.some((usageId) =>
      resolvedSelections.includes(usageId),
    );
    if (!hasUsageSkill) {
      warnings.push({
        type: "unused_setup",
        message: `Setup skill "${skill.name}" selected but no corresponding usage skills: ${skill.providesSetupFor.map((id) => matrix.skills[id]?.name || id).join(", ")}`,
        skills: [skillId, ...skill.providesSetupFor],
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get available skills for a category with computed state
 */
export function getAvailableSkills(
  categoryId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
  options?: SkillCheckOptions,
): SkillOption[] {
  const skillOptions: SkillOption[] = [];
  const resolvedSelections = currentSelections.map((s) =>
    resolveAlias(s, matrix),
  );

  // Find all skills in this category
  for (const skill of Object.values(matrix.skills)) {
    if (skill.category !== categoryId) {
      continue;
    }

    const disabled = isDisabled(skill.id, currentSelections, matrix, options);
    const discouraged =
      !disabled && isDiscouraged(skill.id, currentSelections, matrix);
    const recommended =
      !disabled &&
      !discouraged &&
      isRecommended(skill.id, currentSelections, matrix);

    skillOptions.push({
      id: skill.id,
      alias: skill.alias,
      name: skill.name,
      description: skill.description,
      disabled,
      disabledReason: disabled
        ? getDisableReason(skill.id, currentSelections, matrix)
        : undefined,
      discouraged,
      discouragedReason: discouraged
        ? getDiscourageReason(skill.id, currentSelections, matrix)
        : undefined,
      recommended,
      recommendedReason: recommended
        ? getRecommendReason(skill.id, currentSelections, matrix)
        : undefined,
      selected: resolvedSelections.includes(skill.id),
      alternatives: skill.alternatives.map((a) => a.skillId),
    });
  }

  // Keep original order - don't sort
  return skillOptions;
}

/**
 * Get skills for a category that belong to it (by looking up category from skills)
 * This handles the case where skills define their category in metadata.yaml
 */
export function getSkillsByCategory(
  categoryId: string,
  matrix: MergedSkillsMatrix,
): ResolvedSkill[] {
  const skills: ResolvedSkill[] = [];

  for (const skill of Object.values(matrix.skills)) {
    if (skill.category === categoryId) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Check if all skills in a category are disabled
 * Returns the common reason if all are disabled, undefined otherwise
 */
export function isCategoryAllDisabled(
  categoryId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
  options?: SkillCheckOptions,
): { disabled: boolean; reason?: string } {
  // In expert mode, nothing is ever disabled
  if (options?.expertMode) {
    return { disabled: false };
  }

  const skills = getSkillsByCategory(categoryId, matrix);

  if (skills.length === 0) {
    return { disabled: false };
  }

  // Check if ALL skills are disabled
  const disabledSkills: Array<{ skillId: string; reason: string | undefined }> =
    [];

  for (const skill of skills) {
    if (isDisabled(skill.id, currentSelections, matrix, options)) {
      disabledSkills.push({
        skillId: skill.id,
        reason: getDisableReason(skill.id, currentSelections, matrix),
      });
    }
  }

  if (disabledSkills.length === skills.length) {
    // All skills are disabled - find the most common reason
    // Usually they all have the same reason (e.g., "select framework first")
    const firstReason = disabledSkills[0]?.reason;
    // Extract just the short reason part before "(requires ...)"
    const shortReason = firstReason?.split(" (")[0] || "requirements not met";
    return { disabled: true, reason: shortReason };
  }

  return { disabled: false };
}

/**
 * Get subcategories for a parent category
 */
export function getSubcategories(
  parentCategoryId: string,
  matrix: MergedSkillsMatrix,
): string[] {
  const subcategories: string[] = [];

  for (const category of Object.values(matrix.categories)) {
    if (category.parent === parentCategoryId) {
      subcategories.push(category.id);
    }
  }

  // Sort by order
  subcategories.sort((a, b) => {
    const catA = matrix.categories[a];
    const catB = matrix.categories[b];
    return (catA?.order ?? 0) - (catB?.order ?? 0);
  });

  return subcategories;
}

/**
 * Get top-level categories (those without a parent)
 */
export function getTopLevelCategories(matrix: MergedSkillsMatrix): string[] {
  const topLevel: string[] = [];

  for (const category of Object.values(matrix.categories)) {
    if (!category.parent) {
      topLevel.push(category.id);
    }
  }

  // Sort by order
  topLevel.sort((a, b) => {
    const catA = matrix.categories[a];
    const catB = matrix.categories[b];
    return (catA?.order ?? 0) - (catB?.order ?? 0);
  });

  return topLevel;
}
