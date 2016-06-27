/**
 * This file is a json-file based database
 *
 * Includes caching and parsing of pattern.json
 */
var _ = require('lodash');
var assert = require('assert');
var path = require('path');
var HotFileCache = require('hot-file-cache');

module.exports = function NitroComponentResolver(options) {
  assert(typeof options === 'object' && options.rootDirectory, 'rootDirectory not specified');
  // Defaults
  options = _.extend ({
    examples: false,
    readme: true,
    exampleFolderName: '_example',
    patternExpression: '*/*/pattern.json',
    // Optional renderer
    exampleRenderer: (resolver, renderData) => renderData,
    readmeRenderer: (resolver, renderData) => renderData,
  }, options);

  var patternFiles = new HotFileCache(options.patternExpression, {
    cwd: options.rootDirectory,
    /**
     * Process the pattern.json files when load into the file cache
     */
    fileProcessor: (filepath, fileContent) => {
      var data;
      try {
        data = JSON.parse(fileContent.toString());
      } catch (e) {
        throw new Error('Failed to parse "' + filepath + '" ' + e);
      }
      var componentPath = path.dirname(path.relative(options.rootDirectory, filepath)).replace(/\\/g, '/');
      var componentPathParts = componentPath.split('/');
      return {
        metaFile: filepath,
        directory: path.dirname(filepath),
        path: componentPath,
        type: componentPathParts[0],
        name: componentPathParts[1],
        data: data
      }
    }
  });

  // Search for examples inside the project
  var exampleFiles;
  if (options.examples) {
    exampleFiles = new HotFileCache('*/*/' + options.exampleFolderName + '/*.*', {
      cwd: options.rootDirectory,
      /**
       * Process the examle files when load into the file cache
       */
      fileProcessor: (filepath, fileContent) => {
        var exampleName = path.basename(filepath).replace(/\..+$/, '');
        return Promise.resolve(options.exampleRenderer(this, {
          name: exampleName,
          filepath: filepath,
          content: fileContent.toString(),
          hidden: path.basename(filepath).substr(0, 1) === '_'
        }));
      }
    });
   }

   // Readme files
   var readmeFiles;
   if (options.readme) {
    readmeFiles = new HotFileCache('*/*/readme.md', {
       cwd: options.rootDirectory,
       /**
        * Process the readme.md files when load into the file cache
        */
       fileProcessor: (filepath, fileContent) => {
         return Promise.resolve(options.readmeRenderer(this, {
           filepath: filepath,
           content: fileContent.toString()
         }));
       }
     });
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
        throw new Error('Could not resolve component "' + componentPath + '"');
      }
      return components[componentPath];
    });
  };

  /**
   * Returns the html of the parsed readme markdown
   */
  this.getComponentReadme = function getComponentReadme(componentPath) {
    if (!options.readme) {
      throw new Error('component resolver: readmes are deactivated');
    }
    var readmePath = path.join(componentPath, 'readme.md');
    return readmeFiles.fileExists(readmePath)
      .then(function(exists) {
        if (exists) {
          return readmeFiles.readFile(readmePath);
        }
      });
  };

  /**
   * Returns an array of absolute filenames to the examples inside the given component directory
   */
  this.getComponentExamples = function getComponentExamples(componentDirectory) {
    if (!options.examples) {
      throw new Error('component resolver: examples are deactivated');
    }
    var exampleDirectory = path.join(componentDirectory, options.exampleFolderName);
    // filter all examples for files which are in the example path
    return exampleFiles.getFiles().then(function(filenames) {
      filenames.sort();
      return Promise.all(_.sortedUniq(filenames)
        .filter(function(filename) {
          return filename.indexOf(exampleDirectory) === 0;
        })
        .map(function(filename) {
          return exampleFiles.readFile(filename);
        })
      );
    });
  };

};