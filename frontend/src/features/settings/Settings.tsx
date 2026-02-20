/* eslint-disable @typescript-eslint/no-unused-vars */
// src/features/settings/Settings.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Building2,
  Users,
  CreditCard,
  Bell,
  Palette,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Shield,
} from "lucide-react";
import { getErrorMessage } from "@/api/client";
import apiClient from "@/api/client";

export function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, company, membership, logout } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Company settings state
  const [companyName, setCompanyName] = useState(company?.name || "");
  const [isEditingCompany, setIsEditingCompany] = useState(false);

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [complianceAlerts, setComplianceAlerts] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState(true);
  const [evidenceReminders, setEvidenceReminders] = useState(true);

  // Theme preferences
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("en");

  const isOwnerOrAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiClient.patch(`/companies/${company?.id}/`, {
        name,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSuccess("Company settings updated successfully!");
      setIsEditingCompany(false);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setTimeout(() => setError(null), 5000);
    },
  });

  // Delete company mutation
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

  const handleDeleteCompany = () => {
    deleteCompanyMutation.mutate();
  };

  return (
    <div className="space-y-6 lg:px-80 py-6 md:px-2 sm:px-2">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account and company settings
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* Company Settings Tab */}
        <TabsContent value="company">
          <div className="space-y-6">
            {/* Success/Error Messages */}
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

            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Manage your company details and settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateCompany} className="space-y-4">
                  {/* Company Name */}
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={!isEditingCompany || !isOwnerOrAdmin}
                      required
                    />
                  </div>

                  {/* Company Details */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Company Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Plan:</span>
                        <Badge variant="outline" className="ml-2 capitalize">
                          {company?.plan}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-600">Max Users:</span>
                        <span className="ml-2 font-medium">
                          {company?.max_users}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Storage Limit:</span>
                        <span className="ml-2 font-medium">
                          {company?.max_storage_mb} MB
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Created:</span>
                        <span className="ml-2 font-medium">
                          {company?.created_at
                            ? new Date(company.created_at).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <Badge
                          variant="outline"
                          className="ml-2 bg-green-50 text-green-700 border-green-200"
                        >
                          Active
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-600">Company ID:</span>
                        <span className="ml-2 font-mono text-xs">
                          {company?.id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {isOwnerOrAdmin && (
                    <div className="flex justify-end space-x-2 pt-4">
                      {isEditingCompany ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsEditingCompany(false);
                              setCompanyName(company?.name || "");
                            }}
                            disabled={updateCompanyMutation.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={updateCompanyMutation.isPending}
                          >
                            {updateCompanyMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              "Save Changes"
                            )}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setIsEditingCompany(true)}
                        >
                          Edit Company
                        </Button>
                      )}
                    </div>
                  )}

                  {!isOwnerOrAdmin && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
                      <Shield className="h-4 w-4 inline mr-2" />
                      You need Owner or Admin role to edit company settings
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Plan & Billing */}
            <Card>
              <CardHeader>
                <CardTitle>Plan & Billing</CardTitle>
                <CardDescription>
                  Manage your subscription and billing information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 capitalize">
                          {company?.plan} Plan
                        </h4>
                        <p className="text-sm text-gray-600">
                          {company?.max_users} users • {company?.max_storage_mb}{" "}
                          MB storage
                        </p>
                      </div>
                    </div>
                    {isOwnerOrAdmin && (
                      <Button variant="outline">Upgrade Plan</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members */}
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

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
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
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              {/* Desktop Notifications */}
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
                  checked={desktopNotifications}
                  onCheckedChange={setDesktopNotifications}
                />
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4">Alert Types</h4>

                {/* Compliance Alerts */}
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="compliance-alerts">Compliance Alerts</Label>
                    <p className="text-sm text-gray-600">
                      Updates on compliance status and gaps
                    </p>
                  </div>
                  <Switch
                    id="compliance-alerts"
                    checked={complianceAlerts}
                    onCheckedChange={setComplianceAlerts}
                  />
                </div>

                {/* Risk Alerts */}
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="risk-alerts">Risk Alerts</Label>
                    <p className="text-sm text-gray-600">
                      Notifications about high-priority risks
                    </p>
                  </div>
                  <Switch
                    id="risk-alerts"
                    checked={riskAlerts}
                    onCheckedChange={setRiskAlerts}
                  />
                </div>

                {/* Evidence Reminders */}
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
                    checked={evidenceReminders}
                    onCheckedChange={setEvidenceReminders}
                  />
                </div>
              </div>

              <Button className="w-full">Save Notification Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the application looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme */}
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
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

              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
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

              <Button className="w-full">Save Appearance Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Delete Company */}
              {membership?.role === "owner" && (
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
                            onClick={handleDeleteCompany}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {deleteCompanyMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
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
              )}

              {membership?.role !== "owner" && (
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
