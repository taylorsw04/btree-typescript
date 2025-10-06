# sorted-btree Development Guide

This guide provides information for working with the sorted-btree repository.

## Project Overview

**sorted-btree** is a fast B+ tree implementation for TypeScript/JavaScript that provides a sorted collection of key-value pairs. It's compatible with ES6 Map but offers additional functionality including:

- Fast O(1) cloning with subtree sharing
- Persistent operations (immutable updates)
- Range queries and batch operations
- Support for both maps and sets
- Efficient memory usage

## Installation

```bash
npm install sorted-btree
```

## Development Setup

```bash
npm install
```

## Running Tests

**IMPORTANT**: After making ANY code changes, you MUST run the tests to ensure the code compiles and all tests pass.

The project uses Jest for testing with TypeScript support via ts-jest.

```bash
npm test
```

This command:
1. Compiles TypeScript files (`tsc`)
2. Creates a workaround file for ts-jest issue #657
3. Runs Jest tests

**Development Workflow:**
1. Make your code changes
2. Run `npm test` to verify compilation and test passing
3. Fix any compilation errors or test failures before proceeding
4. Only mark a task as complete when tests pass

**Coding Standards:**
- **Match Existing Style**: All code must follow the existing coding style found throughout the repository
- **Performance Critical**: This codebase uses strict performance optimizations. Changes must:
  - Avoid unnecessary memory allocations
  - Minimize additional reads or operations
  - Follow the same performance-conscious patterns used in existing code
  - Maintain the same level of optimization found throughout the repository

Test files are located at:
- [b+tree.test.ts](b+tree.test.ts)

## Building

Build the project and create minified output:

```bash
npm run build
```

This will:
1. Compile TypeScript to JavaScript
2. Minify the output to `b+tree.min.js`

To only minify (after TypeScript compilation):

```bash
npm run minify
```

## Benchmarking

Run performance benchmarks:

```bash
npm run benchmark
```

This compiles the project and runs [benchmarks.js](benchmarks.js) to compare performance against other tree implementations.

## Project Structure

- [b+tree.ts](b+tree.ts) - Main B+ tree implementation
- [sorted-array.ts](sorted-array.ts) - Sorted array wrapper class
- [interfaces.d.ts](interfaces.d.ts) - Interface lattice for TypeScript
- [b+tree.test.ts](b+tree.test.ts) - Test suite
- [benchmarks.js](benchmarks.js) - Performance benchmarks

## Publishing

For safe publishing with validation:

```bash
npm run safePublish
```

This runs the build, executes testpack for validation, and publishes to npm.

## Key Features for Development

- **TypeScript**: Written entirely in TypeScript with full type definitions
- **ES5 Compatible**: No ES6+ features required (Symbol.iterator is optional)
- **No Dependencies**: Zero runtime dependencies
- **Jest Configuration**: See [package.json](package.json:65-83) for Jest setup
- **Git Repository**: https://github.com/qwertie/btree-typescript

## Additional Resources

For full API documentation and usage examples, see the [README.md](readme.md).
