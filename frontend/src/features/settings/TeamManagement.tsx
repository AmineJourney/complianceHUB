// src/features/settings/TeamManagement.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { teamApi } from "@/api/team";
import type { Invitation } from "@/api/team";
import type { Membership } from "@/types/auth.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import {
  Users,
  UserPlus,
  Link,
  Copy,
  Check,
  Trash2,
  Shield,
  Clock,
  AlertCircle,
  ChevronDown,
  X,
  RefreshCw,
} from "lucide-react";
import { getErrorMessage } from "@/api/client";

const ROLES = [
  { value: "viewer", label: "Viewer", description: "Read-only access" },
  {
    value: "auditor",
    label: "Auditor",
    description: "Can view and export reports",
  },
  {
    value: "analyst",
    label: "Analyst",
    description: "Can create evidence and assess risks",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Can manage controls, evidence and risks",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Full access except company deletion",
  },
  {
    value: "owner",
    label: "Owner",
    description: "Full access including company deletion",
  },
];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  manager: "bg-indigo-100 text-indigo-800 border-indigo-200",
  analyst: "bg-green-100 text-green-800 border-green-200",
  auditor: "bg-yellow-100 text-yellow-800 border-yellow-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1">
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}

interface MemberRowProps {
  member: Membership;
  currentUserId: string;
  canManage: boolean;
  onRoleChange: (id: string, role: string) => void;
  onRemove: (id: string) => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

function MemberRow({
  member,
  currentUserId,
  canManage,
  onRoleChange,
  onRemove,
  isUpdating,
  isRemoving,
}: MemberRowProps) {
  const isSelf = member.user === currentUserId;
  const name = member.user_name || member.user_email || "Unknown";

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors ">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold flex-shrink-0">
          {getInitials(name)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {name}
            {isSelf && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                (you)
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">{member.user_email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canManage && !isSelf ? (
          <Select
            value={member.role}
            onValueChange={(val) => onRoleChange(member.id, val)}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge
            variant="outline"
            className={`text-xs capitalize ${ROLE_COLORS[member.role] ?? ""}`}
          >
            {member.role}
          </Badge>
        )}

        {canManage && !isSelf && member.role !== "owner" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500"
                disabled={isRemoving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove member?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{name}</strong> will lose all access to{" "}
                  <strong>{member.company_name}</strong>. This cannot be undone
                  from here — you would need to re-invite them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => onRemove(member.id)}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

interface InviteRowProps {
  invite: Invitation;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}

function InviteRow({ invite, onRevoke, isRevoking }: InviteRowProps) {
  const inviteLink = `${window.location.origin}/invite/${invite.token}`;
  const isExpired = new Date(invite.expires_at) < new Date();

  return (
    <div className="flex flex-col gap-2 py-3 px-4 rounded-lg bg-gray-50 border border-dashed border-gray-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-xs capitalize ${ROLE_COLORS[invite.role] ?? ""}`}
            >
              {invite.role}
            </Badge>
            {invite.email && (
              <span className="text-xs text-gray-500">
                for <strong>{invite.email}</strong>
              </span>
            )}
            {isExpired && (
              <Badge
                variant="outline"
                className="text-xs bg-red-50 text-red-700 border-red-200"
              >
                Expired
              </Badge>
            )}
            {invite.is_revoked && (
              <Badge
                variant="outline"
                className="text-xs bg-gray-100 text-gray-600"
              >
                Revoked
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Created {formatDate(invite.created_at)} · Expires{" "}
            {formatDate(invite.expires_at)}
          </p>
        </div>

        {invite.is_valid && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-red-500 flex-shrink-0"
            onClick={() => onRevoke(invite.id)}
            disabled={isRevoking}
            title="Revoke invite"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {invite.is_valid && (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 font-mono truncate text-gray-600">
            {inviteLink}
          </code>
          <CopyButton text={inviteLink} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TeamManagement() {
  const { user, membership, company } = useAuthStore();
  const queryClient = useQueryClient();

  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newInvite, setNewInvite] = useState<Invitation | null>(null);

  const canManage =
    membership?.role === "owner" || membership?.role === "admin";

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["company-members"],
    queryFn: teamApi.getCompanyMembers,
  });

  const { data: invitations = [], isLoading: invitesLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: teamApi.getInvitations,
    enabled: canManage,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      teamApi.updateMemberRole(id, role),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["company-members"] }),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: teamApi.removeMember,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["company-members"] }),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const createInviteMutation = useMutation({
    mutationFn: teamApi.createInvitation,
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      setNewInvite(invite);
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteRole("viewer");
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: teamApi.revokeInvitation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
    onError: (err) => setError(getErrorMessage(err)),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreateInvite = () => {
    setError(null);
    setNewInvite(null);
    createInviteMutation.mutate({
      role: inviteRole,
      email: inviteEmail.trim() || undefined,
    });
  };

  const pendingInvites = invitations.filter((i) => i.is_valid);
  const pastInvites = invitations.filter((i) => !i.is_valid);

  return (
    <div className="space-y-6 max-w-4xl py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {company?.name} · {members.length} member
            {members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setShowInviteForm(!showInviteForm);
              setNewInvite(null);
              setError(null);
            }}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* New invite success banner */}
      {newInvite && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
            <Check className="h-4 w-4" />
            Invite link created! Share this link with your team member.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 font-mono truncate text-gray-700">
              {`${window.location.origin}/invite/${newInvite.token}`}
            </code>
            <CopyButton
              text={`${window.location.origin}/invite/${newInvite.token}`}
            />
          </div>
          <p className="text-xs text-green-700">
            This link expires on {formatDate(newInvite.expires_at)} and can only
            be used once.
            {newInvite.email && ` Only ${newInvite.email} can use it.`}
          </p>
        </div>
      )}

      {/* Invite form */}
      {showInviteForm && canManage && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link className="h-4 w-4" />
              Create Invite Link
            </CardTitle>
            <CardDescription>
              No email required — you get a shareable link to send via Slack,
              email, or anywhere else.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.filter(
                      (r) =>
                        // Admins can't create owner invites
                        membership?.role === "owner" || r.value !== "owner",
                    ).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="font-medium">{r.label}</span>
                        <span className="text-gray-400 ml-1 text-xs">
                          — {r.description}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Restrict to email{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <p className="text-xs text-gray-400">
                  Leave blank to allow anyone with the link to join.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateInvite}
                disabled={createInviteMutation.isPending}
                className="gap-2"
              >
                {createInviteMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Link className="h-4 w-4" />
                )}
                Generate Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Members
            <Badge variant="outline" className="ml-1 font-normal">
              {members.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Loading members…
            </div>
          ) : members.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No members yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentUserId={user?.id ?? ""}
                  canManage={canManage}
                  onRoleChange={(id, role) =>
                    updateRoleMutation.mutate({ id, role })
                  }
                  onRemove={(id) => removeMemberMutation.mutate(id)}
                  isUpdating={updateRoleMutation.isPending}
                  isRemoving={removeMemberMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Pending Invitations
              {pendingInvites.length > 0 && (
                <Badge variant="outline" className="ml-1 font-normal">
                  {pendingInvites.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Active invite links that have not been accepted yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitesLoading ? (
              <p className="text-sm text-gray-400">Loading invitations…</p>
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-gray-400">No pending invitations.</p>
            ) : (
              pendingInvites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  onRevoke={(id) => revokeInviteMutation.mutate(id)}
                  isRevoking={revokeInviteMutation.isPending}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Past invitations (collapsed) */}
      {canManage && pastInvites.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 select-none">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Show {pastInvites.length} past invitation
            {pastInvites.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-3 space-y-2">
            {pastInvites.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onRevoke={(id) => revokeInviteMutation.mutate(id)}
                isRevoking={revokeInviteMutation.isPending}
              />
            ))}
          </div>
        </details>
      )}

      {/* Role reference */}
      <Card className="bg-gray-50 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
            <Shield className="h-4 w-4" />
            Role Permissions Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <div key={r.value} className="flex items-start gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs capitalize flex-shrink-0 mt-0.5 ${ROLE_COLORS[r.value] ?? ""}`}
                >
                  {r.label}
                </Badge>
                <span className="text-xs text-gray-500">{r.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
