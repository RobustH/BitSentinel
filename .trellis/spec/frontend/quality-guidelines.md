# 前端质量规范

> 本项目当前是前端模拟数据原型，但仍应保持类型、状态和交互规则清晰。

---

## 当前工具

`package.json` 中已有脚本：

```json
{
  "dev": "vite --host 0.0.0.0",
  "build": "tsc -b && vite build",
  "test": "vitest run"
}
```

测试框架：

- Vitest
- Testing Library 配套依赖
- jsdom

当前真实测试：

- `src/store/appStore.test.ts`：验证策略创建后能为每个挂载币种创建独立状态。

---

## 质量要求

### 类型检查

涉及 TypeScript 类型、store、mock 数据时，至少应运行：

```powershell
npx.cmd tsc --noEmit
```

如果用户明确说“不需要 build”，不要主动跑 `npm run build`。

### 单元测试

修改 `src/store/appStore.ts` 时，应优先补或运行 store 测试：

```powershell
npm.cmd test
```

如果只是文档变更，不需要跑前端测试。

---

## 必须保持的产品规则

- 信号条件和周期槽位分离。
- 一个币种可以被多个策略监控。
- 同一个策略和同一个币种不能重复挂载。
- 监控状态按 `strategyInstanceId + symbol` 独立存在。
- 信号触发先右下角通知，点击后再进入详情。
- V1 只做监控和模拟交易，不做真实自动下单。
- 第一版推送渠道是邮箱。
- 单租户。

---

## 禁止模式

- 不要绕开 Zustand action 直接改全局状态。
- 不要把真实 API Key、邮箱密码、Webhook Secret 写入前端。
- 不要在没有确认的情况下加入真实下单能力。
- 不要把同一个币种只能挂一个策略写死。
- 不要把 K 线或资金流长期方案设计成本地 SQLite 强绑定。
- 不要在 render 阶段触发 notification。
- 不要为了单个小功能大规模重构 `src/App.tsx`。

---

## 可访问性和交互

当前项目主要依赖 Ant Design 的可访问性基础能力。

新增交互时：

- 按钮必须有明确文案或图标语义。
- 表单项必须有 label。
- 抽屉、通知、弹窗要有明确标题。
- 表格操作不要只靠颜色区分。
- 状态标签应同时使用文本和颜色。

---

## Code Review 检查项

提交前检查：

- 是否符合 `src/types.ts` 的领域类型。
- 是否破坏“策略 + 币种”的独立状态模型。
- 是否把业务规则硬编码到 UI 文案中。
- 是否新增了没有入口的页面或状态。
- 是否引入未使用依赖。
- 是否修改了与任务无关的文件。
- 是否保留了模拟数据原型的可运行性。
- 是否需要补 store 测试。

---

## 当前技术债

- `src/App.tsx` 过大，后续应单独任务拆分。
- 部分 mock 中文文案在终端显示可能乱码，应逐步修正编码显示和文案质量。
- 还没有 API client、server state、WebSocket 事件层。
- 还没有真实后端接口契约落地。
