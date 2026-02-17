import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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

export function CompanySelector() {
  const navigate = useNavigate();
  const { setCompany, user } = useAuthStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: authApi.getCompanies,
  });

  const handleSelectCompany = async (companyId: string) => {
    const company = companies?.find((c) => c.id === companyId);
    if (company) {
      // Get membership for this company
      const response = await fetch(
        `/api/core/memberships/?company=${companyId}`,
      );
      const memberships = await response.json();
      const membership = memberships.results.find(
        (m: any) => m.user.id === user?.id,
      );

      if (membership) {
        setCompany(company, membership);
        navigate("/dashboard");
      }
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const company = await authApi.createCompany(newCompanyName);
      // After creating, fetch the membership
      const response = await fetch(
        `/api/core/memberships/?company=${company.id}`,
      );
      const memberships = await response.json();
      const membership = memberships.results.find(
        (m: any) => m.user.id === user?.id,
      );

      if (membership) {
        setCompany(company, membership);
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Failed to create company:", error);
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
