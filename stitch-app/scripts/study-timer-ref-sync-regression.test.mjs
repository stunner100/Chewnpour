import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const hookPath = path.join(root, 'src', 'hooks', 'useStudyTimer.js');
const source = await fs.readFile(hookPath, 'utf8');

if (/userIdRef\.current\s*=\s*userId\s*;/.test(source)) {
  throw new Error('Expected useStudyTimer to avoid writing userIdRef.current during render.');
}

if (!/useEffect\(\(\)\s*=>\s*{\s*userIdRef\.current\s*=\s*userId\s*\|\|\s*'';\s*},\s*\[userId\]\s*\)/s.test(source)) {
  throw new Error('Expected useStudyTimer to sync userIdRef.current from a useEffect.');
}

if (!source.includes('pendingMinutesByUserRef')) {
  throw new Error('Expected useStudyTimer to keep pending flush retries isolated per user.');
}

if (!source.includes('flushForUser(userIdRef.current)')) {
  throw new Error('Expected useStudyTimer to flush through a user-scoped helper.');
}

if (!source.includes('setPendingMinutesForUser(normalizedUserId, currentPending + minutes)')) {
  throw new Error('Expected useStudyTimer to retry failed flushes for the same user.');
}

console.log('study-timer-ref-sync-regression.test.mjs passed');
