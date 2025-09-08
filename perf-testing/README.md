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

- **immer7-10**: Historical Immer versions
- **immer10Perf**: Current development version (references `../dist`)
- **vanilla**: Pure JavaScript implementations for baseline comparison

## Key Features

- **Sourcemap support**: CPU profile analysis includes original function names
- **Version-aware analysis**: Breaks down performance by Immer version
- **Production bundling**: Uses Rolldown to eliminate development overhead
