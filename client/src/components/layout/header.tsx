import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, LogOut } from "lucide-react";
import { getAuthToken, logout } from "@/lib/auth";
import { getQueryFn } from "@/lib/queryClient";

export function Header() {
  const [location] = useLocation();
  const isAuthenticated = !!getAuthToken();

  const { data: currentUser } = useQuery<{ user: { id: string; username: string; role: string } }>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center cursor-pointer">
                <Shield className="text-primary text-2xl mr-3" />
                <h1 className="text-xl font-bold text-slate-900">PromiseShare</h1>
                <span className="ml-2 text-sm text-slate-500">Secure Promise Platform</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {!isAuthenticated ? (
              <div className="flex space-x-3">
                <Link href="/auth?mode=login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth?mode=register">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            ) : (
              currentUser?.user && (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant={currentUser.user.role === "admin" ? "default" : "secondary"}>
                      {currentUser.user.role}
                    </Badge>
                    <span className="text-sm font-medium text-slate-700">
                      {currentUser.user.username}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
