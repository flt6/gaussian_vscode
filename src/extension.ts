import * as vscode from 'vscode';
import { GaussianCompletionProvider } from './completion';
import { GaussianOutputPreviewProvider } from './previewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Gaussian syntax extension is now active!');

    // 注册代码补全提供程序
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { language: 'GaussianInput' },
        new GaussianCompletionProvider(),
        '#', // 触发字符 - route section
        '%', // 触发字符 - link0 commands
        '(', // 触发字符 - options
        '=', // 触发字符 - keyword options
        '/', // 触发字符 - basis set
        ' '  // 触发字符 - space for keywords
    );

    // 注册输出文件预览命令
    const previewCommand = vscode.commands.registerCommand('gaussian.previewOutput', (uri?: vscode.Uri) => {
        // 如果没有传入URI，使用当前活动编辑器的文件
        if (!uri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                uri = activeEditor.document.uri;
            } else {
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

        GaussianOutputPreviewProvider.showPreview(uri);
    });

    context.subscriptions.push(completionProvider, previewCommand);
}

export function deactivate() {}
