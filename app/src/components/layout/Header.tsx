import { Bell, Sparkles, LogOut as LogOutIcon, CheckCheck, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/CommandPalette';
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
import { authFetch } from '@/lib/authFetch';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.getUnreadCount());
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const setFromApi = useNotificationStore((state) => state.setFromApi);
  const navigate = useNavigate();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = async () => {
    if (!user) {
      setFromApi([]);
      return;
    }

    try {
      const res = await authFetch('/notifications');
      if (res.status === 401) {
        setFromApi([]);
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[notify] Fetch failed:', res.status, text);
        setFromApi([]);
        return;
      }

      const text = await res.text().catch(() => '');
      if (!text) {
        setFromApi([]);
        return;
      }

      try {
        const rows = JSON.parse(text);
        setFromApi(Array.isArray(rows) ? rows : []);
      } catch (parseErr) {
        console.error('[notify] Invalid notification payload:', parseErr);
        setFromApi([]);
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes('Failed to fetch')) {
        console.warn('[notify] Backend API not accessible. Is the backend server running on port 3001?');
      } else if (!errorMsg.includes('Not authenticated')) {
        console.error('[notify] Fetch error:', err);
      }
      setFromApi([]);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user?.id]);

  const handleMarkAllRead = async () => {
    markAllRead();
    try {
      await authFetch('/notifications/read-all', { method: 'PATCH' });
    } catch {
      // Silent
    }
  };

  const handleMarkOneRead = async (id: string) => {
    markAsRead(id);
    try {
      await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // Silent
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileClick = () => {
    navigate(user?.role === 'instructor' ? '/instructor/settings' : user?.role === 'admin' ? '/admin/settings' : '/settings');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lesson':     return <span className="text-lg">•</span>;
      case 'unit':       return <span className="text-lg">•</span>;
      case 'quiz':       return <span className="text-lg">•</span>;
      case 'lab':        return <span className="text-lg">•</span>;
      case 'assignment': return <span className="text-lg">•</span>;
      case 'achievement':return <span className="text-lg">•</span>;
      case 'announcement': return <span className="text-lg">•</span>;
      default:           return <Sparkles className="w-4 h-4 text-yellow-400" />;
    }
  };

  /**
   * Map notification type → destination route based on the user's role.
   * Returns null if there's no sensible destination.
   */
  const getNotificationDestination = (type: string): string | null => {
    const isInstructor = user?.role === 'instructor';
    switch (type) {
      case 'announcement':
        return isInstructor ? '/instructor/announcements' : '/announcements';
      case 'lesson':
      case 'unit':
        return isInstructor ? '/instructor/courses' : '/lessons';
      case 'quiz':
        return isInstructor ? '/instructor/quizzes' : '/quizzes';
      case 'lab':
        return isInstructor ? '/instructor/laboratories' : '/laboratories';
      case 'assignment':
        return isInstructor ? '/instructor/assessments' : '/quizzes';
      case 'achievement':
        return isInstructor ? null : '/achievements';
      default:
        return null;
    }
  };

  const handleNotificationClick = (notification: { id: string; type: string }) => {
    // Mark as read locally + on the server
    handleMarkOneRead(notification.id);
    // Navigate to the relevant page
    const dest = getNotificationDestination(notification.type);
    if (dest) navigate(dest);
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

  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <header className="h-14 border-b border-teal-400/20 bg-slate-950/65 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30 aether-header">
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
            <DropdownMenuLabel className="flex items-center justify-between text-slate-200">
              <span>Notifications {unreadCount > 0 && <span className="text-red-400">({unreadCount})</span>}</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 font-normal"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-slate-800 ${
                      !notification.read ? 'bg-slate-800/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {getNotificationIcon(notification.type)}
                      <span className="text-sm font-medium text-slate-200 flex-1 leading-tight">{notification.title}</span>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">{notification.message}</p>
                    {notification.attachmentUrl && (
                      <a
                        href={notification.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        📎 {notification.attachmentName ?? 'View attachment'}
                      </a>
                    )}
                    <span className="text-xs text-slate-500">{formatTime(notification.timestamp)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile and logout actions */}
        <ThemeToggle />
        <Button
          variant="ghost"
          onClick={handleProfileClick}
          className="relative h-10 w-10 rounded-full p-0 header-user-trigger"
          aria-label="Open settings"
          title="Settings"
        >
          <span className="header-user-ring" />
          <div className="header-user-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="text-white font-semibold text-sm">
                {user?.full_name?.charAt(0).toUpperCase() || 'S'}
              </span>
            )}
          </div>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          aria-label="Log out"
          title="Log out"
        >
          <LogOutIcon className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
