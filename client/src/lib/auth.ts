import { queryClient } from "./queryClient";

export interface User {
  id: string;
  username: string;
  role: string;
}

export const getAuthToken = (): string | null => {
  return localStorage.getItem("authToken");
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem("authToken", token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem("authToken");
  // Invalidate all queries when logging out
  queryClient.clear();
};

export const isAuthenticated = (): boolean => {
  return getAuthToken() !== null;
};

export const logout = (): void => {
  removeAuthToken();
  // Redirect to home page
  window.location.href = "/";
};

// Add Authorization header to all requests
export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
