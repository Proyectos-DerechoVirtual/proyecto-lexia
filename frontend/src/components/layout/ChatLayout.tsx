import { useState } from 'react';
import { useAuthStore } from '@/stores/supabaseAuthStore';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatInterface } from '../chat/ChatInterface';
import { Header } from './Header';
import { LoginRequiredModal } from '../modals/LoginRequiredModal';

export function ChatLayout() {
  const { isAuthenticated } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Removido subscribeToMessages para simplificar

  return (
    <>
      <div className="flex h-full bg-claude-beige dark:bg-claude-gray-900">
        {/* Solo mostrar sidebar si está autenticado */}
        {isAuthenticated && (
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        )}
        
        <div 
          className="flex-1 flex flex-col transition-all duration-300 ease-in-out"
          style={{
            marginLeft: isAuthenticated && isSidebarOpen ? '320px' : '0',
          }}
        >
          <Header 
            onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            isSidebarOpen={isSidebarOpen}
          />
          <ChatInterface />
        </div>
      </div>
      
      {/* Modal de login requerido */}
      <LoginRequiredModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}