const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface StoredUser {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: string[];
  enabled: boolean;
  isFallbackAdministrator: boolean;
  setupCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export const tokenStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  getUser(): StoredUser | null {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  setUser(user: StoredUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  clear(): void {
    this.removeToken();
    this.removeUser();
  },
};
