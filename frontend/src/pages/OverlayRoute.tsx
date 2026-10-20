import { useParams } from '@tanstack/react-router';
import { OverlayPage } from './OverlayPage';

/**
 * Reads the instance id from the URL and hands it to the overlay.
 *
 * Kept separate so `OverlayPage` takes a plain prop and can be rendered without a router — which is
 * what the admin's live preview will need.
 */
export function OverlayRoute() {
  const { instanceId } = useParams({ from: '/overlay/$instanceId' });
  return <OverlayPage instanceId={instanceId} surfaceMode="leaderboard" />;
}

export function OverlayEliminationRoute() {
  return <OverlayPage surfaceMode="elimination" />;
}

export function OverlayInstanceEliminationRoute() {
  const { instanceId } = useParams({ from: '/overlay/$instanceId/elimination' });
  return <OverlayPage instanceId={instanceId} surfaceMode="elimination" />;
}

export function OverlayMatchInfoRoute() {
  return <OverlayPage surfaceMode="match-info" />;
}

export function OverlayInstanceMatchInfoRoute() {
  const { instanceId } = useParams({ from: '/overlay/$instanceId/match-info' });
  return <OverlayPage instanceId={instanceId} surfaceMode="match-info" />;
}

export function OverlayWwcdRoute() {
  return <OverlayPage surfaceMode="wwcd" />;
}

export function OverlayInstanceWwcdRoute() {
  const { instanceId } = useParams({ from: '/overlay/$instanceId/wwcd' });
  return <OverlayPage instanceId={instanceId} surfaceMode="wwcd" />;
}

export function OverlayPostGameRoute() {
  return <OverlayPage surfaceMode="postgame" />;
}

export function OverlayInstancePostGameRoute() {
  const { instanceId } = useParams({ from: '/overlay/$instanceId/postgame' });
  return <OverlayPage instanceId={instanceId} surfaceMode="postgame" />;
}
