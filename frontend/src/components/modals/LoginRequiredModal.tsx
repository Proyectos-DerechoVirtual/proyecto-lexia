import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ScaleIcon } from '../icons/ScaleIcon';
import { useNavigate } from 'react-router-dom';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginRequiredModal({ isOpen, onClose }: LoginRequiredModalProps) {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  const handleRegister = () => {
    navigate('/login');
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-claude-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-claude-orange rounded-xl flex items-center justify-center shadow-sm">
                      <ScaleIcon className="text-white" size={24} />
                    </div>
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-xl font-bold text-claude-text dark:text-white"
                      >
                        ¡Únete a LexAI!
                      </Dialog.Title>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-claude-gray-400 hover:text-claude-gray-600 dark:hover:text-claude-gray-300"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-claude-gray-600 dark:text-claude-gray-400 mb-4">
                    Has alcanzado el límite de <strong>2 preguntas gratuitas</strong>. 
                    Para continuar utilizando LexAI y acceder a todas las funcionalidades, 
                    necesitas crear una cuenta gratuita.
                  </p>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                      Beneficios de registrarte:
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                      <li>✓ Acceso ilimitado a consultas legales</li>
                      <li>✓ Historial de conversaciones guardado</li>
                      <li>✓ Acceso a toda la legislación y temario</li>
                      <li>✓ Preparación completa para oposiciones</li>
                      <li>✓ ¡Completamente GRATIS!</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-xl bg-claude-orange px-4 py-3 text-sm font-medium text-white hover:bg-claude-darkOrange focus:outline-none focus-visible:ring-2 focus-visible:ring-claude-orange focus-visible:ring-offset-2 transition-colors"
                    onClick={handleRegister}
                  >
                    Crear cuenta gratis
                  </button>
                  
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-xl border border-claude-gray-300 dark:border-claude-gray-600 bg-white dark:bg-claude-gray-700 px-4 py-3 text-sm font-medium text-claude-text dark:text-white hover:bg-claude-gray-50 dark:hover:bg-claude-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-claude-orange focus-visible:ring-offset-2 transition-colors"
                    onClick={handleLogin}
                  >
                    Ya tengo cuenta
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}