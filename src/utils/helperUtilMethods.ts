export function findFileCountOfJSConversionsToTS(filesAdded: string[], filesRemoved: string[]) {
  let count = 0;
  filesAdded.forEach((d) => {
    const splitFileName = d.split('.');
    filesRemoved.forEach((e) => {
      const splitRemovedFileName = e.split('.');
      if (
        splitRemovedFileName[splitRemovedFileName.length - 1] === 'js' &&
        (splitFileName[splitFileName.length - 1] === 'ts' || splitFileName[splitFileName.length - 1] === 'tsx')
      ) {
        if (splitRemovedFileName[splitRemovedFileName.length - 2] === splitFileName[splitFileName.length - 2]) {
          count++;
        }
      }
    });
  });
  return count;
}
