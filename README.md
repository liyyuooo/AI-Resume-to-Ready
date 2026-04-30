# Resume to Ready

从简历到面试，AI 帮你梳理经历、优化简历、模拟面试，一条完整工作流。

## 功能

- **导入与解析** — 支持 PDF / Word / 文本，AI 自动抽取结构化信息
- **对话式创建** — AI 追问经历细节，帮你挖出亮点与成果
- **JD 匹配分析** — 简历 vs JD 对齐，找出缺口、关键词和改写方向
- **多类型模拟面试** — 岗位问答 / 简历深问 / 行为面试 / 技术题，多轮实战对话
- **语音输入** — 面试中支持语音回答，边说边转文字

## 面向用户

- **初次求职者** — 没写过简历、经历零散不会包装、对面试紧张
- **跨岗位求职者** — 想转岗跨行业，现有经验需要按新岗位重新包装

## 技术栈

- Next.js (App Router) / React / TypeScript
- Tailwind CSS
- IndexedDB（浏览器本地存储，数据不留服务器）
- Web Speech API（语音识别）
- 兼容 OpenAI 格式的 LLM API

## 快速开始

在线使用：[ai-resume-to-ready.vercel.app](https://ai-resume-to-ready.vercel.app)

本地运行：

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 配置 API

支持所有兼容 OpenAI 格式的 API，如阿里云百炼、百度千帆、DeepSeek 等。

1. 打开应用 → 设置页
2. 填写 API 地址和 API Key
3. 选择模型

配置保存在浏览器本地，不会上传到任何服务器。

## 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

或手动部署：

```bash
npm run build
npm start
```
