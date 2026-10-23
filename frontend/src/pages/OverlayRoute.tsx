import { useParams } from '@tanstack/react-router';
import { OverlayPage } from './OverlayPage';

/**
 * Reads the instance id from the URL and hands it to the overlay.
 *
 * Kept separate so `OverlayPage` takes a plain prop and can be rendered without a router — which is
 * what the admin's live preview and static markup tests use.
 */
export function OverlayRoute() {
  const { instanceId } = (useParams({ strict: false }) as { instanceId?: string }) ?? {};
  return <OverlayPage instanceId={instanceId} surfaceMode={instanceId ? 'auto' : 'leaderboard'} />;
}

export function OverlayInstanceMainRoute() {
  const { instanceId } = (useParams({ strict: false }) as { instanceId?: string }) ?? {};
  return <OverlayPage instanceId={instanceId} surfaceMode="leaderboard" />;
}

export function OverlayEliminationRoute() {
  return <OverlayPage surfaceMode="elimination" />;
}

export function OverlayFinalFourRoute() {
  return <OverlayPage surfaceMode="final-four" />;
}

export function OverlayInstanceFinalFourRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="final-four" />;
}

export function OverlayInstanceEliminationRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="elimination" />;
}

export function OverlayMatchInfoRoute() {
  return <OverlayPage surfaceMode="match-info" />;
}

export function OverlayInstanceMatchInfoRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="match-info" />;
}

export function OverlayWwcdRoute() {
  return <OverlayPage surfaceMode="wwcd" />;
}

export function OverlayInstanceWwcdRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="wwcd" />;
}

export function OverlayWwcdFullscreenRoute() {
  return <OverlayPage surfaceMode="wwcd-fullscreen" />;
}

export function OverlayInstanceWwcdFullscreenRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="wwcd-fullscreen" />;
}

export function OverlayPostGameRoute() {
  return <OverlayPage surfaceMode="postgame" />;
}

export function OverlayInstancePostGameRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="postgame" />;
}

export function OverlayPostGameSeriesRoute() {
  return <OverlayPage surfaceMode="postgame-series" />;
}

export function OverlayInstancePostGameSeriesRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="postgame-series" />;
}

export function OverlayTopKillRoute() {
  return <OverlayPage surfaceMode="top-kill" />;
}

export function OverlayInstanceTopKillRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="top-kill" />;
}

export function OverlayMostImprovedRoute() {
  return <OverlayPage surfaceMode="most-improved" />;
}

export function OverlayInstanceMostImprovedRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="most-improved" />;
}

export function OverlayNextMapRoute() {
  return <OverlayPage surfaceMode="next-map" />;
}

export function OverlayInstanceNextMapRoute() {
  const { instanceId } = useParams({ strict: false }) as { instanceId?: string };
  return <OverlayPage instanceId={instanceId} surfaceMode="next-map" />;
}
