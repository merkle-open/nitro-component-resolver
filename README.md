# Nitro Component Resolver
[![Build Status](https://travis-ci.org/namics/nitro-component-resolver.svg?branch=master)](https://travis-ci.org/namics/nitro-component-resolver)
[![Coverage Status](https://coveralls.io/repos/github/namics/nitro-component-resolver/badge.svg?branch=master)](https://coveralls.io/github/namics/nitro-component-resolver?branch=master)
[![Codestyle](https://img.shields.io/badge/codestyle-namics-green.svg)](https://github.com/namics/eslint-config-namics)

A helper to resolve and parse the nitro pattern structure and meta files.

## Installation

```bash
npm i --save-dev @namics/nitro-component-resolver
```

## Usage

```js
const ComponentResolver = require('@namics/nitro-component-resolver');
const resolver = new ComponentResolver({
    rootDirectory: rootDirectories.valid,
    // Readme lookup
    readme: true,
    // Example lookup
    examples: true
});
resolver.getComponents()
    .then(function(components) {
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
