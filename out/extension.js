"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const completion_1 = require("./completion");
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
    context.subscriptions.push(completionProvider);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map