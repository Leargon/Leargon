import axios, { type AxiosInstance } from 'axios';
import type { SignupRequest } from '@/api/generated/model/signupRequest';
import type { AuthResponse } from '@/api/generated/model/authResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';
import type { CreateProcessRequest } from '@/api/generated/model/createProcessRequest';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { BusinessDomainResponse } from '@/api/generated/model/businessDomainResponse';
import type { ClassificationResponse } from '@/api/generated/model/classificationResponse';
import type { OrganisationalUnitResponse } from '@/api/generated/model/organisationalUnitResponse';
import type { UserResponse } from '@/api/generated/model/userResponse';

export function createClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
  });
}

export function withToken(client: AxiosInstance, token: string): AxiosInstance {
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return client;
}

export async function signup(
  client: AxiosInstance,
  data: SignupRequest,
): Promise<AuthResponse> {
  const res = await client.post<AuthResponse>('/authentication/signup', data);
  if (res.status !== 200) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

export async function login(
  client: AxiosInstance,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await client.post<AuthResponse>('/authentication/login', {
    email,
    password,
  });
  if (res.status !== 200) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

export async function createProcess(
  client: AxiosInstance,
  name: string,
  extras?: Partial<CreateProcessRequest>,
): Promise<ProcessResponse> {
  const body: CreateProcessRequest = {
    names: [{ locale: 'en', text: name }],
    ...extras,
  };
  const res = await client.post<ProcessResponse>('/processes', body);
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

export async function createEntity(
  client: AxiosInstance,
  name: string,
): Promise<BusinessEntityResponse> {
  const body = { names: [{ locale: 'en', text: name }] };
  const res = await client.post<BusinessEntityResponse>('/business-entities', body);
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

export async function signupAdmin(
  client: AxiosInstance,
  data: SignupRequest,
): Promise<AuthResponse> {
  // Sign up the user
  await signup(client, data);

  // Login as fallback admin to promote the user
  const adminAuth = await login(client, 'admin@e2e-test.local', 'AdminPass123!');
  const adminClient = createClient(client.defaults.baseURL!);
  withToken(adminClient, adminAuth.accessToken);

  // Find the user to get their ID
  const usersRes = await adminClient.get<UserResponse[]>('/administration/users');
  const user = usersRes.data.find((u) => u.email === data.email);
  if (!user) throw new Error(`User ${data.email} not found after signup`);

  // Promote to admin
  await adminClient.put(`/administration/users/${user.id}`, {
    roles: ['ROLE_USER', 'ROLE_ADMIN'],
  });

  // Re-login as the promoted user to get a token with admin roles
  return login(client, data.email, data.password);
}

export async function createDomain(
  client: AxiosInstance,
  name: string,
  extras?: Record<string, unknown>,
): Promise<BusinessDomainResponse> {
  const body = {
    names: [{ locale: 'en', text: name }],
    ...extras,
  };
  const res = await client.post<BusinessDomainResponse>('/business-domains', body);
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

export async function createClassification(
  client: AxiosInstance,
  name: string,
  assignableTo: string,
  values: Array<{ key: string; names: Array<{ locale: string; text: string }> }> = [],
): Promise<ClassificationResponse> {
  const body = {
    names: [{ locale: 'en', text: name }],
    assignableTo,
  };
  const res = await client.post<ClassificationResponse>('/classifications', body);
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }

  // Values must be added separately via individual POST calls
  for (const value of values) {
    const valRes = await client.post(`/classifications/${res.data.key}/values`, value);
    if (valRes.status !== 201) {
      throw new ApiError(valRes.status, valRes.data);
    }
  }

  // Re-fetch to get the full classification with values
  if (values.length > 0) {
    const getRes = await client.get<ClassificationResponse>(`/classifications/${res.data.key}`);
    if (getRes.status !== 200) {
      throw new ApiError(getRes.status, getRes.data);
    }
    return getRes.data;
  }

  return res.data;
}

export async function createOrgUnit(
  client: AxiosInstance,
  name: string,
  extras?: Record<string, unknown>,
): Promise<OrganisationalUnitResponse> {
  const body = {
    names: [{ locale: 'en', text: name }],
    ...extras,
  };
  const res = await client.post<OrganisationalUnitResponse>('/organisational-units', body);
  if (res.status !== 201) {
    throw new ApiError(res.status, res.data);
  }
  return res.data;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}
