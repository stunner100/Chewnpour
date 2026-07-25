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
        <SidebarMenuButton size="lg" asChild className="h-auto py-2 hover:bg-transparent active:bg-transparent">
          <Link to="/dashboard" aria-label="ChewnPour dashboard" className="!justify-start">
            <BrandLogo
              variant={isDarkMode ? 'white' : 'default'}
              size={28}
              decorative
              className="h-7 w-auto max-w-full"
            />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
