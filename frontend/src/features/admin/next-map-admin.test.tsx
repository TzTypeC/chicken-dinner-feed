import { DEFAULT_OVERLAY_APPEARANCE } from '@cdf/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppearanceEditor } from './AppearanceEditor';

describe('Next Map Admin Settings and Reactivity', () => {
  it('renders quick override buttons and simulator mode options for next-map instance', () => {
    const html = renderToStaticMarkup(
      <AppearanceEditor
        appearance={DEFAULT_OVERLAY_APPEARANCE}
        instanceType="next-map"
        closedMaps={[]}
        customFonts={[]}
        onChange={vi.fn()}
      />,
    );

    // Verify presence of Next Map section
    expect(html).toContain('data-testid="next-map-settings-section"');
    expect(html).toContain('data-testid="next-map-upcoming-select"');

    // Verify quick buttons M1..M4 and Auto
    expect(html).toContain('data-testid="next-map-quick-auto"');
    expect(html).toContain('data-testid="next-map-quick-1"');
    expect(html).toContain('data-testid="next-map-quick-2"');
    expect(html).toContain('data-testid="next-map-quick-3"');
    expect(html).toContain('data-testid="next-map-quick-4"');

    // Verify simulator mode buttons
    expect(html).toContain('data-testid="next-map-sim-disabled"');
    expect(html).toContain('data-testid="next-map-sim-match-1"');
    expect(html).toContain('data-testid="next-map-sim-match-2"');
    expect(html).toContain('data-testid="next-map-sim-match-3"');
    expect(html).toContain('data-testid="next-map-sim-all-completed"');

    // Verify showTeamLogo switch
    expect(html).toContain('Show Team Logo / Tampilkan Logo Tim');
  });
});
