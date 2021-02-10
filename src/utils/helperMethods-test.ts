import { findFileCountOfJSConversionsToTS } from './helperUtilMethods';

describe('helperMethods', () => {
  it('should return the correct count', () => {
    const filesRemoved = ['internal/api2/flags/flags_patch.go', 'static/ld/components/ManageFlagTargetingContainer.js'];
    const filesAdded = [
      'internal/api2/flags/flags_patch_test.go',
      'static/ld/components/ManageFlagTargetingContainer.tsx',
    ];
    expect(findFileCountOfJSConversionsToTS(filesAdded, filesRemoved)).toEqual(1);
  });
});
