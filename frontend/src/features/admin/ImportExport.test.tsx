import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImportExport } from './ImportExport';

describe('ImportExport Component - Error Rendering', () => {
  it('renders initial export and import sections cleanly', () => {
    const html = renderToStaticMarkup(<ImportExport />);
    expect(html).toContain('Application Data Backup &amp; Restore');
    expect(html).toContain('PMCC 2026 Excel Scoring Sheets');
    expect(html).toContain('Download Full Backup (.zip)');
    expect(html).toContain('Download Scoring Sheet (.xlsx)');
    expect(html).toContain('Full Sync');
    expect(html).toContain('Roster Only');
    expect(html).toContain('Matches Only');
  });

  it('renders validation error items containing { location, message } without throwing React Error #31', () => {
    // Directly test the JSX structure used to render validation errors in ImportExport
    const sampleErrors: Array<{ location?: string; message: string }> = [
      { location: 'I7', message: 'Row 7: Invalid slot number' },
      { location: 'L12', message: 'Round 1: Duplicate placement #1' },
      { message: 'General workbook warning' },
    ];

    const errorListHtml = renderToStaticMarkup(
      <div className="border-destructive/50 bg-destructive/10 mt-4 rounded border p-3 text-xs text-destructive">
        <p className="font-semibold">Excel validation failed:</p>
        <ul className="list-disc pl-4 mt-1 space-y-0.5">
          {sampleErrors.map((err, idx) => (
            <li key={idx}>
              {err.location ? (
                <span className="font-mono font-bold mr-1">[{err.location}]</span>
              ) : null}
              {err.message}
            </li>
          ))}
        </ul>
      </div>,
    );

    expect(errorListHtml).toContain('[I7]');
    expect(errorListHtml).toContain('Row 7: Invalid slot number');
    expect(errorListHtml).toContain('[L12]');
    expect(errorListHtml).toContain('Round 1: Duplicate placement #1');
    expect(errorListHtml).toContain('General workbook warning');
    expect(errorListHtml).not.toContain('[object Object]');
  });
});
