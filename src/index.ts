import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import got from 'got';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { findFileCountOfJSConversionsToTS, findFileCountOfJSConversionsToTSForAllFiles } from './utils/helperMethods';
import fetch from 'node-fetch';

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

type SeriesType = 'gauge' | 'count' | 'rate' | 'distribution';

async function submitToDataDog(
  dataPoint: number,
  timestamp: number,
  author: string,
  branch: string,
  datadogMetric: string,
  datadogApiKey: string,
  seriesType: SeriesType,
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
            tags: [`author:${author}`, `branch:${branch}`],
          },
        ],
      },
      responseType: 'json',
    });
  } catch (error) {
    throw error;
  }
}

async function getData(commitId = '', githubToken: string) {
  const response = await fetch(`https://api.github.com/repos/launchdarkly/gonfalon/commits/${commitId}`, {
    headers: { Authorization: `token ${githubToken}` },
  });
  return await response.json();
}

async function reportCountOfFilesConverted(
  sourcePath: string,
  webhookPayload: WebhookPayload,
  datadogMetric: string,
  datadogApiKey: string,
  githubToken: string,
) {
  const response = await getData(webhookPayload.head_commit.id, githubToken);
  try {
    const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);
    if (stderr) {
      throw new Error(stderr);
    }

    const renamedFiles = response.files
      ? response.files.filter((f: { previous_filename?: string }) => f.previous_filename)
      : [];
    const otherFiles = response.files ? response.files.filter((f: { filename?: string }) => f.filename) : [];
    const count = findFileCountOfJSConversionsToTS(renamedFiles);
    const otherCount = findFileCountOfJSConversionsToTSForAllFiles(otherFiles);
    const totalCount = count + otherCount;

    //do not report 0 counts
    if (totalCount === 0) {
      return;
    }

    const headCommit = webhookPayload.head_commit;
    const timestampOfHeadCommit = Math.floor(new Date(headCommit.timestamp).getTime() / 1000);
    const author = headCommit.author.email;
    const branch = webhookPayload.check_suite.head_branch;
    await submitToDataDog(totalCount, timestampOfHeadCommit, author, branch, datadogMetric, datadogApiKey, 'count');

    console.log(`User converted ${totalCount} JS files to Typescript ${sourcePath}`);
  } catch (error) {
    core.setFailed(error.message);
  }
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
const githubToken = core.getInput('github-token');
const datadogProgressMetric = core.getInput('datadog-typescript-progress-metric');
const datadogFilesConvertedMetric = core.getInput('datadog-files-converted-metric');
const datadogApiKey = core.getInput('datadog-api-key');
const webhookPayload = github.context.payload;

reportRatio(sourcePath, webhookPayload, datadogProgressMetric, datadogApiKey);
reportCountOfFilesConverted(sourcePath, webhookPayload, datadogFilesConvertedMetric, datadogApiKey, githubToken);
