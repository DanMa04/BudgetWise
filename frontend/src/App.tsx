import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ThemeProvider } from "@/context/ThemeContext";
import { router } from "@/router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  if (!clerkPubKey) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">
          Missing VITE_CLERK_PUBLISHABLE_KEY environment variable
        </p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ClerkProvider publishableKey={clerkPubKey}>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <RouterProvider router={router} />
          </AuthGuard>
        </QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
}
