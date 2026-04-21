# Gaussian语法高亮与代码补全插件

这是一个为Visual Studio Code开发的Gaussian输入文件语法高亮和代码补全插件。
不仅为输入文件提供了丰富的编辑支持，还为输出文件（.out / .log）提供了直观的数据可视化与实时监控预览。

## 功能特性

### 输出文件预览与监控
支持实时解析与预览Gaussian输出文件（使用命令 `Gaussian: 预览输出文件`）：
- **任务概览监控**：显示总任务数与最终执行状态。若任务异常终止，会自动提取并醒目展示最后报错语句（Termination Message）。
- **自动绘制图表**：对于几何优化（OPT）任务，使用内置的离线图表库（Chart.js）绘制能量随优化步数变化的收敛趋势。
- **高精度数据提取**：当前/最终能量数据统一高精度保留 6 位小数（Hartree）。  
- **热力学信息收集**：对于频率计算（FREQ）任务，自动提取展示前10个低频振动，并特别解析提取 `Sum of electronic and thermal Enthalpies`（电子与热焓之和）。
- **动态刷新**：对于正在运行的任务（Running），预览视图会自动定期刷新，为您展示计算的最新进度。

### 语法高亮
- **Link0命令**：以`%`开头的命令（如`%chk`, `%mem`, `%nproc`等）
- **Route Section**：以`#`开头的计算设置行
- **计算方法**：HF, DFT方法（B3LYP, PBE0等），后HF方法（MP2, CCSD等）
- **基组**：各种基组（6-31G(d), cc-pVDZ, def2TZVP等）
- **任务类型**：OPT, FREQ, SP, IRC, SCAN等
- **元素符号**：自动识别化学元素
- **注释**：以`!`开头的注释行
- **数值**：坐标和参数中的数值

### 代码补全
- **Route关键字补全**：在`#`行中提供计算方法、基组、任务类型等关键字补全
- **Link0命令补全**：在`%`行中提供常用Link0命令补全
- **溶剂模型补全**：在SCRF选项中提供溶剂模型和溶剂名称补全
- **智能触发**：在相应位置自动触发补全

### 代码片段(Snippets)
插件提供了多种常用的Gaussian输入文件模板：

- **gauss/gaussian/template** - 基础模板
- **opt/optimization** - 几何优化计算
- **freq/frequency** - 频率计算  
- **sp/singlepoint** - 单点能计算
- **td/tddft/excited** - TD-DFT激发态计算
- **irc/reaction** - 内禀反应坐标计算
- **nmr** - NMR计算
- **pcm/solvent** - 溶剂化计算
- **mem/memory** - 内存设置
- **chk/checkpoint** - 检查点文件设置  
- **nproc/proc** - 处理器设置

## 支持的文件扩展名
- `.gin` - Gaussian输入文件
- `.gjf` - Gaussian作业文件  
- `.com` - Gaussian命令文件

## 使用方法

1. 打开或创建一个Gaussian输入文件（.gin, .gjf, .com）
2. 语法高亮将自动应用
3. 在输入时会自动提供代码补全建议：
   - 在`#`行中输入关键字时会显示方法、基组等补全
   - 在`%`行中输入会显示Link0命令补全
   - 在SCRF选项中会显示溶剂相关补全

### 使用代码片段
1. 在Gaussian文件中输入片段触发词（如`gauss`、`opt`、`freq`等）
2. 按`Tab`键或选择建议来插入模板
3. 使用`Tab`键在模板的占位符之间跳转
4. 文件名会自动用于检查点文件名（`${TM_FILENAME_BASE}.chk`）

### 代码片段示例
- 输入`gauss`然后按Tab，会插入基础模板：
  ```
  %NProcShared=32
  %chk=filename.chk
  %mem=30GB
  #p [光标位置]
  
  [标题位置]
  
  0 1
  [坐标位置]
  ```

## 示例输入文件

```gaussian
%chk=water.chk
%mem=1GB
%nproc=4

# B3LYP/6-31G(d) OPT FREQ SCRF=(PCM,Solvent=Water)

Water molecule optimization and frequency calculation

0 1
O   0.000000   0.000000   0.000000
H   0.000000   0.000000   0.957000  
H   0.927000   0.000000  -0.240000

! 水分子的结构优化和频率计算
! 使用B3LYP/6-31G(d)理论级别，PCM溶剂化模型
```

## 安装

1. 下载或克隆此项目
2. 在VS Code中打开项目文件夹
3. 按F5启动调试模式，或者构建VSIX包进行安装

## 开发

- 运行`npm install`安装依赖
- 运行`npm run compile`编译TypeScript代码
- 按F5在新的VS Code窗口中测试扩展

## 许可证

MIT
