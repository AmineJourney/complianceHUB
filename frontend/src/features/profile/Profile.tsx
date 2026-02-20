/* eslint-disable @typescript-eslint/no-unused-vars */
// src/features/profile/Profile.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { profileApi } from "@/api/profile";
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
import {
  User,
  Mail,
  Building2,
  Shield,
  Calendar,
  Loader2,
  Check,
  AlertCircle,
  Key,
} from "lucide-react";
import { getErrorMessage } from "@/api/client";

export function Profile() {
  const queryClient = useQueryClient();
  const { user, company, membership } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");

  // Password change states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Fetch user's memberships
  const { data: membershipsData } = useQuery({
    queryKey: ["user-memberships"],
    queryFn: () => authApi.getMemberships(),
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setSuccess("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setTimeout(() => setError(null), 5000);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      setPasswordSuccess("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 3000);
    },
    onError: (err) => {
      setPasswordError(getErrorMessage(err));
      setTimeout(() => setPasswordError(null), 5000);
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    updateProfileMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      email,
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    changePasswordMutation.mutate({
      old_password: oldPassword,
      new_password: newPassword,
      new_password_confirm: confirmPassword,
    });
  };

  const memberships = membershipsData?.results || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1">
          Manage your account information and settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Success/Error Messages */}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center text-green-800">
                  <Check className="h-4 w-4 mr-2" />
                  {success}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center text-red-800">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {error}
                </div>
              )}

              {/* Profile Picture */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-semibold">
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                </div>
              </div>

              {/* Profile Form */}
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  {/* Last Name */}
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={!isEditing}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isEditing}
                    required
                  />
                </div>

                {/* Account Details */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Account Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Username:</span>
                      <span className="ml-2 font-medium">{user?.username}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Account Status:</span>
                      <Badge
                        variant="outline"
                        className="ml-2 bg-green-50 text-green-700 border-green-200"
                      >
                        Active
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-600">Member Since:</span>
                      <span className="ml-2 font-medium">
                        {user?.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">User ID:</span>
                      <span className="ml-2 font-mono text-xs">
                        {user?.id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setFirstName(user?.first_name || "");
                          setLastName(user?.last_name || "");
                          setEmail(user?.email || "");
                        }}
                        disabled={updateProfileMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? (
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
                    <Button type="button" onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Success/Error Messages */}
              {passwordSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center text-green-800">
                  <Check className="h-4 w-4 mr-2" />
                  {passwordSuccess}
                </div>
              )}

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center text-red-800">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Old Password */}
                <div className="space-y-2">
                  <Label htmlFor="old-password">Current Password</Label>
                  <Input
                    id="old-password"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">Minimum 8 characters</p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Memberships Tab */}
        <TabsContent value="memberships">
          <Card>
            <CardHeader>
              <CardTitle>Company Memberships</CardTitle>
              <CardDescription>
                Companies you belong to and your roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {memberships.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 border rounded-lg ${
                      m.company === company?.id
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {m.company_name}
                            {m.company === company?.id && (
                              <Badge
                                variant="outline"
                                className="ml-2 bg-primary/10 text-primary border-primary"
                              >
                                Current
                              </Badge>
                            )}
                          </h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge
                              variant="outline"
                              className={
                                m.role === "owner"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : m.role === "admin"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-gray-50 text-gray-700 border-gray-200"
                              }
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {m.role}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Joined{" "}
                              {new Date(m.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {memberships.length === 0 && (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">
                      No company memberships found
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
