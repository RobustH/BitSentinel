# TypeScript 类型规范

> 当前项目的领域类型集中在 `src/types.ts`。

---

## 类型组织

核心类型定义在：

```text
src/types.ts
```

真实类型示例：

- `TimeframeSlotKey`
- `SignalDefinition`
- `TimeframeSlotTemplate`
- `StrategyInstance`
- `StrategyState`
- `Signal`
- `SignalReviewResult`
- `BacktestSnapshot`
- `AlertRule`
- `PushChannelConfig`
- `CreateStrategyPayload`

如果某个类型会被多个文件使用，应放入 `src/types.ts`。

如果类型只在单个组件内部使用，可以暂时放在 `src/App.tsx`，例如当前 `ReviewRecord`、`MonitorSignalStat`。

---

## 联合类型

固定枚举值优先使用 string union。

真实示例：

```ts
export type TimeframeSlotKey = "direction_tf" | "structure_tf" | "trigger_tf";
export type SignalGroup = "watch" | "trigger" | "confirm" | "invalidate" | "exit";
export type SignalCategory = "indicator" | "structure" | "money_flow" | "time" | "risk";
```

状态值也应使用 union：

```ts
state: "idle" | "watching" | "waiting_trigger" | "triggered" | "invalidated" | "cooldown";
```

---

## Record 映射

对于状态、类别、方向等 UI 元数据，使用 `Record<Union, Meta>` 保证覆盖完整。

真实示例：

- `stateMeta`
- `strengthMeta`
- `directionLabel`
- `categoryLabel`
- `slotLabels`

这样新增 union 值时，TypeScript 会提示哪些映射没有补齐。

---

## 类型引用

组件和 store 应通过 `import type` 引入类型。

真实示例：

```ts
import type {
  AlertRule,
  BacktestSnapshot,
  StrategyInstance,
  StrategyState,
} from "../types";
```

规则：

- 类型导入用 `import type`。
- 运行时代码导入和类型导入分开。
- 不要重复定义领域类型。

---

## Runtime Validation

当前项目没有使用 Zod、Yup、io-ts 等运行时校验库。

因此：

- mock 数据必须满足 `src/types.ts`。
- store action 入参必须有 TypeScript 类型。
- 后续接真实 API 前，需要补运行时校验或 API DTO 转换层。

---

## 禁止模式

- 不要使用 `any` 绕过类型。
- 不要用大范围类型断言掩盖数据结构问题。
- 不要把后端返回的未知结构直接当作领域类型使用。
- 不要在多个文件中复制同一个 union。
- 不要把可选字段当必填字段直接使用。

---

## 当前注意事项

- 当前部分旧 mock 文案在终端中可能显示乱码，修改时保持 UTF-8。
- 策略版本字段当前部分是可选字段，例如 `StrategyInstance.version?`，使用时要有默认值或兜底。
- 信号、复盘、回测、模拟交易后续都应保留策略版本上下文。
