import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  FileText,
  Download,
  ExternalLink,
  Image,
  FileCode,
  FileSpreadsheet,
} from "lucide-react";
import type { Evidence } from "../../types/evidence.types";

interface EvidenceViewerProps {
  evidence: Evidence;
}

export function EvidenceViewer({ evidence }: EvidenceViewerProps) {
  const getFileIcon = () => {
    const ext = evidence.file_extension.toLowerCase();

    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"].includes(ext)) {
      return <Image className="h-12 w-12 text-blue-600" />;
    } else if ([".pdf"].includes(ext)) {
      return <FileText className="h-12 w-12 text-red-600" />;
    } else if ([".xls", ".xlsx", ".csv"].includes(ext)) {
      return <FileSpreadsheet className="h-12 w-12 text-green-600" />;
    } else if (
      [".json", ".xml", ".yaml", ".txt", ".log", ".md"].includes(ext)
    ) {
      return <FileCode className="h-12 w-12 text-purple-600" />;
    } else {
      return <FileText className="h-12 w-12 text-gray-600" />;
    }
  };

  const canPreview = () => {
    const ext = evidence.file_extension.toLowerCase();
    return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".pdf"].includes(
      ext,
    );
  };

  const isImage = () => {
    const ext = evidence.file_extension.toLowerCase();
    return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"].includes(ext);
  };

  const isPDF = () => {
    return evidence.file_extension.toLowerCase() === ".pdf";
  };

  const renderPreview = () => {
    if (isImage()) {
      return (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={evidence.file_url}
            alt={evidence.name}
            className="w-full h-auto max-h-[600px] object-contain"
          />
        </div>
      );
    }

    if (isPDF()) {
      return (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden">
          <iframe
            src={evidence.file_url}
            className="w-full h-[600px] border-0"
            title={evidence.name}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardContent className="p-6">
        {canPreview() ? (
          <div className="space-y-4">
            {renderPreview()}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Preview may not reflect exact formatting
              </p>
              <Button variant="outline" asChild>
                <a
                  href={evidence.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4">{getFileIcon()}</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Preview Not Available
            </h3>
            <p className="text-gray-600 mb-6">
              This file type cannot be previewed in the browser.
              <br />
              Download the file to view its contents.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild>
                <a href={evidence.file_url} download>
                  <Download className="mr-2 h-4 w-4" />
                  Download File
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={evidence.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </a>
              </Button>
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left max-w-md mx-auto">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                File Information
              </h4>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Type:</dt>
                  <dd className="text-gray-900 font-medium">
                    {evidence.file_extension.toUpperCase()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Size:</dt>
                  <dd className="text-gray-900 font-medium">
                    {evidence.file_size_display}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">MIME Type:</dt>
                  <dd className="text-gray-900 font-medium truncate max-w-[200px]">
                    {evidence.file_type || "Unknown"}
                  </dd>
                </div>
                {evidence.file_hash && (
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <dt className="text-gray-600">SHA-256:</dt>
                    <dd
                      className="text-gray-900 font-mono text-xs truncate max-w-[200px]"
                      title={evidence.file_hash}
                    >
                      {evidence.file_hash.substring(0, 16)}...
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
