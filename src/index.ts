import { promisify } from 'util';
import { exec as execCb, ExecException } from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';

const exec = promisify(execCb);

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

async function main() {
  try {
    const sourcePath = core.getInput('source-path');
    const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);

    if (stderr) {
      throw new Error(stderr);
    }

    const payload = github.context.payload;

    const stats = JSON.parse(stdout) as ClocOutput;
    const ratio = stats.TypeScript.code / stats.SUM.code;

    console.log(ratio);
    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
