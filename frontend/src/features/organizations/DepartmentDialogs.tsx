// src/features/organizations/CreateDepartmentDialog.tsx
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { organizationsApi } from "@/api/organizations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/api/client";

interface CreateDepartmentDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateDepartmentDialog({
  open,
  onClose,
}: CreateDepartmentDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Fetch departments for parent selection
  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => organizationsApi.getDepartments(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: organizationsApi.createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department-tree"] });
      handleClose();
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Department name is required");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      parent: parent || undefined,
    });
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setParent(undefined);
    setError(null);
    onClose();
  };

  const departments = departmentsData?.results || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Department</DialogTitle>
            <DialogDescription>
              Add a new department to your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Engineering, Sales, Marketing"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this department"
                rows={3}
              />
            </div>

            {/* Parent Department */}
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Department</Label>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level department)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.full_path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select a parent department to create a sub-department
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Department
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// src/features/organizations/EditDepartmentDialog.tsx
import type { Department } from "@/types/organization.types";

interface EditDepartmentDialogProps {
  department: Department;
  open: boolean;
  onClose: () => void;
}

export function EditDepartmentDialog({
  department,
  open,
  onClose,
}: EditDepartmentDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || "");
  const [parent, setParent] = useState<string | undefined>(department.parent);
  const [isActive, setIsActive] = useState(department.is_active);
  const [error, setError] = useState<string | null>(null);

  // Fetch departments for parent selection
  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => organizationsApi.getDepartments(),
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      organizationsApi.updateDepartment(department.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department-tree"] });
      queryClient.invalidateQueries({
        queryKey: ["department", department.id],
      });
      handleClose();
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Department name is required");
      return;
    }

    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      parent: parent || undefined,
      is_active: isActive,
    });
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const departments = (departmentsData?.results || []).filter(
    (dept) => dept.id !== department.id, // Don't allow setting self as parent
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update department information</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Parent Department */}
            <div className="space-y-2">
              <Label htmlFor="edit-parent">Parent Department</Label>
              <Select
                value={parent || "none"}
                onValueChange={(val) =>
                  setParent(val === "none" ? undefined : val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level department)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.full_path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
