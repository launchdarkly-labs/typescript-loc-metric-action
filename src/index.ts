import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import got from 'got';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { findFileCountOfJSConversionsToTS } from './utils/helperMethods';
import fetch from 'cross-fetch';

type WebhookPayload = typeof github.context.payload;

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

async function submitToDataDog(
  dataPoint: number,
  timestamp: number,
  author: string,
  datadogMetric: string,
  datadogApiKey: string,
  seriesType: string,
) {
  try {
    const params = new URLSearchParams({ api_key: datadogApiKey });
    await got.post(`https://api.datadoghq.com/api/v1/series?${params.toString()}`, {
      json: {
        series: [
          {
            host: 'gonfalon',
            metric: datadogMetric,
            type: seriesType,
            points: [[timestamp, dataPoint]],
            tags: [`author:${author}`],
          },
        ],
      },
      responseType: 'json',
    });
  } catch (error) {
    throw error;
  }
}

async function getData(url = '') {
  // Default options are marked with *
  const response = await fetch(url);
  console.log(response.json());
  return response.json(); // parses JSON response into native JavaScript objects
}

async function reportCountOfFilesConverted(
  sourcePath: string,
  webhookPayload: WebhookPayload,
  datadogMetric: string,
  datadogApiKey: string,
) {
  //  https://api.github.com/orgs/launchdarkly/repos/{owner}/gonfalon/commits/{ref}
  console.log(webhookPayload.repository?.commits_url);

  try {
    const res = await fetch(
      `https://api.github.com/repos/launchdarkly/gonfalon/commits/${webhookPayload.head_commit.id}`,
    );

    if (res.status >= 400) {
      console.log(res);
      throw new Error('Bad response from server');
    }

    const user = await res.json();

    console.log(user);
  } catch (err) {
    console.error(err);
  }

  // getData(webhookPayload.repository?.commits_url)
  //   .then((data) => console.log(data))
  //   .catch((error) => console.log(error));
  //
  // try {
  //   const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);
  //
  //   if (stderr) {
  //     throw new Error(stderr);
  //   }
  //
  //   const headCommit = webhookPayload.head_commit;
  //   const timestampOfHeadCommit = Math.floor(new Date(headCommit.timestamp).getTime() / 1000);
  //   const author = headCommit.author.email;
  //   const filesAdded = headCommit.added;
  //   const filesRemoved = headCommit.removed;
  //   console.log(webhookPayload);
  //   const count = findFileCountOfJSConversionsToTS(filesAdded, filesRemoved);
  //   await submitToDataDog(count, timestampOfHeadCommit, author, datadogMetric, datadogApiKey, 'count');
  //
  //   console.log(`User converted ${count}% of JS files to Typescript ${sourcePath}`);
  // } catch (error) {
  //   core.setFailed(error.message);
  // }
}

async function reportRatio(
  sourcePath: string,
  webhookPayload: WebhookPayload,
  datadogMetric: string,
  datadogApiKey: string,
) {
  try {
    const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);

    if (stderr) {
      throw new Error(stderr);
    }

    const stats = JSON.parse(stdout) as ClocOutput;
    const ratio = stats.TypeScript.code / stats.SUM.code;
    const headCommit = webhookPayload.head_commit;
    const timestampOfHeadCommit = Math.floor(new Date(headCommit.timestamp).getTime() / 1000);
    const author = headCommit.author.email;

    await submitToDataDog(ratio, timestampOfHeadCommit, author, datadogMetric, datadogApiKey, 'gauge');

    console.log(`TypeScript is ${Math.round(ratio * 100)}% of the code in ${sourcePath}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

const sourcePath = core.getInput('source-path');
const datadogProgressMetric = core.getInput('datadog-typescript-progress-metric');
const datadogFilesConvertedMetric = core.getInput('datadog-files-converted-metric');
const datadogApiKey = core.getInput('datadog-api-key');
const webhookPayload = github.context.payload;

// reportRatio(sourcePath, webhookPayload, datadogProgressMetric, datadogApiKey);
reportCountOfFilesConverted(sourcePath, webhookPayload, datadogFilesConvertedMetric, datadogApiKey);
