import { describe, it, expect } from "vitest";
import {
  resolveSkillReference,
  resolveSkillReferences,
  stackToCompileConfig,
} from "./resolver";
import type { SkillDefinition, SkillReference, StackConfig } from "../types";

describe("resolveSkillReference", () => {
  const mockSkills: Record<string, SkillDefinition> = {
    "frontend/react (@vince)": {
      path: "skills/frontend/framework/react (@vince)/",
      name: "React",
      description: "React component patterns",
      canonicalId: "frontend/react (@vince)",
    },
    "backend/hono (@vince)": {
      path: "skills/backend/api/hono (@vince)/",
      name: "Hono",
      description: "Hono API framework",
      canonicalId: "backend/hono (@vince)",
    },
  };

  it("should resolve a skill reference to a full Skill object", () => {
    const ref: SkillReference = {
      id: "frontend/react (@vince)",
      usage: "when building React components",
      preloaded: true,
    };

    const result = resolveSkillReference(ref, mockSkills);

    expect(result).toEqual({
      id: "frontend/react (@vince)",
      path: "skills/frontend/framework/react (@vince)/",
      name: "React",
      description: "React component patterns",
      usage: "when building React components",
      preloaded: true,
    });
  });

  it("should default preloaded to false when not specified", () => {
    const ref: SkillReference = {
      id: "backend/hono (@vince)",
      usage: "when building APIs",
    };

    const result = resolveSkillReference(ref, mockSkills);

    expect(result.preloaded).toBe(false);
  });

  it("should throw an error if skill is not found", () => {
    const ref: SkillReference = {
      id: "nonexistent/skill",
      usage: "never",
    };

    expect(() => resolveSkillReference(ref, mockSkills)).toThrow(
      /Skill 'nonexistent\/skill' not found in scanned skills\. Available skills:/,
    );
  });
});

describe("resolveSkillReferences", () => {
  const mockSkills: Record<string, SkillDefinition> = {
    "frontend/react (@vince)": {
      path: "skills/frontend/framework/react (@vince)/",
      name: "React",
      description: "React component patterns",
      canonicalId: "frontend/react (@vince)",
    },
    "frontend/zustand (@vince)": {
      path: "skills/frontend/client-state-management/zustand (@vince)/",
      name: "Zustand",
      description: "Lightweight state management",
      canonicalId: "frontend/zustand (@vince)",
    },
  };

  it("should resolve multiple skill references", () => {
    const refs: SkillReference[] = [
      { id: "frontend/react (@vince)", usage: "for components" },
      { id: "frontend/zustand (@vince)", usage: "for state", preloaded: true },
    ];

    const results = resolveSkillReferences(refs, mockSkills);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("frontend/react (@vince)");
    expect(results[1].id).toBe("frontend/zustand (@vince)");
    expect(results[1].preloaded).toBe(true);
  });

  it("should return empty array for empty input", () => {
    const results = resolveSkillReferences([], mockSkills);
    expect(results).toEqual([]);
  });
});

describe("stackToCompileConfig", () => {
  it("should convert a stack config to a compile config", () => {
    const stack: StackConfig = {
      name: "Test Stack",
      description: "A test stack",
      agents: ["frontend-developer", "backend-developer"],
      skills: [],
    };

    const result = stackToCompileConfig("test-stack", stack);

    expect(result).toEqual({
      name: "Test Stack",
      description: "A test stack",
      claude_md: "",
      stack: "test-stack",
      agents: {
        "frontend-developer": {},
        "backend-developer": {},
      },
    });
  });

  it("should handle empty agents array", () => {
    const stack: StackConfig = {
      name: "Empty Stack",
      agents: [],
      skills: [],
    };

    const result = stackToCompileConfig("empty-stack", stack);

    expect(result.agents).toEqual({});
  });

  it("should use empty string for missing description", () => {
    const stack: StackConfig = {
      name: "No Description",
      agents: ["test-agent"],
      skills: [],
    };

    const result = stackToCompileConfig("no-desc", stack);

    expect(result.description).toBe("");
  });
});
