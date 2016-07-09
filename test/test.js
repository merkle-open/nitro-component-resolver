/* eslint max-len: off, quotes:off, no-param-reassign: off */
import test from 'ava';
import path from 'path';
import denodeify from 'denodeify';
import escapeStringRegexp from 'escape-string-regexp';
import ComponentResolver from '..';

const copy = denodeify(require('ncp').ncp);
const mkdirp = denodeify(require('mkdirp'));
const rimraf = denodeify(require('rimraf'));
const unlink = denodeify(require('fs').unlink);
const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const tmp = path.resolve(__dirname, '..', 'tmp', 'testing');

let testDirId = 0;
const createTestEnvironment = async(environment = 'valid') => {
	const targetDir = path.resolve(tmp, `test-${testDirId++}`);
	const componentDir = path.join(targetDir, 'components');
	await mkdirp(targetDir);
	await copy(path.resolve(__dirname, 'fixtures', environment), targetDir);
	return componentDir;
};

const getErrorMessage = async(cb) => {
	try {
		await (Promise.resolve().then(cb));
	} catch (e) {
		return e.message;
	}
	return undefined;
};

test('should list all components of the given folder', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir
	});
	const componentNames = Object.keys(await resolver.getComponents());
	componentNames.sort();
	t.deepEqual(componentNames, ['atoms/button', 'atoms/radio', 'helper/typography']);
	t.pass();
});

test('should throw if a JSON contains errors', async t => {
	const rootDir = await createTestEnvironment('invalid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir
	});
	const err = await getErrorMessage(async() => {
		await resolver.getComponents();
	});
	const invalidJsonFile = path.resolve(rootDir, 'atoms/button/pattern.json');
	t.regex(err, new RegExp(`^Failed to parse "${escapeStringRegexp(invalidJsonFile)}" SyntaxError: Unexpected end`));
	t.pass();
});

test('should fail listing examples if examples is set to false', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir
	});
	const buttonDirectory = path.resolve(rootDir, 'atoms/button');
	const err = await getErrorMessage(async() => {
		await resolver.getComponentExamples(buttonDirectory);
	});
	t.is(err, 'component resolver: examples are deactivated');
	t.pass();
});
test('should return component', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir
	});
	const component = await resolver.getComponent('atoms/button');
	t.deepEqual(component, {
		metaFile: path.resolve(rootDir, 'atoms/button/pattern.json'),
		directory: path.resolve(rootDir, 'atoms/button'),
		path: 'atoms/button',
		type: 'atoms',
		name: 'button',
		data: {
			title: 'button',
			id: 189,
			stability: 'beta',
			properties: {}
		}
	});
	t.pass();
});

test('should list examples', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		examples: true
	});
	const buttonDirectory = path.resolve(rootDir, 'atoms/button');
	const examples = await resolver.getComponentExamples(buttonDirectory);
	t.deepEqual(examples, [{
		name: '_hidden',
		filepath: path.resolve(buttonDirectory, '_example/_hidden.hbs'),
		content: 'This example should not be deployed',
		hidden: true
	}, {
		name: 'example',
		filepath: path.resolve(buttonDirectory, '_example/example.hbs'),
		content: 'Hello World',
		hidden: false
	}]);
	t.pass();
});

test('should throw on unkown component', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir
	});
	const err = await getErrorMessage(async() => {
		await resolver.getComponent('fancy/fancy');
	});
	t.is(err, 'Could not resolve component "fancy/fancy"');
	t.pass();
});

test('should throw if trying to access deactivated readme', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: false
	});
	const err = await getErrorMessage(async() => {
		await resolver.getComponentReadme('atoms/button');
	});
	t.is(err, 'component resolver: readmes are deactivated');
	t.pass();
});

test('should return not readmde if no file exists', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: true
	});
	const buttonDirectory = path.resolve(rootDir, 'atoms/button');
	const readme = await resolver.getComponentReadme(buttonDirectory);
	t.is(readme, undefined);
	t.pass();
});

test('should return readmde', async t => {
	const rootDir = await createTestEnvironment('valid');
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: true
	});
	const typographyDirectory = path.resolve(rootDir, 'helper/typography');
	const readme = await resolver.getComponentReadme(typographyDirectory);
	t.deepEqual(readme, {
		filepath: path.join(typographyDirectory, 'readme.md'),
		content: 'Please read me!'
	});
	t.pass();
});

test('should load the readmde from cache', async t => {
	const rootDir = await createTestEnvironment('valid');
	let renderIndex = 0;
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: true,
		readmeRenderer: (resolverInstance, renderData) => {
			renderData.content = ++renderIndex;
			return renderData;
		}
	});
	const typographyDirectory = path.resolve(rootDir, 'helper/typography');
	const readme = await resolver.getComponentReadme(typographyDirectory);
	t.is(readme.content, 1);
	const readme2 = await resolver.getComponentReadme(typographyDirectory);
	t.is(readme, readme2);
	t.pass();
});

test('should invalidate the readme cache when changing an example', async t => {
	const rootDir = await createTestEnvironment('valid');
	let renderIndex = 0;
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: true,
		examples: true,
		readmeRenderer: (resolverInstance, renderData) => {
			renderData.content = ++renderIndex;
			return renderData;
		}
	});
	const typographyDirectory = path.resolve(rootDir, 'helper/typography');
	const readme = await resolver.getComponentReadme(typographyDirectory);
	await resolver.getComponentExamples(typographyDirectory);
	t.is(readme.content, 1);
	await unlink(path.join(typographyDirectory, '_example', 'small.hbs'));
	await sleep(200);
	const readme2 = await resolver.getComponentReadme(typographyDirectory);
	t.is(readme2.content, 2);
	t.pass();
});

test('should invalidate the example cache when changing another example', async t => {
	const rootDir = await createTestEnvironment('valid');
	let renderIndex = 0;
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: true,
		examples: true,
		exampleRenderer: (resolverInstance, renderData) => {
			renderData.content = ++renderIndex;
			return renderData;
		}
	});
	const typographyDirectory = path.resolve(rootDir, 'helper/typography');
	await resolver.getComponentExamples(typographyDirectory);
	const examples = await resolver.getComponentExamples(typographyDirectory);
	t.is(examples[0].content, 1);
	t.is(examples[1].content, 2);
	await resolver.getComponentExamples(typographyDirectory);
	await unlink(path.join(typographyDirectory, '_example', 'small.hbs'));
	await sleep(200);
	const examples2 = await resolver.getComponentExamples(typographyDirectory);
	t.is(examples2[0].content, 3);
	t.pass();
});

test('should invalidate the example cache when changing the main template', async t => {
	const rootDir = await createTestEnvironment('valid');
	let renderIndex = 0;
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: true,
		examples: true,
		exampleRenderer: (resolverInstance, renderData) => {
			renderData.content = ++renderIndex;
			return renderData;
		}
	});
	const typographyDirectory = path.resolve(rootDir, 'helper/typography');
	await resolver.getComponentExamples(typographyDirectory);
	const examples = await resolver.getComponentExamples(typographyDirectory);
	t.is(examples[0].content, 1);
	t.is(examples[1].content, 2);
	await resolver.getComponentExamples(typographyDirectory);
	await unlink(path.join(typographyDirectory, 'typography.hbs'));
	await sleep(200);
	const examples2 = await resolver.getComponentExamples(typographyDirectory);
	t.is(Math.min(examples2[0].content, examples2[1].content), 3);
	t.pass();
});

test('should invalidate the example cache when changing the pattern.json', async t => {
	const rootDir = await createTestEnvironment('valid');
	let renderIndex = 0;
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: false,
		examples: true,
		exampleRenderer: (resolverInstance, renderData) => {
			renderData.content = ++renderIndex;
			return renderData;
		}
	});
	const typographyDirectory = path.resolve(rootDir, 'helper/typography');
	await resolver.getComponentExamples(typographyDirectory);
	const examples = await resolver.getComponentExamples(typographyDirectory);
	t.is(examples[0].content, 1);
	t.is(examples[1].content, 2);
	await resolver.getComponentExamples(typographyDirectory);
	await unlink(path.join(typographyDirectory, 'pattern.json'));
	await sleep(200);
	const examples2 = await resolver.getComponentExamples(typographyDirectory);
	t.is(Math.min(examples2[0].content, examples2[1].content), 3);
	t.pass();
});

test('should read example from disk if example cache is deactivated', async t => {
	const rootDir = await createTestEnvironment('valid');
	let renderIndex = 0;
	const resolver = new ComponentResolver({
		rootDirectory: rootDir,
		readme: false,
		examples: true,
		cacheExamples: false,
		exampleRenderer: (resolverInstance, renderData) => {
			renderData.content = ++renderIndex;
			return renderData;
		}
	});
	const typographyDirectory = path.resolve(rootDir, 'helper/typography');
	const examples = await resolver.getComponentExamples(typographyDirectory);
	t.is(examples[0].content, 1);
	t.is(examples[1].content, 2);
	const examples2 = await resolver.getComponentExamples(typographyDirectory);
	t.is(Math.min(examples2[0].content, examples2[1].content), 3);
	t.pass();
});

test.after.always('cleanup', async () => {
	await rimraf(tmp);
});

