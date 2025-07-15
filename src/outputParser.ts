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
    finalEnergy?: EnergyResult;
    version?: string;
    state?: string;
    pointGroup?: string;
    jobType: string;
}

export interface ParsedOutput {
    jobs: CalculationJob[];
    totalJobs: number;
    terminationStatus: 'normal' | 'error' | 'running' | 'unknown';
    terminationMessage?: string;
}

export class GaussianOutputParser {
    
    static parseOutput(content: string): ParsedOutput {
        const jobs: CalculationJob[] = [];
        
        // 检查计算终止状态
        const terminationInfo = this.checkTerminationStatus(content);
        
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
            totalJobs: jobs.length,
            terminationStatus: terminationInfo.status,
            terminationMessage: terminationInfo.message
        };
    }
    
    /**
     * 从给定的能量结果中提取最终能量
     * @param energyResults 能量结果数组
     * @param route 计算路径（可选，用于辅助判断）
     * @returns 最终能量结果，如果没有找到则返回 undefined
     */
    static getFinalEnergy(energyResults: EnergyResult[], route?: string): EnergyResult | undefined {
        return this.extractFinalEnergy(energyResults, route || '');
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
                if (energyMatches) {
                    energyMatches.forEach(match => {
                        const parts = match.match(/([A-Z0-9()]+)=(-?\d+\.\d+)/);
                        if (parts) {
                            const method = parts[1];
                            const energy = parseFloat(parts[2]);
                            
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
        
        // 提取最终能量
        const finalEnergy = this.extractFinalEnergy(energyResults, route);
        
        // 如果没有找到任何有用信息，跳过这个任务
        if (!route && energyResults.length === 0) {
            return null;
        }
        title = route.split("\n")[1]
        route = route.split("\n")[0]
        
        return {
            jobNumber,
            route: route || '未知计算类型',
            title: title || `任务 ${jobNumber}`,
            energyResults,
            finalEnergy,
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
    
    private static extractFinalEnergy(energyResults: EnergyResult[], route: string): EnergyResult | undefined {
        if (energyResults.length === 0) {
            return undefined;
        }
        
        // 能量方法优先级（从高到低）
        const priorityOrder = [
            'QCISD(T)',         // 最高级别
            'CCSD(T)',          // Gold standard
            'E(CBS-QB3)',       // 复合方法
            'ONIOM',            // ONIOM方法（需要特殊处理）
            'CCSD',             // CCSD
            'MP4SDQ',           // MP4 full
            'MP4',              // MP4 full (alternative)
            'MP4DQ',            // MP4 with DQ
            'MP4D',             // MP4 with D
            'MP2',              // MP2
            'HF'                // 最基础的方法
        ];
        
        // 特殊处理：查找包含特定关键词的能量
        for (const result of energyResults) {
            if (result.method.includes('CBS-QB3') || 
                result.method.includes('extrapolated energy') ||
                result.method.includes('ONIOM')) {
                return result;
            }
        }
        
        // 按优先级查找
        for (const priority of priorityOrder) {
            const found = energyResults.find(result => 
                result.method === priority || 
                result.method.startsWith(priority)
            );
            if (found) {
                return found;
            }
        }
        
        // 如果没有找到预定义的方法，返回最后一个能量（通常是最终能量）
        return energyResults[energyResults.length - 1];
    }
    
    private static checkTerminationStatus(content: string): { status: 'normal' | 'error' | 'running' | 'unknown', message?: string } {
        const lines = content.split('\n');
        let messages = '';
        let warns = new Map<string, number>();
        for (const match of content.matchAll(/(.*(Warning|Unable|failed|impossible).*)/gi)) {
            if (match[0].includes("This program may not be used in any manner that")) continue;
            
            const warningText = match[0].trim();
            warns.set(warningText, (warns.get(warningText) || 0) + 1);
        }
        
        for (const [warning, count] of warns) {
            if (count > 1) {
                messages += `注意：${warning} *${count}<br>`;
            } else {
                messages += `注意：${warning}<br>`;
            }
        }

        // 检查正常终止
        if (lines[lines.length - 2].includes('Normal termination of Gaussian')) {
            return { status: 'normal', message: messages + '计算正常完成' };
        }
        
        // 检查错误终止
        for (const line of lines) {
            if (line.includes('Error termination')) {
                // 尝试提取错误信息
                const impossibleMultiplicityMatch = content.match(/The combination of multiplicity\s*\d+\s*and\s*\d+\s*electrons is impossible./);
                if (impossibleMultiplicityMatch){
                    return { 
                        status: 'error', 
                        message: messages + `检查多重度设置` 
                    };
                }
                const scfErrorMatch = content.match(/Convergence criterion not met./);
                if (scfErrorMatch) {
                    return { 
                        status: 'error', 
                        message: messages + `SCF不收敛` 
                    };
                }
                const syntaxErrorMatch = content.match(/End of file in ZSymb./);
                if (syntaxErrorMatch) {
                    return { 
                        status: 'error', 
                        message: messages + `语法错误，检查文末是否有空行` 
                    };
                }
                const emErrorMatch = content.match(/.+Unable to choose the S6 parameter.+ScaHFX=\s*([\d\.]+).+/);
                if (emErrorMatch) {
                    if (emErrorMatch.length >= 2 && emErrorMatch[1] === '0.0000') {
                        return { 
                            status: 'error', 
                            message: messages + `纯粹的HF方法(或CCSD等）不能使用em参数。` 
                        };
                    }
                    return { 
                        status: 'error', 
                        message: messages + `检查em参数与计算方法的兼容性`
                    };
                }
                const errorMatch = line.match(/Error termination via (.+) at/);
                const errorLocation = errorMatch ? errorMatch[1] : '未知位置';
                return { 
                    status: 'error', 
                    message: messages + `计算异常终止 (${errorLocation})` 
                };
            }
        }
        
        // 检查是否有任何Gaussian特征行，如果没有则状态未知
        const hasGaussianContent = lines.some(line => 
            line.includes('Gaussian') || 
            line.includes('l9999.exe') ||
            line.includes('Route #') ||
            line.includes('# ')
        );
        
        if (!hasGaussianContent) {
            return { status: 'unknown', message: '无法识别的文件内容' };
        }
        
        // 如果有Gaussian内容但没有终止信息，则认为正在运行
        return { status: 'running', message: '计算可能仍在进行中或已被中断' };
    }
}
