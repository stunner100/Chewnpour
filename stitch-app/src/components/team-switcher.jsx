import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function TeamSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild className="h-auto py-2">
          <Link to="/dashboard" aria-label="ChewnPour dashboard">
            <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BrandLogo
                variant="mark"
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
