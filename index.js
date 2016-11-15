/**
 * This file is a json-file based database
 *
 * Includes caching and parsing of pattern.json
 */
'use strict';

/* eslint-disable id-blacklist */

const _ = require('lodash');
const assert = require('assert');
const path = require('path');
const HotFileCache = require('hot-file-cache');

module.exports = function NitroComponentResolver(userOptions) {
	assert(typeof userOptions === 'object' && userOptions.rootDirectory, 'rootDirectory not specified');
	// Defaults
	const options = _.extend({
		watch: true,
		cacheExamples: true,
		exampleFolderName: '_example',
		mainTemplate: '*/*/*.hbs',
		subTemplate: '*/*/elements/*/*.hbs',
		patternExpression: '*/*/pattern.json',
		// Optional renderer
		exampleRenderer: (resolver, renderData) => renderData,
		readmeRenderer: (resolver, renderData) => renderData
	}, userOptions);

	const mainTemplate = new HotFileCache(options.mainTemplate, {
		cwd: options.rootDirectory,
		hot: options.watch
	});

	const subTemplate = new HotFileCache(options.subTemplate, {
		cwd: options.rootDirectory,
		hot: options.watch,
		fileProcessor: (filepath, fileContent) => {
			const elementName = path.basename(path.dirname(filepath));
			// Render exmaple after the templates are initialized
			return {
				filepath,
				name: elementName,
				content: fileContent.toString()
			};
		}
	});

	const templatesInitialized = Promise.all([mainTemplate.getFiles(), subTemplate.getFiles()]);

	const patternFiles = new HotFileCache(options.patternExpression, {
		cwd: options.rootDirectory,
		hot: options.watch,
		/*
		 * Process the pattern.json files when load into the file cache
		 */
		fileProcessor: (filepath, fileContent) => {
			let jsonData;
			try {
				jsonData = JSON.parse(fileContent.toString());
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
				data: jsonData
			};
		}
	});

	// Search for examples inside the project
	const exampleFiles = new HotFileCache(`*/*/${options.exampleFolderName}/*.*`, {
		cwd: options.rootDirectory,
		hot: options.watch,
		useCache: options.cacheExamples,
		/*
		 * Process the examle files when load into the file cache
		 */
		fileProcessor: (filepath, fileContent) => {
			const exampleName = path.basename(filepath).replace(/\..+$/, '');
			// Render exmaple after the templates are initialized
			return templatesInitialized
				.then(() => options.exampleRenderer(this, {
					filepath,
					name: exampleName,
					content: fileContent.toString(),
					main: path.basename(filepath).substr(0, 1) !== '_'
				}));
		}
	});

	// Readme files
	const readmeFiles = new HotFileCache('**/readme.md', {
		cwd: options.rootDirectory,
		hot: options.watch,
		/*
		 * Process the readme.md files when load into the file cache
		 */
		fileProcessor: (filepath, fileContent) =>
			Promise.resolve(options.readmeRenderer(this, {
				filepath,
				content: fileContent.toString()
			}))
	});

	// Auto invalidation of readmes if an example changes
	exampleFiles.on('cache-revoked', () => readmeFiles.invalidateEntireCache());
	// Auto invalidate examples if another (e.g. a child component) changed
	exampleFiles.on('all', () => exampleFiles.invalidateEntireCache());
	// Auto invalidate examples if the package json changed
	patternFiles.on('all', () => exampleFiles.invalidateEntireCache());
	// Auto invalidate examples if the main template changed
	mainTemplate.on('all', () => exampleFiles.invalidateEntireCache());
	// Auto invalidate examples if the sub template changed
	subTemplate.on('all', () => exampleFiles.invalidateEntireCache());

	/**
	 * @returns {Array} a key value pair list for all parsed pattern.json files:
	 * + name: 'atoms', 'molecules', ...
	 * + path: component path (relative unix directory e.g. "atoms")
	 * + directory: absolute directory of the component type
	 */
	this.getComponentTypes = function getComponentTypes() {
		return patternFiles.getFiles().then((filenames) => {
			const fileBaseFolders = filenames.map(
				(filename) => path.relative(options.rootDirectory, filename).split(path.sep)[0]
			);
			const types = _.uniq(fileBaseFolders);
			types.sort();
			return types;
		});
	};

	/**
	 * @param {string} type optional type folder name e.g. "atoms", "molecules"
	 * @returns {Object} a key value pair list for all parsed pattern.json files:
	 * + name: example name (from filename)
	 * + path: component path (relative unix directory e.g. "atoms/button")
	 * + directory: component directory (relative directory)
	 * + data: parsed json data
	 */
	this.getComponents = function getComponents(type) {
		const directory = (type ? path.join(options.rootDirectory, type) : options.rootDirectory) + path.sep;
		return patternFiles.getFiles()
			.then((filenames) => filenames.filter((filename) => filename.indexOf(directory) === 0))
			.then((filenames) => Promise.all(filenames.map((file) => patternFiles.readFile(file)))
			.then((fileContents) =>
				// Combine path (keys) and fileContents (values) to an object
				_.zipObject(fileContents.map((fileContent) => fileContent.path), fileContents)
			)
		);
	};

	/**
	 * @param {string} componentPath relative unix path e.g. 'atoms/button'
	 * @returns {Object} a key value pair list for pattern.json files of the given path
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
	 * @returns {string} the html of the parsed readme markdown
	 */
	this.getComponentReadme = function getComponentReadme(componentPath) {
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
	 * @returns {{filepath: string, content: string}} processed example object
	 * Returns an array of absolute filenames to the examples inside the given component directory
	 */
	this.getComponentExamples = function getComponentExamples(componentDirectory) {
		const exampleDirectory = path.join(componentDirectory, options.exampleFolderName);
		// filter all examples for files which are in the example path
		return exampleFiles.getFiles()
			.then((filenames) => {
				filenames.sort();
				return Promise.all(_.sortedUniq(filenames)
					.filter((filename) => filename.indexOf(exampleDirectory) === 0)
					.map((filename) => exampleFiles.readFile(filename))
				);
			});
	};

	/**
	 * @param {string} componentDirectory absolute unix path e.g. 'atoms/button'
	 * @returns {{filepath: string, content: string}} processed example object
	 * Returns an array of absolute filenames to the templates inside the given component directory
	 */
	this.getComponentSubTemplates = function getComponentSubTemplates(componentDirectory) {
		// filter all sub templates for files which are in the sub template path
		return subTemplate.getFiles()
			.then((filenames) => {
				filenames.sort();
				return Promise.all(_.sortedUniq(filenames)
					.filter((filename) => filename.indexOf(componentDirectory) === 0)
					.map((filename) => subTemplate.readFile(filename))
				);
			});
	};

};
