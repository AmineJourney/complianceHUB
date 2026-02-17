# Frontend Implementation Guide
## ComplianceOS — Step-by-Step from Zero

---

## Prerequisites

Install these before starting:

```bash
# Verify Node.js (need v20+)
node --version

# Verify npm (need v10+)
npm --version
```

If Node is missing, download from https://nodejs.org (choose LTS).

---

## STEP 1 — Scaffold the Project

```bash
# Navigate to your project root (where your backend/ folder lives)
cd complianceos

# Create the React + TypeScript + Vite project
npm create vite@latest frontend -- --template react-ts

# Move into the new folder
cd frontend

# Install base dependencies
npm install
```

You should now have this structure:
```
frontend/
├── public/
├── src/
│   ├── assets/
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## STEP 2 — Install All Dependencies

Run these one at a time so you can catch any errors:

```bash
# Routing
npm install react-router-dom

# Server state (data fetching)
npm install @tanstack/react-query

# Client state
npm install zustand

# HTTP client
npm install axios

# Radix UI primitives (used by shadcn components)
npm install @radix-ui/react-dialog \
            @radix-ui/react-dropdown-menu \
            @radix-ui/react-slot

# Styling utilities
npm install class-variance-authority clsx tailwind-merge

# Icons
npm install lucide-react

# Charts
npm install recharts

# Forms and validation
npm install react-hook-form zod

# Date formatting
npm install date-fns

# Tailwind CSS + Vite plugin
npm install -D tailwindcss postcss autoprefixer \
               tailwindcss-animate \
               @tailwindcss/forms

# Type definitions
npm install -D @types/react @types/react-dom @types/node
```

Verify your `package.json` dependencies look similar to:

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-slot": "^1.0.2",
    "@tanstack/react-query": "^5.17.0",
    "axios": "^1.6.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.303.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.49.0",
    "react-router-dom": "^6.21.0",
    "recharts": "^2.10.0",
    "tailwind-merge": "^2.2.0",
    "zod": "^3.22.0",
    "zustand": "^4.4.7"
  }
}
```

---

## STEP 3 — Configure Tailwind CSS

```bash
# Generate tailwind and postcss config files
npx tailwindcss init -p
```

Replace the entire contents of `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

---

## STEP 4 — Configure Vite

Replace `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

Update `tsconfig.json` to support path aliases:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## STEP 5 — Set Up CSS Variables

Replace `src/index.css` completely:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Delete `src/App.css` (we won't use it).

---

## STEP 6 — Create the Folder Structure

Run this entire block to create every folder at once:

```bash
mkdir -p src/api
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/common
mkdir -p src/features/auth
mkdir -p src/features/dashboard
mkdir -p src/features/controls
mkdir -p src/features/evidence
mkdir -p src/features/risk
mkdir -p src/features/compliance
mkdir -p src/hooks
mkdir -p src/lib
mkdir -p src/stores
mkdir -p src/types
```

Verify the structure:
```bash
find src -type d
```

---

## STEP 7 — Create Environment File

Create `.env` in the `frontend/` root:

```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=ComplianceOS
```

Create `.env.example` as a template for teammates:

```bash
cp .env .env.example
```

Add `.env` to `.gitignore` (it should already be there from Vite, but verify):

```bash
echo ".env" >> .gitignore
```

---

## STEP 8 — Create Utility Files

### `src/lib/utils.ts`

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
```

### `src/lib/constants.ts`

```ts
export const RISK_LEVELS = {
  low: { label: 'Low', color: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800' },
} as const

export const COMPLIANCE_STATUS = {
  compliant: { label: 'Compliant', color: 'bg-green-100 text-green-800' },
  mostly_compliant: { label: 'Mostly Compliant', color: 'bg-blue-100 text-blue-800' },
  partially_compliant: { label: 'Partial', color: 'bg-yellow-100 text-yellow-800' },
  non_compliant: { label: 'Non-Compliant', color: 'bg-red-100 text-red-800' },
} as const

export const CONTROL_STATUS = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-800' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  implemented: { label: 'Implemented', color: 'bg-purple-100 text-purple-800' },
  testing: { label: 'Testing', color: 'bg-yellow-100 text-yellow-800' },
  operational: { label: 'Operational', color: 'bg-green-100 text-green-800' },
  needs_improvement: { label: 'Needs Improvement', color: 'bg-orange-100 text-orange-800' },
  non_compliant: { label: 'Non-Compliant', color: 'bg-red-100 text-red-800' },
} as const

export const EVIDENCE_STATUS = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  needs_update: { label: 'Needs Update', color: 'bg-orange-100 text-orange-800' },
} as const

export const ROLES = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  analyst: 'Analyst',
  auditor: 'Auditor',
  viewer: 'Viewer',
} as const
```

---

## STEP 9 — Create TypeScript Types

### `src/types/auth.types.ts`

```ts
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  date_joined: string
}

export interface Company {
  id: string
  name: string
  plan: 'free' | 'starter' | 'professional' | 'enterprise'
  is_active: boolean
  created_at: string
}

export interface Membership {
  id: string
  user: string
  company: string
  role: 'owner' | 'admin' | 'manager' | 'analyst' | 'auditor' | 'viewer'
  is_active: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access: string
  refresh: string
  companies: Company[]
}

export interface RegisterRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  company_name?: string
}

export interface AuthState {
  user: User | null
  company: Company | null
  membership: Membership | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}
```

### `src/types/control.types.ts`

```ts
export interface ReferenceControl {
  id: string
  code: string
  name: string
  description: string
  control_family: string
  control_type: 'preventive' | 'detective' | 'corrective' | 'directive'
  automation_level: 'manual' | 'semi_automated' | 'automated'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
}

export interface AppliedControl {
  id: string
  company: string
  reference_control: string
  reference_control_code: string
  reference_control_name: string
  department?: string
  department_name?: string
  control_owner?: string
  control_owner_email?: string
  status: 'not_started' | 'in_progress' | 'implemented' | 'testing' | 'operational' | 'needs_improvement' | 'non_compliant'
  implementation_notes: string
  effectiveness_rating?: number
  compliance_score: number
  evidence_count: number
  has_deficiencies: boolean
  is_overdue: boolean
  last_tested_date?: string
  next_review_date?: string
  created_at: string
  updated_at: string
}

export interface ControlDashboard {
  total_controls: number
  avg_compliance_score: number
  evidence_coverage_percentage: number
  controls_with_deficiencies: number
  overdue_reviews: number
  status_breakdown: Array<{ status: string; count: number }>
}
```

### `src/types/risk.types.ts`

```ts
export interface RiskMatrix {
  id: string
  name: string
  likelihood_levels: number
  impact_levels: number
  risk_score_matrix: Record<string, number>
  low_threshold: number
  medium_threshold: number
  high_threshold: number
  is_active: boolean
}

export interface Risk {
  id: string
  risk_id?: string
  company: string
  title: string
  description: string
  risk_category: string
  risk_source: 'internal' | 'external' | 'both'
  inherent_likelihood: number
  inherent_impact: number
  inherent_risk_score: number
  inherent_risk_level: 'low' | 'medium' | 'high' | 'critical'
  treatment_strategy: 'mitigate' | 'transfer' | 'accept' | 'avoid'
  treatment_plan?: string
  potential_causes?: string
  potential_consequences?: string
  status: string
  risk_owner?: string
  risk_owner_email?: string
  next_review_date?: string
  is_overdue: boolean
  residual_risk_data: {
    residual_score: number
    residual_level: string
    control_count: number
    avg_effectiveness: number
    risk_reduction: number
  }
  created_at: string
}

export interface RiskAssessment {
  id: string
  risk: string
  applied_control: string
  control_code: string
  control_name: string
  control_effectiveness: number
  effectiveness_rating: number
  residual_likelihood: number
  residual_impact: number
  residual_score: number
  residual_risk_level: string
  risk_reduction: number
  assessment_notes?: string
  created_at: string
}

export interface RiskEvent {
  id: string
  risk: string
  title: string
  description: string
  occurred_at: string
  actual_impact?: string
  financial_impact?: number
  is_resolved: boolean
  resolved_at?: string
  created_at: string
}

export interface RiskTreatmentAction {
  id: string
  risk: string
  action_title: string
  action_description: string
  action_type: string
  status: string
  due_date: string
  progress_percentage: number
  estimated_cost?: number
  actual_cost?: number
  created_at: string
}
```

### `src/types/compliance.types.ts`

```ts
export interface ComplianceResult {
  id: string
  company: string
  framework: string
  framework_code: string
  framework_name: string
  compliance_score: number
  coverage_percentage: number
  compliance_status: string
  compliance_grade: string
  total_requirements: number
  requirements_compliant: number
  requirements_partial: number
  requirements_non_compliant: number
  total_controls: number
  controls_operational: number
  controls_implemented: number
  controls_in_progress: number
  controls_not_started: number
  gap_count: number
  requirement_details: Record<string, any>
  is_current: boolean
  calculated_at: string
}

export interface ComplianceOverview {
  total_frameworks: number
  avg_compliance_score: number
  frameworks: Array<{
    framework_id: string
    framework_code: string
    framework_name: string
    compliance_score: number
    coverage_percentage: number
    grade: string
    status: string
    gap_count: number
  }>
}

export interface FrameworkAdoption {
  id: string
  company: string
  framework: string
  framework_code: string
  framework_name: string
  adoption_status: string
  target_completion_date?: string
  scope_description?: string
  is_certified: boolean
  certification_body?: string
  certification_date?: string
  certification_expiry_date?: string
  certificate_number?: string
  is_certification_expired: boolean
  is_audit_overdue: boolean
  created_at: string
}
```

---

## STEP 10 — Create the API Client

### `src/api/client.ts`

```ts
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
apiClient.interceptors.request.use((config) => {
  // Import inline to avoid circular dependency
  const raw = localStorage.getItem('auth-storage')
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const token = parsed?.state?.accessToken
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // ignore parse errors
    }
  }
  return config
})

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      try {
        const raw = localStorage.getItem('auth-storage')
        const parsed = raw ? JSON.parse(raw) : null
        const refreshToken = parsed?.state?.refreshToken

        if (!refreshToken) throw new Error('No refresh token')

        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/auth/token/refresh/`,
          { refresh: refreshToken }
        )

        const newAccess = response.data.access

        // Update stored token
        if (parsed?.state) {
          parsed.state.accessToken = newAccess
          localStorage.setItem('auth-storage', JSON.stringify(parsed))
        }

        original.headers.Authorization = `Bearer ${newAccess}`
        return apiClient(original)
      } catch {
        // Refresh failed — clear storage and redirect
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string') return data
    if (data?.detail) return data.detail
    if (data?.non_field_errors) return data.non_field_errors.join(', ')
    const firstKey = Object.keys(data || {})[0]
    if (firstKey) return `${firstKey}: ${data[firstKey]}`
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}

export default apiClient
```

### `src/api/auth.ts`

```ts
import apiClient from './client'
import type { User, Company, LoginRequest, LoginResponse, RegisterRequest } from '@/types/auth.types'

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/token/', data)
    return response.data
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/core/users/register/', data)
    return response.data
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post('/auth/token/refresh/', { refresh })
    return response.data
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/core/users/me/')
    return response.data
  },

  getCompanies: async (): Promise<Company[]> => {
    const response = await apiClient.get('/core/companies/')
    return response.data.results || response.data
  },

  createCompany: async (name: string): Promise<Company> => {
    const response = await apiClient.post<Company>('/core/companies/', { name })
    return response.data
  },
}
```

---

## STEP 11 — Create Zustand Stores

### `src/stores/authStore.ts`

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Company, Membership, AuthState } from '@/types/auth.types'

interface AuthStore extends AuthState {
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  setCompany: (company: Company, membership: Membership) => void
  setAccessToken: (token: string) => void
  logout: () => void
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      company: null,
      membership: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setCompany: (company, membership) =>
        set({ company, membership }),

      setAccessToken: (token) => set({ accessToken: token }),

      logout: () =>
        set({
          user: null, company: null, membership: null,
          accessToken: null, refreshToken: null, isAuthenticated: false,
        }),

      hasPermission: (permission: string) => {
        const { membership } = get()
        if (!membership) return false
        const rolePermissions: Record<string, string[]> = {
          owner: ['*'],
          admin: ['view_any', 'create_any', 'update_any', 'delete_any', 'manage_users'],
          manager: ['view_any', 'create_any', 'update_own', 'delete_own'],
          analyst: ['view_any', 'create_evidence', 'update_own'],
          auditor: ['view_any', 'export_reports'],
          viewer: ['view_own', 'view_assigned'],
        }
        const perms = rolePermissions[membership.role] || []
        return perms.includes('*') || perms.includes(permission)
      },
    }),
    { name: 'auth-storage' }
  )
)
```

### `src/stores/uiStore.ts`

```ts
import { create } from 'zustand'

interface UIStore {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
```

---

## STEP 12 — Add the Remaining API Files

Copy the following files from the code delivered earlier in the conversation:

| File | Source |
|---|---|
| `src/api/controls.ts` | Part 11 — Controls API |
| `src/api/evidence.ts` | Part 12 — Evidence API |
| `src/api/risk.ts` | Part 13 — Risk API |
| `src/api/compliance.ts` | Part 14 — Compliance API |

Each file exports a named object (`controlsApi`, `evidenceApi`, `riskApi`, `complianceApi`).

---

## STEP 13 — Add UI Components

Create these files by copying from the conversation:

### Core UI Components (copy from earlier parts)

```
src/components/ui/button.tsx          ← Part 5
src/components/ui/card.tsx            ← Part 5
src/components/ui/badge.tsx           ← Part 5
src/components/ui/input.tsx           ← Part 11
src/components/ui/dialog.tsx          ← Part 11
src/components/ui/dropdown-menu.tsx   ← Part 12
```

### Common Components

```
src/components/common/LoadingSpinner.tsx   ← Part 5
```

### Layout Components

```
src/components/layout/AppLayout.tsx   ← Part 7
src/components/layout/Sidebar.tsx     ← Part 7
src/components/layout/Header.tsx      ← Part 7
```

---

## STEP 14 — Add Feature Components

Copy each feature from the conversation in order:

### Auth (Part 8)
```
src/features/auth/Login.tsx
src/features/auth/CompanySelector.tsx
```

### Dashboard (Part 9)
```
src/features/dashboard/Dashboard.tsx
```

### Controls (Part 11)
```
src/features/controls/ControlList.tsx
src/features/controls/ControlDetail.tsx
src/features/controls/ControlDashboard.tsx
src/features/controls/ApplyControlDialog.tsx
src/features/controls/EditControlDialog.tsx
```

### Evidence (Parts 12–13)
```
src/features/evidence/EvidenceList.tsx
src/features/evidence/EvidenceDetail.tsx
src/features/evidence/UploadEvidenceDialog.tsx
src/features/evidence/EvidenceViewer.tsx
src/features/evidence/LinkControlsDialog.tsx
src/features/evidence/EvidenceComments.tsx
```

### Risk (Parts 13–14 continued)
```
src/features/risk/RiskRegister.tsx
src/features/risk/RiskDetail.tsx
src/features/risk/RiskHeatMap.tsx
src/features/risk/CreateRiskDialog.tsx
src/features/risk/AssessRiskDialog.tsx
src/features/risk/AddTreatmentActionDialog.tsx
```

### Compliance (Part 14)
```
src/features/compliance/ComplianceDashboard.tsx
src/features/compliance/FrameworkComplianceDetail.tsx
src/features/compliance/GapAnalysis.tsx
src/features/compliance/ComplianceRecommendations.tsx
src/features/compliance/FrameworkAdoptionList.tsx
src/features/compliance/ComplianceReports.tsx
src/features/compliance/AdoptFrameworkDialog.tsx
```

---

## STEP 15 — Add the Custom Hook

### `src/hooks/useAuth.ts`

```ts
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api/auth'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { LoginRequest } from '@/types/auth.types'

export function useAuth() {
  const navigate = useNavigate()
  const { user, company, membership, isAuthenticated, setAuth, logout } = useAuthStore()

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: async (data) => {
      const user = await authApi.getCurrentUser()
      setAuth(user, data.access, data.refresh)
      navigate('/select-company')
    },
  })

  const logoutUser = () => {
    logout()
    navigate('/login')
  }

  return {
    user,
    company,
    membership,
    isAuthenticated,
    login: loginMutation.mutate,
    logout: logoutUser,
    isLoading: loginMutation.isPending,
    error: loginMutation.error,
  }
}
```

---

## STEP 16 — Wire Up App.tsx and main.tsx

### `src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### `src/App.tsx`

Copy the final version from Part 14 of the conversation. It imports all feature components and wires up all routes.

---

## STEP 17 — Verify the Build

```bash
# Type-check without building
npx tsc --noEmit

# Fix any errors, then build
npm run build
```

Common errors and fixes:

| Error | Fix |
|---|---|
| `Cannot find module '@/...'` | Check `tsconfig.json` paths and `vite.config.ts` alias |
| `Property 'X' does not exist on type` | Add the missing property to the relevant `.types.ts` file |
| `Cannot find module 'recharts'` | Run `npm install recharts` |
| `'useQuery' is not exported from '@tanstack/react-query'` | Ensure version is v5 (`npm install @tanstack/react-query@5`) |

---

## STEP 18 — Run the Full Stack

Make sure your Django backend is running first:

```bash
# Terminal 1 — Backend
cd ../backend
source venv/bin/activate
python manage.py runserver
```

```bash
# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## File Creation Order (Dependency-Safe)

If you prefer to build incrementally and test as you go, create files in this exact order to avoid import errors:

```
1.  src/lib/utils.ts
2.  src/lib/constants.ts
3.  src/types/auth.types.ts
4.  src/types/control.types.ts
5.  src/types/risk.types.ts
6.  src/types/compliance.types.ts
7.  src/api/client.ts
8.  src/api/auth.ts
9.  src/api/controls.ts
10. src/api/evidence.ts
11. src/api/risk.ts
12. src/api/compliance.ts
13. src/stores/authStore.ts
14. src/stores/uiStore.ts
15. src/hooks/useAuth.ts
16. src/components/ui/button.tsx
17. src/components/ui/card.tsx
18. src/components/ui/badge.tsx
19. src/components/ui/input.tsx
20. src/components/ui/dialog.tsx
21. src/components/ui/dropdown-menu.tsx
22. src/components/common/LoadingSpinner.tsx
23. src/components/layout/Sidebar.tsx
24. src/components/layout/Header.tsx
25. src/components/layout/AppLayout.tsx
26. src/features/auth/Login.tsx
27. src/features/auth/CompanySelector.tsx
28. src/features/dashboard/Dashboard.tsx
29. src/features/controls/ApplyControlDialog.tsx
30. src/features/controls/EditControlDialog.tsx
31. src/features/controls/ControlList.tsx
32. src/features/controls/ControlDetail.tsx
33. src/features/controls/ControlDashboard.tsx
34. src/features/evidence/UploadEvidenceDialog.tsx
35. src/features/evidence/EvidenceViewer.tsx
36. src/features/evidence/LinkControlsDialog.tsx
37. src/features/evidence/EvidenceComments.tsx
38. src/features/evidence/EvidenceList.tsx
39. src/features/evidence/EvidenceDetail.tsx
40. src/features/risk/CreateRiskDialog.tsx
41. src/features/risk/AssessRiskDialog.tsx
42. src/features/risk/AddTreatmentActionDialog.tsx
43. src/features/risk/RiskRegister.tsx
44. src/features/risk/RiskHeatMap.tsx
45. src/features/risk/RiskDetail.tsx
46. src/features/compliance/AdoptFrameworkDialog.tsx
47. src/features/compliance/GapAnalysis.tsx
48. src/features/compliance/ComplianceRecommendations.tsx
49. src/features/compliance/FrameworkComplianceDetail.tsx
50. src/features/compliance/FrameworkAdoptionList.tsx
51. src/features/compliance/ComplianceReports.tsx
52. src/features/compliance/ComplianceDashboard.tsx
53. src/App.tsx
54. src/main.tsx
```

---

## Quick Troubleshooting

### White screen / nothing loads
```bash
# Open browser DevTools → Console tab
# Look for the first red error and fix it
npm run dev
```

### `Proxy error: Could not proxy request /api/...`
The backend is not running. Start it first:
```bash
cd ../backend && python manage.py runserver
```

### `401 Unauthorized` on every request
Your JWT has expired or was never stored. Log out and log in again. If it keeps happening, check that `VITE_API_BASE_URL` matches the backend URL exactly.

### Tailwind classes not applying
```bash
# Ensure postcss.config.js exists
cat postcss.config.js
# Should contain: plugins: { tailwindcss: {}, autoprefixer: {} }
```

### `recharts` or other chart components are blank
Wrap the `ResponsiveContainer` parent in a div with an explicit height:
```tsx
<div style={{ height: 300 }}>
  <ResponsiveContainer width="100%" height="100%">
    ...
  </ResponsiveContainer>
</div>
```
