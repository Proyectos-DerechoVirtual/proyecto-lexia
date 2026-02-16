import { useEffect } from 'react';
import { PlusIcon, XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useChatStore } from '@/stores/supabaseChatStore';
import { ConversationList } from './ConversationList';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle?: () => void;
}

export function Sidebar({ isOpen, onClose, onToggle }: SidebarProps) {
  const { createConversation, loadConversations } = useChatStore();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewChat = async () => {
    await createConversation('Nueva consulta legal');
    onClose();
  };

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40',
          isOpen ? 'block' : 'hidden'
        )}
        onClick={onClose}
      />
      
      <aside
        className={clsx(
          'w-80 h-screen bg-claude-beige dark:bg-claude-gray-800 border-r border-claude-gray-200 dark:border-claude-gray-700 z-50 transition-all duration-300 ease-in-out fixed top-0 left-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-claude-gray-200 dark:border-claude-gray-700">
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <h2 className="text-lg font-semibold text-claude-text dark:text-claude-gray-200">Conversaciones</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-claude-gray-200 dark:hover:bg-claude-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-claude-text dark:text-claude-gray-300" />
              </button>
            </div>
            
            {/* Botón de colapsar para desktop */}
            <div className="hidden lg:flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-claude-text dark:text-claude-gray-200">Conversaciones</h2>
              {onToggle && (
                <button
                  onClick={onToggle}
                  className="p-2 rounded-lg hover:bg-claude-gray-200 dark:hover:bg-claude-gray-700 transition-colors"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-claude-text dark:text-claude-gray-300" />
                </button>
              )}
            </div>
            
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-3 px-4 py-3 bg-transparent hover:bg-claude-gray-100 dark:hover:bg-claude-gray-700 text-claude-text dark:text-claude-gray-300 rounded-lg transition-colors font-medium border border-claude-gray-200 dark:border-claude-gray-600"
            >
              <div className="w-6 h-6 bg-claude-orange rounded-full flex items-center justify-center flex-shrink-0">
                <PlusIcon className="w-4 h-4 text-white" />
              </div>
              <span>Nueva conversación</span>
            </button>
          </div>

          <ConversationList />
        </div>
      </aside>
    </>
  );
}