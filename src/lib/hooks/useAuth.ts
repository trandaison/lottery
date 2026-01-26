'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';

interface AuthState {
  user: Omit<User, 'passwordDigest'> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  /**
   * Fetch current user from API
   */
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/admin/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return;
      }

      const data = await response.json();

      if (data.success && data.data.user) {
        setState({
          user: data.data.user,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  /**
   * Login with email and password
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      const response = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        return false;
      }

      if (data.success && data.data.user) {
        setState({
          user: data.data.user,
          isLoading: false,
          isAuthenticated: true,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  /**
   * Logout current user
   */
  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/v1/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      router.push('/admin/login');
    }
  };

  /**
   * Refresh user data
   */
  const refresh = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  // Fetch user on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user: state.user,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    logout,
    refresh,
  };
}
