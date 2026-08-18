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
  "fetch('/api/uploads'",
  'MyMaterialsLibrary.jsx',
);
requireIncludes(
  materialsSource,
  "fetch('/api/courses'",
  'MyMaterialsLibrary.jsx',
);
requireIncludes(
  materialsSource,
  '/api/uploads/${encodeURIComponent(uploadId)}/export',
  'MyMaterialsLibrary.jsx',
);
requireIncludes(
  materialsSource,
  'Download lessons and quizzes from every upload.',
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
  'className="flex h-16 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface',
  'DashboardLayout.jsx',
);
requireIncludes(
  dashboardLayoutSource,
  'md:max-w-md',
  'DashboardLayout.jsx',
);

requireIncludes(
  mobileBottomNavSource,
  "if (p === '/dashboard') return pathname === '/dashboard';",
  'MobileBottomNav.jsx',
);
requireIncludes(
  mobileBottomNavSource,
  'const moreTabPaths = moreItems.map((item) => item.path);',
  'MobileBottomNav.jsx',
);
requireIncludes(
  mobileBottomNavSource,
  "path: '/dashboard/library'",
  'MobileBottomNav.jsx',
);

if (lessonsSource.includes('topicsSectionRef.current?.scrollIntoView')) {
  throw new Error('LessonMemoryNeuralBasis.jsx should not auto-scroll to the topics section when courseId is selected.');
}

console.log('materials-page-qa-regression.test.mjs passed');
