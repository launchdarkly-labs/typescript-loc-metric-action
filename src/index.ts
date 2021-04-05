import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import got from 'got';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { findFileCountOfJSConversionsToTS, findFileCountOfJSConversionsToTSForAllFiles } from './utils/helperMethods';

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

async function getCommitData(commitId = '', githubToken: string): Promise<any> {
  const response = await got(`https://api.github.com/repos/launchdarkly/gonfalon/commits/${commitId}`, {
    headers: { Authorization: `token ${githubToken}` },
    responseType: 'json',
  });
  return response.body;
}

function parseTimestamp(timestamp: string) {
  return Math.floor(new Date(timestamp).getTime() / 1000);
}

function getBranch(webhookPayload: WebhookPayload) {
  switch (webhookPayload.action) {
    case 'push':
      return webhookPayload.after;
    case 'opened':
    case 'edited':
    case 'closed':
    case 'assigned':
    case 'unassigned':
    case 'review_requested':
    case 'review_request_removed':
    case 'ready_for_review':
    case 'converted_to_draft':
    case 'labeled':
    case 'unlabeled':
    case 'synchronize':
    case 'auto_merge_enabled':
    case 'auto_merge_disabled':
    case 'locked':
    case 'unlocked':
    case 'reopened':
      return webhookPayload.pull_request?.head.ref;
    default:
      return undefined;
  }
}

function getCommitId(webhookPayload: WebhookPayload) {
  console.log(`getCommitId | ${webhookPayload.action}`, webhookPayload);
  switch (webhookPayload.action) {
    case 'push':
      return webhookPayload.sha;
    case 'opened':
    case 'edited':
    case 'closed':
    case 'assigned':
    case 'unassigned':
    case 'review_requested':
    case 'review_request_removed':
    case 'ready_for_review':
    case 'converted_to_draft':
    case 'labeled':
    case 'unlabeled':
    case 'synchronize':
    case 'auto_merge_enabled':
    case 'auto_merge_disabled':
    case 'locked':
    case 'unlocked':
    case 'reopened':
      return webhookPayload.pull_request?.head.sha;
    default:
      return undefined;
  }
}

async function reportCountOfFilesConverted(
  sourcePath: string,
  webhookPayload: WebhookPayload,
  commit: any,
  branch: string,
  datadogMetric: string,
  datadogApiKey: string,
) {
  try {
    const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);
    if (stderr) {
      throw new Error(stderr);
    }

    const renamedFiles = commit.files
      ? commit.files.filter((f: { previous_filename?: string }) => f.previous_filename)
      : [];
    const otherFiles = commit.files ? commit.files.filter((f: { filename?: string }) => f.filename) : [];
    const count = findFileCountOfJSConversionsToTS(renamedFiles);
    const otherCount = findFileCountOfJSConversionsToTSForAllFiles(otherFiles);
    const totalCount = count + otherCount;

    //do not report 0 counts
    if (totalCount === 0) {
      return;
    }

    const author = commit.commit.committer;
    const email = author.email;
    const timestamp = parseTimestamp(author.date);

    await submitToDataDog(totalCount, timestamp, email, branch, datadogMetric, datadogApiKey, 'count');

    console.log(`User converted ${totalCount} JS files to Typescript ${sourcePath}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}
async function reportLinesOfCodeRatio(
  sourcePath: string,
  webhookPayload: WebhookPayload,
  commit: any,
  branch: string,
  datadogMetric: string,
  datadogApiKey: string,
) {
  try {
    const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);

    if (stderr) {
      throw new Error(stderr);
    }

    console.log('loc', webhookPayload);

    const stats = JSON.parse(stdout) as ClocOutput;
    const ratio = stats.TypeScript.code / stats.SUM.code;

    const author = commit.commit.committer;
    const email = author.email;
    const timestamp = parseTimestamp(author.date);

    await submitToDataDog(ratio, timestamp, email, branch, datadogMetric, datadogApiKey, 'gauge');

    console.log(`TypeScript is ${Math.round(ratio * 100)}% of the code in ${sourcePath}`);
  } catch (error) {
    core.setFailed(error);
  }
}

async function run() {
  const sourcePath = core.getInput('source-path');
  const githubToken = core.getInput('github-token');
  const datadogProgressMetric = core.getInput('datadog-typescript-progress-metric');
  const datadogFilesConvertedMetric = core.getInput('datadog-files-converted-metric');
  const datadogApiKey = core.getInput('datadog-api-key');
  const webhookPayload = github.context.payload;

  try {
    const branch = getBranch(webhookPayload);
    const commitId = getCommitId(webhookPayload);

    if (commitId === undefined) {
      throw new Error('Could not find commit id');
    }

    const commit = await getCommitData(commitId, githubToken);

    console.log(branch, commitId);

    reportLinesOfCodeRatio(sourcePath, webhookPayload, commit, branch, datadogProgressMetric, datadogApiKey);
    reportCountOfFilesConverted(sourcePath, webhookPayload, commit, branch, datadogFilesConvertedMetric, datadogApiKey);
  } catch (error) {
    core.setFailed(error);
  }
}

run();
