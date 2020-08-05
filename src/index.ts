import { exec, ExecException } from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';

type ClocOutput = {
  JavaScript: {
    nFiles: number;
    blank: number;
    comment: number;
    code: number;
  };
  TypeScript: {
    nFiles: number;
    blank: number;
    comment: number;
    code: number;
  };
  SUM: {
    blank: number;
    comment: number;
    code: number;
    nFiles: number;
  };
};

try {
  const sourcePath = core.getInput('source-path');

  exec(
    `npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`,
    (err: ExecException | null, stdout: string, stderr: string) => {
      if (err) {
        throw err;
      }

      if (stderr) {
        throw new Error(stderr);
      }

      const payload = github.context.payload;

      const stats = JSON.parse(stdout) as ClocOutput;
      const ratio = stats.TypeScript.code / stats.SUM.code;

      console.log(ratio);
      console.log(JSON.stringify(payload, null, 2));
    },
  );
} catch (error) {
  core.setFailed(error.message);
}
