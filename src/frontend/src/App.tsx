import { RequireAdmin, RequireAuth } from "@/components/auth/RequireAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { useI18n } from "@/i18n";
import { AdminPage } from "@/pages/AdminPage";
import { PlayersPage } from "@/pages/PlayersPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { TournamentDetailPage } from "@/pages/TournamentDetailPage";
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

function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="club-page club-state">
      <p className="section-kicker">{t("404 / OUT OF BOUNDS")}</p>
      <h1 className="font-display text-3xl font-bold uppercase">
        {t("Wrong side of the table.")}
      </h1>
      <Link to="/tournaments" className="btn btn-primary mt-6">
        {t("Back to tournaments")}
      </Link>
    </div>
  );
}
const rootRoute = createRootRoute({
  component: MainLayout,
  notFoundComponent: NotFoundPage,
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/tournaments" });
  },
});
const playersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players",
  component: PlayersPage,
});
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  beforeLoad: () => {
    throw redirect({ to: "/players" });
  },
});
const tournamentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tournaments",
  component: TournamentsPage,
});
const tournamentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tournaments/$tournamentId",
  validateSearch: (search: Record<string, unknown>): { view?: "bracket" } =>
    search.view === "bracket" ? { view: "bracket" } : {},
  component: TournamentRoomRoute,
});

function TournamentRoomRoute() {
  const { t } = useI18n();
  const { tournamentId } = tournamentDetailRoute.useParams();
  if (!/^\d+$/.test(tournamentId)) {
    return (
      <div className="club-page club-state">
        <h1 className="font-display text-3xl font-bold uppercase">
          {t("Tournament not found.")}
        </h1>
        <Link to="/tournaments" className="btn btn-primary mt-6">
          {t("Back to tournaments")}
        </Link>
      </div>
    );
  }
  return <TournamentDetailPage tournamentId={BigInt(tournamentId)} />;
}
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <RequireAdmin>
      <AdminPage />
    </RequireAdmin>
  ),
});
const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/accounts",
  component: () => (
    <RequireAdmin>
      <UsersPage />
    </RequireAdmin>
  ),
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
});
export const routeTree = rootRoute.addChildren([
  indexRoute,
  playersRoute,
  usersRoute,
  tournamentsRoute,
  tournamentDetailRoute,
  adminRoute,
  accountsRoute,
  profileRoute,
]);
const router = createRouter({
  routeTree,
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
