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
    enthalpy?: number;
}

export interface ParsedOutput {
    jobs: CalculationJob[];
    totalJobs: number;
    terminationStatus: 'normal' | 'error' | 'running' | 'unknown';
    terminationMessage?: string;
}

export interface NormalizedJob {
    id: number;
    type: string;
    typeLabel: string;
    status: string;
    statusLabel: string;
    name: string;
    completedSteps: number | null;
    currentEnergy: number | null;
    finalEnergy: number | null;
    energies: number[];
    frequencies: number[];
    enthalpy: number | null;
}

export interface NormalizedOutput {
    jobs: NormalizedJob[];
    totalJobs: number;
    terminationStatus: 'normal' | 'error' | 'running' | 'unknown';
    terminationMessage?: string;
}

export class GaussianOutputParser {

    static parseOutput(content: string): ParsedOutput {
        const jobs: CalculationJob[] = [];
        const terminationInfo = this.checkTerminationStatus(content);
        const keyLine = '(Enter /share/apps/soft/g16/l9999.exe)';
        const lines = content.split('\n');
        let jobNumber = 1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(keyLine)) {
                const summaryLines: string[] = [];
                for (let j = i + 1; j < lines.length; j++) {
                    const line = lines[j].trim();
                    if (line === '') { continue; }
                    summaryLines.push(line);
                    if (line.endsWith('@')) { break; }
                }
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

    static getFinalEnergy(energyResults: EnergyResult[], route?: string): EnergyResult | undefined {
        return this.extractFinalEnergy(energyResults, route || '');
    }

    static parseOutputNormalized(content: string): NormalizedOutput {
        const terminationInfo = this.checkTerminationStatus(content);
        const lines = content.split('\n');
        const jobs: NormalizedJob[] = [];

        const jobBoundaries: number[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('/share/apps/soft/g16/l1.exe PID=')) {
                jobBoundaries.push(i);
            }
        }
        if (jobBoundaries.length === 0) {
            jobBoundaries.push(0);
        }
        jobBoundaries.push(lines.length);

        for (let b = 0; b < jobBoundaries.length - 1; b++) {
            const start = jobBoundaries[b];
            const end = jobBoundaries[b + 1];
            const jobLines = lines.slice(start, end);
            const jobContent = jobLines.join('\n');

            const route = this.extractRouteFromJobLines(jobLines);
            if (!route) { continue; }

            const title = this.extractTitleFromJobLines(jobLines);
            const type = this.getJobTypeCode(route);
            const typeLabel = this.getJobTypeLabel(type);
            const isRunning = terminationInfo.status === 'running' && b === jobBoundaries.length - 2;
            const status = isRunning ? 'running' : (b < jobBoundaries.length - 2 || terminationInfo.status === 'normal' ? 'completed' : terminationInfo.status);
            const statusLabel = isRunning ? 'Running' : (b < jobBoundaries.length - 2 || terminationInfo.status === 'normal' ? 'Completed' : terminationInfo.status);

            const scfEnergies = this.parseScfEnergies(jobContent);
            const frequencies = this.parseFrequencies(jobContent);
            const enthalpy = this.parseEnthalpy(jobContent);
            const optSteps = this.parseOptimizationSteps(jobContent);
            const summaryEnergy = this.extractSummaryFinalEnergy(jobLines);

            let finalEnergy: number | null = null;
            let currentEnergy: number | null = null;
            let completedSteps: number | null = null;
            let energies: number[] = [];

            if (type === 'opt') {
                completedSteps = optSteps;
                currentEnergy = scfEnergies.length > 0 ? scfEnergies[scfEnergies.length - 1] : null;
                energies = scfEnergies;
            }
            finalEnergy = summaryEnergy !== null ? summaryEnergy : (scfEnergies.length > 0 ? scfEnergies[scfEnergies.length - 1] : null);

            jobs.push({
                id: b + 1,
                type,
                typeLabel,
                status,
                statusLabel,
                name: title,
                completedSteps,
                currentEnergy,
                finalEnergy,
                energies,
                frequencies,
                enthalpy
            });
        }

        return {
            jobs,
            totalJobs: jobs.length,
            terminationStatus: terminationInfo.status,
            terminationMessage: terminationInfo.message
        };
    }

    private static parseSummarySection(summaryLines: string[], jobNumber: number): CalculationJob | null {
        const summaryText = summaryLines.join('').replace(/\s+/g, ' ').trim();
        const cleanSummary = summaryText.replace(/@\s*$/, '');
        const processedText = cleanSummary.replace(/\\\\/g, '\n').replace(/\\0\n/g, '\\');
        const parts = processedText.split('\\');

        let route = '';
        let title = '';
        const energyResults: EnergyResult[] = [];
        let version = '';
        let state = '';
        let pointGroup = '';

        for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart.startsWith('#')) {
                route = trimmedPart;
            } else if (trimmedPart.includes('Version=')) {
                const versionMatch = trimmedPart.match(/Version=([^\\]+)/);
                if (versionMatch) { version = versionMatch[1]; }
            } else if (trimmedPart.includes('State=')) {
                const stateMatch = trimmedPart.match(/State=([^\\]+)/);
                if (stateMatch) { state = stateMatch[1]; }
            } else if (trimmedPart.includes('PG=')) {
                const pgMatch = trimmedPart.match(/PG=([^\\]+)/);
                if (pgMatch) { pointGroup = pgMatch[1]; }
            } else if (trimmedPart.includes('=') && /[A-Z]/.test(trimmedPart)) {
                const energyMatches = trimmedPart.match(/([A-Z0-9()]+)=(-?\d+\.\d+)/g);
                if (energyMatches) {
                    energyMatches.forEach(match => {
                        const p = match.match(/([A-Z0-9()]+)=(-?\d+\.\d+)/);
                        if (p) {
                            const method = p[1];
                            const energy = parseFloat(p[2]);
                            if (!energyResults.some(r => r.method === method)) {
                                energyResults.push({ method, energy, description: this.getMethodDescription(method) });
                            }
                        }
                    });
                }
            } else if (trimmedPart.length > 0 && !trimmedPart.includes('=') && !trimmedPart.includes(',')) {
                if (!title && !trimmedPart.startsWith('#') && trimmedPart.length < 100) {
                    title = trimmedPart;
                }
            }
        }

        const jobType = this.determineJobType(route, summaryText);
        const finalEnergy = this.extractFinalEnergy(energyResults, route);

        if (!route && energyResults.length === 0) { return null; }
        title = route.split('\n')[1];
        route = route.split('\n')[0];

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
        if (routeLower.includes('opt')) { return '几何优化'; }
        if (routeLower.includes('freq')) { return '频率计算'; }
        if (routeLower.includes('td')) { return '激发态计算'; }
        if (routeLower.includes('irc')) { return '反应路径计算'; }
        if (routeLower.includes('scan')) { return '扫描计算'; }
        return '单点能计算(推测)';
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
        };
        return descriptions[method] || method;
    }

    private static extractFinalEnergy(energyResults: EnergyResult[], route: string): EnergyResult | undefined {
        if (energyResults.length === 0) { return undefined; }
        const priorityOrder = [
            'QCISD(T)', 'CCSD(T)', 'E(CBS-QB3)', 'ONIOM',
            'CCSD', 'MP4SDQ', 'MP4', 'MP4DQ', 'MP4D', 'MP2', 'HF'
        ];
        for (const result of energyResults) {
            if (result.method.includes('CBS-QB3') || result.method.includes('extrapolated energy') || result.method.includes('ONIOM')) {
                return result;
            }
        }
        for (const priority of priorityOrder) {
            const found = energyResults.find(r => r.method === priority || r.method.startsWith(priority));
            if (found) { return found; }
        }
        return energyResults[energyResults.length - 1];
    }

    private static checkTerminationStatus(content: string): { status: 'normal' | 'error' | 'running' | 'unknown', message?: string } {
        const lines = content.split('\n');
        let messages = '';
        const warns = new Map<string, number>();
        for (const match of content.matchAll(/(.*(Warning|Unable|failed|impossible).*)/gi)) {
            if (match[0].includes('This program may not be used in any manner that')) { continue; }
            const warningText = match[0].trim();
            warns.set(warningText, (warns.get(warningText) || 0) + 1);
        }
        for (const [warning, count] of warns) {
            messages += count > 1 ? `注意：${warning} *${count}<br>` : `注意：${warning}<br>`;
        }

        if (lines[lines.length - 2] && lines[lines.length - 2].includes('Normal termination of Gaussian')) {
            return { status: 'normal', message: messages + '计算正常完成' };
        }

        for (const line of lines) {
            if (line.includes('Error termination')) {
                if (content.match(/The combination of multiplicity\s*\d+\s*and\s*\d+\s*electrons is impossible./)) {
                    return { status: 'error', message: messages + '检查多重度设置' };
                }
                if (content.match(/Convergence criterion not met./)) {
                    return { status: 'error', message: messages + 'SCF不收敛' };
                }
                if (content.match(/End of file in ZSymb./)) {
                    return { status: 'error', message: messages + '语法错误，检查文末是否有空行' };
                }
                const emErrorMatch = content.match(/.+Unable to choose the S6 parameter.+ScaHFX=\s*([\d.]+).+/);
                if (emErrorMatch) {
                    return {
                        status: 'error',
                        message: messages + (emErrorMatch[1] === '0.0000' ? '纯粹的HF方法(或CCSD等）不能使用em参数。' : '检查em参数与计算方法的兼容性')
                    };
                }
                const errorMatch = line.match(/Error termination via (.+) at/);
                return { status: 'error', message: messages + `计算异常终止 (${errorMatch ? errorMatch[1] : '未知位置'})` };
            }
        }

        const hasGaussianContent = lines.some(line =>
            line.includes('Gaussian') || line.includes('l9999.exe') || line.includes('Route #') || line.includes('# ')
        );
        if (!hasGaussianContent) {
            return { status: 'unknown', message: '无法识别的文件内容' };
        }
        return { status: 'running', message: '计算可能仍在进行中或已被中断' };
    }

    private static extractRouteFromJobLines(lines: string[]): string {
        let inRoute = false;
        const routeLines: string[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!inRoute && trimmed.startsWith('#')) {
                inRoute = true;
            }
            if (inRoute) {
                routeLines.push(trimmed);
                if (trimmed.endsWith('--') || trimmed === '' || trimmed.startsWith('---')) {
                    break;
                }
            }
        }
        return routeLines.join(' ').replace(/\s*-{2,}\s*/g, '').trim();
    }

    private static extractTitleFromJobLines(lines: string[]): string {
        let afterL101 = false;
        let afterFirstDash = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!afterL101) {
                if (trimmed.includes('Enter /share/apps/soft/g16/l101.exe')) {
                    afterL101 = true;
                }
                continue;
            }
            if (!afterFirstDash) {
                if (/^-{3,}$/.test(trimmed)) { afterFirstDash = true; }
                continue;
            }
            if (trimmed.length > 0 && !/^-{3,}$/.test(trimmed)) {
                return trimmed;
            }
        }
        return 'Job';
    }

    private static getJobTypeCode(route: string): string {
        const r = route.toLowerCase();
        if (r.includes('opt')) { return 'opt'; }
        if (r.includes('freq')) { return 'freq'; }
        if (r.includes('td')) { return 'td'; }
        if (r.includes('irc')) { return 'irc'; }
        if (r.includes('scan')) { return 'scan'; }
        return 'sp';
    }

    private static getJobTypeLabel(type: string): string {
        const labels: { [key: string]: string } = {
            'opt': 'Geometry Optimization',
            'freq': 'Frequency Calculation',
            'sp': 'Single Point Energy',
            'td': 'Excited State Calculation',
            'irc': 'IRC Calculation',
            'scan': 'Scan Calculation'
        };
        return labels[type] || 'Single Point Energy';
    }

    private static parseScfEnergies(content: string): number[] {
        const energies: number[] = [];
        const re = /SCF Done:\s+E\([^)]+\)\s+=\s+(-?\d+\.\d+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
            energies.push(parseFloat(m[1]));
        }
        return energies;
    }

    private static parseFrequencies(content: string): number[] {
        const frequencies: number[] = [];
        const re = /Frequencies\s+--\s+([\d.\s-]+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
            const vals = m[1].trim().split(/\s+/).map(parseFloat).filter(v => !isNaN(v));
            frequencies.push(...vals);
        }
        return frequencies;
    }

    private static parseEnthalpy(content: string): number | null {
        const re = /Sum of electronic and thermal Enthalpies=\s+(-?\d+\.\d+)/;
        const match = content.match(re);
        return match ? parseFloat(match[1]) : null;
    }

    private static parseOptimizationSteps(content: string): number {
        const re = /Step number\s+(\d+)/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
            last = parseInt(m[1]);
        }
        return last;
    }

    private static extractSummaryFinalEnergy(lines: string[]): number | null {
        const keyLine = '(Enter /share/apps/soft/g16/l9999.exe)';
        let collecting = false;
        const summaryLines: string[] = [];
        for (const line of lines) {
            if (line.includes(keyLine)) {
                collecting = true;
                continue;
            }
            if (collecting) {
                const t = line.trim();
                if (t === '') { continue; }
                summaryLines.push(t);
                if (t.endsWith('@')) { break; }
            }
        }
        if (summaryLines.length === 0) { return null; }
        const summaryText = summaryLines.join('').replace(/\s+/g, ' ').replace(/@\s*$/, '');
        const processed = summaryText.replace(/\\\\/g, '\n').replace(/\\0\n/g, '\\');
        const parts = processed.split('\\');
        const energyResults: EnergyResult[] = [];
        for (const part of parts) {
            const t = part.trim();
            if (t.includes('=') && /[A-Z]/.test(t)) {
                const matches = t.match(/([A-Z0-9()]+)=(-?\d+\.\d+)/g);
                if (matches) {
                    matches.forEach(match => {
                        const p = match.match(/([A-Z0-9()]+)=(-?\d+\.\d+)/);
                        if (p && !energyResults.some(r => r.method === p[1])) {
                            energyResults.push({ method: p[1], energy: parseFloat(p[2]), description: '' });
                        }
                    });
                }
            }
        }
        const final = this.extractFinalEnergy(energyResults, '');
        return final ? final.energy : null;
    }
}
