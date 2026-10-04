import { RequireAdmin } from "@/components/auth/RequireAuth";
import { MainLayout } from "@/components/ui/layouts/MainLayout";
import { AdminPage } from "@/pages/AdminPage";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { UsersPage } from "@/pages/UsersPage";
import {
  Link,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: MainLayout,
  notFoundComponent: () => (
    <div className="club-page club-state">
      <p className="section-kicker">404 / OUT OF BOUNDS</p>
      <h1 className="font-display text-3xl font-bold uppercase">
        Wrong side of the table.
      </h1>
      <Link to="/tournaments" className="btn btn-primary mt-6">
        Back to tournaments
      </Link>
    </div>
  ),
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/tournaments" });
  },
});
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: UsersPage,
});
const tournamentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tournaments",
  component: TournamentsPage,
});
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <RequireAdmin>
      <AdminPage />
    </RequireAdmin>
  ),
});
const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    usersRoute,
    tournamentsRoute,
    adminRoute,
  ]),
  defaultPreload: "intent",
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
export default function App() {
  return <RouterProvider router={router} />;
}
