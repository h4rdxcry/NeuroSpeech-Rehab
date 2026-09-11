/**
 * NeuroSpeech Rehab - Production Central API Client
 * Strict Zero Fake Functionality: Direct binding to FastAPI backend endpoints.
 */

function resolveInitialBaseUrl(): string {
  try {
    const custom = localStorage.getItem('neurospeech_custom_api_url');
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch {}
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && envUrl.trim().startsWith('http')) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export let API_BASE_URL = resolveInitialBaseUrl();

export function setApiBaseUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  API_BASE_URL = clean;
  try {
    localStorage.setItem('neurospeech_custom_api_url', clean);
  } catch {}
}

const TOKEN_KEY = 'neurospeech_access_token';
const REFRESH_TOKEN_KEY = 'neurospeech_refresh_token';

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken?: string, persist: boolean = true): void {
  try {
    const storage = persist ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch (e) {
    console.error('Failed to store auth tokens:', e);
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (e) {
    console.error('Failed to clear auth tokens:', e);
  }
}

export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail: unknown;
    let message = `API request failed with status ${response.status}`;
    try {
      const data = await response.json();
      errorDetail = data;
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        message = data.detail[0].msg;
      }
    } catch {
      message = response.statusText || message;
    }

    const err: ApiError = {
      status: response.status,
      message,
      detail: errorDetail,
    };
    throw err;
  }

  // Check if response has content
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return {} as T;
}

// =========================================================================
// API Sub-Modules
// =========================================================================

export const healthApi = {
  checkHealth: async (): Promise<{ status: string; version: string; pingMs: number }> => {
    const t0 = performance.now();
    const data = await apiRequest<{ status: string; version: string }>('/health');
    const pingMs = Math.round(performance.now() - t0);
    return { ...data, pingMs };
  },
};

export const authApi = {
  login: async (email: string, password: string): Promise<{ access_token: string; refresh_token: string; token_type: string }> => {
    return apiRequest<{ access_token: string; refresh_token: string; token_type: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getMe: async (): Promise<{ id: string; email: string; is_active: boolean; role: { id: string; name: string } }> => {
    return apiRequest<{ id: string; email: string; is_active: boolean; role: { id: string; name: string } }>('/api/v1/auth/me');
  },
  logout: async (): Promise<{ detail: string }> => {
    try {
      return await apiRequest<{ detail: string }>('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },
};

export const rehabApi = {
  getProgress: async (patientId?: string): Promise<{
    id: string;
    patient_id: string;
    current_level: number;
    highest_unlocked_level: number;
    completed_levels: number[];
    streak_count: number;
    longest_streak: number;
    last_practice_date: string | null;
  }> => {
    const query = patientId ? `?patient_id=${patientId}` : '';
    return apiRequest(`/api/v1/rehabilitation/progress${query}`);
  },

  submitAttempt: async (payload: {
    level_number: number;
    target_text: string;
    language: string;
    recognized_transcript?: string | null;
    recording_duration_seconds?: number;
    peak_audio_level?: number;
    lip_aperture_ratio?: number;
    mouth_width_ratio?: number;
    target_vowel_type?: string;
    landmarks_sequence?: number[][][];
    mouth_frames_sequence?: unknown[];
    session_id?: string;
  }): Promise<{
    attempt_id: string;
    level_number: number;
    target_text: string;
    language: string;
    transcript: string | null;
    speech_detected: boolean;
    match_score: number;
    is_success: boolean;
    feedback_message: string;
    actionable_tip?: string;
    current_level: number;
    highest_unlocked_level: number;
    completed_levels: number[];
    streak_count: number;
    rehab_summary?: Record<string, unknown>;
  }> => {
    return apiRequest('/api/v1/rehabilitation/attempt', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  resetProgress: async (patientId?: string): Promise<unknown> => {
    const query = patientId ? `?patient_id=${patientId}` : '';
    return apiRequest(`/api/v1/rehabilitation/reset-progress${query}`, { method: 'POST' });
  },
};

export const cameraApi = {
  trackFrame: async (imageBase64: string): Promise<{
    status: 'TRACKED' | 'NO_FACE';
    landmarks?: number[][];
    tracker_version?: string;
    lip_aperture_ratio?: number;
    mouth_width_ratio?: number;
    lip_aspect_ratio?: number;
    jaw_depression?: number;
  }> => {
    return apiRequest('/api/v1/research-signals/camera/track-frame', {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64 }),
    });
  },
};

export const sessionsApi = {
  listSessions: async (params: { participant_id?: string; skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.participant_id) searchParams.set('participant_id', params.participant_id);
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/sessions/sessions${qs}`);
  },
};

export const participantsApi = {
  listPatients: async (params: { skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/participants/patients${qs}`);
  },
  listResearchParticipants: async (params: { skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/participants/research-participants${qs}`);
  },
  getMyPatient: async (): Promise<any> => {
    return apiRequest('/api/v1/participants/me');
  },
};

export const recordingsApi = {
  listRecordings: async (params: { session_id?: string; skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.session_id) searchParams.set('session_id', params.session_id);
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/recordings/recordings${qs}`);
  },
};

export const datasetsApi = {
  listDatasets: async (params: { skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/datasets/datasets${qs}`);
  },
  listProvenances: async (): Promise<any[]> => {
    return apiRequest('/api/v1/datasets/provenances');
  },
  listSplits: async (): Promise<any[]> => {
    return apiRequest('/api/v1/datasets/splits');
  },
};

export const modelsApi = {
  listModelVersions: async (params: { skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/model-versions/model-versions${qs}`);
  },
  listEvaluationRuns: async (params: { skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/evaluation-runs/evaluation-runs${qs}`);
  },
};

export const annotationsApi = {
  listAnnotations: async (params: { recording_id?: string; skip?: number; limit?: number } = {}): Promise<any[]> => {
    const searchParams = new URLSearchParams();
    if (params.recording_id) searchParams.set('recording_id', params.recording_id);
    if (params.skip) searchParams.set('skip', String(params.skip));
    if (params.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest(`/api/v1/annotations/annotations${qs}`);
  },
};
