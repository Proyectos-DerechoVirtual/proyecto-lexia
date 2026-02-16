import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences?: any;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          console.log('Attempting login for:', email);
          
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            console.error('Login error:', error);
            throw error;
          }

          console.log('Login successful, fetching profile...');

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.error('Profile fetch error:', profileError);
          }

          console.log('Profile data:', profile);

          set({
            user: {
              id: data.user.id,
              email: data.user.email!,
              name: profile?.name || 'Usuario',
              role: profile?.role || 'user',
              preferences: profile?.preferences,
            },
            isAuthenticated: true,
            isLoading: false,
          });

          console.log('Login completed successfully');
        } catch (error: any) {
          console.error('Login failed:', error);
          set({
            error: error.message || 'Credenciales inválidas',
            isLoading: false,
          });
        }
      },

      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
            },
          });

          if (error) throw error;

          if (data.user && !data.user.email_confirmed_at) {
            // Usuario necesita confirmar email
            set({
              error: 'Revisa tu email para confirmar tu cuenta antes de iniciar sesión',
              isLoading: false,
            });
            return;
          }

          if (data.user) {
            // Esperar un momento para que el trigger cree el perfil
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verificar si el perfil existe, si no, crearlo
            let { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (profileError && profileError.code === 'PGRST116') {
              // Perfil no existe, crearlo manualmente
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  email: data.user.email,
                  name: name,
                  role: 'user'
                })
                .select()
                .single();

              if (createError) throw createError;
              profile = newProfile;
            } else if (profileError) {
              throw profileError;
            }

            set({
              user: {
                id: data.user.id,
                email: data.user.email!,
                name: profile?.name || name,
                role: profile?.role || 'user',
                preferences: profile?.preferences,
              },
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error: any) {
          console.error('Registration error:', error);
          set({
            error: error.message || 'Error al registrar usuario',
            isLoading: false,
          });
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            set({
              user: {
                id: user.id,
                email: user.email!,
                name: profile?.name || 'Usuario',
                role: profile?.role || 'user',
                preferences: profile?.preferences,
              },
              isAuthenticated: true,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
            });
          }
        } catch (error) {
          console.error('Error checking auth:', error);
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);