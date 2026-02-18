/* eslint-disable @typescript-eslint/no-unused-vars */
// src/features/auth/Register.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, CheckCircle } from "lucide-react";
import { getErrorMessage } from "@/api/client";

export function Register() {
  const { register, isLoading, error } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
  });
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [success, setSuccess] = useState(false);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email";
    }

    // Username validation
    if (!formData.username) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    // First name validation
    if (!formData.first_name) {
      errors.first_name = "First name is required";
    }

    // Last name validation
    if (!formData.last_name) {
      errors.last_name = "Last name is required";
    }

    // Password validation
    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    // Password confirmation
    if (!formData.password_confirm) {
      errors.password_confirm = "Please confirm your password";
    } else if (formData.password !== formData.password_confirm) {
      errors.password_confirm = "Passwords do not match";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    register(formData);
  };

  const handleChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [field]: e.target.value });
      // Clear validation error for this field when user starts typing
      if (validationErrors[field]) {
        setValidationErrors({ ...validationErrors, [field]: "" });
      }
    };

  // Show success message if registration completed
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Account Created!
            </CardTitle>
            <CardDescription>
              Your account has been successfully created
            </CardDescription>
          </CardHeader>

          <CardContent className="text-center">
            <p className="text-gray-600">
              You can now sign in with your credentials to access the platform.
            </p>
          </CardContent>

          <CardFooter>
            <Link to="/login" className="w-full">
              <Button className="w-full">Continue to Sign In</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Create an account
          </CardTitle>
          <CardDescription>
            Enter your information to get started with compliance management
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {getErrorMessage(error)}
              </div>
            )}

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="first_name" className="text-sm font-medium">
                  First Name *
                </label>
                <Input
                  id="first_name"
                  type="text"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={handleChange("first_name")}
                  className={
                    validationErrors.first_name ? "border-red-500" : ""
                  }
                  required
                />
                {validationErrors.first_name && (
                  <p className="text-xs text-red-600">
                    {validationErrors.first_name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="last_name" className="text-sm font-medium">
                  Last Name *
                </label>
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={handleChange("last_name")}
                  className={validationErrors.last_name ? "border-red-500" : ""}
                  required
                />
                {validationErrors.last_name && (
                  <p className="text-xs text-red-600">
                    {validationErrors.last_name}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email *
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange("email")}
                className={validationErrors.email ? "border-red-500" : ""}
                required
              />
              {validationErrors.email && (
                <p className="text-xs text-red-600">{validationErrors.email}</p>
              )}
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username *
              </label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={formData.username}
                onChange={handleChange("username")}
                className={validationErrors.username ? "border-red-500" : ""}
                required
              />
              {validationErrors.username && (
                <p className="text-xs text-red-600">
                  {validationErrors.username}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Choose a unique username (minimum 3 characters)
              </p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password *
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange("password")}
                className={validationErrors.password ? "border-red-500" : ""}
                required
              />
              {validationErrors.password && (
                <p className="text-xs text-red-600">
                  {validationErrors.password}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Must be at least 8 characters long
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="password_confirm" className="text-sm font-medium">
                Confirm Password *
              </label>
              <Input
                id="password_confirm"
                type="password"
                placeholder="••••••••"
                value={formData.password_confirm}
                onChange={handleChange("password_confirm")}
                className={
                  validationErrors.password_confirm ? "border-red-500" : ""
                }
                required
              />
              {validationErrors.password_confirm && (
                <p className="text-xs text-red-600">
                  {validationErrors.password_confirm}
                </p>
              )}
            </div>

            {/* Terms acceptance */}
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="terms"
                className="mt-1 rounded border-gray-300"
                required
              />
              <label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the{" "}
                <a href="#" className="text-primary hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>

            <p className="text-sm text-center text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
