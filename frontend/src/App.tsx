import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useAuthStore } from "./stores/authStore";
import { AppLayout } from "./components/layout/AppLayout";
import { Login } from "./features/auth/Login";
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
import { complianceApi } from "./api/compliance.ts";
import { GapAnalysis } from "./features/compliance/GapAnalysis.tsx";
// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, company } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!company) {
    return <Navigate to="/select-company" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/select-company" element={<CompanySelector />} />

          {/* Protected routes */}
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

            {/* Placeholder routes - to be implemented */}
            <Route path="controls">
              <Route index element={<ControlList />} />
              <Route path="dashboard" element={<ControlDashboard />} />
              <Route path=":id" element={<ControlDetail />} />
            </Route>
            <Route path="evidence">
              <Route index element={<EvidenceList />} />
              <Route path=":id" element={<EvidenceDetail />} />
            </Route>
            <Route path="risks">
              <Route index element={<RiskRegister />} />
              <Route path="heat-map" element={<RiskHeatMap />} />
              <Route path=":id" element={<RiskDetail />} />
            </Route>
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
            <Route
              path="organizations"
              element={<div>Organizations Page</div>}
            />
            <Route path="library" element={<div>Library Page</div>} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Standalone gap page wrapper
function GapPage() {
  const { data: overview } = useQuery({
    queryKey: ["compliance-overview"],
    queryFn: complianceApi.getOverview,
  });
  const frameworkId = overview?.frameworks?.[0]?.framework_id;
  if (!frameworkId)
    return <div className="p-6 text-gray-500">No frameworks adopted yet</div>;
  return <GapAnalysis frameworkId={frameworkId} />;
}

export default App;
