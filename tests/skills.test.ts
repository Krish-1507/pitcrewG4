import { expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSkills, skillContext } from '../packages/skills/src/index.js';

it('loads the installed skill set with validated manifests and instructions', async () => {
  const skills = await loadSkills(join(process.cwd(), 'skills'));
  expect(skills.map((skill) => skill.manifest.name)).toEqual([
    'accessibility',
    'api-contract',
    'architecture',
    'browser-qa',
    'database-safety',
    'debugging',
    'documentation',
    'performance',
    'security-review',
  ]);
  for (const skill of skills) {
    expect(skill.instructions.length).toBeGreaterThan(40);
    expect(Array.isArray(skill.manifest.permissions)).toBe(true);
    expect(skill.root.endsWith(skill.manifest.name)).toBe(true);
  }
  expect(
    (await skillContext(join(process.cwd(), 'skills'), 'debugging')).manifest
      .permissions,
  ).toContain('sandbox:execute');
});

it('rejects skills whose manifest disagrees with the directory or file set', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-skills-'));
  await mkdir(join(root, 'wrong-name'));
  await writeFile(
    join(root, 'wrong-name', 'skill.json'),
    JSON.stringify({
      name: 'different-name',
      description: 'A manifest whose name does not match its directory.',
      version: '1.0.0',
      permissions: [],
    }),
  );
  await writeFile(
    join(root, 'wrong-name', 'SKILL.md'),
    '# Skill\n\nEnough instructions to load.',
  );
  await expect(loadSkills(root)).rejects.toThrow(/match its directory/);
  await expect(
    skillContext(join(process.cwd(), 'skills'), '../secret'),
  ).rejects.toThrow(/Invalid skill name/);
});
