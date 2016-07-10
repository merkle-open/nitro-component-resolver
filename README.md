# Nitro Component Resolver
[![npm version](https://badge.fury.io/js/%40namics%2Fnitro-component-resolver.svg)](https://badge.fury.io/js/%40namics%2Fnitro-component-resolver)
[![Build Status](https://travis-ci.org/namics/nitro-component-resolver.svg?branch=master)](https://travis-ci.org/namics/nitro-component-resolver)
[![Coverage Status](https://coveralls.io/repos/github/namics/nitro-component-resolver/badge.svg?branch=master)](https://coveralls.io/github/namics/nitro-component-resolver?branch=master)
[![Codestyle](https://img.shields.io/badge/codestyle-namics-green.svg)](https://github.com/namics/eslint-config-namics)

A helper to resolve, cache and parse the nitro pattern structure and meta files.

## Installation

```bash
npm i --save-dev @namics/nitro-component-resolver
```

## Usage

```js
const ComponentResolver = require('@namics/nitro-component-resolver');
const resolver = new ComponentResolver({
    rootDirectory: rootDirectories.valid,
    // File watch mode
    watch: true
});
resolver.getComponentTypes()
    .then(function(componentTypes) {
        // Returns all existing nitro component types e.g. 'atoms', 'molecules'
        console.log(componentTypes);
    });
resolver.getComponents()
    .then(function(components) {
        // Returns all nitro components and their package.json content
        console.log(components);
    });
resolver.getComponents('atoms')
    .then(function(components) {
        // Returns the nitro components of type 'atoms' and their package.json content
        console.log(components);
    });
// Optional
resolver.getComponentExamples('a/path/to/atoms/button')
    .then(function(examples) {
        console.log(examples);
    });
// Optional
resolver.getComponentReadme('a/path/to/atoms/button')
    .then(function(readme) {
        console.log(readme);
    });
```

## Performance

The component resolver relies on [chokidar](https://github.com/paulmillr/chokidar).

Chokidar shares its internal file watcher so that only one io-watcher per file/folder is used even if multiple
chokidar instances exist.

## Caching

All resolved and parsed components are cached using the [hot-file-cache](https://github.com/jantimon/hot-file-cache/) module:

[![Concept flow uml](https://raw.githubusercontent.com/jantimon/hot-file-cache/master/flow.png)](https://github.com/jantimon/hot-file-cache/blob/master/flow.puml)

