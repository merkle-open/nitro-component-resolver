/* eslint max-len: off, quotes:off */
import test from 'ava';
import path from 'path';
import ComponentResolver from '..';

const rootDirectories = {
	valid: path.resolve(__dirname, 'fixtures', 'valid', 'components'),
	invalid: path.resolve(__dirname, 'fixtures', 'invalid', 'components'),
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
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid
	});
	const componentNames = Object.keys(await resolver.getComponents());
	componentNames.sort();
	t.deepEqual(componentNames, ['atoms/button', 'atoms/radio', 'helper/typography']);
	t.pass();
});

test('should throw if a JSON contains errors', async t => {
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.invalid
	});
	const err = await getErrorMessage(async() => {
		await resolver.getComponents();
	});
	const invalidJsonFile = path.resolve(rootDirectories.invalid, 'atoms/button/pattern.json');
	const expectedError = `Failed to parse \"${invalidJsonFile}\" SyntaxError: Unexpected end of input`;
	t.is(err, expectedError);
	t.pass();
});

test('should fail listing examples if examples is set to false', async t => {
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid
	});
	const buttonDirectory = path.resolve(rootDirectories.valid, 'atoms/button');
	const err = await getErrorMessage(async() => {
		await resolver.getComponentExamples(buttonDirectory);
	});
	t.is(err, 'component resolver: examples are deactivated');
	t.pass();
});
test('should return component', async t => {
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid
	});
	const component = await resolver.getComponent('atoms/button');
	t.deepEqual(component, {
		metaFile: path.resolve(rootDirectories.valid, 'atoms/button/pattern.json'),
		directory: path.resolve(rootDirectories.valid, 'atoms/button'),
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
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid,
		examples: true
	});
	const buttonDirectory = path.resolve(rootDirectories.valid, 'atoms/button');
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
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid,
	});
	const err = await getErrorMessage(async() => {
		await resolver.getComponent('fancy/fancy');
	});
	t.is(err, 'Could not resolve component "fancy/fancy"');
	t.pass();
});

test('should throw if trying to access deactivated readme', async t => {
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid,
		readme: false
	});
	const err = await getErrorMessage(async() => {
		await resolver.getComponentReadme('atoms/button');
	});
	t.is(err, 'component resolver: readmes are deactivated');
	t.pass();
});

test('should return not readmde if no file exists', async t => {
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid,
		readme: true
	});
	const buttonDirectory = path.resolve(rootDirectories.valid, 'atoms/button');
	const readme = await resolver.getComponentReadme(buttonDirectory);
	t.is(readme, undefined);
	t.pass();
});

test('should return readmde', async t => {
	const resolver = new ComponentResolver({
		rootDirectory: rootDirectories.valid,
		readme: true
	});
	const typographyDirectory = path.resolve(rootDirectories.valid, 'helper/typography');
	const readme = await resolver.getComponentReadme(typographyDirectory);
	t.deepEqual(readme, {
		filepath: path.join(typographyDirectory, 'readme.md'),
		content: 'Please read me!'
	});
	t.pass();
});

