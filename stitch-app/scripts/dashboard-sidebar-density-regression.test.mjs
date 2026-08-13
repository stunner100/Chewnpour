import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const layoutSource = await fs.readFile(path.join(root, 'src/components/DashboardLayout.jsx'), 'utf8');
const sidebarSource = await fs.readFile(path.join(root, 'src/components/app-sidebar.jsx'), 'utf8');
const sidebarUiSource = await fs.readFile(path.join(root, 'src/components/ui/sidebar.jsx'), 'utf8');
const navMainSource = await fs.readFile(path.join(root, 'src/components/nav-main.jsx'), 'utf8');

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Dashboard sidebar should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Dashboard sidebar should not keep ${label}: ${snippet}`);
  }
};

requireIncludes(layoutSource, 'SidebarProvider', 'sidebar-07 provider shell');
requireIncludes(layoutSource, 'SidebarInset', 'sidebar inset content area');
requireIncludes(layoutSource, 'SidebarTrigger', 'collapsible sidebar trigger');
requireIncludes(sidebarSource, 'collapsible="icon"', 'icon-collapsible sidebar');
requireIncludes(sidebarSource, 'Generate Material', 'primary sidebar CTA');
requireIncludes(sidebarSource, 'profile?.fullName', 'profile fullName for sidebar display name');
requireIncludes(sidebarSource, 'profile?.avatarUrl', 'profile avatarUrl for sidebar avatar');
requireExcludes(sidebarSource, '/dashboard/flashcards', 'parked flashcards nav');
requireIncludes(sidebarSource, '/dashboard/podcasts', 'podcasts sidebar nav');
requireIncludes(navMainSource, 'SidebarMenuButton', 'compact sidebar menu buttons');
requireIncludes(navMainSource, 'tooltip={item.title}', 'icon-collapsed tooltips');
requireIncludes(sidebarUiSource, 'w-[var(--sidebar-width)]', 'tailwind v3 sidebar width classes');
requireIncludes(sidebarUiSource, 'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]', 'collapsed icon sidebar width');
requireIncludes(sidebarUiSource, 'group-data-[collapsible=icon]:overflow-hidden', 'collapsed header/footer clip');
requireIncludes(sidebarUiSource, 'group-data-[collapsible=icon]:[&>span]:hidden', 'collapsed nav label hide');

const navUserSource = await fs.readFile(path.join(root, 'src/components/nav-user.jsx'), 'utf8');
requireIncludes(navUserSource, 'group-data-[collapsible=icon]:hidden', 'collapsed user details hide');
requireIncludes(navUserSource, 'group-data-[collapsible=icon]:overflow-hidden', 'collapsed user button clip');

if (sidebarUiSource.includes('w-(--sidebar-width)')) {
  throw new Error('Sidebar UI must not use Tailwind v4 width syntax incompatible with Tailwind v3.');
}

if (layoutSource.includes('w-sidebar-width')) {
  throw new Error('Dashboard layout should use shadcn sidebar spacing instead of fixed sidebar width offsets.');
}

console.log('dashboard-sidebar-density-regression.test.mjs passed');
