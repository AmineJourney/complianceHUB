/* eslint-disable @typescript-eslint/no-unused-vars */
// src/App.tsx  ← FULL REPLACEMENT
// Key fixes vs original:
//   1. Profile & Settings are now INSIDE ProtectedRoute + AppLayout
//   2. /invite/:token is a public route (no auth required)
//   3. /settings/users → <TeamManagement /> (was a dead navigate() call)
//   4. GapPage fixed to support multi-framework selection
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
} from "react-router-dom";
import "./App.css";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useAuthStore } from "./stores/authStore";
import { AppLayout } from "./components/layout/AppLayout";
import { Login } from "./features/auth/Login";
import { Register } from "./features/auth/Register";
import { AcceptInvite } from "./features/auth/AcceptInvite";
import { CompanySelector } from "./features/auth/CompanySelector";
import { Dashboard } from "./features/dashboard/Dashboard";
import { ControlList } from "./features/controls/ControlList";
import { ControlDetail } from "./features/controls/ControlDetail";
import { ControlDashboard } from "./features/controls/ControlDashboard";
import { EvidenceList } from "./features/evidence/EvidenceList";
import { EvidenceDetail } from "./features/evidence/EvidenceDetail";
import { RiskRegister } from "./features/risk/RiskRegister";
import { RiskDetail } from "./features/risk/RiskDetail";
import { RiskHeatMap } from "./features/risk/RiskHeatMap";
import { ComplianceDashboard } from "./features/compliance/ComplianceDashboard";
import { FrameworkComplianceDetail } from "./features/compliance/FrameworkComplianceDetail";
import { FrameworkAdoptionList } from "./features/compliance/FrameworkAdoptionList";
import { ComplianceReports } from "./features/compliance/ComplianceReports";
import { GapAnalysis } from "./features/compliance/GapAnalysis";
import { complianceApi } from "./api/compliance";
import { FrameworkList } from "./features/library/FrameworkList";
import { FrameworkDetail } from "./features/library/FrameworkDetail";
import { DepartmentTree } from "./features/organizations/DepartmentTree";
import { DepartmentList } from "./features/organizations/DepartmentList";
import { Profile } from "./features/profile/Profile";
import { Settings } from "./features/settings/Settings";
import { TeamManagement } from "./features/settings/TeamManagement";
import { useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ── Route guards ──────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, company } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!company) return <Navigate to="/select-company" replace />;
  return <>{children}</>;
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* ── Public routes ───────────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Invite accept — fully public, works for guests too */}
          <Route path="/invite/:token" element={<AcceptInvite />} />

          {/* ── Semi-authenticated (logged in, no company required) ──────── */}
          <Route
            path="/select-company"
            element={
              <AuthenticatedRoute>
                <CompanySelector />
              </AuthenticatedRoute>
            }
          />

          {/* ── Protected routes (need company context) ──────────────────── */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Controls */}
            <Route path="controls">
              <Route index element={<ControlList />} />
              <Route path="dashboard" element={<ControlDashboard />} />
              <Route path=":id" element={<ControlDetail />} />
            </Route>

            {/* Evidence */}
            <Route path="evidence">
              <Route index element={<EvidenceList />} />
              <Route path=":id" element={<EvidenceDetail />} />
            </Route>

            {/* Risks */}
            <Route path="risks">
              <Route index element={<RiskRegister />} />
              <Route path="heat-map" element={<RiskHeatMap />} />
              <Route path=":id" element={<RiskDetail />} />
            </Route>

            {/* Compliance */}
            <Route path="compliance">
              <Route index element={<ComplianceDashboard />} />
              <Route
                path="frameworks/:frameworkId"
                element={<FrameworkComplianceDetail />}
              />
              <Route path="adoptions" element={<FrameworkAdoptionList />} />
              <Route path="gaps" element={<GapPage />} />
              <Route path="reports" element={<ComplianceReports />} />
            </Route>

            {/* Organizations */}
            <Route
              path="organizations/departments"
              element={<DepartmentList />}
            />
            <Route
              path="organizations/departments/tree"
              element={<DepartmentTree />}
            />

            {/* Library */}
            <Route path="library/frameworks" element={<FrameworkList />} />
            <Route
              path="library/frameworks/:id"
              element={<FrameworkDetail />}
            />

            {/* Profile — FIXED: now inside ProtectedRoute + AppLayout */}
            <Route path="profile" element={<Profile />} />

            {/* Settings — FIXED: now inside ProtectedRoute + AppLayout */}
            <Route path="settings" element={<Settings />} />

            {/* Team management — FIXED: was dead /settings/users navigate() */}
            <Route path="settings/users" element={<TeamManagement />} />
          </Route>

          {/* ── 404 ────────────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// ── GapPage — FIXED: framework selector instead of hardcoded [0] ─────────────

function GapPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["compliance-overview"],
    queryFn: complianceApi.getOverview,
  });

  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string | null>(
    null,
  );

  const frameworks = overview?.frameworks ?? [];
  const frameworkId =
    selectedFrameworkId ?? frameworks[0]?.framework_id ?? null;

  if (isLoading) {
    return <div className="p-6 text-gray-400 text-sm">Loading frameworks…</div>;
  }

  if (frameworks.length === 0) {
    return <div className="p-6 text-gray-500">No frameworks adopted yet.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Framework selector — only shown when there are multiple */}
      {frameworks.length > 1 && (
        <div className="flex items-center gap-3 pb-2">
          <label className="text-sm font-medium text-gray-700">
            Framework:
          </label>
          <select
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
            value={frameworkId ?? ""}
            onChange={(e) => setSelectedFrameworkId(e.target.value)}
          >
            {frameworks.map(
              (f: {
                framework_id: string;
                framework_code: string;
                framework_name?: string;
              }) => (
                <option key={f.framework_id} value={f.framework_id}>
                  {f.framework_code}
                  {f.framework_name ? ` — ${f.framework_name}` : ""}
                </option>
              ),
            )}
          </select>
        </div>
      )}

      {frameworkId && <GapAnalysis frameworkId={frameworkId} />}
    </div>
  );
}

export default App;
