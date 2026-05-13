# 前端开发规范索引

> BitSentinel 前端开发规范入口。后续修改前端代码前，先读取对应规范文件。

---

## 概览

当前项目是 Vite + React + TypeScript 的前端模拟数据原型，主要使用：

- Ant Design：主 UI 组件库
- Zustand：前端全局 mock 状态
- Lightweight Charts：K 线图
- Recharts：统计图和资金流图
- Lucide React：图标

---

## 规范索引

| 文档 | 说明 | 状态 |
|------|------|------|
| [目录结构规范](./directory-structure.md) | 当前源码组织、文件职责、新功能放置规则 | 已完成 |
| [组件规范](./component-guidelines.md) | 函数组件、Ant Design、props、样式、交互规则 | 已完成 |
| [Hook 规范](./hook-guidelines.md) | React hook、Zustand hook、副作用和数据获取边界 | 已完成 |
| [状态管理规范](./state-management.md) | Zustand 状态分类、action 规则、后端接入前约束 | 已完成 |
| [质量规范](./quality-guidelines.md) | 类型检查、测试、禁止模式、Review 清单 | 已完成 |
| [类型规范](./type-safety.md) | `src/types.ts`、联合类型、Record 映射、类型导入 | 已完成 |

---

## 使用规则

1. 改页面或组件前，读取组件规范和目录结构规范。
2. 改 store 或 mock 行为前，读取状态管理规范。
3. 改类型前，读取类型规范。
4. 改图表、通知、抽屉、表格交互前，读取组件规范和质量规范。
5. 接后端前，先补 API client、server state、WebSocket 事件层设计，不要把请求散落在组件中。

---

## 当前重要边界

- 当前 `src/App.tsx` 很大，小改动可继续沿用；拆分需要单独任务。
- 信号条件和周期槽位必须分离。
- 一个币种可以被多个策略监控。
- 监控状态按“策略 + 币种”独立保存。
- V1 只做监控和模拟交易，不做真实自动下单。
- 第一版真实推送渠道是邮箱。
- 文档语言使用中文。
