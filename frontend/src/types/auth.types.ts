export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  is_active: boolean; // ← Changed from is_deleted (backend uses is_active)
  max_users: number;
  max_storage_mb: number;
  created_at: string;
}

export interface Membership {
  id: string;
  user: string; // UUID string
  company: string; // ← FIXED: UUID string, not Company object
  role: "owner" | "admin" | "manager" | "analyst" | "auditor" | "viewer";
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;

  // Additional fields from backend serializer
  user_email?: string;
  user_name?: string;
  company_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  companies?: Array<{
    // ← Made optional since not always present
    id: string;
    name: string;
    role: string;
  }>;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
}

export interface AuthState {
  user: User | null;
  company: Company | null;
  membership: Membership | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  page_size?: number | null; // ← Made optional
  results: T[];
}
