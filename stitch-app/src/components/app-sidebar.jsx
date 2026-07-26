import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { TutorAvatarMark } from '@/components/tutor/TutorAvatar';
import {
  BarChart3Icon,
  BookOpenIcon,
  CloudUploadIcon,
  FolderIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  CircleHelpIcon,
  SparklesIcon,
} from 'lucide-react';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboardIcon, exact: true },
  { title: 'Upload', url: '/dashboard/upload', icon: CloudUploadIcon },
  { title: 'My Materials', url: '/dashboard/library', icon: FolderIcon },
  { title: 'Lessons', url: '/dashboard/lessons', icon: BookOpenIcon },
  { title: 'Quizzes', url: '/dashboard/quiz', icon: CircleHelpIcon },
  { title: 'Exam', url: '/dashboard/exam', icon: GraduationCapIcon },
  { title: 'AI Tutor', url: '/dashboard/ai-tutor', icon: TutorAvatarMark, isTutorAvatar: true },
  { title: 'Progress', url: '/dashboard/progress', icon: BarChart3Icon },
];

const isNavItemActive = (pathname, item) => {
  if (item.exact) return pathname === item.url;
  return pathname === item.url || pathname.startsWith(`${item.url}/`);
};

export function AppSidebar({ ...props }) {
  const location = useLocation();
  const { profile, user: authUser } = useAuth();

  const displayName =
    profile?.fullName || authUser?.name || authUser?.email?.split('@')[0] || 'Student';
  const user = {
    name: displayName,
    email: authUser?.email || '',
    avatar: profile?.avatarUrl || '',
  };

  const items = navItems.map((item) => ({
    title: item.title,
    url: item.url,
    icon: item.isTutorAvatar ? (
      <item.icon className="size-4 rounded-full" />
    ) : (
      <item.icon className="size-4" />
    ),
    isActive: isNavItemActive(location.pathname, item),
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
        <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
          <Button asChild className="w-full justify-center gap-2 rounded-full bg-[#111111] text-white hover:bg-black">
            <Link to="/dashboard/upload">
              <SparklesIcon className="size-4" />
              Generate Material
            </Link>
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
