# TypeScript metric action

This action computes the ratio of TypeScript to JavaScript lines of code for a directory and submits it
to a Datadog metric.

## Usage

Add this to a `.yml` file under `.github/workflows/`:

```
on:
  push:
    branches:
      - main

jobs:
  reportTypeScriptRatio:
    name: Report ratio of Typescript to JavaScript to Datadog
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Report ratio of Typescript to JavaScript to Datadog
        uses: launchdarkly-labs/typescript-loc-metric-action@main
        with:
          source-path: '<!-- Source path goes here -->'
          datadog-metric: '<!-- Datadog metric name goes here -->'
          datadog-api-key: ${{ secrets.DATADOG_API_KEY }}
```

## Contributing

You can test this action by updating the code under `./example`.

Once you've made the changes you wanted, you can release a new version by following these steps:

```bash
$ npm run build
$ npm run package
$ git add .
$ git commit -m 'Commit message'
```
