/**
 * This file is a json-file based database
 *
 * Includes caching and parsing of pattern.json
 */
'use strict';
const _ = require('lodash');
const assert = require('assert');
const path = require('path');
const HotFileCache = require('hot-file-cache');

module.exports = function NitroComponentResolver(userOptions) {
	assert(typeof userOptions === 'object' && userOptions.rootDirectory, 'rootDirectory not specified');
	// Defaults
	const options = _.extend({
		examples: false,
		readme: true,
		exampleFolderName: '_example',
		patternExpression: '*/*/pattern.json',
		// Optional renderer
		exampleRenderer: (resolver, renderData) => renderData,
		readmeRenderer: (resolver, renderData) => renderData,
	}, userOptions);

	const patternFiles = new HotFileCache(options.patternExpression, {
		cwd: options.rootDirectory,
		/*
		 * Process the pattern.json files when load into the file cache
		 */
		fileProcessor: (filepath, fileContent) => {
			let data;
			try {
				data = JSON.parse(fileContent.toString());
			} catch (e) {
				throw new Error(`Failed to parse "${filepath}" ${e}`);
			}
			const componentPath = path.dirname(path.relative(options.rootDirectory, filepath)).replace(/\\/g, '/');
			const componentPathParts = componentPath.split('/');
			return {
				metaFile: filepath,
				directory: path.dirname(filepath),
				path: componentPath,
				type: componentPathParts[0],
				name: componentPathParts[1],
				data: data
			};
		}
	});

	// Search for examples inside the project
	let exampleFiles;
	if (options.examples) {
		exampleFiles = new HotFileCache(`*/*/${options.exampleFolderName}/*.*`, {
			cwd: options.rootDirectory,
			/*
			 * Process the examle files when load into the file cache
			 */
			fileProcessor: (filepath, fileContent) => {
				const exampleName = path.basename(filepath).replace(/\..+$/, '');
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
	let readmeFiles;
	if (options.readme) {
		readmeFiles = new HotFileCache('*/*/readme.md', {
			cwd: options.rootDirectory,
			/*
			 * Process the readme.md files when load into the file cache
			 */
			fileProcessor: (filepath, fileContent) =>
				Promise.resolve(options.readmeRenderer(this, {
					filepath: filepath,
					content: fileContent.toString()
				}))
		});
	}

	/**
	 * @return {object} a key value pair list for all parsed pattern.json files:
	 * + name: example name (from filename)
	 * + path: component path (relative unix directory e.g. "atoms/button")
	 * + directory: component directory (relative directory)
	 * + data: parsed json data
	 */
	this.getComponents = function getComponents() {
		return patternFiles.getFiles().then((filenames) =>
			Promise.all(filenames.map((file) =>
				patternFiles.readFile(file)
			)).then((fileContents) =>
				// Combine path (keys) and fileContents (values) to an object
				_.zipObject(fileContents.map((fileContent) => fileContent.path), fileContents)
			)
		);
	};

	/**
	 * @param {string} componentPath relative unix path e.g. 'atoms/button'
	 * @return {object} a key value pair list for pattern.json files of the given path
	 *
	 * + name: example name (from filename)
	 * + path: component path (relative unix directory e.g. "atoms/button")
	 * + directory: component directory (relative directory)
	 * + data: parsed json data
	 */
	this.getComponent = function getComponent(componentPath) {
		return this.getComponents().then((components) => {
			if (!components[componentPath]) {
				throw new Error(`Could not resolve component "${componentPath}"`);
			}
			return components[componentPath];
		});
	};

	/**
	 * @param {string} componentPath relative unix path e.g. 'atoms/button'
	 * @return {string} the html of the parsed readme markdown
	 */
	this.getComponentReadme = function getComponentReadme(componentPath) {
		if (!options.readme) {
			throw new Error('component resolver: readmes are deactivated');
		}
		const readmePath = path.join(componentPath, 'readme.md');
		return readmeFiles.fileExists(readmePath)
			.then((exists) => {
				if (exists) {
					return readmeFiles.readFile(readmePath);
				}
				return undefined;
			});
	};

	/**
	 * @param {string} componentDirectory absolute unix path e.g. 'atoms/button'
	 * @return {object} processed example object
	 * Returns an array of absolute filenames to the examples inside the given component directory
	 */
	this.getComponentExamples = function getComponentExamples(componentDirectory) {
		if (!options.examples) {
			throw new Error('component resolver: examples are deactivated');
		}
		const exampleDirectory = path.join(componentDirectory, options.exampleFolderName);
		// filter all examples for files which are in the example path
		return exampleFiles.getFiles().then((filenames) => {
			filenames.sort();
			return Promise.all(_.sortedUniq(filenames)
				.filter((filename) => filename.indexOf(exampleDirectory) === 0)
				.map((filename) => exampleFiles.readFile(filename))
			);
		});
	};

};
