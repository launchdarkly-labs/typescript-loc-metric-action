export function findFileCountOfJSConversionsToTS(findRenamedFiles: { filename: string; previous_filename: string }[]) {
  let count = 0;
  findRenamedFiles.forEach((d: { filename: string; previous_filename: string }) => {
    const [fileName, fileExtension] = d.filename.split('.');
    const [prevFileName, prevFileExtension] = d.previous_filename.split('.');
    if ((fileExtension === 'ts' || fileExtension === 'tsx') && prevFileExtension === 'js') {
      if (fileName === prevFileName) {
        count++;
      }
    }
  });
  return count;
}
