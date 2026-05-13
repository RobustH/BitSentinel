# 前端组件规范

> 当前项目以 Ant Design 为主，业务组件集中在 `src/App.tsx`。新增组件应先匹配现有风格，再考虑重构。

---

## 组件形态

当前组件以函数组件为主。

真实示例：

- `src/App.tsx` 中的 `Dashboard()`
- `src/App.tsx` 中的 `StrategyBuilder()`
- `src/App.tsx` 中的 `MonitorCenter()`
- `src/App.tsx` 中的 `SignalDrawer()`

组件通常直接从 Zustand store 读取所需数据：

```tsx
const strategyInstances = useAppStore((state) => state.strategyInstances);
const signals = useAppStore((state) => state.signals);
```

---

## UI 组件库

项目当前使用 Ant Design 作为主 UI 框架。

常用组件：

- `Layout`
- `Menu`
- `Card`
- `Table`
- `Tabs`
- `Drawer`
- `Form`
- `Select`
- `Button`
- `Tag`
- `Badge`
- `Statistic`
- `notification`

图标使用 `lucide-react`。

图表使用：

- `lightweight-charts`：K 线和交易图表。
- `recharts`：资金流、评分、统计图。

---

## 组件职责

页面级组件可以包含较多业务编排，但不要让单个新增组件承担过多无关职责。

建议职责边界：

- 页面组件：读取 store、组织布局、处理页面级交互。
- 表格/列表组件：只关心展示和行级操作。
- 抽屉/详情组件：展示详情、局部编辑。
- 图表组件：接收数据并渲染，不直接修改 store。

当前 `MiniKline` 是较好的图表组件模式：通过 props 接收 `data` 和 `markerLabel`。

---

## Props 规则

- props 直接在函数参数处声明时，适合简单组件。
- 如果 props 超过 3 个字段，建议单独定义 `type XxxProps`。
- props 类型优先引用 `src/types.ts` 中已有领域类型。

真实示例：

```tsx
function MiniKline({ data, markerLabel = "信号触发" }: { data: KlinePoint[]; markerLabel?: string }) {
  // ...
}
```

---

## 样式规则

当前样式主要在 `src/styles.css` 中定义。

规则：

- 优先使用 Ant Design 组件属性完成基础布局。
- 复杂布局再补 CSS 类。
- CSS 类名使用业务语义，不使用随机命名。
- 图表容器必须有稳定高度，例如 `.chart-host`、`.chart-box`。
- 列表滚动、监控统计等效果放 CSS，不要在组件里硬编码动画。

---

## 交互规则

- 信号触发后使用右下角通知，用户点击后再进入详情。
- 不要自动强制打开信号详情抽屉。
- 市场监控中的“加入监控”应明确选择策略，因为一个币种可以被多个策略监控。
- 策略相关功能尽量放在“策略相关”工作区，不新增过多一级菜单。

---

## 常见问题

- `src/App.tsx` 已经很大，小功能可以继续放这里，但大功能应单独规划拆分。
- 当前部分中文在终端显示可能出现乱码，这是编码显示问题；修改文案时应保持源文件 UTF-8。
- 不要绕过 Ant Design 自己手写一套表格、抽屉、表单。
- 不要在 JSX 中重复写复杂条件映射，优先抽 `Record<Union, Meta>`。
