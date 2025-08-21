import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, ShieldCheck, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromiseForm } from "@/components/promises/promise-form";
import { PromiseList } from "@/components/promises/promise-list";
import { PromiseVerifier } from "@/components/promises/promise-verifier";
import { getAuthToken } from "@/lib/auth";
import { getQueryFn } from "@/lib/queryClient";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!getAuthToken()) {
      setLocation("/auth?mode=login");
    }
  }, [setLocation]);

  const { data: currentUser, isLoading: isLoadingUser, error: userError } = useQuery<{ user: { id: string; username: string; role: string } }>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!getAuthToken(),
  });

  const { data: adminStats, isLoading: isLoadingStats } = useQuery<{ totalUsers: number; totalPromises: number; totalShares: number }>({
    queryKey: ["/api/admin/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: currentUser?.user?.role === "admin",
  });

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (userError || !currentUser?.user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load user data. Please try logging in again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const user = currentUser.user;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* User Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                  <User className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{user.username}</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                    <span className="text-sm text-slate-500">Authenticated with WebAuthn</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-green-600">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-medium">Secure Session</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Panel */}
        {user.role === "admin" && (
          <Card>
            <CardContent className="p-6">
              <h4 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
                <User className="text-amber-500 mr-2" />
                Admin Panel
              </h4>

              {isLoadingStats ? (
                <div className="grid md:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : adminStats ? (
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {adminStats.totalUsers}
                    </div>
                    <div className="text-sm text-blue-800">Total Users</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {adminStats.totalPromises}
                    </div>
                    <div className="text-sm text-green-800">Total Promises</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {adminStats.totalShares}
                    </div>
                    <div className="text-sm text-purple-800">Promise Shares</div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load admin statistics.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="promises" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="promises">My Promises</TabsTrigger>
            <TabsTrigger value="create">Create Promise</TabsTrigger>
            <TabsTrigger value="verify">Verify Promise</TabsTrigger>
          </TabsList>
          
          <TabsContent value="promises" className="space-y-6">
            <PromiseList currentUser={user} />
          </TabsContent>
          
          <TabsContent value="create" className="space-y-6">
            <PromiseForm />
          </TabsContent>
          
          <TabsContent value="verify" className="space-y-6">
            <PromiseVerifier />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
