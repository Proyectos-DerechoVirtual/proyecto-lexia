import { MoonIcon, SunIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/supabaseAuthStore';

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen?: boolean;
}

export function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
  const { isDark, toggle } = useThemeStore();
  const { user, logout, isAuthenticated } = useAuthStore();

  return (
    <header className="border-b border-claude-gray-200 dark:border-claude-gray-700 bg-claude-beige dark:bg-claude-gray-800">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Show button only when authenticated and sidebar is closed */}
          {isAuthenticated && !isSidebarOpen && (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-lg hover:bg-claude-gray-100 dark:hover:bg-claude-gray-700 transition-colors"
            >
              <Bars3Icon className="w-5 h-5 text-claude-text dark:text-claude-gray-300" />
            </button>
          )}
          
          <div className="flex items-center gap-3">
            <img src="/logobuho.png" alt="LexAI" className="w-12 h-12 object-contain" />
            <h1 className="text-xl font-semibold text-claude-text dark:text-claude-gray-100">
              LexAI
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-claude-gray-100 dark:hover:bg-claude-gray-700 transition-colors"
          >
            {isDark ? (
              <SunIcon className="w-5 h-5 text-claude-text dark:text-claude-gray-300" />
            ) : (
              <MoonIcon className="w-5 h-5 text-claude-text dark:text-claude-gray-300" />
            )}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-claude-text dark:text-claude-gray-400 font-medium">
                {user?.name}
              </span>
              <button
                onClick={logout}
                className="text-sm text-claude-text hover:text-claude-gray-700 dark:text-claude-gray-400 dark:hover:text-claude-gray-200 transition-colors font-medium"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="text-sm text-claude-orange hover:text-claude-darkOrange transition-colors font-medium"
            >
              Iniciar sesión
            </a>
          )}
        </div>
      </div>
    </header>
  );
}