import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

suite('SQL Query Analysis Tests', () => {
	vscode.window.showInformationMessage('Start SQL query analysis tests.');

	// Helper function to create a text document with SQL content
	async function createTestDocument(content: string): Promise<vscode.TextDocument> {
		const document = await vscode.workspace.openTextDocument({
			content: content,
			language: 'sql'
		});
		return document;
	}

	// Helper function to get diagnostics for a document
	function getDiagnostics(document: vscode.TextDocument): Thenable<vscode.Diagnostic[]> {
		return new Promise((resolve) => {
			// Wait for diagnostics to be calculated
			setTimeout(() => {
				const diagnostics = vscode.languages.getDiagnostics(document.uri);
				resolve(diagnostics);
			}, 100);
		});
	}

	test('SELECT * detection', async () => {
		const doc = await createTestDocument('SELECT * FROM users');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("Avoid using 'SELECT *'. Specify the columns you need to reduce I/O and network traffic"), true);
	});

	test('Leading wildcard LIKE detection', async () => {
		const doc = await createTestDocument("SELECT id FROM users WHERE name LIKE '%John%'");
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("Avoid leading wildcards in LIKE clauses (e.g., '%value')"), true);
	});

	test('JOIN with IS NULL detection', async () => {
		const doc = await createTestDocument('SELECT a.id FROM table1 a JOIN table2 b ON a.id IS NULL');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("IS NULL"), true);
	});

	test('Outer JOIN detection', async () => {
		const doc = await createTestDocument('SELECT * FROM table1 LEFT JOIN table2 ON table1.id = table2.id');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 2); // Will detect both SELECT * and LEFT JOIN
		assert.strictEqual(diagnostics.some(d => d.message.includes("Outer joins")), true);
	});

	test('NULL comparison detection', async () => {
		const doc = await createTestDocument('SELECT * FROM users WHERE name = NULL');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 2); // Will detect both SELECT * and NULL comparison
		assert.strictEqual(diagnostics.some(d => d.message.includes("IS NULL")), true);
	});

	test('ORDER BY with LIMIT detection', async () => {
		const doc = await createTestDocument('SELECT id FROM users ORDER BY name LIMIT 10');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("ORDER BY"), true);
	});

	test('ORDER BY RAND() detection', async () => {
		const doc = await createTestDocument('SELECT id FROM users ORDER BY RAND()');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("RAND()"), true);
	});

	test('GROUP BY with HAVING detection', async () => {
		const doc = await createTestDocument('SELECT department, COUNT(*) FROM employees GROUP BY department HAVING COUNT(*) > 10');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("HAVING"), true);
	});

	test('IN with subquery detection', async () => {
		const doc = await createTestDocument('SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 2); // Will detect both SELECT * and IN subquery
		assert.strictEqual(diagnostics.some(d => d.message.includes("IN + subquery")), true);
	});

	test('Function in WHERE clause detection', async () => {
		const doc = await createTestDocument('SELECT id FROM users WHERE UPPER(name) = "JOHN"');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("functions in WHERE"), true);
	});

	test('DISTINCT usage detection', async () => {
		const doc = await createTestDocument('SELECT DISTINCT name FROM users');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("DISTINCT"), true);
	});

	test('OR condition detection', async () => {
		const doc = await createTestDocument('SELECT id FROM users WHERE name = "John" OR age = 30');
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0].message.includes("OR conditions"), true);
	});

	test('Multiple issues in single query', async () => {
		const doc = await createTestDocument(`
			SELECT DISTINCT * 
			FROM users 
			LEFT JOIN orders ON users.id = orders.user_id 
			WHERE name LIKE '%John%' OR age = 30 
			ORDER BY RAND() 
			LIMIT 10
		`);
		const diagnostics = await getDiagnostics(doc);
		// Should detect: SELECT *, DISTINCT, LEFT JOIN, LIKE with leading %, OR condition, ORDER BY RAND(), ORDER BY with LIMIT
		assert.strictEqual(diagnostics.length >= 6, true);
	});

	test('Non-SQL file should have no diagnostics', async () => {
		const doc = await vscode.workspace.openTextDocument({
			content: 'SELECT * FROM users',
			language: 'javascript'
		});
		const diagnostics = await getDiagnostics(doc);
		assert.strictEqual(diagnostics.length, 0);
	});
});
