import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { complianceApi } from "../../api/compliance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  Plus,
  Award,
  Target,
  Calendar,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { formatDate } from "../../lib/utils";
import { AdoptFrameworkDialog } from "./AdoptFrameworkDialog";

export function FrameworkAdoptionList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAdoptDialog, setShowAdoptDialog] = useState(false);
  const [selectedAdoption, setSelectedAdoption] = useState<any>(null);
  const [showCertifyForm, setShowCertifyForm] = useState<string | null>(null);
  const [certifyData, setCertifyData] = useState({
    certification_body: "",
    certification_date: "",
    certification_expiry_date: "",
    certificate_number: "",
  });

  const { data: adoptions, isLoading } = useQuery({
    queryKey: ["all-adoptions"],
    queryFn: () => complianceApi.getAdoptions({ page_size: 100 }),
  });

  const { data: expiringSoon } = useQuery({
    queryKey: ["expiring-certifications"],
    queryFn: complianceApi.getExpiringSoon,
  });

  const certifyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      complianceApi.certifyFramework(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-adoptions"] });
      setShowCertifyForm(null);
      setCertifyData({
        certification_body: "",
        certification_date: "",
        certification_expiry_date: "",
        certificate_number: "",
      });
    },
  });

  const statusConfig: Record<string, { color: string; label: string }> = {
    planning: { color: "bg-gray-100 text-gray-800", label: "Planning" },
    implementing: { color: "bg-blue-100 text-blue-800", label: "Implementing" },
    operational: {
      color: "bg-purple-100 text-purple-800",
      label: "Operational",
    },
    certified: { color: "bg-green-100 text-green-800", label: "Certified" },
    suspended: { color: "bg-red-100 text-red-800", label: "Suspended" },
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Framework Adoptions
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your compliance framework programs
          </p>
        </div>
        <Button onClick={() => setShowAdoptDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adopt Framework
        </Button>
      </div>

      {/* Expiring Alert */}
      {expiringSoon && expiringSoon.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-800">
                {expiringSoon.length} certification
                {expiringSoon.length !== 1 ? "s" : ""} expiring within 90 days
              </p>
              <div className="mt-1 flex gap-2 flex-wrap">
                {expiringSoon.map((a: any) => (
                  <span key={a.id} className="text-sm text-yellow-700">
                    {a.framework_code} (expires{" "}
                    {formatDate(a.certification_expiry_date)})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adoptions Grid */}
      {!adoptions?.results || adoptions.results.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">No frameworks adopted yet</p>
            <p className="text-gray-400 mt-2">
              Start by adopting a compliance framework
            </p>
            <Button className="mt-6" onClick={() => setShowAdoptDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adopt Framework
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adoptions.results.map((adoption) => (
            <Card
              key={adoption.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {adoption.framework_code}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {adoption.framework_name}
                    </CardDescription>
                  </div>
                  <Badge
                    className={statusConfig[adoption.adoption_status]?.color}
                  >
                    {statusConfig[adoption.adoption_status]?.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Certification Status */}
                {adoption.is_certified ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <Award className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800">
                        Certified
                      </p>
                      {adoption.certification_body && (
                        <p className="text-xs text-green-700">
                          {adoption.certification_body}
                        </p>
                      )}
                    </div>
                    {adoption.is_certification_expired ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs text-green-700">Expires</p>
                        <p className="text-xs font-medium text-green-800">
                          {adoption.certification_expiry_date
                            ? formatDate(adoption.certification_expiry_date)
                            : "N/A"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : showCertifyForm === adoption.id ? (
                  <div className="space-y-3 p-3 border border-gray-200 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900">
                      Add Certification
                    </h4>
                    <input
                      type="text"
                      placeholder="Certification body"
                      value={certifyData.certification_body}
                      onChange={(e) =>
                        setCertifyData({
                          ...certifyData,
                          certification_body: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                    <input
                      type="date"
                      placeholder="Certification date"
                      value={certifyData.certification_date}
                      onChange={(e) =>
                        setCertifyData({
                          ...certifyData,
                          certification_date: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                    <input
                      type="date"
                      placeholder="Expiry date"
                      value={certifyData.certification_expiry_date}
                      onChange={(e) =>
                        setCertifyData({
                          ...certifyData,
                          certification_expiry_date: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      placeholder="Certificate number"
                      value={certifyData.certificate_number}
                      onChange={(e) =>
                        setCertifyData({
                          ...certifyData,
                          certificate_number: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          certifyMutation.mutate({
                            id: adoption.id,
                            data: certifyData,
                          })
                        }
                        disabled={certifyMutation.isPending}
                      >
                        {certifyMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCertifyForm(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCertifyForm(adoption.id)}
                  >
                    <Award className="mr-2 h-4 w-4" />
                    Add Certification
                  </Button>
                )}

                {/* Dates */}
                <div className="space-y-2 text-sm">
                  {adoption.target_completion_date && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Calendar className="h-3.5 w-3.5" />
                        Target
                      </span>
                      <span className="text-gray-900">
                        {formatDate(adoption.target_completion_date)}
                      </span>
                    </div>
                  )}
                  {adoption.is_audit_overdue && (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="text-xs">Audit overdue</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    navigate(`/compliance/frameworks/${adoption.framework}`)
                  }
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  View Compliance
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Adopt Dialog */}
      <AdoptFrameworkDialog
        open={showAdoptDialog}
        onClose={() => setShowAdoptDialog(false)}
        onSuccess={() => {
          setShowAdoptDialog(false);
          queryClient.invalidateQueries({ queryKey: ["all-adoptions"] });
        }}
      />
    </div>
  );
}
