import * as vscode from 'vscode';

export class GaussianCompletionProvider implements vscode.CompletionItemProvider {
    
    // Gaussian关键字数据
    private readonly keywords = {
        // 计算方法
        methods: [
            'HF', 'MP2', 'MP3', 'MP4', 'MP5', 'CCSD', 'CCSDT', 'QCISD', 'CID', 'CISD', 'CIS',
            'B3LYP', 'B3PW91', 'BLYP', 'PBE', 'PBE0', 'M06', 'M062X', 'CAM-B3LYP', 'wB97XD', 'LC-wPBE',
            'LSDA', 'SVWN', 'PW91', 'mPW1PW91', 'HCTH', 'HCTH147', 'HCTH407'
        ],
        
        // 基组
        basisSets: [
            'STO-3G', '3-21G', '6-31G', '6-31G(d)', '6-31G(d,p)', '6-31+G(d)', '6-31+G(d,p)', '6-31++G(d,p)',
            '6-311G', '6-311G(d)', '6-311G(d,p)', '6-311+G(d)', '6-311+G(d,p)', '6-311++G(d,p)',
            'cc-pVDZ', 'cc-pVTZ', 'cc-pVQZ', 'cc-pV5Z', 'cc-pV6Z',
            'aug-cc-pVDZ', 'aug-cc-pVTZ', 'aug-cc-pVQZ', 'aug-cc-pV5Z',
            'def2-SVP', 'def2-SVPD', 'def2-TZVP', 'def2-TZVPD', 'def2-QZVP',
            'LANL2DZ', 'LANL2MB', 'SDD', 'CEP-4G', 'CEP-31G', 'CEP-121G'
        ],
        
        // 任务类型
        jobTypes: [
            'sp', 'opt', 'freq', 'irc', 'scan', 'nmr', 'pop', 'polar', 'stable', 'force', 'guess', 
            'scf', 'td', 'admp', 'bomd', 'cis', 'eom','casscf'
        ],
        
        // 其他关键字
        miscKeywords: [
            'scrf', 'geom', 'integral', 'density', 'nosymm', 'symmetry', 'charge', 'units', 
            'temperature', 'pressure', 'counterpoise', 'gfinput', 'gfprint', 'iop', 'test', 
            'output', 'punch', 'prop', 'pseudo', 'restart', 'scale', 'sparse', 'window', 'em'
        ],
        
        // DFT色散校正
        dispersionCorrections: [
            'em=GD2', 'em=GD3', 'em=GD3BJ', 'em=GD4'
        ],
        
        // Link0命令
        link0Commands: [
            '%chk', '%mem', '%nproc', '%nprocshared', '%cpu', '%gpucpu', '%rwf', '%int', '%d2e'
        ],
        
        // 溶剂模型选项
        solventOptions: [
            'PCM', 'IEFPCM', 'CPCM', 'DIPOLE', 'SMD', 'COSMO'
        ],
        
        // 常用溶剂
        solvents: [
            'Water', 'Acetone', 'Acetonitrile', 'Aniline', 'Benzene', 'Bromoform', 'Butanol',
            'CarbonDisulfide', 'CarbonTetrachloride', 'Chlorobenzene', 'Chloroform', 'Cyclohexane',
            'Dichloroethane', 'Dichloromethane', 'Diethylether', 'Dimethylformamide', 'Dimethylsulfoxide',
            'Ethanol', 'Ethylacetate', 'Heptane', 'Hexane', 'Methanol', 'Nitromethane', 'Octanol',
            'Pyridine', 'Tetrahydrofuran', 'Toluene', 'Xylene'
        ]
    };

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        
        const line = document.lineAt(position);
        const lineText = line.text;
        const linePrefix = lineText.substring(0, position.character);
        
        const completionItems: vscode.CompletionItem[] = [];
        
        // 检查是否在route section中 (以#开头的行)
        const isInRouteSection = lineText.startsWith('#') || (linePrefix.includes('#') && !linePrefix.includes('\n'));
        
        if (isInRouteSection) {
            // 检查是否在基组补全中 (在route行中输入 / 时)
            if (linePrefix.endsWith('/')) {
                // 提取 / 后的文本作为筛选条件
                // const slashIndex = linePrefix.lastIndexOf('/');
                // const filterText = linePrefix.substring(slashIndex + 1);
                completionItems.push(...this.getBasisSetCompletions());
            }
            // 检查是否在等号补全中 (处理色散校正等参数)
            else if (linePrefix.endsWith('=')) {
                completionItems.push(...this.getParameterCompletions(linePrefix));
            }
            // 检查是否在空格后或行末 (触发关键字和方法补全)
            else if (linePrefix.endsWith(' ') || 
                     (position.character === linePrefix.length && 
                      !linePrefix.endsWith('/') && 
                      !linePrefix.endsWith('='))) {
                completionItems.push(...this.getRouteKeywordsAndMethods(lineText));
            }
        }
        
        // 检查是否在Link0命令中 (以%开头的行)
        if (lineText.startsWith('%')) {
            completionItems.push(...this.getLink0Completions(position));
        }
        
        // 检查是否在溶剂选项中
        if (linePrefix.toLowerCase().includes('scrf') && linePrefix.includes('(')) {
            completionItems.push(...this.getSolventCompletions());
        }
        
        return completionItems;
    }
    
    private getRouteKeywordsAndMethods(lineText: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // 检查当前行是否已经包含计算方法
        const hasMethod = this.keywords.methods.some(method => 
            lineText.toLowerCase().includes(method.toLowerCase())
        );
        
        if (hasMethod) {
            // 如果已经有方法，只显示关键字
            
            // 添加任务类型
            this.keywords.jobTypes.forEach(job => {
                const item = new vscode.CompletionItem(job, vscode.CompletionItemKind.Keyword);
                item.detail = '任务类型';
                item.documentation = new vscode.MarkdownString(`**${job}** 任务类型`);
                completions.push(item);
            });
            
            // 添加其他关键字
            this.keywords.miscKeywords.forEach(keyword => {
                const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Property);
                item.detail = 'Gaussian关键字';
                item.documentation = new vscode.MarkdownString(`**${keyword}** Gaussian关键字`);
                completions.push(item);
            });
        } else {
            // 如果没有方法，只显示计算方法
            this.keywords.methods.forEach(method => {
                const item = new vscode.CompletionItem(method, vscode.CompletionItemKind.Method);
                item.detail = '计算方法';
                item.documentation = new vscode.MarkdownString(`**${method}** 计算方法`);
                completions.push(item);
            });
        }
        
        return completions;
    }
    
    private getParameterCompletions(linePrefix: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        const prefix = linePrefix.toLowerCase();
        
        // 检查是否是em=的情况
        if (prefix.endsWith("em=")){
            this.keywords.dispersionCorrections.forEach(dispersion => {
                const item = new vscode.CompletionItem(dispersion.replace('em=', ''), vscode.CompletionItemKind.Property);
                item.detail = 'DFT色散校正';
                item.documentation = new vscode.MarkdownString(`**${dispersion}** DFT经验色散校正`);
                item.insertText = dispersion.replace('em=', '');
                completions.push(item);
            });

        }

        if (prefix.endsWith('geom=') || prefix.endsWith("guess=")) {
            const item = new vscode.CompletionItem("checkpoint", vscode.CompletionItemKind.Property);
            item.detail = '检查点';
            item.documentation = new vscode.MarkdownString(`从上一个检查点读取`);
            item.insertText = "checkpoint";
            completions.push(item);
        }
        
        return completions;
    }
    
    
    private getLink0Completions(position: vscode.Position): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // 获取当前文件名（不带扩展名）
        const activeEditor = vscode.window.activeTextEditor;
        let baseFileName = 'filename';
        if (activeEditor) {
            const fileName = activeEditor.document.fileName;
            const baseName = fileName.split(/[\\\/]/).pop(); // 获取文件名部分
            if (baseName) {
                baseFileName = baseName.replace(/\.[^/.]+$/, ''); // 移除扩展名
            }
        }
        
        this.keywords.link0Commands.forEach(command => {
            const item = new vscode.CompletionItem(command, vscode.CompletionItemKind.Function);
            item.detail = 'Link0命令';
            item.documentation = new vscode.MarkdownString(`**${command}** Link0命令`);
            
            // 设置替换范围，避免重复%
            item.range = new vscode.Range(
                new vscode.Position(position.line, 0),
                new vscode.Position(position.line, position.character)
            );
            
            // 为某些命令添加默认值
            switch (command) {
                case '%mem':
                    item.insertText = '%mem=30GB';
                    break;
                case '%nproc':
                    item.insertText = '%nproc=1';
                    break;
                case '%nprocshared':
                    item.insertText = '%nprocshared=32';
                    break;
                case '%chk':
                    item.insertText = `%chk=${baseFileName}.chk`;
                    break;
                default:
                    item.insertText = command + '=';
            }
            
            completions.push(item);
        });
        
        return completions;
    }
    
    private getBasisSetCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // 添加所有基组，让 VS Code 自己处理筛选
        this.keywords.basisSets.forEach(basis => {
            const item = new vscode.CompletionItem(basis, vscode.CompletionItemKind.Method);
            item.detail = '基组';
            item.documentation = new vscode.MarkdownString(`**${basis}** 基组`);
            // item.insertText = basis;
            completions.push(item);
        });
        
        return completions;
    }
    
    private getSolventCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // 添加溶剂模型
        this.keywords.solventOptions.forEach(option => {
            const item = new vscode.CompletionItem(option, vscode.CompletionItemKind.Enum);
            item.detail = '溶剂模型';
            item.documentation = new vscode.MarkdownString(`**${option}** 溶剂模型`);
            completions.push(item);
        });
        
        // 添加溶剂
        this.keywords.solvents.forEach(solvent => {
            const item = new vscode.CompletionItem(solvent, vscode.CompletionItemKind.Value);
            item.detail = '溶剂';
            item.documentation = new vscode.MarkdownString(`**${solvent}** 溶剂`);
            item.insertText = `Solvent=${solvent}`;
            completions.push(item);
        });
        
        return completions;
    }
}
