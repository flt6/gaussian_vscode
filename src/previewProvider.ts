import * as vscode from 'vscode';
import * as path from 'path';
import { GaussianOutputParser, NormalizedOutput } from './outputParser';

export class GaussianOutputPreviewProvider {
    private static readonly viewType = 'gaussianOutputPreview';
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static refreshTimer: NodeJS.Timeout | undefined;
    private static currentUri: vscode.Uri | undefined;

    public static async showPreview(uri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        GaussianOutputPreviewProvider.currentUri = uri;

        if (GaussianOutputPreviewProvider.currentPanel) {
            GaussianOutputPreviewProvider.currentPanel.reveal(column);
        } else {
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

        GaussianOutputPreviewProvider.currentPanel.onDidDispose(
            () => {
                GaussianOutputPreviewProvider.currentPanel = undefined;
                GaussianOutputPreviewProvider.currentUri = undefined;
                if (GaussianOutputPreviewProvider.refreshTimer) {
                    clearInterval(GaussianOutputPreviewProvider.refreshTimer);
                    GaussianOutputPreviewProvider.refreshTimer = undefined;
                }
            },
            null
        );

        await this.loadContent();
        this.startAutoRefresh();
    }

    private static async loadContent() {
        if (!GaussianOutputPreviewProvider.currentPanel || !GaussianOutputPreviewProvider.currentUri) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(GaussianOutputPreviewProvider.currentUri);
            const content = document.getText();

            const normalizedOutput = GaussianOutputParser.parseOutputNormalized(content);
            const filename = path.basename(GaussianOutputPreviewProvider.currentUri.fsPath);
            
            const chartJsPath = vscode.Uri.file(path.join(__dirname, '..', 'js', 'Chart.js'));
            const chartJsUri = GaussianOutputPreviewProvider.currentPanel.webview.asWebviewUri(chartJsPath);

            GaussianOutputPreviewProvider.currentPanel.webview.html =
                GaussianOutputPreviewProvider.buildWebviewHtml(normalizedOutput, filename, chartJsUri);

            if (normalizedOutput.terminationStatus !== 'running' && normalizedOutput.terminationStatus !== 'unknown') {
                if (GaussianOutputPreviewProvider.refreshTimer) {
                    clearInterval(GaussianOutputPreviewProvider.refreshTimer);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to preview Gaussian output: ${error}`);
        }
    }

    private static startAutoRefresh() {
        if (GaussianOutputPreviewProvider.refreshTimer) {
            clearInterval(GaussianOutputPreviewProvider.refreshTimer);
        }

        GaussianOutputPreviewProvider.refreshTimer = setInterval(async () => {
            if (GaussianOutputPreviewProvider.currentPanel && GaussianOutputPreviewProvider.currentUri) {
                await this.loadContent();
            }
        }, 5000);
    }

    private static buildWebviewHtml(normalizedOutput: NormalizedOutput, filename: string, chartJsUri: vscode.Uri): string {
        const jobsJson = JSON.stringify(normalizedOutput.jobs);
        const updateTime = new Date().toLocaleString('zh-CN');
        console.log(`jobsJson length: ${jobsJson.length}, updateTime: ${updateTime}`);

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gaussian Job Monitoring</title>
  <script src="${chartJsUri}"></script>
  <style>
    :root {
      --bg: #0b1220;
      --bg-elev: #111a2b;
      --panel: rgba(17, 26, 43, 0.88);
      --panel-strong: rgba(20, 31, 52, 0.96);
      --border: rgba(255, 255, 255, 0.08);
      --text: #e8eefc;
      --muted: #94a3b8;
      --line: rgba(255, 255, 255, 0.08);
      --primary: #60a5fa;
      --primary-soft: rgba(96, 165, 250, 0.16);
      --success: #84cc16;
      --success-bg: rgba(132, 204, 22, 0.18);
      --done: #3b82f6;
      --done-bg: rgba(59, 130, 246, 0.18);
      --warning: #fbbf24;
      --shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
      --radius-lg: 20px;
      --radius-md: 16px;
      --radius-sm: 12px;
      --font: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font);
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(168, 85, 247, 0.08), transparent 22%),
        linear-gradient(180deg, #0a1120 0%, #0d1626 100%);
    }

    .app {
      max-width: 1480px;
      margin: 0 auto;
      padding: 24px;
    }

    .shell {
      border: 1px solid var(--border);
      border-radius: 24px;
      background: rgba(8, 15, 28, 0.7);
      backdrop-filter: blur(10px);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 22px 28px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    }

    .title-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: #cfe1ff;
      background: linear-gradient(135deg, rgba(59,130,246,0.35), rgba(14,165,233,0.18));
      border: 1px solid rgba(96, 165, 250, 0.3);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .title h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .title p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 14px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .ghost-btn,
    .select,
    .search {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 12px;
      height: 40px;
    }

    .ghost-btn {
      padding: 0 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .ghost-btn:hover,
    .select:hover,
    .search:hover {
      border-color: rgba(96, 165, 250, 0.35);
      background: rgba(255, 255, 255, 0.06);
    }

    .search,
    .select {
      padding: 0 12px;
      outline: none;
    }

    .select {
      min-width: 140px;
    }

    .search {
      min-width: 220px;
    }

    .content {
      padding: 20px;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(160px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .stat {
      padding: 16px 18px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
    }

    .stat .label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 8px;
    }

    .stat .value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(320px, 1fr));
      gap: 18px;
    }

    .card {
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 22px;
      min-height: 260px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 16px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--line);
    }

    .card-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .card-title h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.2px; }

    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      height: 32px; padding: 0 14px; border-radius: 999px;
      font-size: 13px; font-weight: 700; white-space: nowrap; border: 1px solid transparent;
    }
    .badge.running { color: #dff7bb; background: var(--success-bg); border-color: rgba(132,204,22,0.22); }
    .badge.completed { color: #d8e8ff; background: var(--done-bg); border-color: rgba(59,130,246,0.25); }
    .badge.error { color: #ffd0d0; background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.28); }

    .meta { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 18px; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; font-size: 15px; line-height: 1.65; }
    .meta-label { color: var(--muted); min-width: 110px; }
    .meta-value { color: var(--text); font-weight: 500; }
    .mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
    .accent { color: var(--primary); }

    .section-title { font-size: 15px; font-weight: 700; margin: 8px 0 12px; color: #d8e4ff; }
    .chart-panel { border: 1px solid var(--border); border-radius: 16px; background: rgba(4,10,20,0.32); padding: 12px 14px 8px; overflow: hidden; }
    .chart-title { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
    .freq-list { margin: 0; padding-left: 28px; display: grid; grid-template-columns: 1fr; gap: 6px; }
    .freq-list li { color: #c9d8f5; font-size: 15px; font-variant-numeric: tabular-nums; }
    .footer-note { margin-top: 8px; color: var(--muted); font-size: 13px; }
    .legend { display: flex; gap: 10px; align-items: center; color: var(--muted); font-size: 12px; margin-top: 8px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); display: inline-block; box-shadow: 0 0 0 4px rgba(96,165,250,0.12); }
    .empty { border: 1px dashed rgba(255,255,255,0.12); border-radius: 16px; padding: 18px; color: var(--muted); text-align: center; }

    .energy-table-panel {
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 22px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
    }
    .energy-table-panel h3 { margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #d8e4ff; }
    .energy-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .energy-table th { color: var(--muted); font-weight: 600; text-align: left; padding: 6px 12px; border-bottom: 1px solid var(--line); }
    .energy-table td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text); font-variant-numeric: tabular-nums; }
    .energy-table tr:last-child td { border-bottom: none; }
    .copy-btn { float: right; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--muted); border-radius: 8px; padding: 4px 12px; font-size: 12px; cursor: pointer; }
    .copy-btn:hover { background: rgba(255,255,255,0.08); color: var(--text); }

    @media (max-width: 1080px) { .summary, .grid { grid-template-columns: 1fr; } }
    @media (max-width: 680px) {
      .header, .content, .card { padding-left: 16px; padding-right: 16px; }
      .title h1 { font-size: 22px; }
      .summary { grid-template-columns: 1fr; }
      .search { min-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="app"><div class="shell">
    <header class="header">
      <div class="title-wrap">
        <div class="logo">GJ</div>
        <div class="title">
          <h1>Gaussian Job Monitoring</h1>
          <p>${filename} &nbsp;·&nbsp; 最后更新: ${updateTime}</p>
        </div>
      </div>
      <div class="toolbar">
        <select class="select" id="statusFilter">
          <option value="all">全部状态</option>
          <option value="running">运行中</option>
          <option value="completed">已完成</option>
        </select>
        <select class="select" id="typeFilter">
          <option value="all">全部类型</option>
          <option value="opt">Optimization</option>
          <option value="freq">Frequency</option>
          <option value="sp">Single Point</option>
          <option value="td">TD-DFT</option>
          <option value="irc">IRC</option>
          <option value="scan">Scan</option>
        </select>
        <input class="search" id="keywordInput" type="text" placeholder="搜索任务名称或类型..." />
        <button class="ghost-btn" id="unitToggle">Hartree</button>
      </div>
    </header>
    <main class="content">
      <section class="summary" id="summary"></section>
      <section class="grid" id="jobGrid"></section>
      <section id="energySummary" style="margin-top:18px;"></section>
    </main>
  </div></div>
  <script>
    const allJobs = ${jobsJson};
    const totalJobs = ${normalizedOutput.totalJobs};
    const terminationStatus = "${normalizedOutput.terminationStatus}";
    const terminationMessage = ${normalizedOutput.terminationMessage ? JSON.stringify(normalizedOutput.terminationMessage) : 'null'};
    const HARTREE_TO_EV = 27.211386245988;
    const state = { jobs: allJobs, filters: { status: 'all', type: 'all', keyword: '' }, useEV: false };
    const summaryEl = document.getElementById('summary');
    const gridEl = document.getElementById('jobGrid');
    const energySummaryEl = document.getElementById('energySummary');
    const statusFilterEl = document.getElementById('statusFilter');
    const typeFilterEl = document.getElementById('typeFilter');
    const keywordInputEl = document.getElementById('keywordInput');
    const unitToggleEl = document.getElementById('unitToggle');

    function convertEnergy(v) { return state.useEV ? v * HARTREE_TO_EV : v; }
    function unitLabel() { return state.useEV ? 'eV' : 'Hartree'; }
    function formatEnergy(v) {
      if (v === null || v === undefined) return 'Calculating...';
      return convertEnergy(v).toFixed(6) + ' ' + unitLabel();
    }
    function progressText(job) { return job.type !== 'opt' ? '—' : String(job.completedSteps); }
    function getStatusClass(s) { return s === 'running' ? 'running' : s === 'completed' ? 'completed' : 'error'; }

    function renderSummary(jobs) {
      const summaryHtml =
        '<div class="stat"><div class="label">总任务数</div><div class="value mono">' + totalJobs + '</div></div>' +
        '<div class="stat"><div class="label">状态</div><div class="value mono" style="font-size: 24px;">' + terminationStatus + '</div></div>';
      
      const errorHtml = terminationMessage 
        ? '<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.4); margin-bottom: 18px; color: #ffb3b3; padding: 12px 16px; border-radius: 12px; font-size: 14px;">' + terminationMessage + '</div>'
        : '';
        
      summaryEl.innerHTML = summaryHtml;
      
      // Inject error message after summary if it exists
      const oldErrorEl = document.getElementById('terminationError');
      if (oldErrorEl) oldErrorEl.remove();
      
      if (terminationMessage) {
        const errDiv = document.createElement('div');
        errDiv.id = 'terminationError';
        errDiv.innerHTML = errorHtml;
        summaryEl.parentNode.insertBefore(errDiv, summaryEl.nextSibling);
      }
    }

    function createChartHTML(job) {
      if (!job.energies || job.energies.length === 0) return '<div class="empty">无能量数据</div>';
      return '<div style="position: relative; width: 100%; height: 220px;"><canvas id="chart-' + job.id + '"></canvas></div>';
    }

    function renderFreqList(freqs) {
      if (!freqs || freqs.length === 0) return '<div class="empty">该任务没有频率数据</div>';
      return '<ol class="freq-list">' +
        freqs.slice(0, 10).map((f, i) => '<li class="mono">' + f.toFixed(2) + ' cm\u207b\u00b9</li>').join('') +
        '</ol>';
    }

    function renderJobCard(job) {
      const showOpt = job.type === 'opt', showFreq = job.type === 'freq';
      const optMeta = showOpt
        ? '<div class="meta-row"><span class="meta-label">Completed Steps</span><span class="meta-value mono">' + progressText(job) + '</span></div>' +
          '<div class="meta-row"><span class="meta-label">Current Energy</span><span class="meta-value mono">' + formatEnergy(job.currentEnergy) + '</span></div>'
        : '';
      const optChart = showOpt && job.energies && job.energies.length > 0
        ? '<div class="section-title">Optimization Progress</div><div class="chart-panel"><div class="chart-title">Energy vs. Steps</div>' +
          createChartHTML(job) +
          '<div class="legend"><span class="dot"></span><span>当前优化能量收敛趋势</span></div></div>'
        : '';
      const freqSec = showFreq ? '<div class="section-title">Top 10 Frequencies</div>' + renderFreqList(job.frequencies) : '';
      const enthalpySec = (showFreq && job.enthalpy !== null && job.enthalpy !== undefined) 
        ? '<div class="meta-row"><span class="meta-label">Enthalpies</span><span class="meta-value mono">' + formatEnergy(job.enthalpy) + '</span></div>'
        : '';
      return '<article class="card">' +
        '<div class="card-header"><div class="card-title">' +
        '<h2>Job ' + job.id + ': ' + job.typeLabel + '</h2>' +
        '<span class="badge ' + getStatusClass(job.status) + '">' + job.statusLabel + '</span>' +
        '</div></div>' +
        '<div class="meta">' +
        '<div class="meta-row"><span class="meta-label">Name</span><span class="meta-value accent">' + job.name + '</span></div>' +
        optMeta +
        '<div class="meta-row"><span class="meta-label">Final Energy</span><span class="meta-value mono">' + formatEnergy(job.finalEnergy) + '</span></div>' +
        enthalpySec +
        '</div>' +
        optChart + freqSec + 
        '</article>';
    }

    function getFilteredJobs() {
      return state.jobs.filter(job => {
        const ms = state.filters.status === 'all' || job.status === state.filters.status;
        const mt = state.filters.type === 'all' || job.type === state.filters.type;
        const kw = state.filters.keyword.trim().toLowerCase();
        return ms && mt && (!kw || (job.name + ' ' + job.typeLabel).toLowerCase().includes(kw));
      });
    }

    let chartInstances = {};

    function render() {
      const filtered = getFilteredJobs();
      renderSummary(filtered);
      renderEnergySummary(filtered);
      
      // Cleanup old chart instances
      Object.keys(chartInstances).forEach(id => {
        chartInstances[id].destroy();
      });
      chartInstances = {};

      gridEl.innerHTML = filtered.length === 0
        ? '<div class="empty">没有符合当前筛选条件的任务</div>'
        : filtered.map(renderJobCard).join('');
        
      // Initialize charts
      filtered.forEach(job => {
        if (job.type === 'opt' && job.energies && job.energies.length > 0) {
          const ctx = document.getElementById('chart-' + job.id);
          if (ctx) {
            chartInstances[job.id] = new Chart(ctx, {
              type: 'line',
              data: {
                labels: job.energies.map((_, i) => (i + 1)),
                datasets: [{
                  label: 'Energy (' + unitLabel() + ')',
                  data: job.energies.map(convertEnergy),
                  borderColor: '#60a5fa',
                  backgroundColor: 'rgba(96, 165, 250, 0.1)',
                  pointBackgroundColor: '#60a5fa',
                  pointBorderColor: 'rgba(255,255,255,0.22)',
                  pointRadius: 4,
                  pointHoverRadius: 6,
                  fill: true,
                  tension: 0.1,
                  borderWidth: 2
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#94a3b8',
                    bodyColor: '#e8eefc',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                      label: function(context) {
                        return (context.dataset.label || 'Energy') + ': ' + context.parsed.y.toFixed(6) + ' ' + unitLabel();
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8ea3c0', maxTicksLimit: 10 }
                  },
                  y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8ea3c0' }
                  }
                }
              }
            });
          }
        }
      });
    }

    function renderEnergySummary(jobs) {
      const rows = jobs
        .filter(j => j.finalEnergy !== null && j.finalEnergy !== undefined)
        .map(j => ({ name: j.name, energy: convertEnergy(j.finalEnergy) }));
      if (rows.length === 0) { energySummaryEl.innerHTML = ''; return; }
      const tsvText = rows.map(r => r.name + '\\t' + r.energy.toFixed(6)).join('\\n');
      const tableRows = rows.map(r =>
        '<tr><td>' + r.name.replace(/</g, '&lt;') + '</td><td class="mono">' + r.energy.toFixed(6) + '</td><td class="mono">' + unitLabel() + '</td></tr>'
      ).join('');
      energySummaryEl.innerHTML =
        '<div class="energy-table-panel">' +
        '<h3>Energy Summary <button class="copy-btn" id="copyTsv">Copy TSV</button></h3>' +
        '<table class="energy-table"><thead><tr><th>Name</th><th>Energy</th><th>Unit</th></tr></thead>' +
        '<tbody>' + tableRows + '</tbody></table></div>';
      document.getElementById('copyTsv').addEventListener('click', () => {
        navigator.clipboard.writeText(tsvText).catch(() => {});
      });
    }

    statusFilterEl.addEventListener('change', e => { state.filters.status = e.target.value; render(); });
    typeFilterEl.addEventListener('change', e => { state.filters.type = e.target.value; render(); });
    keywordInputEl.addEventListener('input', e => { state.filters.keyword = e.target.value; render(); });
    unitToggleEl.addEventListener('click', () => {
      state.useEV = !state.useEV;
      unitToggleEl.textContent = state.useEV ? 'eV' : 'Hartree';
      render();
    });
    render();
  </script>
</body>
</html>`;
    }
}

