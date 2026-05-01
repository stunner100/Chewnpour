import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [topicDetailSource, authContextSource, topicsSource, profilesSource, examSecuritySource, subscriptionsSource, protectedRouteStateSource] = await Promise.all([
  read('src/pages/TopicDetail.jsx'),
  read('src/contexts/AuthContext.jsx'),
  read('convex/topics.ts'),
  read('convex/profiles.ts'),
  read('convex/lib/examSecurity.js'),
  read('convex/subscriptions.ts'),
  read('src/lib/protectedRouteState.js'),
]);

for (const snippet of [
  "import { useQuery, useAction, useMutation, useConvexAuth } from 'convex/react';",
  "const { user, profile, updateProfile, loading: authLoading } = useAuth();",
  "const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();",
  "routeTopicId && !authLoading && isConvexAuthenticated",
  "suspendMissingDetection: authLoading || !isConvexAuthenticated",
  "user?.id && isConvexAuthenticated ? {} : 'skip'",
]) {
  if (!topicDetailSource.includes(snippet)) {
    throw new Error(`Regression detected: TopicDetail auth gating missing snippet: ${snippet}`);
  }
}

for (const snippet of [
  "import { useQuery, useMutation, useConvexAuth } from 'convex/react';",
  "const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();",
  "sessionUser?.id && isConvexAuthenticated ? { userId: sessionUser.id } : 'skip'",
  "const awaitingConvexAuth = Boolean(sessionUser?.id) && !isConvexAuthenticated;",
  "const loading = isPending || ottPending || isConvexAuthLoading || awaitingConvexAuth || profileLoading;",
  "if (!activeUserId || !isConvexAuthenticated) {",
]) {
  if (!authContextSource.includes(snippet)) {
    throw new Error(`Regression detected: AuthContext auth gating missing snippet: ${snippet}`);
  }
}

for (const snippet of [
  "export const collectAuthUserIdCandidates = (identity) => {",
  "authUserIds,",
  "!normalizedAuthUserIds.includes(normalizedResourceOwnerUserId)",
  "for (const separator of [\"|\", \":\"])",
]) {
  if (!examSecuritySource.includes(snippet)) {
    throw new Error(`Regression detected: examSecurity auth candidate handling missing snippet: ${snippet}`);
  }
}

for (const snippet of [
  "collectAuthUserIdCandidates,",
  "const authUserIds = collectAuthUserIdCandidates(identity);",
  "authUserIds,",
]) {
  if (!topicsSource.includes(snippet)) {
    throw new Error(`Regression detected: topics auth candidate handling missing snippet: ${snippet}`);
  }
}

for (const snippet of [
  "import { collectAuthUserIdCandidates } from \"./lib/examSecurity\";",
  "const authenticatedUserIds = collectAuthUserIdCandidates(identity);",
  "!authenticatedUserIds.includes(requestedUserId)",
]) {
  if (!profilesSource.includes(snippet)) {
    throw new Error(`Regression detected: profiles auth candidate handling missing snippet: ${snippet}`);
  }
}

for (const snippet of [
  "import { collectAuthUserIdCandidates } from \"./lib/examSecurity\";",
  "return collectAuthUserIdCandidates(identity)[0] || \"\";",
]) {
  if (!subscriptionsSource.includes(snippet)) {
    throw new Error(`Regression detected: subscriptions auth candidate handling missing snippet: ${snippet}`);
  }
}

for (const snippet of [
  'if (loading) {',
  "type: 'loading',",
  'if (!user) {',
  'if (profileReady) {',
]) {
  if (!protectedRouteStateSource.includes(snippet)) {
    throw new Error(`Regression detected: protected route loading guard missing snippet: ${snippet}`);
  }
}

console.log('topic-auth-transition-regression.test.mjs passed');
