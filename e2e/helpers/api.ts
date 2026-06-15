import { E2E_API_URL, E2E_PASS, E2E_USER } from './env';

export interface AuthSession {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
    name: string;
    permissions?: string[];
    dialysisPrimaryHospitalId?: number | null;
  };
}

export interface HospitalRow {
  id: number;
  name: string;
  code?: string | null;
}

export interface LocationRow {
  id: number;
  hallName: string;
  bedCode: string;
}

async function apiRequest<T>(
  method: string,
  path: string,
  opts: { token?: string; query?: Record<string, string | number>; body?: unknown } = {}
): Promise<{ status: number; data: T }> {
  const url = new URL(path, E2E_API_URL);
  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: T;
  try {
    data = text ? JSON.parse(text) : (null as T);
  } catch {
    data = text as T;
  }
  return { status: res.status, data };
}

let cachedSession: AuthSession | null = null;

export async function apiLogin(
  username = E2E_USER,
  password = E2E_PASS
): Promise<AuthSession> {
  if (cachedSession && username === E2E_USER && password === E2E_PASS) {
    return cachedSession;
  }
  const { status, data } = await apiRequest<{ token?: string; user?: AuthSession['user']; error?: string }>(
    'POST',
    '/api/auth/login',
    { body: { username, password } }
  );
  if (status !== 200 || !data.token || !data.user) {
    throw new Error(data.error || `Login failed HTTP ${status}`);
  }
  cachedSession = { token: data.token, user: data.user };
  return cachedSession;
}

export async function apiGetHospitals(token: string): Promise<HospitalRow[]> {
  const { status, data } = await apiRequest<HospitalRow[]>('GET', '/api/dialysis/hospitals', { token });
  if (status !== 200 || !Array.isArray(data) || !data.length) {
    throw new Error(`No hospitals HTTP ${status}`);
  }
  return data;
}

export async function apiGetLocations(token: string, hospitalId: number): Promise<LocationRow[]> {
  const { status, data } = await apiRequest<LocationRow[]>('GET', '/api/dialysis/locations', {
    token,
    query: { hospital_id: hospitalId },
  });
  if (status !== 200 || !Array.isArray(data) || !data.length) {
    throw new Error(`No locations HTTP ${status}`);
  }
  return data;
}

export async function apiCreateEmergencyPatient(
  token: string,
  hospitalId: number,
  fullName: string
): Promise<{ id: number; fullName: string }> {
  const { status, data } = await apiRequest<{ id: number; fullName: string; error?: string }>(
    'POST',
    '/api/dialysis/patients',
    {
      token,
      query: { hospital_id: hospitalId },
      body: {
        kind: 'EMERGENCY',
        full_name: fullName,
        gender: 'MALE',
        phone: '07700000001',
        address_line: 'عنوان اختبار E2E',
      },
    }
  );
  if (status !== 200 && status !== 201) {
    throw new Error(data.error || `Create patient failed HTTP ${status}`);
  }
  return data;
}

export async function apiDeletePatient(token: string, hospitalId: number, patientId: number): Promise<void> {
  const { status, data } = await apiRequest<{ error?: string }>(
    'DELETE',
    `/api/dialysis/patients/${patientId}`,
    { token, query: { hospital_id: hospitalId } }
  );
  if (status !== 200) {
    throw new Error((data as { error?: string })?.error || `Delete patient failed HTTP ${status}`);
  }
}

export async function apiCreateSession(
  token: string,
  hospitalId: number,
  patientId: number,
  locationId: number
): Promise<{ id: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { status, data } = await apiRequest<{ id: number; error?: string }>(
    'POST',
    '/api/dialysis/sessions',
    {
      token,
      query: { hospital_id: hospitalId },
      body: {
        dialysis_patient_id: patientId,
        session_date: today,
        location_id: locationId,
        started_at: new Date().toISOString(),
        status: 'ACTIVE',
      },
    }
  );
  if (status !== 200 && status !== 201) {
    throw new Error(data.error || `Create session failed HTTP ${status}`);
  }
  return data;
}

export async function apiDeleteSession(token: string, hospitalId: number, sessionId: number): Promise<void> {
  const { status, data } = await apiRequest<{ error?: string }>(
    'DELETE',
    `/api/dialysis/sessions/${sessionId}`,
    { token, query: { hospital_id: hospitalId } }
  );
  if (status !== 200) {
    throw new Error((data as { error?: string })?.error || `Delete session failed HTTP ${status}`);
  }
}

export async function apiHealthOk(): Promise<boolean> {
  try {
    const { status, data } = await apiRequest<{ status?: string }>('GET', '/api/health');
    return status === 200 && data.status === 'OK';
  } catch {
    return false;
  }
}
