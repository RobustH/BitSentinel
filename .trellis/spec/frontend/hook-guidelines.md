# Hook 使用规范

> 当前项目没有大量自定义 hook，主要使用 React 内置 hook 和 Zustand hook。

---

## 当前使用方式

常见 hook：

- `useState`
- `useMemo`
- `useEffect`
- `useRef`
- `useAppStore`

真实示例：

- `src/App.tsx` 中使用 `useMemo` 派生筛选、统计、图表数据。
- `src/App.tsx` 中 `MiniKline` 使用 `useRef` 和 `useEffect` 挂载 `lightweight-charts`。
- `src/store/appStore.ts` 导出 `useAppStore`，供页面组件读取全局状态和 action。

---

## 自定义 Hook 规则

当前项目尚未形成独立 custom hook 目录。

如果新增自定义 hook：

- 命名必须以 `use` 开头。
- 只封装可复用的状态逻辑或副作用逻辑。
- 不要为了单个组件的一小段逻辑创建 hook。
- 不要在 hook 中直接写页面布局。
- hook 返回值应稳定、清晰，避免返回过大的对象。

建议未来目录：

```text
src/hooks/
```

或按 feature 放置：

```text
src/features/monitor/useMonitorFilters.ts
```

---

## Store Hook 使用

使用 `useAppStore` 时，优先选择所需字段，避免整个 store 订阅。

推荐：

```tsx
const signals = useAppStore((state) => state.signals);
const selectSignal = useAppStore((state) => state.selectSignal);
```

避免：

```tsx
const store = useAppStore();
```

原因：订阅整个 store 会增加不必要渲染。

---

## 数据获取

当前项目是纯前端模拟数据版本，没有 React Query、SWR 或真实 API 请求层。

规则：

- 不要在组件里直接写真实 API 请求，除非已经建立统一 API 层。
- mock 数据从 `src/mock/data.ts` 和 `src/store/appStore.ts` 来。
- 后续接后端时，应先设计 API client 和 server state 策略。

---

## 副作用规则

- 图表初始化、订阅、定时器必须在 `useEffect` 中清理。
- `lightweight-charts` 创建的 chart 应在 effect cleanup 中移除。
- 通知类副作用应由明确的用户动作或状态事件触发，不要在 render 阶段触发。

---

## 常见问题

- 不要在 hook 中修改非 React 管理的外部变量。
- 不要把 store action 调用放在 render 过程中。
- 不要让 `useEffect` 依赖缺失导致图表或通知重复触发。
- 不要把复杂业务规则藏在 hook 中而不写类型。
