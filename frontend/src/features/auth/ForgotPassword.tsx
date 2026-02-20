// src/features/auth/ForgotPassword.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { getErrorMessage } from "@/api/client";
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
import { Label } from "@/components/ui/label";
import {
  Shield,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Mail,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: authApi.requestPasswordReset,
    onSuccess: (data) => {
      setSubmitted(true);
      // Dev mode: backend returns the link directly
      if (data.reset_link) {
        setResetLink(data.reset_link);
      }
    },
  });

  const handleCopy = () => {
    if (!resetLink) return;
    navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    mutation.mutate(email.trim().toLowerCase());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {submitted ? "Check your email" : "Forgot password?"}
          </CardTitle>
          <CardDescription>
            {submitted
              ? "If an account with that email exists, a reset link has been sent."
              : "Enter your email and we'll send you a reset link."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mutation.error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {getErrorMessage(mutation.error)}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-sm text-gray-600">
                  Sent to <strong>{email}</strong>
                </p>
              </div>

              {/* Dev mode: show the link directly when no SMTP is configured */}
              {resetLink && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                    Development mode — no email sent
                  </p>
                  <p className="text-xs text-amber-700">
                    Copy this link and open it in your browser:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1.5 font-mono truncate text-gray-700">
                      {resetLink}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopy}
                      className="flex-shrink-0 gap-1"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-xs text-amber-600">
                    This banner only appears in development (
                    <code>DEBUG=True</code>). In production the link is emailed.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSubmitted(false);
                  setResetLink(null);
                  setEmail("");
                  mutation.reset();
                }}
              >
                Try a different email
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            to="/login"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
