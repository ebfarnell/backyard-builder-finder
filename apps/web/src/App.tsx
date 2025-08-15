import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { SearchProvider } from '@/contexts/SearchContext';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import SettingsPage from '@/pages/SettingsPage';
import AdminPage from '@/pages/AdminPage';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SearchProvider>
          <div className="h-full">
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Routes>
          </div>
        </SearchProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;