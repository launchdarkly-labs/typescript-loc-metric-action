import { findFileCountOfJSConversionsToTS } from './helperMethods';

describe('helperMethods', () => {
  it('should return the correct count', () => {
    const files = [
      {
        previous_filename: 'static/ld/components/ManageFlagTargetingContainer.js',
        filename: 'static/ld/components/ManageFlagTargetingContainer.tsx',
      },
      {
        previous_filename: 'static/ld/components/flags.js',
        filename: 'static/ld/components/flags.ts',
      },
    ];
    expect(findFileCountOfJSConversionsToTS(files)).toEqual(2);
  });
});
