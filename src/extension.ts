import path from 'path';
import { channel } from 'process';
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
            } else {
                vscode.window.showErrorMessage(`No files to work with`);
            }
        }
    );
    context.subscriptions.push(formatAll);
}

export function deactivate() {}

function getIncludePattern() {
    console.log(`Getting include pattern`);

    let patternsToIgnore: string[] | undefined = settings.get(
        'inclusions.includePatterns'
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
        'exclusions.ignorePatterns'
    );
    let tempPattern = '';
    if (patternsToIgnore) {
        patternsToIgnore.forEach((element) => {
            tempPattern += element + ',';
        });
    }
    const readGit: boolean | undefined = settings.get(
        'exclusions.includeGitignore'
    );
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
        `Found ${allFiles.length} files to format \nIgnore pattern: ${ignorePattern}\nInclude pattern: ${includePattern}\n`
    );
    return allFiles;
}

const outputChannel = vscode.window.createOutputChannel(
    'format-all-files',
    'markdown'
);

function sentLog(message: string, newLine = true) {
    if (newLine) {
        outputChannel.appendLine(message);
    } else {
        outputChannel.append(message);
    }
}
function sentArrayLog(message: string[]) {
    message.forEach((item) => {
        sentLog(item);
    });
}

async function formatFiles(files: vscode.Uri[]) {
    let errorCount = 0;
    for (let index = 0; index < files.length; index++) {
        sentLog(`Currently formatting: \`${files[index]}\``, false);
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
            sentLog(`: Complete!`);
        } catch (error) {
            if (error instanceof Error) {
                if (error.name == 'CodeExpectedError') {
                    sentLog(`This file is not text, skipping.`);
                } else {
                    errorCount++;
                    sentLog('');
                    sentLog('[Error] message:', false);
                    sentLog(error.message);
                    sentLog(error.name);
                }
            }
        }
    }
    if (errorCount === 0) {
        vscode.window
            .showInformationMessage(
                `Process complete, ${files.length} files successfully formatted!`,
                'Check logs'
            )
            .then((ans) => {
                if (ans) {
                    outputChannel.show();
                }
            });
        const msg =
            funnySuccessLogs[
                Math.floor(Math.random() * funnySuccessLogs.length)
            ];
        sentLog('');
        sentLog(msg);
    } else {
        vscode.window
            .showInformationMessage(
                `Process complete, some errors were catch in the process, would you like to see then?`,
                'yes',
                'no'
            )
            .then((answer) => {
                if (answer === 'no') {
                    const msg =
                        funnySuccessLogs[
                            Math.floor(Math.random() * funnySuccessLogs.length)
                        ];
                    sentLog('');

                    sentLog(msg);
                } else {
                    const msg =
                        funnyLogs[Math.floor(Math.random() * funnyLogs.length)];
                    sentLog('');
                    sentLog(msg);
                    outputChannel.show();
                }
            });
    }
}

// This messages where generated with AI because I am too lazy and unfunny to create them myself
const funnyLogs = [
    'Hide the dinos, boss is coming!',
    'Well… that escalated quickly.',
    'Here be bugs.',
    'Abort mission, we hit an asteroid!',
    'Nothing to see here, just some casual chaos.',
    'When in doubt, blame the compiler.',
    'I swear it worked on my machine.',
    'Feature or bug? You decide.',
    '99 little bugs in the code, 99 little bugs...',
    'Error 404: Patience not found.',
    'The cake is a lie, and so is this success.',
    'Don’t worry, this is a ‘temporary’ problem.',
    'At least we didn’t delete production… yet.',
    'One does not simply format all files without errors.',
    'It’s not a bug, it’s an undocumented feature.',
    'Houston, we have a problem.',
    'Plot twist: the formatter is formatting itself.',
    'Brace yourself, logs are coming.',
    'Don’t panic. Actually, panic a little.',
    'Surprise! More errors than expected.',
];
// This too
const funnySuccessLogs = [
    'All files polished and shiny!',
    'Mission accomplished. High five!',
    'Code formatted, bugs intimidated.',
    'Flawless victory.',
    'Formatter has left the chat.',
    'Everything is awesome!',
    'Zero errors, zero worries.',
    'The formatter gods are pleased.',
    'Smooth as butter.',
    'Victory royale!',
    'Done and dusted.',
    'The code is strong with this one.',
    'May the format be with you.',
    'Formatting complete. Coffee break?',
    'Code so clean you could eat off it.',
    'No errors detected… today.',
    'Your files are now 20% cooler.',
    'Achievement unlocked: Proper Formatting!',
    'Looks like you actually know what you’re doing.',
    'All green lights — deploy at will!',
];
