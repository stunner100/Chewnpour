import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  materialsSource,
  dashboardLayoutSource,
  mobileBottomNavSource,
  lessonsSource,
] = await Promise.all([
  read('src/pages/MyMaterialsLibrary.jsx'),
  read('src/components/DashboardLayout.jsx'),
  read('src/components/MobileBottomNav.jsx'),
  read('src/pages/LessonMemoryNeuralBasis.jsx'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

requireIncludes(
  materialsSource,
  "import { useConvexAuth, useQuery } from 'convex/react';",
  'MyMaterialsLibrary.jsx',
);
requireIncludes(
  materialsSource,
  'const shouldLoadMaterials = isAuthenticated && !authLoading;',
  'MyMaterialsLibrary.jsx',
);
requireIncludes(
  materialsSource,
  "useQuery(api.uploads.getUserUploads, shouldLoadMaterials ? {} : 'skip')",
  'MyMaterialsLibrary.jsx',
);
requireIncludes(
  materialsSource,
  "useQuery(api.courses.getUserCourses, shouldLoadMaterials ? {} : 'skip')",
  'MyMaterialsLibrary.jsx',
);

requireIncludes(
  dashboardLayoutSource,
  "import React, { Component, useEffect, useLayoutEffect } from 'react';",
  'DashboardLayout.jsx',
);
requireIncludes(
  dashboardLayoutSource,
  "const main = document.getElementById('dashboard-main');",
  'DashboardLayout.jsx',
);
requireIncludes(
  dashboardLayoutSource,
  "main.scrollTo({ top: 0, left: 0, behavior: 'auto' });",
  'DashboardLayout.jsx',
);
requireIncludes(
  dashboardLayoutSource,
  "[routerLocation.pathname, routerLocation.search]",
  'DashboardLayout.jsx',
);
requireIncludes(
  dashboardLayoutSource,
  'className="fixed top-0 flex justify-between items-center gap-2 h-16 px-3 md:px-space-8',
  'DashboardLayout.jsx',
);
requireIncludes(
  dashboardLayoutSource,
  'className="flex-1 min-w-0 md:max-w-md',
  'DashboardLayout.jsx',
);
requireIncludes(
  dashboardLayoutSource,
  'className="shrink-0 flex items-center gap-1.5 md:gap-space-4"',
  'DashboardLayout.jsx',
);

requireIncludes(
  mobileBottomNavSource,
  "if (p === '/dashboard') return pathname === '/dashboard';",
  'MobileBottomNav.jsx',
);
requireIncludes(
  mobileBottomNavSource,
  "const moreTabPaths = ['/dashboard/upload', '/dashboard/library'",
  'MobileBottomNav.jsx',
);

if (lessonsSource.includes('topicsSectionRef.current?.scrollIntoView')) {
  throw new Error('LessonMemoryNeuralBasis.jsx should not auto-scroll to the topics section when courseId is selected.');
}

console.log('materials-page-qa-regression.test.mjs passed');
