# 考试宝 (KaoShiBao)

一个**完全离线**的本地刷题/考试练习应用，一套代码同时产出 **Windows 桌面版（Electron）** 和 **Android 手机版（Capacitor）**，数据全存本地，无需任何服务器。

![技术栈](https://img.shields.io/badge/Vue%203-Pinia-orange) ![桌面端](https://img.shields.io/badge/Electron-绿色便携-blue) ![移动端](https://img.shields.io/badge/Capacitor-Android-green)

## 功能特性

- **7 种题型**：单选 / 多选 / 判断 / 填空 / 简答（自评）/ 问答（自评）/ 画图（自评）
- **练习模式**：自由切换上/下一题，答错自动收进错题本，答题卡圆圈跳题，答对自动跳题（可开关），答对同样显示解析
- **考试模式**：自定义题量与时长，倒计时自动交卷，成绩单 + 整卷回顾，考后可对主观题自评补录
- **背题模式**：直接显示答案与解析，支持答案模糊隐藏，方便记忆背诵
- **独立错题本**：答错即存题目快照，删除答题记录不影响错题本；支持错题重练、按题库分组
- **数据统计**：答题总数、正确率、按题型分布、连续刷题天数，支持按题库 / 全部切换
- **题库隔离**：不同题库的错题本与统计互相独立，互不干扰
- **Excel 模板导入**：标准 11 列模板（题型/题干/选项A~F/答案/解析/标签），附 Markdown 转模板脚本
- **备份迁移**：一键导出/导入 JSON，PC 与手机数据互通
- **完全绿色化**：桌面版数据存在 exe 旁的 `Data\` 目录，不写注册表、不留 AppData，换电脑整个文件夹拷走即可

## 目录结构

```
kaoshibao/
├── src/                  # Vue 3 源码（10+ 视图、Pinia stores、工具函数）
│   ├── stores/           # banks / sessions / wrongbook / persist
│   ├── views/            # 首页 / 导入 / 练习 / 考试 / 错题本 / 统计 / 背题
│   └── utils/            # 题型定义 / 判分 / 导入校验 / 备份
├── electron/main.cjs     # Electron 主进程（绿色化数据目录）
├── android/              # Capacitor 安卓工程
├── scripts/              # 工具脚本（见下）
└── public/               # PWA 资源与图标
```

## 工具脚本

| 脚本 | 用途 |
|---|---|
| `scripts/md2kaoshibao.mjs` | Markdown 题库文档 → Excel 导入模板 |
| `scripts/qa2kaoshibao.mjs` | 问答题答案段落 → Excel 导入模板 |
| `scripts/gen-icon.mjs` | 生成 PWA 图标（192/512 PNG） |
| `scripts/gen-android-icons.mjs` | 生成安卓各密度启动图标 |
| `scripts/gen-ico.mjs` | 生成 Windows exe 图标（ico） |
| `scripts/smoke-*.mjs` | 冒烟测试（桌面 / 数据隔离 / 背题 / 移动端） |
| `scripts/file-test.mjs` | file:// 协议验证 |

## 本地构建

```bash
# 桌面版（Windows 便携 exe）
npm install
npm run app:build        # 产物在 portable*/考试宝.exe

# 安卓版（APK，需 Android SDK + JDK 17）
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 下载成品

无需自行构建，可直接到 [Releases](../../releases) 页面下载：

- `考试宝.exe` — Windows 便携版，双击即用，免安装
- `考试宝.apk` — 安卓版，允许安装未知来源后直接安装

## 导入题目

下载模板（或在应用首页点「导入题库」获取模板说明），按 11 列格式填入题目：

```
题型 | 题干 | 选项A | 选项B | 选项C | 选项D | 选项E | 选项F | 答案 | 解析 | 标签
```

选择题/判断题/填空题自动判分；简答/问答/画图题采用对照参考答案自评（答对 / 答错）。

---

*MIT License 仅供参考结构，题目数据请自行准备。*
