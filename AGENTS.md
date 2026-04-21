# AGENTS.md — Gaussian VSCode Extension

## 项目概述

这是一个 Visual Studio Code 扩展插件，为 Gaussian 量化计算软件的输入/输出文件提供语法高亮、代码补全和预览功能。

- **语言**：TypeScript
- **平台**：VS Code Extension API
- **入口文件**：`src/extension.ts`
- **编译输出**：`out/` 目录

## 构建与编译命令

```bash
# 安装依赖
npm install

# 编译 TypeScript（一次性）
npm run compile

# 监视模式（开发时自动重编译）
npm run watch

# 发布前编译（同 compile）
npm run vscode:prepublish
```

> **注意**：本项目无测试框架配置（无 jest/vitest/mocha），无 ESLint/Prettier 配置。
> 调试方式：在 VS Code 中按 F5 启动扩展开发宿主窗口。

## 运行单个测试

本项目当前**没有自动化测试**。验证方式：

1. 按 F5 打开扩展开发宿主
2. 打开 `.gin` / `.gjf` / `.com` 文件验证补全功能
3. 打开 `.out` / `.log` 文件验证预览功能

## 项目结构

```
gaussian_vscode/
├── src/
│   ├── extension.ts        # 插件入口，注册命令和提供程序
│   ├── completion.ts       # 代码补全提供程序 (GaussianCompletionProvider)
│   ├── outputParser.ts     # Gaussian 输出文件解析器
│   └── previewProvider.ts  # 输出文件预览 WebView 提供程序
├── syntaxes/
│   └── GaussianInput.tmLanguage.json  # TextMate 语法定义
├── snippets/
│   └── gaussian.json       # 代码片段
├── out/                    # 编译输出（gitignore）
├── package.json            # 扩展清单 + npm 脚本
├── tsconfig.json           # TypeScript 配置
└── language-configuration.json  # 语言配置
```

## TypeScript 配置

```json
{
  "module": "commonjs",
  "target": "ES2018",
  "outDir": "out",
  "lib": ["ES2018"],
  "sourceMap": true,
  "rootDir": "src",
  "strict": true   // 严格模式已开启
}
```

## 代码风格规范

### 导入规则

```typescript
// 1. Node.js 内置模块用 * as 导入
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 2. 本地模块用命名导入
import { GaussianCompletionProvider } from './completion';
import { GaussianOutputPreviewProvider } from './previewProvider';

// 3. 禁止 require()（除非在函数体内动态加载）
// 允许：const { spawn } = require('child_process');  // 在函数体内
```

### 命名规范

- **类名**：PascalCase，无前缀（`GaussianCompletionProvider`，`GaussianOutputParser`）
- **接口名**：PascalCase，无 `I` 前缀（`EnergyResult`，`CalculationJob`，`ParsedOutput`）
- **函数/方法名**：camelCase（`parseOutput`，`getFinalEnergy`，`provideCompletionItems`）
- **私有方法**：`private` 关键字 + camelCase（`getRouteKeywordsAndMethods`）
- **静态方法**：`static` 关键字 + camelCase（`GaussianOutputParser.parseOutput`）
- **常量/只读属性**：camelCase（`private readonly keywords = {...}`）
- **变量**：camelCase（`lineText`，`completionItems`，`baseFileName`）

### 类型注解

```typescript
// 明确注解函数参数和返回类型
static parseOutput(content: string): ParsedOutput { ... }
static getFinalEnergy(energyResults: EnergyResult[], route?: string): EnergyResult | undefined { ... }

// 使用 interface 定义数据结构，不用 type alias
export interface EnergyResult {
    method: string;
    energy: number;
    description: string;
}

// 联合类型用于有限状态
terminationStatus: 'normal' | 'error' | 'running' | 'unknown';

// 可选参数用 ?
uri?: vscode.Uri
route?: string
```

### 错误处理

```typescript
// try/catch 包裹异步操作，用 vscode.window.showErrorMessage 显示用户错误
try {
    // ...
} catch (error) {
    vscode.window.showErrorMessage(`运行失败: ${error}`);
}

// 返回 null 表示解析失败（不抛出异常）
private static parseSummarySection(...): CalculationJob | null {
    if (!route && energyResults.length === 0) {
        return null;
    }
    // ...
}

// 用户消息均为中文
vscode.window.showErrorMessage('请先打开一个Gaussian输出文件');
vscode.window.showInformationMessage(`已打开输出文件: ${path.basename(outputFilePath)}`);
```

### 类结构

```typescript
// VS Code Provider 实现接口
export class GaussianCompletionProvider implements vscode.CompletionItemProvider {
    // 1. 私有只读数据
    private readonly keywords = { ... };
    
    // 2. 接口方法（公开）
    provideCompletionItems(...): vscode.ProviderResult<...> { ... }
    
    // 3. 私有辅助方法
    private getRouteKeywordsAndMethods(...): vscode.CompletionItem[] { ... }
}

// 纯工具类用静态方法
export class GaussianOutputParser {
    static parseOutput(content: string): ParsedOutput { ... }
    private static parseSummarySection(...): CalculationJob | null { ... }
}
```

### 格式规范

- 缩进：**4个空格**（与现有代码保持一致）
- 字符串：**单引号**（`'GaussianInput'`），模板字符串用反引号
- 分号：**必须加分号**
- 花括号：**同行**（K&R 风格）
- 行尾注释：中文注释说明业务逻辑

### VS Code Extension 开发模式

```typescript
// activate 函数注册所有提供程序和命令
export function activate(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerCompletionItemProvider(...);
    const command = vscode.commands.registerCommand('gaussian.xxx', handler);
    
    // 所有订阅推入 context.subscriptions
    context.subscriptions.push(provider, command);
}

// deactivate 通常为空
export function deactivate() {}
```

## 支持的文件类型

| 语言 ID | 扩展名 | 用途 |
|---------|--------|------|
| GaussianInput | `.gin` `.gjf` `.com` | 输入文件（补全+高亮） |
| GaussianOutput | `.out` `.log` | 输出文件（预览） |

## 扩展命令

| 命令 ID | 功能 |
|---------|------|
| `gaussian.previewOutput` | 预览 Gaussian 输出文件 |
| `gaussian.runInput` | 提交 Gaussian 输入文件运行 |

## 注意事项

- `out/` 目录为编译产物，不要手动修改
- `strict: true` 已启用，所有代码必须通过严格类型检查
- 无 ESLint/Prettier，格式遵循现有代码风格
- 用户面向的消息（错误、信息提示）使用**中文**
- 代码注释使用**中文**描述业务逻辑
