import { z } from 'zod';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { PitCrewError } from '@pitcrew/protocol';

export const skillManifestSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
    description: z.string().min(10).max(500),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    permissions: z
      .array(
        z.enum([
          'filesystem:read',
          'filesystem:write',
          'sandbox:execute',
          'browser:qa',
          'network:read',
        ]),
      )
      .max(8),
  })
  .strict();
export type SkillManifest = z.infer<typeof skillManifestSchema>;
export interface LoadedSkill {
  manifest: SkillManifest;
  instructions: string;
  root: string;
}

export async function loadSkills(root: string): Promise<LoadedSkill[]> {
  const skillsRoot = await realpath(resolve(root));
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skills: LoadedSkill[] = [];
  const names = new Set<string>();
  for (const entry of entries
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const directory = await realpath(join(skillsRoot, entry.name));
    if (!directory.startsWith(skillsRoot + sep))
      throw new PitCrewError(
        'POLICY_DENIED',
        'Skill directory escapes the skills root.',
      );
    let manifest: SkillManifest;
    try {
      manifest = skillManifestSchema.parse(
        JSON.parse(await readFile(join(directory, 'skill.json'), 'utf8')),
      );
    } catch (error) {
      throw new PitCrewError(
        'CONFIGURATION',
        'Skill "' +
          entry.name +
          '" has an invalid manifest: ' +
          (error instanceof Error ? error.message.slice(0, 300) : 'unknown'),
      );
    }
    if (manifest.name !== entry.name)
      throw new PitCrewError(
        'CONFIGURATION',
        'Skill manifest name must match its directory.',
      );
    if (names.has(manifest.name))
      throw new PitCrewError('CONFIGURATION', 'Duplicate skill name.');
    names.add(manifest.name);
    let instructions: string;
    try {
      instructions = await readFile(join(directory, 'SKILL.md'), 'utf8');
    } catch {
      throw new PitCrewError(
        'CONFIGURATION',
        'Skill "' + manifest.name + '" is missing SKILL.md.',
      );
    }
    if (instructions.trim().length < 40)
      throw new PitCrewError(
        'CONFIGURATION',
        'Skill "' + manifest.name + '" has empty instructions.',
      );
    skills.push({ manifest, instructions, root: directory });
  }
  return skills;
}

export async function skillContext(
  root: string,
  name: string,
): Promise<LoadedSkill> {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(name))
    throw new PitCrewError('CONFIGURATION', 'Invalid skill name.');
  const skills = await loadSkills(root);
  const skill = skills.find((entry) => entry.manifest.name === name);
  if (!skill)
    throw new PitCrewError('CONFIGURATION', 'Skill is not installed.');
  return skill;
}
