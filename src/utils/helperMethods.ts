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

export function findFileCountOfJSConversionsToTSForAllFiles(files: { filename: string }[]) {
  let count = 0;
  const countingObj: {[s: string]: number} = {}
  files.forEach((d: { filename: string }) => {
    const [fileName, fileExtension] = d.filename.split('.');
    if (fileExtension === 'ts' || fileExtension === 'tsx' || fileExtension === 'js') {
      if (countingObj[fileName] === 0) {
        //we've seen this file before
        count++
      } else {
        countingObj[fileName] = 0
      }
    }
  });
  return count;
}
