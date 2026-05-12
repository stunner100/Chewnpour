import fs from 'node:fs';
import path from 'node:path';

type SkillUpdate = {
  file: string;
  section: string;
  action: 'append' | 'replace';
  content: string;
};

const [, , jsonPathArg] = process.argv;

if (!jsonPathArg) {
  console.error('Usage: apply-qa-skill-updates <path-to-skill-updates.json>');
  process.exit(1);
}

const jsonPath = path.resolve(process.cwd(), jsonPathArg);
if (!fs.existsSync(jsonPath)) {
  console.log(`No skill updates file found at ${jsonPath}; nothing to apply.`);
  process.exit(0);
}

const raw = fs.readFileSync(jsonPath, 'utf8').trim();
if (!raw) {
  console.log('Skill updates file is empty; nothing to apply.');
  process.exit(0);
}

const updates = JSON.parse(raw) as SkillUpdate[];
if (!Array.isArray(updates) || updates.length === 0) {
  console.log('No skill updates to apply.');
  process.exit(0);
}

const findSectionRange = (source: string, section: string) => {
  const lines = source.split('\n');
  const headingPattern = /^(#{1,6})\s+(.*)$/;
  let headingIndex = -1;
  let headingLevel = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(headingPattern);
    if (!match) continue;
    if (match[2].trim() !== section.trim()) continue;
    headingIndex = i;
    headingLevel = match[1].length;
    break;
  }

  if (headingIndex === -1) {
    throw new Error(`Section "${section}" not found.`);
  }

  let endIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(headingPattern);
    if (!match) continue;
    if (match[1].length <= headingLevel) {
      endIndex = i;
      break;
    }
  }

  return {
    lines,
    headingIndex,
    bodyStart: headingIndex + 1,
    endIndex,
  };
};

const applyUpdate = (source: string, update: SkillUpdate) => {
  const { lines, bodyStart, endIndex } = findSectionRange(source, update.section);
  const before = lines.slice(0, bodyStart).join('\n');
  const after = lines.slice(endIndex).join('\n');
  const existingBody = lines.slice(bodyStart, endIndex).join('\n').trim();
  const nextBody =
    update.action === 'replace'
      ? update.content.trim()
      : existingBody
        ? `${existingBody}\n\n${update.content.trim()}`
        : update.content.trim();

  const parts = [before, nextBody];
  if (after.trim()) parts.push(after);
  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
};

for (const update of updates) {
  const targetPath = path.resolve(process.cwd(), update.file);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target file "${update.file}" does not exist.`);
  }

  const source = fs.readFileSync(targetPath, 'utf8');
  const next = applyUpdate(source, update);
  fs.writeFileSync(targetPath, next);
  console.log(`Applied ${update.action} update to ${update.file} -> ${update.section}`);
}
