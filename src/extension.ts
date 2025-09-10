import path from 'path';
import * as vscode from 'vscode';
import { workspace } from 'vscode';

let settings = workspace.getConfiguration();

let includePattern: string = '';
let ignorePattern: string = '';

export async function activate(context: vscode.ExtensionContext) {
    const formatAll = vscode.commands.registerCommand(
        'all-files-formatter.formatAll',
        async () => {
            vscode.window.showInformationMessage(
                'Getting all the files to format'
            );
            settings = workspace.getConfiguration();

            includePattern = getIncludePattern();
            ignorePattern = await getIgnorePattern();
            const filesToFormat = await getFilesToFormat(
                includePattern,
                ignorePattern
            );
            console.log(filesToFormat.length);
        }
    );
    context.subscriptions.push(formatAll);
}

export function deactivate() {}

function getIncludePattern() {
    console.log(`Getting include pattern`);

    let patternsToIgnore: string[] | undefined = settings.get(
        'inclusions.includePattern'
    );
    let tempPattern = '';
    if (patternsToIgnore) {
        patternsToIgnore.forEach((element) => {
            tempPattern += element + ',';
        });
    }
    tempPattern = tempPattern.slice(0, -1);
    return `{${tempPattern}}`;
}
async function getIgnorePattern() {
    console.log(`Getting ignore pattern`);

    let patternsToIgnore: string[] | undefined = settings.get(
        'exclusions.ignorePattern'
    );
    let tempPattern = '';
    if (patternsToIgnore) {
        patternsToIgnore.forEach((element) => {
            tempPattern += element + ',';
        });
    }
    const gitPattern = await readGitignore();
    tempPattern = tempPattern + gitPattern;
    tempPattern = tempPattern.slice(0, -1);
    return `{${tempPattern}}`;
}

async function readGitignore(): Promise<string> {
    sentLog(`Getting gitignore patters`);
    let gitignoreFiles = await workspace.findFiles('**/.gitignore');
    let ignoresContent = '';
    if (gitignoreFiles.length >= 1) {
        sentLog(`found ${gitignoreFiles.length} gitignore files`);
        for (const element of gitignoreFiles) {
            const location = workspace
                .asRelativePath(element.fsPath)
                .replace(path.basename(element.fsPath), '');
            let fileData = Buffer.from(
                await workspace.fs.readFile(element)
            ).toString('utf8');
            let eachLine = fileData.split(/\r?\n/g);
            eachLine = eachLine.filter((element) => {
                return isEmpty(element);
            });
            eachLine = eachLine.map((item) => {
                item = item.trim();
                if (item.endsWith('/')) {
                    return path.normalize(`**/${location}${item}**`);
                }
                if (item.endsWith('*')) {
                    return path.normalize(`**/${location}${item}*`);
                } else {
                    return path.normalize(`**/${location}/${item}`);
                }
            });
            sentLog(
                `the file ${element.fsPath} has ${eachLine.length} glob patterns after cleanup`
            );
            sentArrayLog(eachLine);

            const final = eachLine.join(',');
            ignoresContent += final + ',';

            function isEmpty(line: string) {
                line = line.trim();
                return !(line === '' || line.startsWith('#') ? true : false);
            }
        }
    }
    sentLog(`Final gitignore pattern is ${ignorePattern}`);
    return ignoresContent;
}

async function getFilesToFormat(include: string, exclude: string) {
    let allFiles = await workspace.findFiles(include, exclude);
    sentLog(
        `Found ${allFiles.length} files to format \n Ignore: ${ignorePattern}\n Include: ${includePattern}`
    );
    sentUryArrayToLog(allFiles);
    vscode.window.showInformationMessage(`Formatting ${allFiles.length} files`);
    return allFiles;
}

// busines/lib64/python313/site-packages/pip/__pycache__/__init__.cpython-313.pyc

const outputChannel = vscode.window.createOutputChannel(
    'format-all-files',
    'markdown'
);

function sentLog(message: string) {
    outputChannel.appendLine(message);
}
function sentUryArrayToLog(message: vscode.Uri[]) {
    message.forEach((element) => {
        sentLog(element.fsPath);
    });
}
function sentArrayLog(message: string[]) {
    message.forEach((item) => {
        sentLog(item);
    });
}
