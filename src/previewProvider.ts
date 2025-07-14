import * as vscode from 'vscode';
import * as path from 'path';
import { GaussianOutputParser, ParsedOutput, CalculationJob } from './outputParser';

export class GaussianOutputPreviewProvider {
    private static readonly viewType = 'gaussianOutputPreview';
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static refreshTimer: NodeJS.Timeout | undefined;
    private static currentUri: vscode.Uri | undefined;

    public static async showPreview(uri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 保存当前URI用于刷新
        GaussianOutputPreviewProvider.currentUri = uri;

        // 如果已有预览面板，则重用
        if (GaussianOutputPreviewProvider.currentPanel) {
            GaussianOutputPreviewProvider.currentPanel.reveal(column);
        } else {
            // 创建新的预览面板
            GaussianOutputPreviewProvider.currentPanel = vscode.window.createWebviewPanel(
                GaussianOutputPreviewProvider.viewType,
                `Gaussian Output Preview - ${path.basename(uri.fsPath)}`,
                column || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
        }

        // 设置关闭事件
        GaussianOutputPreviewProvider.currentPanel.onDidDispose(
            () => {
                GaussianOutputPreviewProvider.currentPanel = undefined;
                GaussianOutputPreviewProvider.currentUri = undefined;
                // 清除定时器
                if (GaussianOutputPreviewProvider.refreshTimer) {
                    clearInterval(GaussianOutputPreviewProvider.refreshTimer);
                    GaussianOutputPreviewProvider.refreshTimer = undefined;
                }
            },
            null
        );

        // 加载内容
        await this.loadContent();

        // 启动自动刷新
        this.startAutoRefresh();
    }

    private static async loadContent() {
        if (!GaussianOutputPreviewProvider.currentPanel || !GaussianOutputPreviewProvider.currentUri) {
            return;
        }

        // 读取文件内容
        try {
            const document = await vscode.workspace.openTextDocument(GaussianOutputPreviewProvider.currentUri);
            const content = document.getText();
            
            // 解析输出文件
            const parsedOutput = GaussianOutputParser.parseOutput(content);
            
            // 生成HTML内容
            const html = this.generateHtmlContent(parsedOutput, path.basename(GaussianOutputPreviewProvider.currentUri.fsPath));
            
            GaussianOutputPreviewProvider.currentPanel.webview.html = html;
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to preview Gaussian output: ${error}`);
        }
    }

    private static startAutoRefresh() {
        // 清除现有定时器
        if (GaussianOutputPreviewProvider.refreshTimer) {
            clearInterval(GaussianOutputPreviewProvider.refreshTimer);
        }

        // 设置每5秒刷新一次
        GaussianOutputPreviewProvider.refreshTimer = setInterval(async () => {
            if (GaussianOutputPreviewProvider.currentPanel && GaussianOutputPreviewProvider.currentUri) {
                await this.loadContent();
            }
        }, 5000);
    }

    private static generateHtmlContent(parsedOutput: ParsedOutput, filename: string): string {
        const { jobs, totalJobs, terminationStatus, terminationMessage } = parsedOutput;
        
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gaussian Output Preview</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .jobs-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .job-card {
            background-color: #f8f9fa;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 5px solid #3498db;
        }
        
        .job-header {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            padding: 20px;
            position: relative;
        }
        
        .job-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .job-route {
            font-size: 14px;
            opacity: 0.9;
            font-family: 'Courier New', monospace;
            background-color: rgba(255,255,255,0.2);
            padding: 8px 12px;
            border-radius: 5px;
            margin-top: 10px;
        }
        
        .job-type {
            position: absolute;
            top: 15px;
            right: 20px;
            background-color: rgba(255,255,255,0.2);
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .summary-card {
            background: linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        
        .stat-item {
            background-color: rgba(255,255,255,0.2);
            padding: 15px;
            border-radius: 8px;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .energy-value {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            color: #e74c3c;
        }
        
        .method-name {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .highlight {
            background-color: #fff3cd;
        }
        
        .no-data {
            text-align: center;
            color: #7f8c8d;
            font-style: italic;
            padding: 40px 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .status-banner {
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .status-normal {
            background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
            color: white;
            border-left: 5px solid #00a085;
        }
        
        .status-error {
            background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
            color: white;
            border-left: 5px solid #c0392b;
            animation: pulse 2s infinite;
        }
        
        .status-running {
            background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%);
            color: white;
            border-left: 5px solid #e67e22;
        }
        
        .status-unknown {
            background: linear-gradient(135deg, #636e72 0%, #2d3436 100%);
            color: white;
            border-left: 5px solid #555;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }
        
        .status-icon {
            font-size: 24px;
        }
        
        @media (max-width: 1024px) {
            .jobs-container {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 15px;
            }
            
            .jobs-container {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            
            .job-header {
                padding: 15px;
            }
            
            .job-type {
                position: static;
                margin-top: 10px;
                display: inline-block;
            }
            
            .summary-stats {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Gaussian 输出文件预览</h1>
        <p><strong>文件名:</strong> ${filename}</p>
        <p style="color: #7f8c8d; font-size: 12px;">⏰ 最后更新: ${new Date().toLocaleString('zh-CN')}</p>
        
        ${this.generateStatusBanner(terminationStatus, terminationMessage)}
        
        
        <div class="jobs-container">
            ${jobs.map((job, index) => this.generateJobSection(job, index + 1)).join('')}
        </div>
    </div>
</body>
</html>`;
    }

    private static generateStatusBanner(status: string, message?: string): string {
        let statusClass = '';
        let statusIcon = '';
        let statusText = '';
        
        switch (status) {
            case 'normal':
                statusClass = 'status-normal';
                statusIcon = '✅';
                statusText = message || '计算正常完成';
                break;
            case 'error':
                statusClass = 'status-error';
                statusIcon = '❌';
                statusText = message || '计算异常终止';
                break;
            case 'running':
                statusClass = 'status-running';
                statusIcon = '⏳';
                statusText = message || '计算可能仍在进行中';
                break;
            case 'unknown':
            default:
                statusClass = 'status-unknown';
                statusIcon = '❓';
                statusText = message || '无法确定计算状态';
                break;
        }
        
        return `
            <div class="status-banner ${statusClass}">
                <span class="status-icon">${statusIcon}</span>
                <span>${statusText}</span>
            </div>
        `;
    }

    private static getTotalEnergyResults(jobs: CalculationJob[]): number {
        return jobs.reduce((total, job) => total + job.energyResults.length, 0);
    }

    private static getUniqueJobTypes(jobs: CalculationJob[]): string[] {
        const types = new Set(jobs.map(job => job.jobType));
        return Array.from(types);
    }

    private static generateJobSection(job: CalculationJob, index: number): string {
        return `
            <div class="job-card">
                <div class="job-header">
                    <div class="job-type">${job.jobType}</div>
                    <div class="job-title">🔬 ${job.title}</div>
                    <div class="job-route">${job.route}</div>
                </div>
                
                <div style="padding: 20px;">
                    <h3 style="margin-top: 0; color: #2c3e50;">⚡ 结果参数</h3>
                    ${this.generateEnergyTable(job.energyResults)}
                </div>
            </div>
        `;
    }

    private static generateEnergyTable(energyResults: any[]): string {
        if (!energyResults || energyResults.length === 0) {
            return '<div class="no-data">未找到参数</div>';
        }

        // 将结果分组，每2个为一行
        const rows = [];
        for (let i = 0; i < energyResults.length; i += 2) {
            rows.push(energyResults.slice(i, i + 2));
        }

        const tableRows = rows.map(row => {
            const cells = row.map(result => {
                const isHighlight = result.method === 'CCSD(T)' || result.method === 'CCSD';
                return `
                    <td ${isHighlight ? 'class="highlight"' : ''} style="text-align: center; padding: 15px; border: 1px solid #ddd;">
                        <div class="method-name" style="margin-bottom: 8px; font-size: 14px;">${result.method}</div>
                        <div class="energy-value" style="font-size: 12px;">${result.energy}</div>
                    </td>
                `;
            }).join('');
            
            // 如果这一行不足2个，补充空单元格
            const emptyCells = row.length < 2 ? 
                Array(2 - row.length).fill('<td style="border: 1px solid #ddd;"></td>').join('') : '';
            
            return `<tr>${cells}${emptyCells}</tr>`;
        }).join('');

        return `
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    }
}
