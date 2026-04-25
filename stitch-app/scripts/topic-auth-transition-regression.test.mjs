import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [topicDetailSource, authContextSource] = await Promise.all([
  read('src/pages/TopicDetail.jsx'),
  read('src/contexts/AuthContext.jsx'),
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

console.log('topic-auth-transition-regression.test.mjs passed');
