/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/features/settings/Settings.tsx
/**
 * FIX #5 — Notification and appearance preferences are now persisted.
 *
 * Before: all toggles/selects were local useState with hardcoded defaults.
 *         Refreshing the page reset everything silently.
 *
 * After:  - On mount, GET /api/auth/preferences/ loads saved preferences.
 *         - "Save" buttons PATCH /api/auth/preferences/ to persist them.
 *         - Appearance and notification tabs share the same endpoint.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
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
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import {
  Users,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Shield,
} from "lucide-react";
import { getErrorMessage } from "@/api/client";
import apiClient from "@/api/client";

// ── Preferences shape (mirrors backend _DEFAULT_PREFERENCES) ─────────────────
interface UserPreferences {
  email_notifications: boolean;
  desktop_notifications: boolean;
  compliance_alerts: boolean;
  risk_alerts: boolean;
  evidence_reminders: boolean;
  theme: "light" | "dark" | "system";
  language: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  email_notifications: true,
  desktop_notifications: false,
  compliance_alerts: true,
  risk_alerts: true,
  evidence_reminders: true,
  theme: "light",
  language: "en",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, company, membership, logout } = useAuthStore();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Company tab state
  const [companyName, setCompanyName] = useState(company?.name || "");
  const [isEditingCompany, setIsEditingCompany] = useState(false);

  // Preferences state — initialised from defaults, overwritten on load
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const isOwnerOrAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  // ── Load preferences on mount ────────────────────────────────────────────
  const { data: savedPrefs } = useQuery<UserPreferences>({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/preferences/");
      return res.data;
    },
  });

  useEffect(() => {
    if (savedPrefs) setPrefs({ ...DEFAULT_PREFERENCES, ...savedPrefs });
  }, [savedPrefs]);

  // ── Save preferences ─────────────────────────────────────────────────────
  const savePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<UserPreferences>) => {
      const res = await apiClient.patch("/auth/preferences/", updates);
      return res.data;
    },
    onSuccess: (data) => {
      setPrefs({ ...DEFAULT_PREFERENCES, ...data });
      queryClient.setQueryData(["user-preferences"], data);
      setSuccess("Preferences saved!");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setTimeout(() => setError(null), 5000);
    },
  });

  // ── Update company name ───────────────────────────────────────────────────
  const updateCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.patch(`/companies/${company?.id}/`, { name });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSuccess("Company settings updated!");
      setIsEditingCompany(false);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setTimeout(() => setError(null), 5000);
    },
  });

  // ── Delete company ────────────────────────────────────────────────────────
  const deleteCompanyMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/companies/${company?.id}/`);
    },
    onSuccess: () => {
      logout();
      navigate("/login");
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleUpdateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    updateCompanyMutation.mutate(companyName.trim());
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 lg:px-80 py-6 md:px-2 sm:px-2">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account and company settings
        </p>
      </div>

      {/* Global feedback banners */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center text-green-800">
          <Check className="h-4 w-4 mr-2" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center text-red-800">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      <Tabs defaultValue="company" className="w-full">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* ── Company tab ─────────────────────────────────────────────────── */}
        <TabsContent value="company">
          <div className="space-y-6">
            {/* Company information */}
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Manage your company details and settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateCompany} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={!isEditingCompany}
                    />
                  </div>

                  <div className="flex gap-2">
                    {isEditingCompany ? (
                      <>
                        <Button
                          type="submit"
                          disabled={updateCompanyMutation.isPending}
                        >
                          {updateCompanyMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsEditingCompany(false);
                            setCompanyName(company?.name || "");
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      isOwnerOrAdmin && (
                        <Button
                          type="button"
                          onClick={() => setIsEditingCompany(true)}
                        >
                          Edit Company Name
                        </Button>
                      )
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Plan & Billing</CardTitle>
                <CardDescription>
                  Your current subscription plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="capitalize">{company?.plan}</Badge>
                      <span className="text-sm text-gray-600">plan</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {company?.max_users} users • {company?.max_storage_mb} MB
                      storage
                    </p>
                  </div>
                  {isOwnerOrAdmin && (
                    <Button variant="outline">Upgrade Plan</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Team */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage users and their roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        User Management
                      </p>
                      <p className="text-sm text-gray-600">
                        View and manage team members
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/settings/users")}
                  >
                    Manage Users
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Notifications tab ────────────────────────────────────────────── */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Delivery channels */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-gray-600">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={prefs.email_notifications}
                  onCheckedChange={(v) =>
                    setPrefs({ ...prefs, email_notifications: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="desktop-notifications">
                    Desktop Notifications
                  </Label>
                  <p className="text-sm text-gray-600">
                    Show desktop push notifications
                  </p>
                </div>
                <Switch
                  id="desktop-notifications"
                  checked={prefs.desktop_notifications}
                  onCheckedChange={(v) =>
                    setPrefs({ ...prefs, desktop_notifications: v })
                  }
                />
              </div>

              {/* Alert types */}
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4">Alert Types</h4>

                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="compliance-alerts">Compliance Alerts</Label>
                    <p className="text-sm text-gray-600">
                      Updates on compliance status and gaps
                    </p>
                  </div>
                  <Switch
                    id="compliance-alerts"
                    checked={prefs.compliance_alerts}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, compliance_alerts: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="risk-alerts">Risk Alerts</Label>
                    <p className="text-sm text-gray-600">
                      Notifications about high-priority risks
                    </p>
                  </div>
                  <Switch
                    id="risk-alerts"
                    checked={prefs.risk_alerts}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, risk_alerts: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="evidence-reminders">
                      Evidence Reminders
                    </Label>
                    <p className="text-sm text-gray-600">
                      Reminders to update evidence
                    </p>
                  </div>
                  <Switch
                    id="evidence-reminders"
                    checked={prefs.evidence_reminders}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, evidence_reminders: v })
                    }
                  />
                </div>
              </div>

              <Button
                className="w-full"
                disabled={savePreferencesMutation.isPending}
                onClick={() =>
                  savePreferencesMutation.mutate({
                    email_notifications: prefs.email_notifications,
                    desktop_notifications: prefs.desktop_notifications,
                    compliance_alerts: prefs.compliance_alerts,
                    risk_alerts: prefs.risk_alerts,
                    evidence_reminders: prefs.evidence_reminders,
                  })
                }
              >
                {savePreferencesMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Notification Preferences"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Appearance tab ───────────────────────────────────────────────── */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the application looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={prefs.theme}
                  onValueChange={(v) =>
                    setPrefs({ ...prefs, theme: v as UserPreferences["theme"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-600">
                  Choose your preferred color theme
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={prefs.language}
                  onValueChange={(v) => setPrefs({ ...prefs, language: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-600">
                  Choose your preferred language
                </p>
              </div>

              <Button
                className="w-full"
                disabled={savePreferencesMutation.isPending}
                onClick={() =>
                  savePreferencesMutation.mutate({
                    theme: prefs.theme,
                    language: prefs.language,
                  })
                }
              >
                {savePreferencesMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Appearance Settings"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Danger Zone tab ──────────────────────────────────────────────── */}
        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {membership?.role === "owner" ? (
                <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium text-red-900">
                        Delete Company
                      </h4>
                      <p className="text-sm text-red-700">
                        Permanently delete this company and all its data. This
                        action cannot be undone.
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Are you absolutely sure?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete{" "}
                            <strong>{company?.name}</strong> and all associated
                            data including users, controls, evidence, risks, and
                            compliance records. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCompanyMutation.mutate()}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {deleteCompanyMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting…
                              </>
                            ) : (
                              "Delete Company"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                  <p className="text-sm text-yellow-800">
                    <Shield className="h-4 w-4 inline mr-2" />
                    Only the company owner can delete the company.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
