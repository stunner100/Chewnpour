import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  fs.readFile(path.join(root, relativePath), 'utf8');

const settingsSource = await read('src/pages/AccountStudySettings.jsx');
const layoutSource = await read('src/components/DashboardLayout.jsx');
const profilesSource = await read('convex/profiles.ts');
const schemaSource = await read('convex/schema.ts');

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Expected ${label}: ${snippet}`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Unexpected ${label}: ${snippet}`);
  }
};

requireIncludes(settingsSource, 'const normalizeStudyPreferences = (value = {}) => ({', 'normalized persisted study preferences');
requireIncludes(profilesSource, 'studyPreferences: v.optional(v.object({', 'profile mutation study preferences');
requireIncludes(schemaSource, 'studyPreferences: v.optional(v.object({', 'database schema study preferences');
requireIncludes(profilesSource, 'if (args.studyPreferences !== undefined) updates.studyPreferences = args.studyPreferences;', 'profile mutation writes study preferences');

requireIncludes(settingsSource, 'const handleCancel = () => {', 'settings cancel handler');
requireIncludes(settingsSource, 'setDraftFullName(null);', 'cancel restores profile name');
requireIncludes(settingsSource, 'setDraftDailyGoal(null);', 'cancel restores daily goal');
requireIncludes(settingsSource, 'setDraftSessionLength(null);', 'cancel restores session length');
requireIncludes(settingsSource, 'setDraftAiTone(null);', 'cancel restores tutor style');
requireIncludes(settingsSource, 'setDraftNotifications(null);', 'cancel restores notification draft');
requireIncludes(settingsSource, 'onClick={handleCancel}', 'cancel button is wired');
requireIncludes(settingsSource, 'htmlFor="settings-full-name"', 'full name label is associated with input');
requireIncludes(settingsSource, 'id="settings-full-name"', 'full name input has an accessible id');
requireIncludes(settingsSource, 'htmlFor="settings-email-address"', 'email label is associated with input');
requireIncludes(settingsSource, 'id="settings-email-address"', 'email input has an accessible id');
requireIncludes(settingsSource, 'htmlFor="settings-daily-goal-minutes"', 'daily goal label is associated with input');
requireIncludes(settingsSource, 'id="settings-daily-goal-minutes"', 'daily goal input has an accessible id');

requireIncludes(settingsSource, 'const handleTutorStyleChange = (persona) => {', 'tutor style is draft-only');
requireExcludes(settingsSource, 'const handleTutorStyleChange = async', 'immediate tutor style persistence');
requireIncludes(settingsSource, 'await setTutorPersona({ persona: normalizedAiTone });', 'tutor style saves with Save Changes');

requireIncludes(settingsSource, 'role="switch"', 'notification toggles expose switch role');
requireIncludes(settingsSource, 'aria-checked={Boolean(notifications[toggle.key])}', 'notification toggles expose checked state');
requireIncludes(settingsSource, 'aria-label={`${toggle.title}: ${notifications[toggle.key] ? \'on\' : \'off\'}`}', 'notification toggles expose names');

requireIncludes(settingsSource, 'href={BILLING_SUPPORT_MAILTO}', 'billing support action is real');
requireIncludes(settingsSource, 'Contact Billing Support', 'subscription card uses honest billing CTA');
requireExcludes(settingsSource, 'to="/dashboard/settings#subscription"', 'dead-end subscription hash link');

requireIncludes(layoutSource, 'const scrollDashboardTargetIntoView = (targetId, options = {}) => {', 'shared dashboard hash scroller');
requireIncludes(layoutSource, 'onClick={handleNotificationSettingsClick}', 'notification shortcut handles same-hash clicks');
requireIncludes(layoutSource, 'scrollDashboardTargetIntoView(\'notifications\', { behavior: \'smooth\' });', 'notification shortcut scrolls to target');

for (const source of [settingsSource, layoutSource]) {
  requireIncludes(source, 'aria-hidden="true"', 'decorative Material Symbols are hidden from assistive tech');
}

console.log('settings-page-ux-regression.test.mjs passed');
