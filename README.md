# Scriptable-NineBot

一个遵循 Apple 系统视觉风格的 **九号电动车 Scriptable 桌面小组件**，支持 iOS 18+ 的小号、中号与大号 iPhone 小组件。

- 小号：车辆图标、电量、续航、锁车状态。
- 中号：车辆图片、电量、续航、速度、模式、锁车状态、更新时间。
- 大号：车辆图片和名称、超大速度、电量、续航、今日骑行、累计里程、锁车/充电状态与更新时间。
- 自动匹配浅色/深色模式、使用 SF Symbols 与等宽数字。
- 默认每 5 分钟请求一次数据；组件上的刷新图标会打开 Scriptable 并立即重新请求。
- 请求失败时显示“车辆离线 / 网络错误”，不会导致组件崩溃。

> 本仓库**不会**包含后台管理账号、密码、Cookie 或 Token。若任意凭据曾被发到公开场所，请立即在后台轮换它。

## 文件

- [`NineBot Widget.js`](./NineBot%20Widget.js)：可直接复制到 Scriptable 的完整脚本。

## 重要：接口与认证

当前 NinePlus Platform 管理页是：

```text
https://你的域名/admin
```

组件应该填写的是 JSON 数据接口，而不是管理页：

```text
https://你的域名/admin/api/dashboard
```

该后台现有前端以 **网页登录会话** 访问 `/admin/api/dashboard`。管理页前端代码没有展示 Bearer Token 鉴权，因此把一个任意 Token 填到 Scriptable 并不能自动取得会话数据。

### 推荐做法：增加只读 Token API

为后端增加一个仅允许 `GET` 的、独立于管理页面会话的接口，例如：

```text
GET /api/v1/ninebot/dashboard
Authorization: Bearer <READ_ONLY_TOKEN>
```

接口返回可直接复用当前 `/admin/api/dashboard` 的 JSON。然后在脚本顶部 `Config` 区域填写：

```javascript
API_URL: "https://你的域名/api/v1/ninebot/dashboard",
TOKEN: "你的只读 Token",
TOKEN_HEADER: "Authorization",
TOKEN_PREFIX: "Bearer",
```

建议该 Token：

1. 只允许读取当前用户的车辆状态；不允许登录、车辆控制或管理后台操作。
2. 仅通过 HTTPS 传输。
3. 支持随时轮换、撤销与过期。
4. 不写入 GitHub，不分享给他人。

如果你的后端采用 `X-API-Key`，设置：

```javascript
TOKEN_HEADER: "X-API-Key",
TOKEN_PREFIX: "",
```

脚本已经适配当前仪表盘返回的 `vehicles → vehicle/state/battery/travel/prediction` 结构。未来替换为其他 JSON 格式时，只需修改 `normalizeVehicleData()`。

## Scriptable 使用步骤

1. 在 iPhone 安装 **Scriptable**。
2. 打开 Scriptable，点右上角 **+**，新建脚本。
3. 将 [`NineBot Widget.js`](./NineBot%20Widget.js) 的全部内容复制进去。
4. 将脚本命名为 `NineBot Widget`（名称可自定；刷新按钮会自动读取当前脚本名）。
5. 在文件顶部的 `Config` 区域填写：
   - `API_URL`：你的只读 JSON API 地址；
   - `TOKEN`：只读 API Token；
   - `APP_URL`：点击组件后打开的地址。可填你的后台地址，或替换为已验证可用的九号 App URL Scheme；
   - `VEHICLE`：多辆车时填 `0`、`1`… 或指定车辆 SN。
6. 在 Scriptable 内点击运行一次，确认中号预览可加载数据。
7. 回到 iPhone 主屏幕，长按空白处 → **编辑** → **添加小组件** → 搜索 **Scriptable**。
8. 选择 Small、Medium 或 Large 尺寸并添加到主屏幕。
9. 长按刚添加的小组件 → **编辑小组件** → `Script` 选择 `NineBot Widget`；若需要，在 `Parameter` 填车辆 SN（也可直接改 Config）。

## 数据字段说明

| 组件字段 | 当前仪表盘字段 / 回退逻辑 |
| --- | --- |
| 车辆名称与图片 | `vehicle.name`、`vehicle.image_url` |
| 电量 | `state.dump_energy` → `battery.electricity` |
| 剩余续航 | `prediction.range.estimated_range_km` → `state.precise_estimate_mileage` |
| 锁车 | `state.loc.lock` 或其他标准锁车字段 |
| 充电 | `state.charging` → `battery.charging` |
| 今日骑行 | `travel.list[0].day_total_mileage` |
| 累计里程 | `vehicle.total_mileage` → `travel.total_mileages` |
| 速度 | 实时 `state.speed`；没有实时字段时回退为最近一次行程速度，并标注“最近速度” |
| 模式 | `state.mode` / `drive_mode` / `riding_mode` / `gear`（Eco / Drive / Sport） |

当前后台响应若未提供实时 `speed` 或骑行模式字段，组件会显示 `--`（速度则优先显示最近行程速度）。要显示真正的实时速度和 Eco / Drive / Sport，需要后端把这些字段加入 JSON。

## 刷新机制

- `REFRESH_MINUTES` 默认 `5`，可在 `Config` 调整。
- iOS 会依据系统资源策略决定实际刷新时间，不能保证精确到每 5 分钟。
- 点击底部的刷新图标会启动 Scriptable 并重新请求接口。

## 安全建议

- 请只使用 `https://` API 地址，避免 HTTP 明文传输 Token。
- 不要把后台管理员密码、网页登录 Cookie 或 Token 提交到仓库。
- 不推荐把管理后台直接暴露为 Internet 上的 Token 接口；应单独实现权限最小化的只读 API。
- 公开仓库只能提交 `YOUR-DOMAIN.example`、`PASTE_READ_ONLY_API_TOKEN_HERE` 等占位符。

## 本地检查

在 macOS 终端执行：

```bash
node --check 'NineBot Widget.js'
```

该命令仅校验 JavaScript 语法；Scriptable 专有 API（如 `ListWidget`、`SFSymbol`）需要在 iPhone 的 Scriptable 中预览验证。
