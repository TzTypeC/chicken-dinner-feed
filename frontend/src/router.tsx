import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AdminPage } from '@/pages/AdminPage';
import {
  OverlayEliminationRoute,
  OverlayInstanceEliminationRoute,
  OverlayInstanceMatchInfoRoute,
  OverlayInstancePostGameRoute,
  OverlayInstanceWwcdRoute,
  OverlayMatchInfoRoute,
  OverlayPostGameRoute,
  OverlayRoute,
  OverlayWwcdRoute,
} from '@/pages/OverlayRoute';

const rootRoute = createRootRoute({ component: Outlet });

// `/` has no screen of its own — it just sends the operator straight to the admin, so nobody lands
// on a blank-looking page and wonders where the admin went (it used to be an unlinked status page).
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/admin' });
  },
});

const overlayEliminationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/elimination',
  component: OverlayEliminationRoute,
});

const overlayMatchInfoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/match-info',
  component: OverlayMatchInfoRoute,
});

const overlayWwcdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/wwcd',
  component: OverlayWwcdRoute,
});

const overlayPostGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/postgame',
  component: OverlayPostGameRoute,
});

/**
 * One route per overlay instance. The instance id is the whole addressing scheme: a director copies
 * this URL into a browser source, and the same id is what Companion calls at
 * `/api/overlays/:instanceId/show` (ADR-0012).
 */
const overlayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId',
  component: OverlayRoute,
});

const overlayInstanceEliminationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/elimination',
  component: OverlayInstanceEliminationRoute,
});

const overlayInstanceMatchInfoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/match-info',
  component: OverlayInstanceMatchInfoRoute,
});

const overlayInstanceWwcdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/wwcd',
  component: OverlayInstanceWwcdRoute,
});

const overlayInstancePostGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/postgame',
  component: OverlayInstancePostGameRoute,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  overlayEliminationRoute,
  overlayMatchInfoRoute,
  overlayWwcdRoute,
  overlayPostGameRoute,
  overlayInstanceEliminationRoute,
  overlayInstanceMatchInfoRoute,
  overlayInstanceWwcdRoute,
  overlayInstancePostGameRoute,
  overlayRoute,
  adminRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
