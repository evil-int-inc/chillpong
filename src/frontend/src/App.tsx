import { RequireAdmin, RequireAuth } from "@/components/auth/RequireAuth";
import { MainLayout } from "@/components/ui/layouts/MainLayout";
import { AdminPage } from "@/pages/AdminPage";
import { ChannelPage } from "@/pages/ChannelPage";
import { FeedPage } from "@/pages/FeedPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { UploadPage } from "@/pages/UploadPage";
import { WatchPage } from "@/pages/WatchPage";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: MainLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/feed" });
  },
});

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feed",
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === "string" ? search.q : undefined;
    return q === undefined ? {} : { q };
  },
  component: FeedPage,
});

const subscriptionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/subscriptions",
  component: SubscriptionsPage,
});

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/upload",
  component: () => (
    <RequireAuth>
      <UploadPage />
    </RequireAuth>
  ),
});

const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/watch/$videoId",
  validateSearch: (
    search: Record<string, unknown>,
  ): { list?: string; index?: number } => {
    const list =
      typeof search.list === "string" && /^\d+$/.test(search.list)
        ? search.list
        : undefined;
    const parsedIndex =
      typeof search.index === "number"
        ? search.index
        : typeof search.index === "string"
          ? Number(search.index)
          : undefined;
    const index =
      parsedIndex !== undefined &&
      Number.isSafeInteger(parsedIndex) &&
      parsedIndex > 0
        ? parsedIndex
        : undefined;
    return { ...(list ? { list } : {}), ...(index ? { index } : {}) };
  },
  component: WatchPage,
});

const channelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/channel/$userId",
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "videos" | "playlists" } => {
    const tab = search.tab === "playlists" ? "playlists" : undefined;
    return tab ? { tab } : {};
  },
  component: ChannelPage,
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

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <RequireAdmin>
      <AdminPage />
    </RequireAdmin>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  feedRoute,
  subscriptionsRoute,
  uploadRoute,
  watchRoute,
  channelRoute,
  profileRoute,
  adminRoute,
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
