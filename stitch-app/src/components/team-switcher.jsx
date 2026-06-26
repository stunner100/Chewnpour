import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';
import useThemeMode from '../lib/useThemeMode.js';
import { DARK_THEME } from '../lib/theme.js';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function TeamSwitcher() {
  const { mode: themeMode } = useThemeMode();
  const isDarkMode = themeMode === DARK_THEME;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild className="h-auto py-2">
          <Link to="/dashboard" aria-label="ChewnPour dashboard">
            <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BrandLogo
                variant={isDarkMode ? 'white' : 'default'}
                size={28}
                decorative
                className="max-h-full max-w-full"
              />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">ChewnPour</span>
              <span className="truncate text-xs text-muted-foreground">AI Study Workspace</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
