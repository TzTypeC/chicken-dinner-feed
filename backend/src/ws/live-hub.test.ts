import type { ServerMessage, TeamRosterEntry } from '@cdf/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { IngestUpdate } from '../ingest/source.js';
import { MatchStore } from '../state/match-store.js';
import { LiveHub, type LiveClient } from './live-hub.js';

const roster: TeamRosterEntry[] = [
  { teamNo: 1, name: 'ONE', logoUrl: null },
  { teamNo: 2, name: 'TWO', logoUrl: null },
];

class FakeClient implements LiveClient {
  readyState = 1;
  readonly sent: ServerMessage[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ServerMessage);
  }
}

function update(overrides: Partial<IngestUpdate> = {}): IngestUpdate {
  return {
    matchId: 'match-1',
    phase: 'live',
    players: [
      {
        id: 'p1',
        name: 'P1',
        teamNo: 1,
        slot: 1,
        liveState: 'alive',
        health: 100,
        healthMax: 100,
        kills: 0,
        rank: 0,
      },
    ],
    ...overrides,
  };
}

describe('LiveHub', () => {
  let store: MatchStore;
  let hub: LiveHub;

  beforeEach(() => {
    store = new MatchStore({ source: 'mock', roster });
    hub = new LiveHub({ store });
  });

  it('sends a snapshot immediately when a client connects', () => {
    const client = new FakeClient();
    hub.addClient(client);

    expect(client.sent).toHaveLength(1);
    expect(client.sent[0]?.type).toBe('snapshot');
  });

  it('gives a client connecting mid-match the current state, not an empty one', () => {
    store.applyUpdate(update({ players: [{ ...update().players[0]!, kills: 4 }] }));
    hub.publish();

    const latecomer = new FakeClient();
    hub.addClient(latecomer);

    const message = latecomer.sent[0];
    expect(message?.type).toBe('snapshot');
    if (message?.type !== 'snapshot') throw new Error('expected a snapshot');
    expect(message.snapshot.match.teams.find((team) => team.teamNo === 1)?.eliminations).toBe(4);
  });

  it('does not broadcast when nothing visible changed', () => {
    // The state has to be established *before* the client connects, or the first update would
    // itself be a genuine change (empty table → live match) and the assertion would be meaningless.
    store.applyUpdate(update());
    hub.publish();

    const client = new FakeClient();
    hub.addClient(client);
    const before = client.sent.length;

    // Same data again: this is the common case, since the upstream pushes on every tick whether or
    // not anything we render moved.
    store.applyUpdate(update());
    const sent = hub.publish();

    expect(sent).toBe(false);
    expect(client.sent).toHaveLength(before);
  });

  it('ignores lastUpdateAt when deciding whether to broadcast', () => {
    store.applyUpdate(update(), 1_000);
    hub.publish();
    const client = new FakeClient();
    hub.addClient(client);
    const before = client.sent.length;

    // Identical payload, later clock. Only the timestamp moved.
    store.applyUpdate(update(), 9_000);

    expect(hub.publish()).toBe(false);
    expect(client.sent).toHaveLength(before);
  });

  it('broadcasts when the rendered state actually changes', () => {
    store.applyUpdate(update());
    hub.publish();
    const client = new FakeClient();
    hub.addClient(client);
    const before = client.sent.length;

    store.applyUpdate(update({ players: [{ ...update().players[0]!, health: 40 }] }));

    expect(hub.publish()).toBe(true);
    expect(client.sent.length).toBe(before + 1);
  });

  it('increases the revision on every broadcast', () => {
    const client = new FakeClient();
    hub.addClient(client);

    store.applyUpdate(update());
    hub.publish();
    store.applyUpdate(update({ players: [{ ...update().players[0]!, kills: 1 }] }));
    hub.publish();

    const revisions = client.sent
      .filter(
        (message): message is Extract<ServerMessage, { type: 'snapshot' }> =>
          message.type === 'snapshot',
      )
      .map((message) => message.snapshot.revision);

    expect(revisions).toEqual([...revisions].sort((a, b) => a - b));
    expect(new Set(revisions).size).toBe(revisions.length);
  });

  it('stops sending to a socket that is no longer open', () => {
    const client = new FakeClient();
    hub.addClient(client);
    const before = client.sent.length;

    client.readyState = 3; // CLOSED
    store.applyUpdate(update());
    hub.publish();

    expect(client.sent).toHaveLength(before);
  });

  it('drops a client that throws on send instead of failing the whole broadcast', () => {
    // One stalled browser source must not blank every other overlay in the production.
    const healthy = new FakeClient();
    const broken = new FakeClient();
    broken.send = () => {
      throw new Error('socket exploded');
    };

    hub.addClient(healthy);
    hub.addClient(broken);
    const healthyBefore = healthy.sent.length;

    store.applyUpdate(update());
    expect(() => hub.publish()).not.toThrow();

    expect(healthy.sent.length).toBe(healthyBefore + 1);
    expect(hub.clientCount).toBe(1);
  });

  describe('sourceCountFor', () => {
    it('counts only the browser sources rendering that instance', () => {
      hub.addClient(new FakeClient(), 'main');
      hub.addClient(new FakeClient(), 'main');
      hub.addClient(new FakeClient(), 'lower');
      hub.addClient(new FakeClient(), null); // an observer, e.g. the admin

      expect(hub.sourceCountFor('main')).toBe(2);
      expect(hub.sourceCountFor('lower')).toBe(1);
      expect(hub.sourceCountFor('nobody')).toBe(0);
    });

    it('excludes the admin preview, which would otherwise answer the question wrongly', () => {
      // "Is anything showing this overlay?" is a question about OBS. The operator asking it has the
      // admin open in front of them, so counting their own preview would always answer yes.
      hub.addClient(new FakeClient(), 'main', { isPreview: true });

      expect(hub.sourceCountFor('main')).toBe(0);
      expect(hub.clientCount).toBe(1);
    });

    it('drops back to zero once the source disconnects', () => {
      const source = new FakeClient();
      hub.addClient(source, 'main');
      expect(hub.sourceCountFor('main')).toBe(1);

      hub.removeClient(source);

      expect(hub.sourceCountFor('main')).toBe(0);
    });
  });

  it('broadcasts a new snapshot when matchInfo changes even if match state is unchanged', () => {
    let currentMatchInfo = { matchNumber: 1, mapName: 'Erangel' };
    const matchInfoHub = new LiveHub({
      store,
      resolveMatchInfo: () => currentMatchInfo,
    });

    store.applyUpdate(update());
    matchInfoHub.publish();

    const client = new FakeClient();
    matchInfoHub.addClient(client);
    const firstMsg = client.sent[0];
    expect(firstMsg?.type).toBe('snapshot');
    if (firstMsg?.type === 'snapshot') {
      expect(firstMsg.snapshot.matchInfo).toEqual({ matchNumber: 1, mapName: 'Erangel' });
    }

    currentMatchInfo = { matchNumber: 3, mapName: 'Miramar' };
    expect(matchInfoHub.publish()).toBe(true);
    const secondMsg = client.sent[1];
    expect(secondMsg?.type).toBe('snapshot');
    if (secondMsg?.type === 'snapshot') {
      expect(secondMsg.snapshot.matchInfo).toEqual({ matchNumber: 3, mapName: 'Miramar' });
    }
  });

  it('broadcasts a new snapshot when lastClosedMap changes so /overlay/postgame updates live', () => {
    let closedMap: import('@cdf/shared').ClosedMapResult | null = null;
    const postGameHub = new LiveHub({
      store,
      resolveLastClosedMap: () => closedMap,
    });

    store.applyUpdate(update());
    postGameHub.publish();

    const client = new FakeClient();
    postGameHub.addClient(client);
    const firstMsg = client.sent[0];
    expect(firstMsg?.type).toBe('snapshot');
    if (firstMsg?.type === 'snapshot') {
      expect(firstMsg.snapshot.lastClosedMap).toBeNull();
    }

    closedMap = {
      id: 'map-1',
      mapNumber: 1,
      mapName: 'Erangel',
      matchId: 'match-1',
      startedAt: 1000,
      endedAt: 2000,
      teams: [
        {
          teamNo: 1,
          placement: 1,
          eliminations: 10,
          killPoints: 10,
          placementPoints: 10,
          totalPoints: 20,
        },
      ],
    };
    expect(postGameHub.publish()).toBe(true);
    const secondMsg = client.sent[1];
    expect(secondMsg?.type).toBe('snapshot');
    if (secondMsg?.type === 'snapshot') {
      expect(secondMsg.snapshot.lastClosedMap?.id).toBe('map-1');
      expect(secondMsg.snapshot.lastClosedMap?.teams[0]?.totalPoints).toBe(20);
    }
  });
});
