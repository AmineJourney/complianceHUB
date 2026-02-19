// src/features/auth/CompanySelector.tsx - UPDATED VERSION
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/api/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/api/client";

export function CompanySelector() {
  const navigate = useNavigate();
  const { setCompany } = useAuthStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch user's companies
  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: authApi.getCompanies,
  });

  // Select company mutation
  const selectCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      // Get full company details
      const allCompanies = await authApi.getCompanies();
      const selectedCompany = allCompanies.find((c) => c.id === companyId);

      if (!selectedCompany) {
        throw new Error("Company not found");
      }

      // Get membership for this company
      const membershipsResponse = await authApi.getMemberships({
        company: companyId,
      });

      if (membershipsResponse.results.length === 0) {
        throw new Error("No membership found for this company");
      }

      const membership = membershipsResponse.results[0];

      return { company: selectedCompany, membership };
    },
    onSuccess: ({ company, membership }) => {
      // Set company and membership in store
      setCompany(company, membership);

      // Navigate to dashboard
      navigate("/dashboard");
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: authApi.createCompany,
    onSuccess: async (newCompany) => {
      // After creating company, get the membership
      const membershipsResponse = await authApi.getMemberships({
        company: newCompany.id,
      });

      if (membershipsResponse.results.length > 0) {
        const membership = membershipsResponse.results[0];
        setCompany(newCompany, membership);
        navigate("/dashboard");
      }
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleSelectCompany = (companyId: string) => {
    setError(null);
    selectCompanyMutation.mutate(companyId);
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newCompanyName.trim()) {
      setError("Company name is required");
      return;
    }

    createCompanyMutation.mutate(newCompanyName.trim());
  };
  console.log("Companies in selector:", companies);
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Select Company</h1>
          <p className="text-gray-600 mt-2">
            Choose which company you want to work with
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Existing Companies */}
        {!showCreateForm && (
          <div className="space-y-4">
            {companies && companies.length > 0 ? (
              <>
                <div className="grid gap-4">
                  {companies.map((company) => (
                    <Card
                      key={company.id}
                      className="hover:border-primary transition-colors cursor-pointer"
                      onClick={() => handleSelectCompany(company.id)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">
                                {company.name}
                              </CardTitle>
                              <CardDescription>
                                {company.plan && `${company.plan} plan`}
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={selectCompanyMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCompany(company.id);
                            }}
                          >
                            {selectCompanyMutation.isPending &&
                            selectCompanyMutation.variables === company.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Select"
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                {/* Create New Company Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Company
                </Button>
              </>
            ) : (
              // No companies - show create form
              <Card>
                <CardHeader>
                  <CardTitle>No Companies Found</CardTitle>
                  <CardDescription>
                    Create your first company to get started
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Company
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Create Company Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Company</CardTitle>
              <CardDescription>
                Enter your company name to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    placeholder="Acme Corporation"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    disabled={createCompanyMutation.isPending}
                    required
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCompanyName("");
                      setError(null);
                    }}
                    disabled={createCompanyMutation.isPending}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createCompanyMutation.isPending || !newCompanyName.trim()
                    }
                    className="flex-1"
                  >
                    {createCompanyMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Company"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
