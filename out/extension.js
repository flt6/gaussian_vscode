"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const completion_1 = require("./completion");
const previewProvider_1 = require("./previewProvider");
function activate(context) {
    console.log('Gaussian syntax extension is now active!');
    // 注册代码补全提供程序
    const completionProvider = vscode.languages.registerCompletionItemProvider({ language: 'GaussianInput' }, new completion_1.GaussianCompletionProvider(), '#', // 触发字符 - route section
    '%', // 触发字符 - link0 commands
    '(', // 触发字符 - options
    '=', // 触发字符 - keyword options
    '/', // 触发字符 - basis set
    ' ' // 触发字符 - space for keywords
    );
    // 注册输出文件预览命令
    const previewCommand = vscode.commands.registerCommand('gaussian.previewOutput', (uri) => {
        // 如果没有传入URI，使用当前活动编辑器的文件
        if (!uri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                uri = activeEditor.document.uri;
            }
            else {
                vscode.window.showErrorMessage('请先打开一个Gaussian输出文件');
                return;
            }
        }
        // 检查文件扩展名
        const fileName = uri.fsPath.toLowerCase();
        if (!fileName.endsWith('.out') && !fileName.endsWith('.log')) {
            vscode.window.showErrorMessage('请选择一个Gaussian输出文件 (.out 或 .log)');
            return;
        }
        previewProvider_1.GaussianOutputPreviewProvider.showPreview(uri);
    });
    // 注册运行输入文件命令
    const runInputCommand = vscode.commands.registerCommand('gaussian.runInput', (uri) => {
        // 如果没有传入URI，使用当前活动编辑器的文件
        if (!uri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                uri = activeEditor.document.uri;
            }
            else {
                vscode.window.showErrorMessage('请先打开一个Gaussian输入文件');
                return;
            }
        }
        // 检查文件扩展名
        const fileName = uri.fsPath.toLowerCase();
        if (!fileName.endsWith('.gin') && !fileName.endsWith('.gjf') && !fileName.endsWith('.com')) {
            vscode.window.showErrorMessage('请选择一个Gaussian输入文件 (.gin, .gjf 或 .com)');
            return;
        }
        runGaussianInput(uri);
    });
    context.subscriptions.push(completionProvider, previewCommand, runInputCommand);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
async function runGaussianInput(uri) {
    const filePath = uri.fsPath;
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const fileNameNoExt = path.parse(fileName).name;
    const outputFilePath = path.join(fileDir, fileNameNoExt + '.out');
    // 显示运行状态
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `运行 Gaussian 计算: ${fileName}`,
        cancellable: true
    }, async (progress, token) => {
        try {
            // 执行 gsub32 命令
            const { spawn } = require('child_process');
            const process = spawn('gsub32', [fileNameNoExt], {
                cwd: fileDir,
                shell: true
            });
            return new Promise((resolve, reject) => {
                let output = '';
                let error = '';
                if (process.stdout) {
                    process.stdout.on('data', (data) => {
                        output += data.toString();
                    });
                }
                if (process.stderr) {
                    process.stderr.on('data', (data) => {
                        error += data.toString();
                    });
                }
                process.on('close', async (code) => {
                    if (code === 0) {
                        vscode.window.showInformationMessage(`Gaussian 计算已提交: ${fileName}`);
                        // 等待输出文件生成并尝试打开
                        await waitForOutputFile(outputFilePath);
                        resolve();
                    }
                    else {
                        vscode.window.showErrorMessage(`Gaussian 计算失败: ${error || '未知错误'}`);
                        reject(new Error(error));
                    }
                });
                process.on('error', (err) => {
                    vscode.window.showErrorMessage(`执行命令失败: ${err.message}`);
                    reject(err);
                });
                // 处理取消操作
                token.onCancellationRequested(() => {
                    process.kill();
                    reject(new Error('用户取消了操作'));
                });
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`运行失败: ${error}`);
        }
    });
}
async function waitForOutputFile(outputFilePath, maxWaitTime = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
        if (fs.existsSync(outputFilePath)) {
            // 等待一小段时间确保文件写入完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const outputUri = vscode.Uri.file(outputFilePath);
                const doc = await vscode.workspace.openTextDocument(outputUri);
                const editor = await vscode.window.showTextDocument(doc);
                // 跳转到文件尾部
                const lastLine = doc.lineCount - 1;
                const lastPosition = new vscode.Position(lastLine, 0);
                editor.selection = new vscode.Selection(lastPosition, lastPosition);
                editor.revealRange(new vscode.Range(lastPosition, lastPosition), vscode.TextEditorRevealType.InCenter);
                vscode.window.showInformationMessage(`已打开输出文件: ${path.basename(outputFilePath)}`);
                return;
            }
            catch (error) {
                vscode.window.showErrorMessage(`无法打开输出文件: ${error}`);
                return;
            }
        }
        // 等待 500ms 后再检查
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    vscode.window.showWarningMessage(`输出文件未在预期时间内生成: ${path.basename(outputFilePath)}`);
}
//# sourceMappingURL=extension.js.map