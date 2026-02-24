/* eslint-disable @typescript-eslint/no-unused-expressions */
import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { evidenceApi } from "../../api/evidence";
import { controlsApi } from "../../api/controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Upload, File, X, Shield, Search } from "lucide-react";
import { getErrorMessage } from "../../api/client";
import { formatFileSize } from "../../lib/utils";

interface UploadEvidenceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-select a control to link after upload */
  preselectedControlId?: string;
}

const EVIDENCE_TYPES = [
  { value: "policy", label: "Policy Document" },
  { value: "procedure", label: "Procedure" },
  { value: "screenshot", label: "Screenshot" },
  { value: "report", label: "Report" },
  { value: "log", label: "Log File" },
  { value: "certificate", label: "Certificate" },
  { value: "configuration", label: "Configuration File" },
  { value: "scan_result", label: "Scan Result" },
  { value: "audit_report", label: "Audit Report" },
  { value: "training_record", label: "Training Record" },
  { value: "other", label: "Other" },
];

export function UploadEvidenceDialog({
  open,
  onClose,
  onSuccess,
  preselectedControlId,
}: UploadEvidenceDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    evidence_type: "other",
    tags: "",
  });
  const [controlSearch, setControlSearch] = useState("");
  const [selectedControls, setSelectedControls] = useState<Set<string>>(
    preselectedControlId ? new Set([preselectedControlId]) : new Set(),
  );
  const [showControlPicker, setShowControlPicker] = useState(false);

  // Fetch applied controls for linking
  const { data: controlsData } = useQuery({
    queryKey: ["applied-controls-picker", controlSearch],
    queryFn: () =>
      controlsApi.getAppliedControls({
        search: controlSearch || undefined,
        page_size: 50,
      }),
    enabled: open && showControlPicker,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: FormData) => evidenceApi.uploadEvidence(data),
    onSuccess: async (evidence) => {
      // Link to selected controls atomically after upload
      if (selectedControls.size > 0) {
        try {
          await evidenceApi.bulkLinkEvidence({
            evidence_ids: [evidence.id],
            control_ids: Array.from(selectedControls),
            link_type: "implementation",
          });
        } catch {
          // Non-fatal — evidence was uploaded, linking failed silently
          console.warn("Evidence uploaded but control linking failed");
        }
      }
      onSuccess();
      onClose(); // ✅ close the dialog
      resetForm();
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      name: "",
      description: "",
      evidence_type: "other",
      tags: "",
    });
    setSelectedControls(new Set());
    setControlSearch("");
    setShowControlPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.name) {
        setFormData((prev) => ({ ...prev, name: file.name }));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.name) {
        setFormData((prev) => ({ ...prev, name: file.name }));
      }
    }
  };

  const toggleControl = (id: string) => {
    setSelectedControls((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const data = new FormData();
    data.append("file", selectedFile);
    data.append("name", formData.name);
    data.append("description", formData.description);
    data.append("evidence_type", formData.evidence_type);

    if (formData.tags) {
      const tagsArray = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      // Send as JSON string — backend validate_tags() parses it
      data.append("tags", JSON.stringify(tagsArray));
    }

    uploadMutation.mutate(data);
  };

  const controls = controlsData?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Evidence</DialogTitle>
          <DialogDescription>
            Upload a file to support your compliance controls
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {uploadMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(uploadMutation.error)}
            </div>
          )}

          {/* File drop zone */}
          <div className="space-y-2">
            <label className="text-sm font-medium">File *</label>
            {!selectedFile ? (
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-gray-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Drag & drop or{" "}
                  <span className="text-primary font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  PDF, Word, Excel, images, ZIP up to 100MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                <File className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Evidence name"
              required
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <select
              value={formData.evidence_type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  evidence_type: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {EVIDENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Describe this evidence..."
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <Input
              value={formData.tags}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tags: e.target.value }))
              }
              placeholder="tag1, tag2, tag3"
            />
            <p className="text-xs text-gray-500">Separate tags with commas</p>
          </div>

          {/* Control Linking */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Link to Controls</label>
              <button
                type="button"
                onClick={() => setShowControlPicker((v) => !v)}
                className="text-xs text-primary hover:underline"
              >
                {showControlPicker ? "Hide" : "Select controls"}
              </button>
            </div>

            {/* Selected badges */}
            {selectedControls.size > 0 && (
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedControls).map((id) => {
                  const ctrl = controls.find((c) => c.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="gap-1 cursor-pointer"
                      onClick={() => toggleControl(id)}
                    >
                      <Shield className="h-3 w-3" />
                      {ctrl?.reference_control_code ?? id.slice(0, 8)}
                      <X className="h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}

            {showControlPicker && (
              <div className="border rounded-md p-2 space-y-2 max-h-40 overflow-y-auto bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={controlSearch}
                    onChange={(e) => setControlSearch(e.target.value)}
                    placeholder="Search controls..."
                    className="pl-7 h-7 text-xs"
                  />
                </div>
                {controls.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">
                    No controls found. Apply controls first.
                  </p>
                ) : (
                  controls.map((ctrl) => (
                    <div
                      key={ctrl.id}
                      onClick={() => toggleControl(ctrl.id)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${
                        selectedControls.has(ctrl.id)
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-white"
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="font-mono font-medium">
                        {ctrl.reference_control_code}
                      </span>
                      <span className="text-gray-500 truncate">
                        {ctrl.reference_control_name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !selectedFile || !formData.name || uploadMutation.isPending
              }
            >
              {uploadMutation.isPending
                ? "Uploading..."
                : selectedControls.size > 0
                  ? `Upload & Link (${selectedControls.size})`
                  : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
