import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useChatStore } from '@/stores/supabaseChatStore';
import { useState } from 'react';
import clsx from 'clsx';

export function ConversationList() {
  const { conversations, currentConversation, selectConversation, deleteConversation, updateConversationTitle } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = (conversation: any) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await updateConversationTitle(editingId, editTitle.trim());
      setEditingId(null);
      setEditTitle('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const groupedConversations = conversations.reduce((groups, conversation) => {
    const date = new Date(conversation.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let group: string;
    if (date.toDateString() === today.toDateString()) {
      group = 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = 'Ayer';
    } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      group = 'Esta semana';
    } else {
      group = format(date, 'MMMM yyyy', { locale: es });
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(conversation);
    return groups;
  }, {} as Record<string, typeof conversations>);

  return (
    <div className="flex-1 overflow-y-auto">
      {Object.entries(groupedConversations).map(([group, convs]) => (
        <div key={group} className="px-4 py-2">
          <h3 className="text-xs font-semibold text-claude-gray-500 dark:text-claude-gray-400 uppercase mb-2">
            {group}
          </h3>
          <div className="space-y-1">
            {convs.map((conversation) => (
              <div
                key={conversation.id}
                className={clsx(
                  'group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                  currentConversation?.id === conversation.id
                    ? 'bg-claude-orange/10 dark:bg-claude-orange/20 text-claude-orange border border-claude-orange/20'
                    : 'hover:bg-claude-gray-200 dark:hover:bg-claude-gray-700 text-claude-text dark:text-claude-gray-300'
                )}
                onClick={() => {
                  if (editingId !== conversation.id) {
                    selectConversation(conversation.id);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  {editingId === conversation.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      onBlur={handleSaveEdit}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1 text-sm bg-white dark:bg-claude-gray-700 border border-claude-gray-300 dark:border-claude-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-claude-orange"
                      autoFocus
                    />
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">
                        {conversation.title}
                      </p>
                      {conversation.category && (
                        <span className="text-xs text-claude-gray-500 dark:text-claude-gray-400">
                          {conversation.category}
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(conversation);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-claude-gray-300 dark:hover:bg-claude-gray-600 transition-opacity"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conversation.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-claude-gray-300 dark:hover:bg-claude-gray-600 transition-opacity"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-claude-gray-500 dark:text-claude-gray-400">
          <p className="text-sm">No hay conversaciones</p>
          <p className="text-xs mt-1">Crea una nueva consulta para comenzar</p>
        </div>
      )}
    </div>
  );
}