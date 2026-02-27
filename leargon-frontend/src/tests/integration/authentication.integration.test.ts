import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, login, withToken, ApiError } from './testClient';
import type { AxiosInstance } from 'axios';

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
});
