import type {
  AutoWwcdVariant,
  BackupPreview,
  CustomFont,
  CustomFontsDocument,
  ExcelImportMode,
  ExcelImportPreview,
  ExcelImportResult,
  ManualMatchDocument,
  ManualTeamPatch,
  OperatingMode,
  OverlayInstance,
  OverlayInstancesDocument,
  OverlayType,
  ScoringRuleset,
  SeriesDocument,
  SeriesMatchInfoPatch,
  Team,
  TeamRosterDocument,
  TeamRosterEntry,
} from '@cdf/shared';

/**
 * The admin's view of the backend.
 *
 * Errors carry the server's message rather than a status code: the backend already explains what is
 * wrong in operator language ("Each team number can only appear once"), and re-wording it here would
 * lose that.
 */
export interface ApiValidationError {
  location?: string;
  message: string;
}

export type ApiErrorDetail = string | ApiValidationError;

export class ApiError extends Error {
  readonly status: number;
  /** Every distinct problem found, when the server has more than one to report. */
  readonly errors?: ApiErrorDetail[];

  constructor(status: number, message: string, errors?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/** What the server did to the Manual Match after a successful Close Current Map. */
export type ManualResetOutcome = 'done' | 'skipped' | 'failed';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await requestWithResponse<T>(path, init)).data;
}

async function requestWithResponse<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; response: Response }> {
  const headers = new Headers(init?.headers);

  // Only declare a JSON body when there actually is one. Declaring `application/json` on a bodyless
  // POST makes the server reject it as an empty JSON body — which is what the show/hide calls are,
  // since they take everything from the URL. FormData is left alone so the browser can add the
  // multipart boundary, which it can only do if we have not set the header ourselves.
  if (init?.body !== undefined && init.body !== null && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`/api${path}`, { ...init, headers });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed (HTTP ${response.status})`;
    const errors: ApiErrorDetail[] | undefined =
      body && typeof body === 'object' && 'errors' in body && Array.isArray(body.errors)
        ? body.errors.map((item): ApiErrorDetail => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const location =
                'location' in item && typeof item.location === 'string' ? item.location : undefined;
              const msg =
                'message' in item && typeof item.message === 'string'
                  ? item.message
                  : JSON.stringify(item);
              return { location, message: msg };
            }
            return String(item);
          })
        : undefined;
    throw new ApiError(response.status, message, errors);
  }

  if (response.status === 204) return { data: undefined as T, response };
  return { data: (await response.json()) as T, response };
}

/**
 * One team's inputs for correcting or hand-adding a closed map. Points are derived server-side;
 * `additionalPoints` is the operator's bonus/penalty (ADR-0018), `adjustmentNote` its reason.
 */
export interface ClosedMapTeamPayload {
  teamNo: number;
  placement: number;
  eliminations: number;
  additionalPoints?: number;
  adjustmentNote?: string;
}

export const api = {
  getOverlays: () => request<OverlayInstancesDocument>('/config/overlays'),

  createOverlay: (body: {
    id: string;
    name: string;
    type?: OverlayType;
    copyAppearanceFrom?: string;
  }) =>
    request<OverlayInstance>('/config/overlays', { method: 'POST', body: JSON.stringify(body) }),

  updateAutoWwcdVariant: (autoWwcdVariant: AutoWwcdVariant) =>
    request<OverlayInstancesDocument>('/config/auto-wwcd', {
      method: 'PUT',
      body: JSON.stringify({ autoWwcdVariant }),
    }),

  updateOverlay: (instance: OverlayInstance) =>
    request<OverlayInstance>(`/config/overlays/${instance.id}`, {
      method: 'PUT',
      body: JSON.stringify(instance),
    }),

  deleteOverlay: (instanceId: string) =>
    request<void>(`/config/overlays/${instanceId}`, { method: 'DELETE' }),

  uploadOverlayBackground: (instanceId: string, file: File) => {
    const body = new FormData();
    body.append('background', file);
    return request<OverlayInstance>(`/overlays/${instanceId}/background`, {
      method: 'POST',
      body,
    });
  },

  deleteOverlayBackground: (instanceId: string) =>
    request<OverlayInstance>(`/overlays/${instanceId}/background`, { method: 'DELETE' }),

  getTeams: () => request<TeamRosterDocument>('/config/teams'),
  saveTeams: (document: TeamRosterDocument) =>
    request<TeamRosterDocument>('/config/teams', { method: 'PUT', body: JSON.stringify(document) }),

  /**
   * Uploads carry their own multipart boundary, so the content type must be left for the browser to
   * set — declaring JSON here, as every other call does, would corrupt the request.
   */
  uploadTeamLogo: (teamNo: number, file: File) => {
    const body = new FormData();
    body.append('logo', file);
    return request<TeamRosterEntry>(`/teams/${teamNo}/logo`, { method: 'POST', body });
  },

  deleteTeamLogo: (teamNo: number) =>
    request<TeamRosterEntry>(`/teams/${teamNo}/logo`, { method: 'DELETE' }),

  importTeamIni: (file: File) => {
    const body = new FormData();
    body.append('ini', file);
    return request<{
      teams: number;
      logosCopied: number;
      logosMissing: string[];
      namesTruncated: string[];
      document: TeamRosterDocument;
    }>('/teams/import-ini', { method: 'POST', body });
  },

  getFonts: () => request<CustomFontsDocument>('/config/fonts'),

  uploadFont: (file: File) => {
    const body = new FormData();
    body.append('font', file);
    return request<CustomFont>('/config/fonts', { method: 'POST', body });
  },

  deleteFont: (family: string) =>
    request<CustomFontsDocument>(`/config/fonts/${encodeURIComponent(family)}`, {
      method: 'DELETE',
    }),

  getScoring: () => request<ScoringRuleset>('/config/scoring'),
  saveScoring: (ruleset: ScoringRuleset) =>
    request<ScoringRuleset>('/config/scoring', { method: 'PUT', body: JSON.stringify(ruleset) }),

  setOverlayVisibility: (instanceId: string, action: 'show' | 'hide' | 'toggle') =>
    request<{ instanceId: string; visible: boolean; changedAt: number }>(
      `/overlays/${instanceId}/${action}`,
      { method: 'POST' },
    ),

  transitionOverlay: (sourceInstanceId: string, targetInstanceId: string) =>
    request<{
      source: { instanceId: string; visible: boolean; changedAt: number };
      target: { instanceId: string; visible: boolean; changedAt: number };
    }>(`/overlays/${sourceInstanceId}/transition/${targetInstanceId}`, { method: 'POST' }),

  getSeries: () => request<{ document: SeriesDocument; standings: Team[] }>('/series'),

  updateSeriesMatchInfo: (patch: SeriesMatchInfoPatch) =>
    request<SeriesDocument>('/series/match-info', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  /**
   * Closes the running map. `expectedMatchId` is the match the operator is looking at: the server
   * answers 409 if it is no longer the running one (double click, stale tab). `manualReset` reports
   * what happened to the Manual Match: `done` (reset after the close), `skipped`, or `failed` (the
   * map is recorded, the reset is not — the operator must press Reset manual match).
   */
  closeMapNow: async (
    expectedMatchId?: string,
  ): Promise<{ document: SeriesDocument; manualReset: ManualResetOutcome }> => {
    const { data, response } = await requestWithResponse<SeriesDocument>('/series/close-map', {
      method: 'POST',
      ...(expectedMatchId === undefined ? {} : { body: JSON.stringify({ expectedMatchId }) }),
    });
    const header = response.headers.get('x-cdf-manual-reset');
    const manualReset: ManualResetOutcome =
      header === 'done' || header === 'failed' ? header : 'skipped';
    return { document: data, manualReset };
  },

  resetSeries: () => request<SeriesDocument>('/series/reset', { method: 'POST' }),

  /** `position` is 1-based and clamped server-side, so anything past the end simply appends. */
  addManualMap: (position: number, teams: ClosedMapTeamPayload[]) =>
    request<SeriesDocument>('/series/maps', {
      method: 'POST',
      body: JSON.stringify({ position, teams }),
    }),

  updateClosedMap: (mapId: string, teams: ClosedMapTeamPayload[]) =>
    request<SeriesDocument>(`/series/maps/${mapId}`, {
      method: 'PUT',
      body: JSON.stringify({ teams }),
    }),

  deleteClosedMap: (mapId: string) =>
    request<SeriesDocument>(`/series/maps/${mapId}`, { method: 'DELETE' }),

  /** Not a fetch — a plain navigable URL, so the browser handles the download itself. */
  backupExportUrl: '/api/backup/export',

  previewImport: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<BackupPreview & { imported: false }>('/backup/import', { method: 'POST', body });
  },

  confirmImport: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ imported: true; summary: BackupPreview['summary'] }>(
      '/backup/import?confirm=true',
      { method: 'POST', body },
    );
  },

  seedPmccTeams: () => request<TeamRosterDocument>('/config/teams/seed-pmcc', { method: 'POST' }),

  /** Not a fetch — a plain navigable URL for downloading the Excel scoring workbook. */
  excelExportUrl: '/api/excel/export',

  previewExcelImport: (file: File, mode: ExcelImportMode = 'full') => {
    const body = new FormData();
    body.append('file', file);
    return request<{ confirmed: false; preview: ExcelImportPreview }>(
      `/excel/import?confirm=false&mode=${encodeURIComponent(mode)}`,
      { method: 'POST', body },
    );
  },

  confirmExcelImport: (file: File, mode: ExcelImportMode = 'full') => {
    const body = new FormData();
    body.append('file', file);
    return request<{ confirmed: true; result: ExcelImportResult }>(
      `/excel/import?confirm=true&mode=${encodeURIComponent(mode)}`,
      { method: 'POST', body },
    );
  },

  getManualState: () => request<{ document: ManualMatchDocument; standings: Team[] }>('/manual'),

  setOperatingMode: (mode: OperatingMode) =>
    request<{ document: ManualMatchDocument; standings: Team[] }>('/manual/mode', {
      method: 'PUT',
      body: JSON.stringify({ mode }),
    }),

  patchManualTeam: (teamNo: number, patch: ManualTeamPatch) =>
    request<{ document: ManualMatchDocument; standings: Team[] }>(`/manual/teams/${teamNo}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  updateManualTeams: (teams: ({ teamNo: number } & ManualTeamPatch)[]) =>
    request<{ document: ManualMatchDocument; standings: Team[] }>('/manual/teams', {
      method: 'PUT',
      body: JSON.stringify({ teams }),
    }),

  resetManualMatch: (options?: { seedFromAuto?: boolean }) =>
    request<{ document: ManualMatchDocument; standings: Team[] }>('/manual/reset', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    }),
};
