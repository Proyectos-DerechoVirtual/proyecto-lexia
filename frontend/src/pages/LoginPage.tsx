import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/supabaseAuthStore';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (isRegister) {
      await register(formData.name, formData.email, formData.password);
    } else {
      await login(formData.email, formData.password);
    }

    if (!error) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-claude-beige dark:bg-claude-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <img src="/logobuho.png" alt="LexAI" className="w-24 h-24 object-contain" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-claude-text dark:text-white">
            {isRegister ? 'Crear cuenta en LexAI' : 'Acceder a LexAI'}
          </h2>
          <p className="mt-2 text-center text-sm text-claude-gray-600 dark:text-claude-gray-400">
            ¡La primera IA para Opositores de Justicia!
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            {isRegister && (
              <div>
                <label htmlFor="name" className="sr-only">
                  Nombre
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required={isRegister}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-claude-gray-300 dark:border-claude-gray-700 placeholder-claude-gray-500 dark:placeholder-claude-gray-400 text-claude-text dark:text-white bg-white dark:bg-claude-gray-800 rounded-t-md focus:outline-none focus:ring-claude-orange focus:border-claude-orange focus:z-10 sm:text-sm"
                  placeholder="Nombre completo"
                />
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-claude-gray-300 dark:border-claude-gray-700 placeholder-claude-gray-500 dark:placeholder-claude-gray-400 text-claude-text dark:text-white bg-white dark:bg-claude-gray-800 ${
                  !isRegister ? 'rounded-t-md' : ''
                } focus:outline-none focus:ring-claude-orange focus:border-claude-orange focus:z-10 sm:text-sm`}
                placeholder="Correo electrónico"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-claude-gray-300 dark:border-claude-gray-700 placeholder-claude-gray-500 dark:placeholder-claude-gray-400 text-claude-text dark:text-white bg-white dark:bg-claude-gray-800 rounded-b-md focus:outline-none focus:ring-claude-orange focus:border-claude-orange focus:z-10 sm:text-sm"
                placeholder="Contraseña"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-claude-orange hover:bg-claude-darkOrange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-claude-orange disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Cargando...' : (isRegister ? 'Registrarse' : 'Iniciar sesión')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                clearError();
              }}
              className="text-sm text-claude-orange hover:text-claude-darkOrange"
            >
              {isRegister
                ? '¿Ya tienes cuenta? Inicia sesión'
                : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}