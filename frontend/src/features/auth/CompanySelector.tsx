/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../stores/authStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Building2, Plus } from "lucide-react";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { getErrorMessage } from "../../api/client.ts";

export function CompanySelector() {
  const navigate = useNavigate();
  const { setCompany, user } = useAuthStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: companiesData = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: authApi.getCompanies,
    select: (data) => data,
  });

  const companies = companiesData;

  const handleSelectCompany = async (companyId: string) => {
    setSelectingId(companyId);

    setError(null);
    try {
      // ← FIXED: use authApi.getMemberships() instead of raw fetch()
      const membershipsData = await authApi.getMemberships(companyId);
      const membership = membershipsData.find((m: any) => m.user === user?.id);
      console.log("Memberships for company", companyId, membershipsData);
      if (!membership) {
        setError("Could not find your membership for this organization.");
        return;
      }

      const company = companies?.find((c) => c.id === companyId);
      if (!company) {
        setError("Company not found.");
        return;
      }

      // Set company in store and navigate
      setCompany(company, membership);
      console.log("Selected company:", company);
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSelectingId(null);
    }
  };

  // Create company mutation
  const createMutation = useMutation({
    mutationFn: authApi.createCompany,
    onSuccess: async (company) => {
      // Fetch memberships for the new company
      const membershipsData = await authApi.getMemberships(company.id);
      const membership = membershipsData.find((m: any) => m.user === user?.id);

      if (!membership) {
        setError("Could not find your membership for this organization.");
        return;
      }

      setCompany(company, membership);
      navigate("/dashboard");
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCompanyName.trim()) {
      createMutation.mutate(newCompanyName.trim());
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Select Your Organization</CardTitle>
          <CardDescription>
            Choose which organization you'd like to access
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Company list */}
          <div className="grid gap-3">
            {companies?.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelectCompany(company.id)}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{company.name}</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {company.plan} Plan
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">→</div>
              </button>
            ))}
          </div>

          {/* Create new company */}
          {!showCreateForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Organization
            </Button>
          ) : (
            <form
              onSubmit={handleCreateCompany}
              className="space-y-3 border border-gray-200 rounded-lg p-4"
            >
              <h3 className="font-medium text-gray-900">
                Create New Organization
              </h3>
              <input
                type="text"
                placeholder="Organization name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <div className="flex space-x-2">
                <Button type="submit" className="flex-1">
                  Create
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
