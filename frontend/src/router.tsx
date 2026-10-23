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
  OverlayFinalFourRoute,
  OverlayInstanceEliminationRoute,
  OverlayInstanceFinalFourRoute,
  OverlayInstanceMainRoute,
  OverlayInstanceMatchInfoRoute,
  OverlayInstancePostGameRoute,
  OverlayInstancePostGameSeriesRoute,
  OverlayInstanceMostImprovedRoute,
  OverlayInstanceTopKillRoute,
  OverlayInstanceWwcdFullscreenRoute,
  OverlayInstanceWwcdRoute,
  OverlayMatchInfoRoute,
  OverlayPostGameRoute,
  OverlayPostGameSeriesRoute,
  OverlayMostImprovedRoute,
  OverlayTopKillRoute,
  OverlayRoute,
  OverlayWwcdFullscreenRoute,
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

const overlayFinalFourRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/final4',
  component: OverlayFinalFourRoute,
});

const overlayFinalFourAliasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/final-four',
  component: OverlayFinalFourRoute,
});

const overlayWwcdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/wwcd',
  component: OverlayWwcdRoute,
});

const overlayWwcdFullscreenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/wwcd-fullscreen',
  component: OverlayWwcdFullscreenRoute,
});

const overlayPostGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/postgame',
  component: OverlayPostGameRoute,
});

const overlayPostGameMatchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/postgame-match',
  component: OverlayPostGameRoute,
});

const overlayPostGameSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/postgame-series',
  component: OverlayPostGameSeriesRoute,
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

const overlayInstanceMainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/main',
  component: OverlayInstanceMainRoute,
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

const overlayInstanceFinalFourRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/final4',
  component: OverlayInstanceFinalFourRoute,
});

const overlayInstanceFinalFourAliasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/final-four',
  component: OverlayInstanceFinalFourRoute,
});

const overlayInstanceWwcdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/wwcd',
  component: OverlayInstanceWwcdRoute,
});

const overlayInstanceWwcdFullscreenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/wwcd-fullscreen',
  component: OverlayInstanceWwcdFullscreenRoute,
});

const overlayInstancePostGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/postgame',
  component: OverlayInstancePostGameRoute,
});

const overlayInstancePostGameMatchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/postgame-match',
  component: OverlayInstancePostGameRoute,
});

const overlayInstancePostGameSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/postgame-series',
  component: OverlayInstancePostGameSeriesRoute,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPage,
});

// Top-level broadcast shortcuts for quick OBS entry:
const shortcutMainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/main',
  component: OverlayRoute,
});

const shortcutFinalFourRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/final4',
  component: OverlayFinalFourRoute,
});

const shortcutFinalFourAliasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/final-four',
  component: OverlayFinalFourRoute,
});

const shortcutWwcdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wwcd',
  component: OverlayWwcdRoute,
});

const shortcutWwcdFullscreenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wwcd-fullscreen',
  component: OverlayWwcdFullscreenRoute,
});

const shortcutMatchInfoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/match-info',
  component: OverlayMatchInfoRoute,
});

const shortcutPostGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/postgame',
  component: OverlayPostGameRoute,
});

const shortcutPostGameMatchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/postgame-match',
  component: OverlayPostGameRoute,
});

const shortcutPostGameSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/postgame-series',
  component: OverlayPostGameSeriesRoute,
});

const shortcutEliminationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/elimination',
  component: OverlayEliminationRoute,
});

// Part 10 fullscreen statistics screens: `/overlay/top-kill`, `/overlay/<id>/top-kill`, `/top-kill`
// (and the same for `most-improved`), like the post-game screens.
const overlayTopKillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/top-kill',
  component: OverlayTopKillRoute,
});
const overlayInstanceTopKillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/top-kill',
  component: OverlayInstanceTopKillRoute,
});
const shortcutTopKillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/top-kill',
  component: OverlayTopKillRoute,
});
const overlayMostImprovedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/most-improved',
  component: OverlayMostImprovedRoute,
});
const overlayInstanceMostImprovedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overlay/$instanceId/most-improved',
  component: OverlayInstanceMostImprovedRoute,
});
const shortcutMostImprovedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/most-improved',
  component: OverlayMostImprovedRoute,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  shortcutMainRoute,
  shortcutFinalFourRoute,
  shortcutFinalFourAliasRoute,
  shortcutWwcdRoute,
  shortcutWwcdFullscreenRoute,
  shortcutMatchInfoRoute,
  shortcutPostGameRoute,
  shortcutPostGameMatchRoute,
  shortcutPostGameSeriesRoute,
  shortcutEliminationRoute,
  overlayEliminationRoute,
  overlayMatchInfoRoute,
  overlayFinalFourRoute,
  overlayFinalFourAliasRoute,
  overlayWwcdRoute,
  overlayWwcdFullscreenRoute,
  overlayPostGameRoute,
  overlayPostGameMatchRoute,
  overlayPostGameSeriesRoute,
  overlayInstanceMainRoute,
  overlayInstanceEliminationRoute,
  overlayInstanceMatchInfoRoute,
  overlayInstanceFinalFourRoute,
  overlayInstanceFinalFourAliasRoute,
  overlayInstanceWwcdRoute,
  overlayInstanceWwcdFullscreenRoute,
  overlayInstancePostGameRoute,
  overlayInstancePostGameMatchRoute,
  overlayInstancePostGameSeriesRoute,
  overlayTopKillRoute,
  overlayInstanceTopKillRoute,
  shortcutTopKillRoute,
  overlayMostImprovedRoute,
  overlayInstanceMostImprovedRoute,
  shortcutMostImprovedRoute,
  overlayRoute,
  adminRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
