# 前端目录结构规范

> 本规范记录当前 BitSentinel 前端原型的真实结构。后续重构可以改规范，但当前开发应先遵守这里的现实状态。

---

## 当前结构

```text
src/
|-- App.tsx                    # 当前主要页面、组件、交互集中处
|-- main.tsx                   # React 入口，挂载 App，加载 Ant Design reset 和全局样式
|-- styles.css                 # 全局 CSS、布局、图表容器、监控列表等样式
|-- types.ts                   # 领域类型定义
|-- mock/
|   `-- data.ts                # 模拟市场、策略、信号、资金流、K 线数据
|-- store/
|   |-- appStore.ts            # Zustand 全局 store 和 mock 行为
|   `-- appStore.test.ts       # store 级单元测试
`-- test/
    `-- setup.ts               # Vitest 测试环境配置
```

真实示例：

- `src/App.tsx`：包含 `Dashboard`、`MarketMonitor`、`StrategyBuilder`、`MonitorCenter`、`SignalDrawer` 等页面级函数组件。
- `src/store/appStore.ts`：集中管理前端 mock 状态和操作，例如创建策略、挂载币种、触发模拟信号。
- `src/types.ts`：定义 `StrategyInstance`、`StrategyState`、`Signal`、`BacktestSnapshot`、`AlertRule` 等核心类型。
- `src/mock/data.ts`：提供 `symbols`、`signalLibrary`、`timeframeSlotTemplates`、`strategyInstances` 等模拟数据。

---

## 当前组织方式

当前项目仍是前端模拟原型，不是模块化完成态：

- 页面和组件大多集中在 `src/App.tsx`。
- 领域类型集中在 `src/types.ts`。
- mock 数据集中在 `src/mock/data.ts`。
- 全局状态集中在 `src/store/appStore.ts`。
- 样式集中在 `src/styles.css`。

这不是长期理想结构，但这是当前真实结构。修改功能时，应先沿用当前文件边界，避免一次性大规模重构。

---

## 新功能放置规则

### 小改动

如果只是调整已有页面、文案、表格列、按钮、抽屉内容：

- 优先改 `src/App.tsx`。
- 如涉及新字段，补 `src/types.ts`。
- 如涉及 mock 数据，补 `src/mock/data.ts`。
- 如涉及全局行为，补 `src/store/appStore.ts`。
- 如涉及布局样式，补 `src/styles.css`。

### 中等功能

如果功能涉及多个页面共享状态，例如“模拟交易”：

- 类型放 `src/types.ts`。
- 初始数据放 `src/mock/data.ts`。
- 创建/更新/删除行为放 `src/store/appStore.ts`。
- 页面入口暂时放 `src/App.tsx` 的策略相关工作区。
- 样式放 `src/styles.css`，类名要有业务前缀。

### 大重构

如果要拆分 `src/App.tsx`，应单独建任务，不要和业务功能混在一次修改中。

推荐未来结构：

```text
src/
|-- features/
|   |-- strategy/
|   |-- monitor/
|   |-- review/
|   |-- market/
|   |-- warehouse/
|   `-- paper-trading/
|-- components/
|-- store/
|-- mock/
|-- types/
`-- styles/
```

---

## 命名约定

- React 组件使用 `PascalCase`，例如 `StrategyBuilder`、`SignalDrawer`。
- 类型使用 `PascalCase`，例如 `StrategyInstance`、`SignalReviewResult`。
- store action 使用动词开头，例如 `createStrategyInstance`、`mountSymbolToStrategy`。
- CSS 类使用 kebab-case，并带业务语义，例如 `monitor-stat-row`、`market-mount-actions`。
- mock 数据集合使用复数名，例如 `symbols`、`signals`、`strategyInstances`。

---

## 禁止模式

- 不要在 `main.tsx` 中放业务逻辑。
- 不要在组件内部临时定义和 `src/types.ts` 重复的领域类型。
- 不要把 mock 数据散落到多个组件内部。
- 不要为小改动强行创建大型目录结构。
- 不要在没有任务说明的情况下拆分整个 `App.tsx`。
