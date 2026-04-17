import { Bell, Search, Sparkles, LogOut as LogOutIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.getUnreadCount());
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lesson':
        return <span className="text-lg">📖</span>;
      case 'unit':
        return <span className="text-lg">📚</span>;
      case 'assignment':
        return <span className="text-lg">✏️</span>;
      case 'achievement':
        return <span className="text-lg">🎉</span>;
      default:
        return <Sparkles className="w-4 h-4 text-yellow-400" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <header className="h-14 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {title && (
          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-3 w-4 h-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-10 bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-violet-500"
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-400 hover:text-slate-100"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-slate-900 border-slate-800">
            <DropdownMenuLabel className="text-slate-200">
              Notifications {unreadCount > 0 && <span className="text-red-400">({unreadCount})</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={`flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-slate-800 ${
                      !notification.read ? 'bg-slate-800/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {getNotificationIcon(notification.type)}
                      <span className="text-sm font-medium text-slate-200 flex-1">{notification.title}</span>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{notification.message}</p>
                    <span className="text-xs text-slate-500">{formatTime(notification.timestamp)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.full_name?.charAt(0).toUpperCase() || 'S'}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
            <DropdownMenuLabel className="text-slate-200">
              <div className="flex flex-col">
                <span>{user?.full_name || 'Student'}</span>
                <span className="text-xs text-slate-400 font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem className="text-slate-300 hover:text-slate-100 hover:bg-slate-800 cursor-pointer">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 hover:text-slate-100 hover:bg-slate-800 cursor-pointer">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 hover:bg-slate-800 cursor-pointer"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
