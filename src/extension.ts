import * as vscode from 'vscode';

// Helper function to detect slow queries
function detectSlowQueries(query: string): string[] {
    const issues: string[] = [];

    // Basic syntax and performance checks
    if (query.includes('SELECT *')) {
        issues.push("Avoid using 'SELECT *'. Specify the columns you need to reduce I/O and network traffic.");
    }

    // LIKE pattern checks
    if (query.match(/WHERE\s+\w+\s+(NOT\s+)?LIKE\s+'%/i)) {
        issues.push("Avoid leading wildcards in LIKE clauses (e.g., '%value'). They prevent index usage and force full table scans.");
    }

    // JOIN checks
    if (query.match(/\bJOIN\b.*\bON\b.*\bIS\s+NULL/i)) {
        issues.push("Ensure indexes exist for JOIN conditions, especially when using IS NULL.");
    }
    if (query.match(/\bLEFT\s+JOIN\b|\bRIGHT\s+JOIN\b/i)) {
        issues.push("Outer joins can be slower than inner joins. Ensure they're necessary and properly indexed.");
    }

    // NULL handling checks
    if (query.match(/WHERE\s+\w+\s*=\s*NULL/i)) {
        issues.push("Use 'IS NULL' instead of '= NULL'. Comparing with NULL using = will always return false.");
    }
    if (query.match(/WHERE\s+\w+\s*<>\s*NULL/i)) {
        issues.push("Use 'IS NOT NULL' instead of '<> NULL' or '!= NULL'. Comparing with NULL using <> will always return false.");
    }

    // Ordering and pagination checks
    if (query.match(/\bORDER\s+BY\b.*\bLIMIT\b/i)) {
        issues.push("Ordering large datasets with LIMIT may cause performance issues. Consider using indexed columns for ORDER BY.");
    }
    if (query.match(/\bORDER\s+BY\s+RAND\(\)/i)) {
        issues.push("ORDER BY RAND() is extremely inefficient for large datasets. Consider alternative randomization methods.");
    }

    // Aggregation checks
    if (query.match(/\bGROUP\s+BY\b.*\bHAVING\b/i)) {
        issues.push("HAVING clauses can be slow. Consider using WHERE before GROUP BY when possible.");
    }

    // Subquery checks
    if (query.match(/WHERE\s+.*\bIN\s*\(\s*SELECT/i)) {
        issues.push("IN + subquery can be slow. Consider using EXISTS or JOIN instead for better performance.");
    }
    if (query.match(/FROM\s*\(\s*SELECT/i)) {
        issues.push("Derived tables (subqueries in FROM) might impact performance. Consider using CTEs or temporary tables.");
    }

    // Function usage checks
    if (query.match(/WHERE\s+\w+\s*=\s*\w+\([^)]*\)/i)) {
        issues.push("Using functions in WHERE clauses prevents index usage. Consider restructuring the query.");
    }

    // DISTINCT usage check
    if (query.match(/\bDISTINCT\b/i)) {
        issues.push("DISTINCT can be expensive. Consider if it's really needed or if the query can be rewritten.");
    }

    // Multiple conditions check
    if (query.match(/WHERE.*\bOR\b/i)) {
        issues.push("OR conditions might prevent optimal index usage. Consider UNION ALL or restructuring the query.");
    }

    // Temporary table operations
    if (query.match(/\bINTO\s+#/i)) {
        issues.push("Consider indexing temporary tables if they're used in subsequent joins or where clauses.");
    }

    return issues;
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('extension.detectSlowQueries', () => {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const document = editor.document;
            const query = document.getText();
            const issues = detectSlowQueries(query);

            if (issues.length > 0) {
                vscode.window.showWarningMessage(`Detected potential issues:\n- ${issues.join('\n- ')}`);
            } else {
                vscode.window.showInformationMessage('No slow query patterns detected.');
            }
        } else {
            vscode.window.showErrorMessage('No active editor detected.');
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

// Create diagnostic for all SQL files
const diagnosticCollection = vscode.languages.createDiagnosticCollection('sql');

function reportDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'sql') {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // Define patterns and their corresponding messages
    const patterns = [
        {
            pattern: /SELECT \*/gi,
            message: "Avoid using 'SELECT *'. Specify the columns you need to reduce I/O and network traffic."
        },
        {
            pattern: /WHERE\s+\w+\s+(NOT\s+)?LIKE\s+'%/gi,
            message: "Avoid leading wildcards in LIKE clauses (e.g., '%value'). They prevent index usage and force full table scans."
        },
        {
            pattern: /\bJOIN\b.*\bON\b.*\bIS\s+NULL/gi,
            message: "Ensure indexes exist for JOIN conditions, especially when using IS NULL."
        },
        {
            pattern: /\bLEFT\s+JOIN\b|\bRIGHT\s+JOIN\b/gi,
            message: "Outer joins can be slower than inner joins. Ensure they're necessary and properly indexed."
        },
        {
            pattern: /WHERE\s+\w+\s*=\s*NULL/gi,
            message: "Use 'IS NULL' instead of '= NULL'. Comparing with NULL using = will always return false."
        },
        {
            pattern: /WHERE\s+\w+\s*<>\s*NULL/gi,
            message: "Use 'IS NOT NULL' instead of '<> NULL' or '!= NULL'. Comparing with NULL using <> will always return false."
        },
        {
            pattern: /\bORDER\s+BY\b.*\bLIMIT\b/gi,
            message: "Ordering large datasets with LIMIT may cause performance issues. Consider using indexed columns for ORDER BY."
        },
        {
            pattern: /\bORDER\s+BY\s+RAND\(\)/gi,
            message: "ORDER BY RAND() is extremely inefficient for large datasets. Consider alternative randomization methods."
        },
        {
            pattern: /\bGROUP\s+BY\b.*\bHAVING\b/gi,
            message: "HAVING clauses can be slow. Consider using WHERE before GROUP BY when possible."
        },
        {
            pattern: /WHERE\s+.*\bIN\s*\(\s*SELECT/gi,
            message: "IN + subquery can be slow. Consider using EXISTS or JOIN instead for better performance."
        },
        {
            pattern: /FROM\s*\(\s*SELECT/gi,
            message: "Derived tables (subqueries in FROM) might impact performance. Consider using CTEs or temporary tables."
        },
        {
            pattern: /WHERE\s+\w+\s*=\s*\w+\([^)]*\)/gi,
            message: "Using functions in WHERE clauses prevents index usage. Consider restructuring the query."
        },
        {
            pattern: /\bDISTINCT\b/gi,
            message: "DISTINCT can be expensive. Consider if it's really needed or if the query can be rewritten."
        },
        {
            pattern: /WHERE.*\bOR\b/gi,
            message: "OR conditions might prevent optimal index usage. Consider UNION ALL or restructuring the query."
        },
        {
            pattern: /\bINTO\s+#/gi,
            message: "Consider indexing temporary tables if they're used in subsequent joins or where clauses."
        }
    ];

    // Check each pattern and create diagnostics
    for (const { pattern, message } of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(
                    document.positionAt(match.index),
                    document.positionAt(match.index + match[0].length)
                ),
                message,
                vscode.DiagnosticSeverity.Warning
            );
            diagnostics.push(diagnostic);
        }
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

vscode.workspace.onDidOpenTextDocument(reportDiagnostics);
vscode.workspace.onDidChangeTextDocument((e) => reportDiagnostics(e.document));
