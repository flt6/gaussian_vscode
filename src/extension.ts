import * as vscode from 'vscode';
import { GaussianCompletionProvider } from './completion';

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

    context.subscriptions.push(completionProvider);
}

export function deactivate() {}
