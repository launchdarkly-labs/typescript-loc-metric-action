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

async function getData(url = '', githubToken: string) {
  const response = await fetch(url, { headers: { Authorization: `token ${githubToken}` } });
  console.log(response.json());
  return response.json();
}

async function reportCountOfFilesConverted(
  sourcePath: string,
  webhookPayload: WebhookPayload,
  datadogMetric: string,
  datadogApiKey: string,
  githubToken: string,
) {
  const response = getData(webhookPayload.head_commit.url, githubToken);
  try {
    const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);
    if (stderr) {
      throw new Error(stderr);
    }
    // somehow get the commit response (this is an example)
    const response = {
      files: [
        {
          sha: 'c1610fc7ab4918c5fb30a64dccecd057a87068b2',
          filename: '.github/workflows/typescript_progress.yml',
          status: 'modified',
          additions: 3,
          deletions: 1,
          changes: 4,
          blob_url:
            'https://github.com/launchdarkly/gonfalon/blob/b3f3c6c0147dd8438a2f4c9ace42210744d4ae67/.github/workflows/typescript_progress.yml',
          raw_url:
            'https://github.com/launchdarkly/gonfalon/raw/b3f3c6c0147dd8438a2f4c9ace42210744d4ae67/.github/workflows/typescript_progress.yml',
          contents_url:
            'https://api.github.com/repos/launchdarkly/gonfalon/contents/.github/workflows/typescript_progress.yml?ref=b3f3c6c0147dd8438a2f4c9ace42210744d4ae67',
          patch:
            "@@ -2,6 +2,7 @@ on:\n   push:\n     branches:\n       - master\n+      - traci/testing-datadog-files-converted-to-typescript-metric\n name: Typescript progress metric\n jobs:\n   reportTypeScriptRatio:\n@@ -14,5 +15,6 @@ jobs:\n         uses: launchdarkly-labs/typescript-loc-metric-action@main\n         with:\n           source-path: './static/ld'\n-          datadog-metric: 'gonfalon.typescript.progress'\n+          datadog-typescript-progress-metric: 'gonfalon.typescript.progress'\n+          datadog-files-converted-metric: 'gonfalon.files.converted.by.author'\n           datadog-api-key: ${{ secrets.DATADOG_API_KEY }}",
        },
        {
          sha: '1df41cf3ed76e5f5facb687081597c93dc81a3ca',
          filename: 'static/ld/utils/confirmationUtils.ts',
          status: 'renamed',
          additions: 0,
          deletions: 0,
          changes: 0,
          blob_url:
            'https://github.com/launchdarkly/gonfalon/blob/b3f3c6c0147dd8438a2f4c9ace42210744d4ae67/static/ld/utils/confirmationUtils.ts',
          raw_url:
            'https://github.com/launchdarkly/gonfalon/raw/b3f3c6c0147dd8438a2f4c9ace42210744d4ae67/static/ld/utils/confirmationUtils.ts',
          contents_url:
            'https://api.github.com/repos/launchdarkly/gonfalon/contents/static/ld/utils/confirmationUtils.ts?ref=b3f3c6c0147dd8438a2f4c9ace42210744d4ae67',
          previous_filename: 'static/ld/utils/confirmationUtils.js',
        },
      ],
    };
    const findRenamedFiles = response.files.filter((f) => f.previous_filename);
    let count = 0;
    findRenamedFiles.forEach((d) => {
      const [fileName, fileExtension] = d.filename.split('.');
      const [prevFileName, prevFileExtension] = d.previous_filename!.split('.');
      if (fileExtension === 'ts' && prevFileExtension === 'js') {
        if (fileName === prevFileName) {
          count++;
        }
      }
    });
    const headCommit = webhookPayload.head_commit;
    const timestampOfHeadCommit = Math.floor(new Date(headCommit.timestamp).getTime() / 1000);
    const author = headCommit.author.email;
    await submitToDataDog(count, timestampOfHeadCommit, author, datadogMetric, datadogApiKey, 'count');

    console.log(`User converted ${count}% of JS files to Typescript ${sourcePath}`);
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

// reportRatio(sourcePath, webhookPayload, datadogProgressMetric, datadogApiKey);
reportCountOfFilesConverted(sourcePath, webhookPayload, datadogFilesConvertedMetric, datadogApiKey, githubToken);
