// src/features/auth/CompanySelector.tsx
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

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: authApi.getCompanies,
  });

  // ── Select existing company ───────────────────────────────────────────────
  const selectCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const [allCompanies, membershipsResponse] = await Promise.all([
        authApi.getCompanies(),
        authApi.getMemberships({ company: companyId }),
      ]);

      const selectedCompany = allCompanies.find((c) => c.id === companyId);
      if (!selectedCompany) throw new Error("Company not found");

      const membership = membershipsResponse.results[0];
      if (!membership)
        throw new Error(
          "No membership found for this company — please contact the company owner",
        );

      return { company: selectedCompany, membership };
    },
    onSuccess: ({ company, membership }) => {
      setCompany(company, membership);
      navigate("/dashboard");
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  // ── Create new company ────────────────────────────────────────────────────
  const createCompanyMutation = useMutation({
    mutationFn: (name: string) => authApi.createCompany(name),
    onSuccess: ({ company, membership }) => {
      // Backend returns both company + membership in one response —
      // set them directly, no second round-trip needed.
      setCompany(company, membership);
      navigate("/dashboard");
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleSelectCompany = (companyId: string) => {
    setError(null);
    selectCompanyMutation.mutate(companyId);
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = newCompanyName.trim();
    if (!name) {
      setError("Company name is required");
      return;
    }
    createCompanyMutation.mutate(name);
  };

  const isBusy =
    selectCompanyMutation.isPending || createCompanyMutation.isPending;

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

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Existing companies */}
        {!showCreateForm && (
          <div className="space-y-4">
            {companies && companies.length > 0 ? (
              <>
                <div className="grid gap-3">
                  {companies.map((company) => (
                    <Card
                      key={company.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                      onClick={() => handleSelectCompany(company.id)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {company.name}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {company.plan} plan
                          </p>
                        </div>
                        {selectCompanyMutation.isPending && (
                          <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create another company
                  </Button>
                </div>
              </>
            ) : (
              /* No companies yet — show create form directly */
              <Card>
                <CardHeader>
                  <CardTitle>Create your first company</CardTitle>
                  <CardDescription>
                    Set up a company workspace to get started
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateCompany} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company name</Label>
                      <Input
                        id="company-name"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Acme Corp"
                        disabled={isBusy}
                        autoFocus
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isBusy}>
                      {createCompanyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        "Create Company"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Create company form (when user already has companies) */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create a new company</CardTitle>
              <CardDescription>You'll be set as the owner</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-company-name">Company name</Label>
                  <Input
                    id="new-company-name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    disabled={isBusy}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCompanyName("");
                      setError(null);
                    }}
                    disabled={isBusy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isBusy}>
                    {createCompanyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating…
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
