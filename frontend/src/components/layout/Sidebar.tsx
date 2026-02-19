import { Link, useLocation } from "react-router-dom";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard,
  Shield,
  FileText,
  AlertTriangle,
  CheckSquare,
  Building2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { Button } from "../../components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Controls", href: "/controls", icon: Shield },
  { name: "Evidence", href: "/evidence", icon: FileText },
  { name: "Risks", href: "/risks", icon: AlertTriangle },
  { name: "Compliance", href: "/compliance", icon: CheckSquare },
  {
    name: "Departments",
    href: "/organizations/departments",
    icon: Building2,
    children: [
      { name: "List View", href: "/organizations/departments" },
      { name: "Tree View", href: "/organizations/departments/tree" },
    ],
  },
  {
    name: "Framework Library",
    href: "/library/frameworks",
    icon: BookOpen,
  },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { company } = useAuthStore();
  console.log("Company in Sidebar:", company);
  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-300",
          sidebarOpen ? "w-64" : "w-20",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {sidebarOpen ? (
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-gray-900">
                ComplianceHUB
              </span>
            </div>
          ) : (
            <Shield className="h-8 w-8 text-primary mx-auto" />
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden md:flex"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Company name */}
        {sidebarOpen && company && (
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-900 truncate">
              {company.name}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {company.plan} Plan
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
                title={!sidebarOpen ? item.name : undefined}
              >
                <Icon
                  className={cn(
                    "flex-shrink-0 h-5 w-5",
                    sidebarOpen ? "mr-3" : "mx-auto",
                  )}
                />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <p className="text-xs text-gray-500 text-center">
              © 2024 ComplianceHUB
            </p>
          </div>
        )}
      </div>
    </>
  );
}
