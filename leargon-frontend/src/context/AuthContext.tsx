import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tokenStorage, StoredUser } from '../utils/tokenStorage';
import { login as apiLogin, signup as apiSignup, azureLogin as apiAzureLogin } from '../api/generated/authentication/authentication';
import type { AuthResponse, UserResponse, SignupRequest } from '../api/generated/model';

interface AuthContextType {
  user: UserResponse | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  azureLogin: (idToken: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: UserResponse) => void;
  isAuthenticated: boolean;
  loading: boolean;
  sessionExpiring: boolean;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiring, setSessionExpiring] = useState(false);

  useEffect(() => {
    const initAuth = () => {
      const token = tokenStorage.getToken();
      if (token) {
        if (isTokenExpired(token)) {
          tokenStorage.clear();
        } else {
          const storedUser = tokenStorage.getUser();
          if (storedUser) {
            setUser(storedUser as UserResponse);
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const token = tokenStorage.getToken();
      if (!token) return;
      if (isTokenExpired(token)) {
        tokenStorage.clear();
        setUser(null);
        setSessionExpiring(false);
      } else {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const msRemaining = payload.exp * 1000 - Date.now();
          setSessionExpiring(msRemaining < 5 * 60 * 1000);
        } catch {
          // malformed token — leave it to the next API call to handle
        }
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await apiLogin({ email, password });
    const authResponse = response.data as AuthResponse;

    tokenStorage.setToken(authResponse.accessToken);
    tokenStorage.setUser(authResponse.user as StoredUser);
    setUser(authResponse.user);
  };

  const signup = async (data: SignupRequest): Promise<void> => {
    const response = await apiSignup(data);
    const authResponse = response.data as AuthResponse;

    tokenStorage.setToken(authResponse.accessToken);
    tokenStorage.setUser(authResponse.user as StoredUser);
    setUser(authResponse.user);
  };

  const azureLogin = async (idToken: string): Promise<void> => {
    const response = await apiAzureLogin({ idToken });
    const authResponse = response.data as AuthResponse;

    tokenStorage.setToken(authResponse.accessToken);
    tokenStorage.setUser(authResponse.user as StoredUser);
    setUser(authResponse.user);
  };

  const logout = (): void => {
    tokenStorage.clear();
    setUser(null);
  };

  const updateUser = (updatedUser: UserResponse): void => {
    tokenStorage.setUser(updatedUser as StoredUser);
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    login,
    signup,
    azureLogin,
    logout,
    updateUser,
    isAuthenticated: !!tokenStorage.getToken() && !isTokenExpired(tokenStorage.getToken()!),
    loading,
    sessionExpiring,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
