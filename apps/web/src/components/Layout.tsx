import { Outlet, Link, useLocation } from 'react-router-dom';
import { Settings, BarChart3, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Layout() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const navigation = [
    { name: 'Search', href: '/', icon: Home },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Admin', href: '/admin', icon: BarChart3 },
  ];

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4">
          <h1 className="text-xl font-bold">Yard Qualifier</h1>
          <p className="text-sm text-gray-400 mt-1">AI-powered parcel analysis</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        {user && (
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="text-white">{user.email}</p>
              </div>
              <button
                onClick={signOut}
                className="text-gray-400 hover:text-white text-sm"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}