import { Writable, Readable, Stream, Pipe } from 'stream';
const { exec } = require('child_process');
const core = require('@actions/core');
const github = require('@actions/github');

try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  console.log(`Hello ${nameToGreet}!`);
  const time = new Date().toTimeString();
  core.setOutput('time', time);

  // Get the JSON webhook payload for the event that triggered the workflow
  // const payload = JSON.stringify(github.context.payload, undefined, 2);
  // console.log(`The event payload: ${payload}`);

  const sourcePath = core.getInput('source-path');
  exec(
    `npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`,
    (err: Error, stdout: string, stderr: string) => {
      if (err) {
        throw err;
      }

      if (stderr) {
        throw new Error(stderr);
      }

      const stats = JSON.parse(stdout);
      const ratio = stats.TypeScript.code / stats.JavaScript.code;

      console.log(ratio);
    },
  );
} catch (error) {
  core.setFailed(error.message);
}
