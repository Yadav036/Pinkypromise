import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { promiseShareSchema } from "@shared/schema";
import { getAuthHeaders } from "@/lib/auth";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Share2, AlertCircle, User } from "lucide-react";
import type { PromiseShare } from "@shared/schema";

interface SharePromiseFormProps {
  promiseId: string;
  onSuccess?: () => void;
}

export function SharePromiseForm({ promiseId, onSuccess }: SharePromiseFormProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: usersData, isLoading } = useQuery<{ users: { id: string; username: string; role: string }[] }>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const form = useForm<PromiseShare>({
    resolver: zodResolver(promiseShareSchema),
    defaultValues: {
      promiseId,
      userIds: [],
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (data: PromiseShare) => {
      const response = await fetch(`/api/promises/${promiseId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ userIds: data.userIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to share promise");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Promise shared successfully!",
        description: "Selected users can now validate your promise certificate.",
      });
      setSelectedUsers([]);
      onSuccess?.();
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleUserSelect = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const onSubmit = () => {
    if (selectedUsers.length === 0) {
      setError("Please select at least one user to share with");
      return;
    }

    setError(null);
    shareMutation.mutate({
      promiseId,
      userIds: selectedUsers,
    });
  };

  const users = usersData?.users || [];

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Select users to share with:</Label>
        <p className="text-sm text-slate-600 mt-1">
          These users will receive validation certificates for your promise.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
        </div>
      ) : users.length === 0 ? (
        <Alert>
          <User className="h-4 w-4" />
          <AlertDescription>
            No other users available to share with.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {users.map((user) => (
            <div key={user.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-slate-50">
              <Checkbox
                id={user.id}
                checked={selectedUsers.includes(user.id)}
                onCheckedChange={(checked) => handleUserSelect(user.id, !!checked)}
              />
              <div className="flex-1">
                <Label htmlFor={user.id} className="cursor-pointer">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{user.username}</span>
                    <span className="text-xs px-2 py-1 bg-slate-100 rounded">
                      {user.role}
                    </span>
                  </div>
                </Label>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUsers.length > 0 && (
        <Alert>
          <Share2 className="h-4 w-4" />
          <AlertDescription>
            {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected for sharing.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex space-x-2">
        <Button
          onClick={onSubmit}
          disabled={shareMutation.isPending || selectedUsers.length === 0}
          className="flex-1"
        >
          <Share2 className="h-4 w-4 mr-2" />
          {shareMutation.isPending ? "Sharing..." : `Share with ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}