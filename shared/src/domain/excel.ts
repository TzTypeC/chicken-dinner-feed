import { z } from 'zod';

export const excelImportModeSchema = z.enum(['roster', 'matches', 'full']);
export type ExcelImportMode = z.infer<typeof excelImportModeSchema>;

export const excelValidationIssueSchema = z.object({
  location: z.string().optional(),
  message: z.string(),
});
export type ExcelValidationIssue = z.infer<typeof excelValidationIssueSchema>;

export const excelRoundSummarySchema = z.object({
  roundNumber: z.number().int().min(1).max(5),
  matchName: z.string().optional(),
  participatingTeamsCount: z.number().int().min(0),
});
export type ExcelRoundSummary = z.infer<typeof excelRoundSummarySchema>;

export const excelImportPreviewSchema = z.object({
  valid: z.boolean(),
  mode: excelImportModeSchema,
  teamsFound: z.number().int().min(0),
  roundsFound: z.number().int().min(0),
  teamNames: z.array(z.string()),
  rounds: z.array(excelRoundSummarySchema),
  warnings: z.array(excelValidationIssueSchema),
  errors: z.array(excelValidationIssueSchema),
});
export type ExcelImportPreview = z.infer<typeof excelImportPreviewSchema>;

export const excelImportResultSchema = z.object({
  success: z.boolean(),
  mode: excelImportModeSchema,
  importedTeamsCount: z.number().int().min(0),
  importedMatchesCount: z.number().int().min(0),
  warnings: z.array(z.string()),
});
export type ExcelImportResult = z.infer<typeof excelImportResultSchema>;
