import { useAuth } from "@/services/hooks";
import { Loader2, ShieldAlert } from "lucide-react";
import { type ReactNode, useEffect } from "react";

/**
 * Guards a route behind authentication. While the identity is initializing it
 * shows a loading state; when the user is anonymous it triggers sign-in and
 * shows a loading state; otherwise it renders the protected content.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitializing, login } = useAuth();

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      login();
    }
  }, [isInitializing, isAuthenticated, login]);

  if (isInitializing) {
    return (
      <div
        data-ocid="loading_state"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <Loader2
          className="size-6 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        data-ocid="loading_state"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <Loader2
          className="size-6 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">Signing in</span>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Guards a route behind the admin role. Renders a loading state while the role
 * is resolving, and a "not authorized" state for signed-in non-admins.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitializing, isAdmin, roleLoading, login } =
    useAuth();

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      login();
    }
  }, [isInitializing, isAuthenticated, login]);

  if (isInitializing || (isAuthenticated && roleLoading)) {
    return (
      <div
        data-ocid="loading_state"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <Loader2
          className="size-6 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">Checking permissions</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        data-ocid="loading_state"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <Loader2
          className="size-6 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">Signing in</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        data-ocid="error_state"
        className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <ShieldAlert className="size-8 text-error" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="max-w-sm text-sm text-base-content/60">
          You do not have permission to view this page. Ask an administrator if
          you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
