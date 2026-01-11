import { Command, Option } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { readFile } from '../utils/fs';
import { setVerbose } from '../utils/logger';
import { OUTPUT_DIR, DEFAULT_PROFILE, DIRS } from '../consts';
import { loadAllAgents, loadAllSkills, loadStackSkills, loadStack } from '../lib/loader';
import { resolveAgents, stackToProfileConfig } from '../lib/resolver';
import { validate, printValidationResult } from '../lib/validator';
import {
  compileAllAgents,
  compileAllSkills,
  copyClaude,
  compileAllCommands,
  createLiquidEngine,
  cleanOutputDir,
} from '../lib/compiler';
import type { ProfileConfig, CompileContext } from '../types';

export const compileCommand = new Command('compile')
  .description('Compile agents from profiles or stacks')
  .addOption(
    new Option('-p, --profile <name>', 'Profile to compile').conflicts('stack')
  )
  .addOption(
    new Option('-s, --stack <name>', 'Stack to compile').conflicts('profile')
  )
  .option('-v, --verbose', 'Enable verbose logging', false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options) => {
    const s = p.spinner();

    // Set verbose mode globally
    setVerbose(options.verbose);

    // Determine mode
    const isStackMode = !!options.stack;
    const stackId = options.stack;
    const profileId = isStackMode ? undefined : (options.profile || DEFAULT_PROFILE);

    // Determine project root (where we're running from)
    const projectRoot = process.cwd();
    const outputDir = path.join(projectRoot, OUTPUT_DIR);

    console.log(
      `\n📦 Compiling ${isStackMode ? `stack: ${stackId}` : `profile: ${profileId}`}\n`
    );

    try {
      // Load agents first (shared across all stacks/profiles)
      s.start('Loading agents...');
      const agents = await loadAllAgents(projectRoot);
      s.stop(`Loaded ${Object.keys(agents).length} agents`);

      // Load profile or stack config to determine effective stack ID
      let profileConfig: ProfileConfig;
      let effectiveStackId: string | undefined;

      if (isStackMode && stackId) {
        s.start('Loading stack configuration...');
        const stack = await loadStack(stackId, projectRoot);
        profileConfig = stackToProfileConfig(stackId, stack);
        effectiveStackId = stackId;
        s.stop(`Stack loaded: ${stack.agents.length} agents, ${stack.skills.length} skills`);
      } else {
        s.start('Loading profile configuration...');
        const configPath = path.join(projectRoot, DIRS.profiles, profileId!, 'config.yaml');
        try {
          const content = await readFile(configPath);
          profileConfig = parseYaml(content) as ProfileConfig;
          effectiveStackId = profileConfig.stack;
          s.stop(`Profile loaded: ${Object.keys(profileConfig.agents).length} agents`);
        } catch (error) {
          s.stop('Failed to load profile');
          p.log.error(`Failed to load config: ${configPath}`);
          process.exit(1);
        }
      }

      // Load skills from stack (if available) or central repository
      s.start('Loading skills...');
      let skills;
      if (effectiveStackId) {
        skills = await loadStackSkills(effectiveStackId, projectRoot);
        s.stop(`Loaded ${Object.keys(skills).length} skills from stack: ${effectiveStackId}`);
      } else {
        skills = await loadAllSkills(projectRoot);
        s.stop(`Loaded ${Object.keys(skills).length} skills from central repository`);
      }

      // Resolve agents
      s.start('Resolving agents...');
      let resolvedAgents;
      try {
        resolvedAgents = await resolveAgents(agents, skills, profileConfig, projectRoot);
        s.stop(`Resolved ${Object.keys(resolvedAgents).length} agents`);
      } catch (error) {
        s.stop('Failed to resolve agents');
        p.log.error(String(error));
        process.exit(1);
      }

      // Validate
      s.start('Validating configuration...');
      const ctx: CompileContext = {
        profileId,
        stackId: effectiveStackId,
        isStackMode,
        verbose: options.verbose,
        projectRoot,
        outputDir,
      };

      const validation = await validate(
        profileConfig,
        resolvedAgents,
        profileId,
        effectiveStackId,
        projectRoot
      );
      s.stop('Validation complete');

      printValidationResult(validation);

      if (!validation.valid) {
        process.exit(1);
      }

      // Clean output directory
      s.start('Cleaning output directory...');
      await cleanOutputDir(outputDir);
      s.stop('Output directory cleaned');

      // Create Liquid engine
      const engine = createLiquidEngine(projectRoot);

      // Compile agents
      console.log('\nCompiling agents...');
      await compileAllAgents(resolvedAgents, profileConfig, ctx, engine);

      // Compile skills
      console.log('\nCompiling skills...');
      await compileAllSkills(resolvedAgents, ctx);

      // Compile commands
      console.log('\nCompiling commands...');
      await compileAllCommands(ctx);

      // Copy CLAUDE.md
      console.log('\nCopying CLAUDE.md...');
      await copyClaude(profileConfig, ctx);

      p.outro(pc.green('✨ Compilation complete!'));
    } catch (error) {
      s.stop('Compilation failed');
      p.log.error(String(error));
      process.exit(1);
    }
  });
