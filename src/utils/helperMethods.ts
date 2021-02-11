export function findFileCountOfJSConversionsToTS(filesAdded: string[], filesRemoved: string[]) {
  let count = 0;
  filesAdded.forEach((d) => {
    const splitFileName = d.split('.');
    filesRemoved.forEach((e) => {
      const splitRemovedFileName = e.split('.');
      if (splitRemovedFileName[1] === 'js' && (splitFileName[1] === 'ts' || splitFileName[1] === 'tsx')) {
        if (splitRemovedFileName[0] === splitFileName[0]) {
          count++;
        }
      }
    });
  });
  return count;
}
