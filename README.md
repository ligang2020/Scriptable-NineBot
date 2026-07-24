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

## 最简单的配置：使用后台账号自动登录

当前 NinePlus Platform 管理页是：

```text
https://你的域名/admin
```

数据接口是：

```text
https://你的域名/admin/api/dashboard
```

该接口需要先登录管理后台。最新版脚本已支持 **admin-session** 模式：首次刷新时，它会用你填写的后台账号密码登录，并把会话 Cookie 安全地缓存在 **iPhone 本机 Scriptable Keychain** 中约 12 小时；之后刷新会复用会话，不会每 5 分钟重复登录。

在 iPhone 的 Scriptable 脚本顶部，按下面填写。账号和密码绝不能提交或粘贴回 GitHub；若 Scriptable 启用了 iCloud 同步，脚本内容也可能随 iCloud 同步。

```javascript
AUTH_MODE: "admin-session",
API_URL: "https://你的域名/admin/api/dashboard",
LOGIN_URL: "https://你的域名/admin/login",
ADMIN_USERNAME: "你的后台用户名",
ADMIN_PASSWORD: "你的后台管理密码",
APP_URL: "https://你的域名/admin",
```

> 必须使用 `https://`，不要使用 `http://`。管理页 `/admin` 不是 JSON 接口，不能填到 `API_URL`。

### Scriptable 使用步骤

1. 在 iPhone 安装并打开 **Scriptable**。
2. 打开仓库中的 [`NineBot Widget.js`](./NineBot%20Widget.js)，复制全部代码。
3. Scriptable 点右上角 **+**，粘贴代码，脚本命名为 `NineBot Widget`。
4. 在顶部 `Config` 按上例填入你的域名、后台用户名和后台管理密码。
5. 点击 Scriptable 内的运行按钮 ▶︎；首次运行会自动登录并显示预览。
6. 回到主屏幕，长按空白处 → **编辑** → **添加小组件** → 搜索 **Scriptable**。
7. 选 Small、Medium 或 Large，添加后长按该组件 → **编辑小组件** → `Script` 选择 `NineBot Widget`。

多辆车时可以在 `Config` 中设置：

```javascript
VEHICLE: 0,             // 第一辆车
// 或：
VEHICLE: "车辆SN",     // 指定某辆车
```

### 以后改为只读 Token API（更推荐）

若你以后为后端实现独立的只读接口，例如：

```text
GET /api/v1/ninebot/dashboard
Authorization: Bearer <READ_ONLY_TOKEN>
```

则可改为：

```javascript
AUTH_MODE: "token",
API_URL: "https://你的域名/api/v1/ninebot/dashboard",
TOKEN: "你的只读 Token",
TOKEN_HEADER: "Authorization",
TOKEN_PREFIX: "Bearer",
```

Token 接口应仅允许读取车辆状态，不能登录管理后台或控制车辆。

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

- 请只使用 `https://` 地址，避免 HTTP 明文传输账号、密码或 Token。
- 不要把后台管理员密码、网页登录 Cookie 或 Token 提交到仓库、GitHub Issue 或聊天记录。
- `admin-session` 模式的会话 Cookie 保存在 Scriptable Keychain；管理员密码仍是脚本配置中的明文，请仅保存在受保护的个人设备上。
- 公开仓库只能提交 `YOUR-DOMAIN.example`、空账号密码及 Token 占位符。
- 长期使用时，建议改为权限最小化的只读 Token API，而非给组件管理后台账号。

## 本地检查

在 macOS 终端执行：

```bash
node --check 'NineBot Widget.js'
```

该命令仅校验 JavaScript 语法；Scriptable 专有 API（如 `ListWidget`、`SFSymbol`）需要在 iPhone 的 Scriptable 中预览验证。
