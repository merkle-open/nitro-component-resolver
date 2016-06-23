/**
 * This file is a json-file based database
 *
 * Includes caching and parsing of pattern.json
 */
var _ = require('lodash');
var assert = require('assert');
var path = require('path');
var HotFileCache = require('hot-file-cache');

module.exports = function ComponentDataExtractor(options) {
  assert(typeof options === 'object' && options.rootDirectory, 'root directory not specified');
  // Defaults
  options = _.extend ({
    examples: false,
    exampleFolderName: '_example',
    patternExpression: '*/*/pattern.json'
  }, options);

  var patternFiles = new HotFileCache('*/*/pattern.json', {
    cwd: rootDirectory,
    fileProcessor: patternJsonProcessor
  });

  // Search for examples inside the project
  var exampleFiles;
  if (options.examples) {
    exampleFiles = new HotFileCache('*/*/' + options.exampleFolderName + '/*.*', {
      cwd: rootDirectory,
      fileProcessor: exampleTemplateProcessor
    });
   }

  /**
   * Process the pattern.json files when load into the file cache
   */
  function patternJsonProcessor(filepath, fileContent) {
    var data;
    try {
      data = JSON.parse(fileContent.toString());
    } catch (e) {
      throw new Error('Failed to parse "' + file + '" ' + e);
    }
    var componentPath = path.dirname(path.relative(rootDirectory, filepath)).replace(/\\/g, '/');
    var componentPathParts = componentPath.split('/');
    return {
      metaFile: filepath,
      directory: path.dirname(filepath),
      path: componentPath,
      type: componentPathParts[0],
      name: componentPathParts[1],
      data: data
    };
  }

  /**
   * Process the examle files when load into the file cache
   */
  function exampleTemplateProcessor(filepath, fileContent) {
    return {
      name: path.basename(filepath).replace(/\..+$/, ''),
      filename: filepath,
      content: fileContent.toString()
    };
  }

  /**
   * Returns a key value pair list for all parsed pattern.json files:
   * + name: example name (from filename)
   * + path: component path (relative unix directory e.g. "atoms/button")
   * + directory: component directory (relative directory)
   * + data: parsed json data
   */
  this.getComponents = function getComponents() {
    return patternFiles.getFiles().then(function(filenames) {
      return Promise.all(filenames.map(function(file) {
        return patternFiles.readFile(file);
      })).then(function(fileContents) {
        // Combine path (keys) and fileContents (values) to an object
        return fileContents.reduce(function(result, fileContent) {
          result[fileContent.path] = fileContent;
          return result;
        }, {});
      });
    });
  };

  /**
   * Returns a key value pair list for pattern.json files of the given path
   *
   * + name: example name (from filename)
   * + path: component path (relative unix directory e.g. "atoms/button")
   * + directory: component directory (relative directory)
   * + data: parsed json data
   */
  this.getComponent = function getComponent(componentPath) {
    return this.getComponents().then(function(components) {
      if (!components[componentPath]) {
        return Promise.reject('Could not resolve component "' + componentPath + '"');
      }
      return components[componentPath];
    });
  };

  /**
   * Returns an array of absolute filenames to the examples inside the given component directory
   */
  this.getComponentExamples = function getComponentExamples(componentDirectory) {
    if (!options.examples) {
      throw new Error('pattern resolver: examples are deactivated');
    }
    var exampleDirectory = path.join(componentDirectory, exampleFolderName);
    // filter all examples for files which are in the example path
    return exampleFiles.getFiles().then(function(filenames) {
      return Promise.all(_.sortedUniq(filenames)
        .filter(function(filename) {
          return filename.indexOf(exampleDirectory) === 0;
        })
        .map(function(filename) {
          return exampleFiles.readFile(filename)
        })
      );
    });
  };

};