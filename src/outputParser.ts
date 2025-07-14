export interface EnergyResult {
    method: string;
    energy: number;
    description: string;
}

export interface CalculationJob {
    jobNumber: number;
    route: string;
    title: string;
    energyResults: EnergyResult[];
    version?: string;
    state?: string;
    pointGroup?: string;
    jobType: string;
}

export interface ParsedOutput {
    jobs: CalculationJob[];
    totalJobs: number;
}

export class GaussianOutputParser {
    
    static parseOutput(content: string): ParsedOutput {
        const jobs: CalculationJob[] = [];
        
        // 查找关键行 (Enter /share/apps/soft/g16/l9999.exe)
        const keyLine = '(Enter /share/apps/soft/g16/l9999.exe)';
        const lines = content.split('\n');
        
        let jobNumber = 1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(keyLine)) {
                // 找到关键行，开始收集后续的输出总结
                const summaryLines: string[] = [];
                
                // 从下一行开始收集，直到遇到以 @ 结尾的行
                for (let j = i + 1; j < lines.length; j++) {
                    const line = lines[j].trim();
                    if (line === '') continue; // 跳过空行
                    
                    summaryLines.push(line);
                    
                    // 如果行以 @ 结尾，停止收集
                    if (line.endsWith('@')) {
                        break;
                    }
                }
                
                // 解析收集到的总结信息
                if (summaryLines.length > 0) {
                    const job = this.parseSummarySection(summaryLines, jobNumber);
                    if (job) {
                        jobs.push(job);
                        jobNumber++;
                    }
                }
            }
        }
        
        return {
            jobs,
            totalJobs: jobs.length
        };
    }
    
    private static parseSummarySection(summaryLines: string[], jobNumber: number): CalculationJob | null {
        // 将所有行拼接为一行
        const summaryText = summaryLines.join('').replace(/\s+/g, ' ').trim();
        
        // 移除末尾的 @
        const cleanSummary = summaryText.replace(/@\s*$/, '');
        
        // 将 \\ 替换为 \n，然后按 \ 分割
        const processedText = cleanSummary.replace(/\\\\/g, '\n').replace(/\\0\n/g, '\\');
        const parts = processedText.split('\\');
        
        // 初始化变量
        let route = '';
        let title = '';
        const energyResults: EnergyResult[] = [];
        let version = '';
        let state = '';
        let pointGroup = '';
        
        // 解析各个部分
        for (const part of parts) {
            const trimmedPart = part.trim();
            
            if (trimmedPart.startsWith('#')) {
                // 计算路径
                route = trimmedPart;
            } else if (trimmedPart.includes('Version=')) {
                // 版本信息
                const versionMatch = trimmedPart.match(/Version=([^\\]+)/);
                if (versionMatch) {
                    version = versionMatch[1];
                }
            } else if (trimmedPart.includes('State=')) {
                // 状态信息
                const stateMatch = trimmedPart.match(/State=([^\\]+)/);
                if (stateMatch) {
                    state = stateMatch[1];
                }
            } else if (trimmedPart.includes('PG=')) {
                // 点群信息
                const pgMatch = trimmedPart.match(/PG=([^\\]+)/);
                if (pgMatch) {
                    pointGroup = pgMatch[1];
                }
            } else if (trimmedPart.includes('=') && /[A-Z]/.test(trimmedPart)) {
                // 能量信息
                const energyMatches = trimmedPart.match(/([A-Z0-9()]+)=(-?\d+\.\d+)/g);
                console.log(trimmedPart)
                if (energyMatches) {
                    energyMatches.forEach(match => {
                        const parts = match.match(/([A-Z0-9()]+)=(-?\d+\.\d+)/);
                        if (parts) {
                            const method = parts[1];
                            const energy = parseFloat(parts[2]);
                            console.log(method,energy)
                            
                            // 避免重复添加相同的能量结果
                            if (!energyResults.some(result => result.method === method)) {
                                energyResults.push({
                                    method,
                                    energy,
                                    description: this.getMethodDescription(method)
                                });
                            }
                        }
                    });
                }
            } else if (trimmedPart.length > 0 && !trimmedPart.includes('=') && !trimmedPart.includes(',')) {
                // 可能是标题，取第一个非路径的文本作为标题
                if (!title && !trimmedPart.startsWith('#') && trimmedPart.length < 100) {
                    title = trimmedPart;
                }
            }
        }
        
        // 确定任务类型
        const jobType = this.determineJobType(route, summaryText);
        
        // 如果没有找到任何有用信息，跳过这个任务
        if (!route && energyResults.length === 0) {
            return null;
        }
        route = route.split("\n")[0]
        
        return {
            jobNumber,
            route: route || '未知计算类型',
            title: title || `任务 ${jobNumber}`,
            energyResults,
            version,
            state,
            pointGroup,
            jobType
        };
    }
    
    private static determineJobType(route: string, section: string): string {
        const routeLower = route.toLowerCase();
        
        if (routeLower.includes('opt')) {
            return '几何优化';
        } else if (routeLower.includes('freq')) {
            return '频率计算';
        } else if (routeLower.includes('td')) {
            return '激发态计算';
        } else if (routeLower.includes('irc')) {
            return '反应路径计算';
        } else if (routeLower.includes('scan')) {
            return '扫描计算';
        } else {
            return '单点能计算(推测)';
        }
    }
    
    private static getMethodDescription(method: string): string {
        const descriptions: { [key: string]: string } = {
            'HF': 'Hartree-Fock Self-Consistent Field',
            'MP2': 'Second-order Møller-Plesset Perturbation Theory',
            'MP3': 'Third-order Møller-Plesset Perturbation Theory',
            'MP4D': 'Fourth-order Møller-Plesset with Double Substitutions',
            'MP4DQ': 'Fourth-order Møller-Plesset with Double and Quadruple Substitutions',
            'MP4SDQ': 'Fourth-order Møller-Plesset with Single, Double and Quadruple Substitutions',
            'CCSD': 'Coupled Cluster with Single and Double Excitations',
            'CCSD(T)': 'Coupled Cluster with Single, Double and Perturbative Triple Excitations',
            'B3LYP': 'Becke 3-parameter Lee-Yang-Parr Hybrid Functional',
            'M06-2X': 'Minnesota 06 Meta-GGA Exchange-Correlation Functional',
            'PBE0': 'Perdew-Burke-Ernzerhof Hybrid Functional'
            // 'RMSD': 'Root Mean Square Deviation of Density Matrix',
        };
        
        return descriptions[method] || method;
    }
}
