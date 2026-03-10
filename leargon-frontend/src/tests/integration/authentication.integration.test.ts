import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, login, signupAdmin, withToken, ApiError } from './testClient';
import type { AxiosInstance } from 'axios';
import type { UserResponse } from '@/api/generated/model/userResponse';
import type { SupportedLocaleResponse } from '@/api/generated/model/supportedLocaleResponse';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Authentication E2E', () => {
  let client: AxiosInstance;

  beforeAll(() => {
    client = createClient(getBackendUrl());
  });

  // =====================
  // SIGNUP
  // =====================

  it('should sign up a new user and return token + user data', async () => {
    const auth = await signup(client, {
      email: 'fe-auth-signup@example.com',
      username: 'feauthsignup',
      password: 'password123',
      firstName: 'Auth',
      lastName: 'Signup',
    });

    expect(auth.accessToken).toBeTruthy();
    expect(auth.accessToken.length).toBeGreaterThan(0);
    expect(auth.user).toBeDefined();
    expect(auth.user.email).toBe('fe-auth-signup@example.com');
    expect(auth.user.username).toBe('feauthsignup');
    expect(auth.user.firstName).toBe('Auth');
    expect(auth.user.lastName).toBe('Signup');
  });

  it('should reject signup with duplicate email', async () => {
    await signup(client, {
      email: 'fe-auth-dupe@example.com',
      username: 'feauthdupe1',
      password: 'password123',
      firstName: 'Dupe',
      lastName: 'Test',
    });

    try {
      await signup(client, {
        email: 'fe-auth-dupe@example.com',
        username: 'feauthdupe2',
        password: 'password123',
        firstName: 'Dupe',
        lastName: 'Test',
      });
      expect.fail('Expected signup to fail');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(409);
    }
  });

  // =====================
  // LOGIN
  // =====================

  it('should login with valid credentials', async () => {
    await signup(client, {
      email: 'fe-auth-login@example.com',
      username: 'feauthlogin',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    });

    const auth = await login(client, 'fe-auth-login@example.com', 'password123');
    expect(auth.accessToken).toBeTruthy();
  });

  it('should reject login with wrong password', async () => {
    await signup(client, {
      email: 'fe-auth-wrongpw@example.com',
      username: 'feauthwrongpw',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    });

    try {
      await login(client, 'fe-auth-wrongpw@example.com', 'wrongpassword');
      expect.fail('Expected login to fail');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(401);
    }
  });

  // =====================
  // TOKEN VALIDATION
  // =====================

  it('should reject unauthenticated access to protected endpoints', async () => {
    const res = await client.get('/business-entities');
    expect(res.status).toBe(401);
  });

  it('should reject access with invalid token', async () => {
    const res = await client.get('/users/me', {
      headers: { Authorization: 'Bearer invalid.token.value' },
    });
    expect(res.status).toBe(401);
  });

  // =====================
  // USER PROFILE
  // =====================

  it('should return current user profile via /users/me', async () => {
    const auth = await signup(client, {
      email: 'fe-auth-me@example.com',
      username: 'feauthme',
      password: 'password123',
      firstName: 'My',
      lastName: 'Profile',
    });

    const authedClient = createClient(getBackendUrl());
    withToken(authedClient, auth.accessToken);

    const res = await authedClient.get('/users/me');
    expect(res.status).toBe(200);
    expect(res.data.email).toBe('fe-auth-me@example.com');
    expect(res.data.username).toBe('feauthme');
    expect(res.data.firstName).toBe('My');
    expect(res.data.lastName).toBe('Profile');
    expect(res.data.enabled).toBe(true);
  });

  // =====================
  // CHANGE OWN PASSWORD
  // =====================

  it('should allow user to change their own password', async () => {
    const auth = await signup(client, {
      email: 'fe-auth-chpw@example.com',
      username: 'feauthchpw',
      password: 'oldPassword123',
      firstName: 'Change',
      lastName: 'Password',
    });

    const authedClient = createClient(getBackendUrl());
    withToken(authedClient, auth.accessToken);

    const res = await authedClient.post('/users/me/password', {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });
    expect(res.status).toBe(200);

    // Old password no longer works
    try {
      await login(client, 'fe-auth-chpw@example.com', 'oldPassword123');
      expect.fail('Expected login to fail with old password');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(401);
    }

    // New password works
    const newAuth = await login(client, 'fe-auth-chpw@example.com', 'newPassword456');
    expect(newAuth.accessToken).toBeTruthy();
  });

  it('should reject own password change with wrong current password', async () => {
    const auth = await signup(client, {
      email: 'fe-auth-wrongcurr@example.com',
      username: 'feauthwrongcurr',
      password: 'correctPass123',
      firstName: 'Wrong',
      lastName: 'Current',
    });

    const authedClient = createClient(getBackendUrl());
    withToken(authedClient, auth.accessToken);

    const res = await authedClient.post('/users/me/password', {
      currentPassword: 'wrongCurrentPass',
      newPassword: 'newPassword456',
    });
    expect(res.status).toBe(401);
  });

  // =====================
  // USER MANAGEMENT (ADMIN)
  // =====================

  it('should list all users as admin', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-auth-listadmin@example.com',
      username: 'feauthlistadmin',
      password: 'password123',
      firstName: 'List',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const res = await adminClient.get<UserResponse[]>('/administration/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('should create user as admin', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-auth-createadmin@example.com',
      username: 'feauthcreateadmin',
      password: 'password123',
      firstName: 'Create',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const res = await adminClient.post('/administration/users', {
      email: 'fe-auth-adminmade@example.com',
      username: 'feauthadminmade',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'Made',
    });
    expect(res.status).toBe(201);
    expect(res.data.email).toBe('fe-auth-adminmade@example.com');
    expect(res.data.enabled).toBe(true);
  });

  it('should reject user list for non-admin', async () => {
    const userAuth = await signup(client, {
      email: 'fe-auth-noadmin@example.com',
      username: 'feauthnoadmin',
      password: 'password123',
      firstName: 'No',
      lastName: 'Admin',
    });

    const userClient = createClient(getBackendUrl());
    withToken(userClient, userAuth.accessToken);

    const res = await userClient.get('/administration/users');
    expect(res.status).toBe(403);
  });

  it('should disable and re-enable a user as admin', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-auth-disableadmin@example.com',
      username: 'feauthdisableadmin',
      password: 'password123',
      firstName: 'Disable',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    // Create a target user
    const targetAuth = await signup(client, {
      email: 'fe-auth-target@example.com',
      username: 'feauthtarget',
      password: 'password123',
      firstName: 'Target',
      lastName: 'User',
    });

    // Find user ID
    const usersRes = await adminClient.get<UserResponse[]>('/administration/users');
    const targetUser = usersRes.data.find((u) => u.email === 'fe-auth-target@example.com');
    expect(targetUser).toBeTruthy();
    const userId = targetUser!.id;

    // Disable
    const disableRes = await adminClient.post(`/administration/users/${userId}/disable`);
    expect(disableRes.status).toBe(200);
    expect(disableRes.data.enabled).toBe(false);

    // Disabled user cannot login
    try {
      await login(client, 'fe-auth-target@example.com', 'password123');
      expect.fail('Expected login to fail for disabled user');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(401);
    }

    // Re-enable
    const enableRes = await adminClient.post(`/administration/users/${userId}/enable`);
    expect(enableRes.status).toBe(200);
    expect(enableRes.data.enabled).toBe(true);

    // Re-enabled user can login
    const reloginAuth = await login(client, 'fe-auth-target@example.com', 'password123');
    expect(reloginAuth.accessToken).toBeTruthy();

    expect(targetAuth).toBeDefined();
  });

  it('should change user password as admin', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-auth-pwadmin@example.com',
      username: 'feauthpwadmin',
      password: 'password123',
      firstName: 'PW',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    // Create target user
    await signup(client, {
      email: 'fe-auth-pwreset@example.com',
      username: 'feauthpwreset',
      password: 'oldPassword123',
      firstName: 'PW',
      lastName: 'Reset',
    });

    // Find user ID
    const usersRes = await adminClient.get<UserResponse[]>('/administration/users');
    const targetUser = usersRes.data.find((u) => u.email === 'fe-auth-pwreset@example.com');
    const userId = targetUser!.id;

    // Admin resets password
    const res = await adminClient.put(`/administration/users/${userId}/password`, {
      newPassword: 'adminReset456',
    });
    expect(res.status).toBe(200);

    // User can login with new password
    const newAuth = await login(client, 'fe-auth-pwreset@example.com', 'adminReset456');
    expect(newAuth.accessToken).toBeTruthy();
  });

  it('should hard-delete a user with no ownership as admin', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-auth-deladmin@example.com',
      username: 'feauthdeladmin',
      password: 'password123',
      firstName: 'Del',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    // Create target user
    await signup(client, {
      email: 'fe-auth-deluser@example.com',
      username: 'feauthdeluser',
      password: 'password123',
      firstName: 'Del',
      lastName: 'User',
    });

    const usersRes = await adminClient.get<UserResponse[]>('/administration/users');
    const targetUser = usersRes.data.find((u) => u.email === 'fe-auth-deluser@example.com');
    const userId = targetUser!.id;

    // Hard-delete returns 204 with no body
    const delRes = await adminClient.delete(`/administration/users/${userId}`);
    expect(delRes.status).toBe(204);

    // User is permanently removed — no longer appears in the list
    const afterRes = await adminClient.get<UserResponse[]>('/administration/users');
    expect(afterRes.data.find((u) => u.id === userId)).toBeUndefined();
  });

  // =====================
  // LOCALE MANAGEMENT
  // =====================

  it('should list supported locales', async () => {
    const auth = await signup(client, {
      email: 'fe-auth-locale@example.com',
      username: 'feauthlocale',
      password: 'password123',
      firstName: 'Locale',
      lastName: 'Tester',
    });

    const authedClient = createClient(getBackendUrl());
    withToken(authedClient, auth.accessToken);

    const res = await authedClient.get<SupportedLocaleResponse[]>('/locales');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);

    const enLocale = res.data.find((l) => l.localeCode === 'en');
    expect(enLocale).toBeTruthy();
    expect(enLocale!.isDefault).toBe(true);
    expect(enLocale!.isActive).toBe(true);
  });

  it('should update locale display name as admin', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-auth-localeadmin@example.com',
      username: 'feauthlocaleadmin',
      password: 'password123',
      firstName: 'Locale',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const localesRes = await adminClient.get<SupportedLocaleResponse[]>('/locales');
    const enLocale = localesRes.data.find((l) => l.localeCode === 'en');
    expect(enLocale).toBeTruthy();

    // Update display name
    const updateRes = await adminClient.put(`/locales/${enLocale!.id}`, {
      displayName: 'English',
      isActive: true,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.data.displayName).toBe('English');
  });
});
