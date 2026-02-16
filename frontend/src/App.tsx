import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useThemeStore } from './stores/themeStore';
import { ChatLayout } from './components/layout/ChatLayout';
import { LoginPage } from './pages/LoginPage';
import { EmbedPage } from './pages/EmbedPage';
import { useEffect } from 'react';
import { useAuthStore } from './stores/supabaseAuthStore';

function App() {
  const { isDark } = useThemeStore();
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/embed" element={<EmbedPage />} />
        <Route path="/teachable" element={<EmbedPage hideHeader={false} />} />
        <Route path="/" element={<ChatLayout />} />
      </Routes>
    </Router>
  );
}

export default App;