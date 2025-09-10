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
            settings = workspace.getConfiguration();

            includePattern = getIncludePattern();
            ignorePattern = await getIgnorePattern();
            const filesToFormat = await getFilesToFormat(
                includePattern,
                ignorePattern
            );
            if (filesToFormat.length >= 1) {
                vscode.window
                    .showInformationMessage(
                        `Do you really want to format ${filesToFormat.length} file(s)`,
                        'yes',
                        'no'
                    )
                    .then((selection) => {
                        if (selection === 'yes') {
                            formatFiles(filesToFormat);
                        } else {
                            vscode.window.showInformationMessage(
                                `Process cancelled!`
                            );
                        }
                    });
            }
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
    const readGit: boolean | undefined = settings.get('exclusions.includeGit');
    if (readGit) {
        sentLog(`Request to check .gitignore? true`);
        const gitPattern = await readGitignore();
        tempPattern = tempPattern + gitPattern;
    } else {
        sentLog(`Request to check .gitignore? false`);
    }
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
    return allFiles;
}

const outputChannel = vscode.window.createOutputChannel(
    'format-all-files',
    'markdown'
);

function sentLog(message: string) {
    outputChannel.appendLine(message);
}
// function sentUryArrayToLog(message: vscode.Uri[]) {
//     message.forEach((element) => {
//         sentLog(element.fsPath);
//     });
// }
function sentArrayLog(message: string[]) {
    message.forEach((item) => {
        sentLog(item);
    });
}

async function formatFiles(files: vscode.Uri[]) {
    for (let index = 0; index < files.length; index++) {
        sentLog(`Currently formatting: ${files[index]}`);
        try {
            await vscode.window.showTextDocument(files[index]);
            await vscode.commands.executeCommand(
                'editor.action.formatDocument'
            );
            const closeFiles: boolean | undefined = settings.get(
                'automaticallyCloseFiles'
            );
            if (closeFiles) {
                await vscode.commands.executeCommand(
                    'workbench.action.closeActiveEditor'
                );
            }
        } catch (error) {
            if (error instanceof Error) {
                sentLog(error.message);
                vscode.window.showErrorMessage(
                    `The following error was detected: ${error.message}.`
                );
            }
        }
        sentLog(`Complete!`);
    }
    vscode.window.showInformationMessage(
        `Process complete, ${files.length} files successfully formatted!`
    );
}
