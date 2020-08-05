import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import got from 'got';
import * as core from '@actions/core';

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

async function submitRatioToDatadog(ratio: number, datadogMetric: string, datadogApiKey: string) {
  try {
    const params = new URLSearchParams({ api_key: datadogApiKey });
    const data = {
      series: [
        {
          host: 'gonfalon',
          metric: datadogMetric,
          type: 'gauge',
          points: [[Math.floor(Date.now() / 1000), ratio]],
        },
      ],
    };
    const response = await got.post(`https://api.datadoghq.com/api/v1/series?${params.toString()}`, {
      json: data,
      responseType: 'json',
    });

    console.dir({
      request: JSON.stringify(data, null, 2),
      response: JSON.stringify(response.body, null, 2),
    });
  } catch (error) {
    throw error;
  }
}

async function reportRatio(sourcePath: string, datadogMetric: string, datadogApiKey: string) {
  try {
    const { stdout, stderr } = await exec(`npx --quiet cloc --include-lang=TypeScript,JavaScript --json ${sourcePath}`);

    if (stderr) {
      throw new Error(stderr);
    }

    const stats = JSON.parse(stdout) as ClocOutput;
    const ratio = stats.TypeScript.code / stats.SUM.code;

    await submitRatioToDatadog(ratio, datadogMetric, datadogApiKey);
  } catch (error) {
    core.setFailed(error.message);
  }
}

const sourcePath = core.getInput('source-path');
const datadogMetric = core.getInput('datadog-metric');
const datadogApiKey = core.getInput('datadog-api-key');

reportRatio(sourcePath, datadogMetric, datadogApiKey);
