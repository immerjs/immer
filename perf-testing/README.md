# Immer Performance Testing

This directory contains performance testing tools for Immer, allowing you to benchmark different versions of Immer and analyze CPU profiles to identify performance bottlenecks.

## Setup

1. **Install dependencies** (in this directory):

   ```bash
   yarn install
   ```

2. **Build Immer first**:

   ```bash
   yarn build-immer
   ```

3. **Build the benchmark bundle**:
   ```bash
   yarn build
   ```

Alternately, you can rebuild both Immer and the benchmarking script:

```bash
yarn build-with-latest
```

## Usage

### Running Benchmarks

To run the performance benchmarks:

```bash
# Run basic benchmarks, with relative version speed comparisons
yarn benchmark

# Run the benchmarks, but also generate a CPU profile
yarn profile
```

Environment variables:

- `BENCH_FILTER`: regex matched against scenario names, e.g. `BENCH_FILTER='^10k-' yarn benchmark`
- `BENCH_VERSIONS`: comma-separated versions to run, e.g. `BENCH_VERSIONS=immer10Perf,immer10PerfAM,mutative`. Default: `immer10,immer11,immer10Perf,immer10PerfAM,mutative` (plus `vanilla`, which always runs as the baseline)
- `BENCH_JSON`: write raw results (avg, p50, p99, min, max, sample count) to this file

### How scenarios are measured

- Each scenario runs with `freeze: false` and `freeze: true`. With `freeze: true` the initial state is deep-frozen before timing starts, the same as state that earlier Immer or Mutative calls produced. Auto-freeze is turned on for every library in that case, including Mutative.
- Initial states are built once and cached, outside the timed region.
- The default scenarios use a 100-item array. `10k-*` scenarios use a 10,000-item array: toggle one field, update via `find`, push one item, remove one item.
- `*-reuse`, `mixed-sequence`, `rtkq-sequence` and `10k-chain10-*` feed each result into the next call, so later steps start from state the library itself produced.

### Analyzing CPU Profiles

After running `yarn profile`, you'll get a `.cpuprofile` file. To analyze it:

```bash
# Analyze the most recent profile
yarn analyze-profile your-profile.cpuprofile
```

## What's Included

- **immutability-benchmarks.mjs**: Main benchmark script comparing different Immer versions
- **read-cpuprofile.js**: Advanced CPU profile analyzer with sourcemap support
- **rolldown.config.js**: Bundler configuration that eliminates `process.env` overhead

## Benchmark Versions

The benchmarks compare:

- **immer5-10**: Historical Immer versions
- **immer11** / **immer11AM**: Latest published Immer 11, without and with `enableArrayMethods()`
- **immer10Perf** / **immer10PerfAM**: Local build (references `../dist`), without and with `enableArrayMethods()`. The AM variants are bundled as separate module instances so enabling the plugin does not affect the other variant.
- **mutative**: Mutative 2.x, with `enableAutoFreeze` matching the scenario's freeze setting
- **vanilla**: Pure JavaScript implementations for baseline comparison

## Key Features

- **Sourcemap support**: CPU profile analysis includes original function names
- **Version-aware analysis**: Breaks down performance by Immer version
- **Production bundling**: Uses Rolldown to eliminate development overhead
