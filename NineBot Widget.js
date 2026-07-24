// 九号电动车 · Scriptable 桌面小组件
// 兼容：Scriptable 最新版、iOS 18+、Small / Medium / Large Widget
// 数据接口：默认适配 NinePlus Platform 的 /admin/api/dashboard 响应；也可扩展 normalizeVehicleData() 支持其他 JSON。

// ================================================================
// Config 配置区域：只修改这里即可
// ================================================================
const Config = {
  // 请使用“返回 JSON 的接口”，不要填管理网页地址 /admin。
  // 当前 NinePlus Platform 默认接口：https://你的域名/admin/api/dashboard
  API_URL: "https://YOUR-DOMAIN.example/admin/api/dashboard",

  // 认证方式：
  // - "admin-session"：适用于当前 NinePlus Platform。组件会先用以下账号密码登录，再读取数据。
  // - "token"：适用于你以后提供了只读 API Token 的后端。
  AUTH_MODE: "admin-session",

  // admin-session 模式：仅在 iPhone 的 Scriptable 脚本中填写，绝不能提交 GitHub。
  LOGIN_URL: "https://YOUR-DOMAIN.example/admin/login",
  ADMIN_USERNAME: "",
  ADMIN_PASSWORD: "",

  // token 模式：推荐未来改为只读 Token API 后使用；不要填写后台管理员密码。
  TOKEN: "PASTE_READ_ONLY_API_TOKEN_HERE",
  TOKEN_HEADER: "Authorization",
  TOKEN_PREFIX: "Bearer", // 如后端要求 X-API-Key，请改 TOKEN_HEADER 为 "X-API-Key" 并清空此项。

  // 后端有其他固定请求头时放在此处，例如 { "X-Client": "Scriptable" }。
  // 不建议在此放 Cookie：脚本会在 admin-session 模式下自动维护会话。
  EXTRA_HEADERS: {},

  // 多辆车时选择：数字（0 = 第一辆）或车辆 SN。
  VEHICLE: 0,

  // 小组件点击后打开的地址。可替换为九号 App 的 URL Scheme（若你已确认可用）。
  APP_URL: "https://YOUR-DOMAIN.example/admin",

  REFRESH_MINUTES: 5,
  REQUEST_TIMEOUT_SECONDS: 20,
  PREVIEW_FAMILY: "medium", // 在 Scriptable App 内运行脚本时的预览尺寸：small / medium / large
};

// ================================================================
// 设计令牌：低饱和、Apple 系统风格，自动匹配浅色 / 深色模式
// ================================================================
const Theme = {
  // Tesla-inspired 中控屏：近黑 / 暖白底色，少量克制红色强调。
  widget: Color.dynamic(new Color("F7F7F5"), new Color("0A0A0B")),
  card: Color.dynamic(new Color("FFFFFF", 0.92), new Color("171719", 0.98)),
  cardSecondary: Color.dynamic(new Color("ECECEA"), new Color("242426")),
  primary: Color.dynamic(new Color("151516"), new Color("F4F4F5")),
  secondary: Color.dynamic(new Color("707074"), new Color("A1A1A6")),
  tertiary: Color.dynamic(new Color("AEAEB0"), new Color("66666B")),
  accent: Color.dynamic(new Color("D6281B"), new Color("FF453A")),
  positive: Color.dynamic(new Color("227A52"), new Color("4DBD84")),
  warning: Color.dynamic(new Color("AD6C20"), new Color("E2A55C")),
  danger: Color.dynamic(new Color("C92A20"), new Color("FF6961")),
  separator: Color.dynamic(new Color("D9D9D6"), new Color("37373A")),
};

const Layout = {
  radius: 14,
  cardPadding: 14,
  smallInset: 14,
  mediumInset: 14,
  largeInset: 16,
};

// ================================================================
// 数据层
// ================================================================
async function fetchDashboard() {
  if (!Config.API_URL || Config.API_URL.includes("YOUR-DOMAIN")) {
    throw new Error("请先在 Config 中填写 API_URL");
  }

  // 当前 NinePlus Platform 的 dashboard 需要管理后台会话。
  // Token 模式则直接附带 Authorization / X-API-Key 等请求头。
  let headers = await buildRequestHeaders();
  try {
    const payload = await loadDashboard(headers);
    return normalizeVehicleData(payload);
  } catch (error) {
    // 会话可能在服务端提前失效：清除本地 Cookie 后自动重新登录一次。
    if (!isAdminSessionMode()) throw normalizeRequestError(error);
    clearSavedSession();
    try {
      headers = await buildRequestHeaders(true);
      const payload = await loadDashboard(headers);
      return normalizeVehicleData(payload);
    } catch (retryError) {
      throw normalizeRequestError(retryError);
    }
  }
}

async function loadDashboard(headers) {
  const request = new Request(Config.API_URL);
  request.method = "GET";
  request.timeoutInterval = Config.REQUEST_TIMEOUT_SECONDS;
  request.headers = headers;

  try {
    const payload = await request.loadJSON();
    const statusCode = request.response && request.response.statusCode;
    if (statusCode && (statusCode < 200 || statusCode >= 300)) {
      const error = new Error((payload && payload.detail) || `HTTP ${statusCode}`);
      error.statusCode = statusCode;
      throw error;
    }
    return payload;
  } catch (error) {
    if (!error.statusCode && request.response) error.statusCode = request.response.statusCode;
    throw error;
  }
}

async function buildRequestHeaders(forceRelogin = false) {
  const headers = buildHeaders();
  if (!isAdminSessionMode()) return headers;

  const cookie = forceRelogin ? await createAdminSession() : (readSavedSession() || await createAdminSession());
  headers.Cookie = cookie;
  return headers;
}

function buildHeaders() {
  const headers = {
    Accept: "application/json",
    ...Config.EXTRA_HEADERS,
  };

  const token = String(Config.TOKEN || "").trim();
  if (!isAdminSessionMode() && token && !token.startsWith("PASTE_")) {
    const prefix = String(Config.TOKEN_PREFIX || "").trim();
    headers[Config.TOKEN_HEADER] = prefix ? `${prefix} ${token}` : token;
  }
  return headers;
}

function isAdminSessionMode() {
  return String(Config.AUTH_MODE || "token").toLowerCase() === "admin-session";
}

async function createAdminSession() {
  if (!Config.LOGIN_URL || Config.LOGIN_URL.includes("YOUR-DOMAIN")) {
    throw new Error("请填写 LOGIN_URL");
  }
  if (!String(Config.ADMIN_USERNAME || "").trim() || !String(Config.ADMIN_PASSWORD || "")) {
    throw new Error("请在 Config 填写 ADMIN_USERNAME 和 ADMIN_PASSWORD");
  }

  const request = new Request(Config.LOGIN_URL);
  request.method = "POST";
  request.timeoutInterval = Config.REQUEST_TIMEOUT_SECONDS;
  request.headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...Config.EXTRA_HEADERS,
  };
  request.body = JSON.stringify({
    username: Config.ADMIN_USERNAME,
    password: Config.ADMIN_PASSWORD,
  });

  let response;
  try {
    response = await request.loadJSON();
  } catch (error) {
    throw new Error("登录后台失败，请检查网络、LOGIN_URL、账号和密码");
  }

  const statusCode = request.response && request.response.statusCode;
  if (statusCode && (statusCode < 200 || statusCode >= 300)) {
    throw new Error((response && response.detail) || "登录后台失败，请检查账号和密码");
  }

  const cookie = extractSessionCookie(request.response);
  if (!cookie) throw new Error("登录成功但未获得会话 Cookie");
  saveSession(cookie);
  return cookie;
}

function extractSessionCookie(response) {
  // Scriptable 会优先将 Set-Cookie 解析为 response.cookies。
  const cookies = response && response.cookies;
  if (Array.isArray(cookies)) {
    const cookie = cookies.find((item) => item && item.name && item.value !== undefined);
    if (cookie) return `${cookie.name}=${cookie.value}`;
  }

  // 对旧版 / 特殊响应结构作 Set-Cookie 回退解析。
  const headers = (response && response.headers) || {};
  const setCookie = headers["Set-Cookie"] || headers["set-cookie"];
  const text = Array.isArray(setCookie) ? setCookie.join(",") : String(setCookie || "");
  const matched = text.match(/(?:^|,\s*)([^=;\s]+)=([^;]+)/);
  return matched ? `${matched[1]}=${matched[2]}` : "";
}

function sessionCacheKey() {
  return `ScriptableNineBotSession_${encodeURIComponent(Config.LOGIN_URL || "default").slice(0, 120)}`;
}

function readSavedSession() {
  const key = sessionCacheKey();
  if (!Keychain.contains(key)) return "";
  try {
    const saved = JSON.parse(Keychain.get(key));
    if (saved.cookie && saved.expiresAt > Date.now()) return saved.cookie;
  } catch (_) {}
  clearSavedSession();
  return "";
}

function saveSession(cookie) {
  // 当前后台 Cookie 有效期是 12 小时；提前 5 分钟过期以减少刷新失败。
  Keychain.set(sessionCacheKey(), JSON.stringify({
    cookie,
    expiresAt: Date.now() + 11 * 60 * 60 * 1000 + 55 * 60 * 1000,
  }));
}

function clearSavedSession() {
  const key = sessionCacheKey();
  if (Keychain.contains(key)) Keychain.remove(key);
}

function normalizeRequestError(error) {
  const message = error && error.message ? error.message : String(error || "");
  return new Error(message || "网络请求失败");
}

/**
 * 将不同后端 JSON 归一化为组件所需字段。
 * 默认支持：{ updated_at, vehicles: [{ vehicle, state, battery, travel, prediction }] }
 * 将来改接口时，优先只修改本函数，无需改 UI。
 */
function normalizeVehicleData(payload) {
  if (!payload || typeof payload !== "object") throw new Error("接口未返回有效 JSON");
  if (payload.not_logged_in) throw new Error(payload.message || "后端尚未绑定九号账号");

  const item = selectVehicle(payload);
  if (!item || item.error) throw new Error((item && item.error) || "未找到车辆数据");

  // 同时支持 NinePlus 原始仪表盘结构和已扁平化的自定义结构。
  const vehicle = item.vehicle || item;
  const state = item.state || item.status || {};
  const battery = item.battery || {};
  const travel = item.travel || {};
  const prediction = item.prediction || {};
  const latestTrip = getLatestTrip(travel);
  const rawVehicle = vehicle.raw || {};

  const batteryPercent = numberOf(
    firstDefined(state.dump_energy, battery.electricity, battery.battery_main && battery.battery_main.electricity, item.batteryPercent, item.battery)
  );
  const rangeKm = numberOf(
    firstDefined(prediction.range && prediction.range.estimated_range_km, state.precise_estimate_mileage, state.estimate_mileage, item.rangeKm, item.range)
  );

  // 当前后端若没有实时速度，则退回为最近一次行程速度；界面会标注“最近”。
  const rawSpeed = firstDefined(state.speed, state.current_speed, item.speed);
  const currentSpeed = numberOf(rawSpeed);
  const lastTripSpeed = numberOf(firstDefined(latestTrip && latestTrip.speed, travel.speed));

  const mode = normalizeMode(firstDefined(state.mode, state.drive_mode, state.riding_mode, state.gear, item.mode));
  const charging = booleanOf(firstDefined(state.charging, battery.charging, prediction.charging && prediction.charging.is_charging, item.charging));
  const locked = booleanOf(firstDefined(
    state.locked,
    state.lock_status,
    state.vehicle_lock_status,
    state.loc && state.loc.lock,
    item.locked
  ));
  const onlineRaw = firstDefined(state.online, state.is_online, state.connected, item.online);

  return {
    name: firstText(vehicle.name, vehicle.device_name, rawVehicle.device_name, item.name, "九号电动车"),
    model: firstText(vehicle.model, vehicle.vehicle_name, rawVehicle.vehicle_name, item.model),
    imageURL: firstText(vehicle.image_url, vehicle.img_url, rawVehicle.img_url, item.image_url, item.imageURL),
    online: onlineRaw === undefined ? true : booleanOf(onlineRaw),
    speed: currentSpeed === null ? lastTripSpeed : currentSpeed,
    speedIsHistorical: currentSpeed === null && lastTripSpeed !== null,
    battery: batteryPercent,
    range: rangeKm,
    mode,
    locked,
    charging,
    todayDistance: numberOf(firstDefined(
      travel.today_mileage,
      travel.day_total_mileage,
      item.today_distance,
      item.todayDistance,
      latestTrip && latestTrip.day_total_mileage
    )),
    totalDistance: numberOf(firstDefined(
      vehicle.total_mileage,
      rawVehicle.total_mileage,
      state.total_mileage,
      item.total_distance,
      item.totalDistance,
      travel.total_mileages
    )),
    updatedAt: parseDate(firstDefined(payload.updated_at, item.updated_at, state.updated_at, prediction.updated_at)),
  };
}

function selectVehicle(payload) {
  const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [payload];
  if (!vehicles.length) throw new Error(payload.message || "没有已绑定的车辆");

  if (typeof Config.VEHICLE === "string" && Config.VEHICLE.trim()) {
    const expected = Config.VEHICLE.trim();
    const bySN = vehicles.find((item) => String((item.vehicle || item).sn || "") === expected);
    if (bySN) return bySN;
  }
  const index = Math.max(0, Number(Config.VEHICLE) || 0);
  return vehicles[index] || vehicles[0];
}

function getLatestTrip(travel) {
  const trips = Array.isArray(travel.list) ? travel.list : (Array.isArray(travel.trips) ? travel.trips : []);
  return trips.length ? trips[0] : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function firstText(...values) {
  const value = firstDefined(...values);
  return value === undefined ? "" : String(value);
}

function numberOf(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanOf(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value || "").toLowerCase();
  return ["1", "true", "yes", "on", "locked", "online", "charging"].includes(normalized);
}

function normalizeMode(value) {
  if (value === undefined || value === null || value === "") return "--";
  const key = String(value).toLowerCase();
  const map = {
    "0": "Eco", "1": "Drive", "2": "Sport",
    eco: "Eco", drive: "Drive", sport: "Sport",
    economy: "Eco", normal: "Drive", sports: "Sport",
  };
  return map[key] || String(value);
}

function parseDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

// ================================================================
// UI 基础组件
// ================================================================
function makeWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = Theme.widget;
  widget.setPadding(Layout.mediumInset, Layout.mediumInset, Layout.mediumInset, Layout.mediumInset);
  widget.refreshAfterDate = new Date(Date.now() + Config.REFRESH_MINUTES * 60 * 1000);
  return widget;
}

function makeCard(parent, padding = Layout.cardPadding) {
  const card = parent.addStack();
  card.layoutVertically();
  card.backgroundColor = Theme.card;
  card.cornerRadius = Layout.radius;
  card.setPadding(padding, padding, padding, padding);
  return card;
}

function addText(parent, text, options = {}) {
  const label = parent.addText(String(text));
  label.font = options.font || Font.regularSystemFont(12);
  label.textColor = options.color || Theme.primary;
  label.lineLimit = options.lineLimit || 1;
  if (options.opacity !== undefined) label.textOpacity = options.opacity;
  if (options.align === "right") label.rightAlignText();
  if (options.align === "center") label.centerAlignText();
  if (options.minimumScaleFactor) label.minimumScaleFactor = options.minimumScaleFactor;
  return label;
}

function addSymbol(parent, name, size = 14, color = Theme.secondary) {
  const symbol = SFSymbol.named(name) || SFSymbol.named("questionmark.circle");
  symbol.applyFont(Font.mediumSystemFont(size));
  const image = parent.addImage(symbol.image);
  image.imageSize = new Size(size, size);
  image.tintColor = color;
  return image;
}

function addSpacer(parent, value = null) {
  parent.addSpacer(value === null ? undefined : value);
}

function addPill(parent, icon, text, tone = Theme.secondary) {
  const pill = parent.addStack();
  pill.centerAlignContent();
  pill.backgroundColor = Theme.cardSecondary;
  pill.cornerRadius = 10;
  pill.setPadding(5, 7, 5, 7);
  addSymbol(pill, icon, 11, tone);
  addSpacer(pill, 4);
  addText(pill, text, { font: Font.mediumSystemFont(10), color: tone });
  return pill;
}

function addMetric(parent, icon, label, value, options = {}) {
  const metric = parent.addStack();
  metric.layoutVertically();
  const top = metric.addStack();
  top.centerAlignContent();
  addSymbol(top, icon, 11, options.iconColor || Theme.secondary);
  addSpacer(top, 4);
  addText(top, label, { font: Font.mediumSystemFont(10), color: Theme.secondary });
  metric.addSpacer(3);
  addText(metric, value, {
    font: options.font || Font.mediumMonospacedSystemFont(options.size || 16),
    color: options.color || Theme.primary,
    minimumScaleFactor: 0.65,
  });
  return metric;
}

function addFooter(parent, date) {
  const row = parent.addStack();
  row.centerAlignContent();
  addSymbol(row, "arrow.clockwise", 10, Theme.tertiary);
  addSpacer(row, 4);
  addText(row, `更新于 ${formatUpdateTime(date)}`, {
    font: Font.regularSystemFont(10),
    color: Theme.secondary,
  });
  addSpacer(row);
  const refresh = addSymbol(row, "arrow.clockwise.circle", 13, Theme.accent);
  refresh.url = scriptRunURL();
}

async function addVehicleImage(parent, imageURL, size) {
  // 图片请求失败时使用 SF Symbol 占位符，避免影响整个组件。
  const image = imageURL ? await loadImage(imageURL) : null;
  if (image) {
    const vehicleImage = parent.addImage(image);
    vehicleImage.imageSize = new Size(size, size);
    vehicleImage.resizable = true;
    vehicleImage.cornerRadius = Math.min(16, size / 5);
    return vehicleImage;
  }

  const fallback = SFSymbol.named("bicycle");
  fallback.applyFont(Font.regularSystemFont(size * 0.62));
  const placeholder = parent.addImage(fallback.image);
  placeholder.imageSize = new Size(size, size);
  placeholder.tintColor = Theme.secondary;
  return placeholder;
}

async function loadImage(url) {
  try {
    const request = new Request(url);
    request.timeoutInterval = Config.REQUEST_TIMEOUT_SECONDS;
    return await request.loadImage();
  } catch (_) {
    return null;
  }
}

function addDivider(parent, opacity = 1) {
  const line = parent.addStack();
  line.size = new Size(0, 1);
  line.backgroundColor = Theme.separator;
  return line;
}

function addTeslaEyebrow(parent, text = "NINEBOT") {
  addText(parent, text.toUpperCase(), {
    font: Font.mediumMonospacedSystemFont(9),
    color: Theme.tertiary,
  });
}

function addTeslaStatus(parent, vehicle) {
  const row = parent.addStack();
  row.centerAlignContent();
  const tone = vehicle.online ? Theme.positive : Theme.danger;
  const dot = row.addStack();
  dot.size = new Size(6, 6);
  dot.cornerRadius = 3;
  dot.backgroundColor = tone;
  addSpacer(row, 5);
  addText(row, vehicle.online ? "ONLINE" : "OFFLINE", {
    font: Font.mediumMonospacedSystemFont(9),
    color: tone,
  });
  return row;
}

function addTeslaMetric(parent, label, value, icon, options = {}) {
  const metric = parent.addStack();
  metric.layoutVertically();
  const labelRow = metric.addStack();
  labelRow.centerAlignContent();
  if (icon) {
    addSymbol(labelRow, icon, 10, options.iconColor || Theme.tertiary);
    addSpacer(labelRow, 4);
  }
  addText(labelRow, label.toUpperCase(), {
    font: Font.mediumMonospacedSystemFont(9),
    color: Theme.tertiary,
  });
  metric.addSpacer(4);
  addText(metric, value, {
    font: options.font || Font.mediumMonospacedSystemFont(options.size || 16),
    color: options.color || Theme.primary,
    minimumScaleFactor: 0.6,
  });
  return metric;
}

function statusText(vehicle) {
  return vehicle.online ? "在线" : "离线";
}

function statusTone(vehicle) {
  return vehicle.online ? Theme.positive : Theme.danger;
}

function lockText(vehicle) {
  return vehicle.locked ? "已锁车" : "未锁车";
}

function lockIcon(vehicle) {
  return vehicle.locked ? "lock.fill" : "lock.open.fill";
}

function batteryText(value) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function rangeText(value) {
  return value === null ? "--" : `${formatNumber(value, value >= 100 ? 0 : 1)} km`;
}

function speedText(value) {
  return value === null ? "--" : `${formatNumber(value, 0)}`;
}

function distanceText(value) {
  return value === null ? "--" : `${formatNumber(value, value >= 100 ? 0 : 1)} km`;
}

function formatNumber(value, fractionDigits) {
  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatUpdateTime(date) {
  const formatter = new DateFormatter();
  formatter.locale = "zh_CN";
  formatter.dateFormat = "MM/dd HH:mm";
  return formatter.string(date);
}

function scriptRunURL() {
  const scriptName = encodeURIComponent(Script.name());
  return `scriptable:///run?scriptName=${scriptName}&refresh=1`;
}

function setWidgetURL(widget) {
  // 若未设置 APP_URL，退回到手动刷新本脚本。
  widget.url = Config.APP_URL && !Config.APP_URL.includes("YOUR-DOMAIN") ? Config.APP_URL : scriptRunURL();
}

// ================================================================
// 三种 Widget 布局
// ================================================================
async function createSmallWidget(vehicle) {
  const widget = makeWidget();
  widget.setPadding(Layout.smallInset, Layout.smallInset, Layout.smallInset, Layout.smallInset);
  setWidgetURL(widget);

  // Tesla-inspired：极简读数卡，减少装饰，突出能量与锁车状态。
  const card = makeCard(widget, 14);
  const header = card.addStack();
  header.centerAlignContent();
  addTeslaEyebrow(header, "NINEBOT // VEHICLE");
  addSpacer(header);
  addTeslaStatus(header, vehicle);

  card.addSpacer(13);
  const energy = card.addStack();
  energy.bottomAlignContent();
  addText(energy, batteryText(vehicle.battery), {
    font: Font.boldMonospacedSystemFont(37),
    color: Theme.primary,
    minimumScaleFactor: 0.65,
  });
  addSpacer(energy, 6);
  addText(energy, "BATTERY", { font: Font.mediumMonospacedSystemFont(10), color: Theme.tertiary });

  card.addSpacer(10);
  addDivider(card, 0.8);
  card.addSpacer(10);
  const bottom = card.addStack();
  addTeslaMetric(bottom, "Range", rangeText(vehicle.range), "location.fill", { size: 13 });
  addSpacer(bottom);
  addTeslaMetric(bottom, "Lock", vehicle.locked ? "LOCKED" : "UNLOCKED", lockIcon(vehicle), {
    size: 12,
    color: vehicle.locked ? Theme.primary : Theme.warning,
    iconColor: vehicle.locked ? Theme.primary : Theme.warning,
  });
  return widget;
}

async function createMediumWidget(vehicle) {
  const widget = makeWidget();
  setWidgetURL(widget);

  const card = makeCard(widget, 15);
  const header = card.addStack();
  header.centerAlignContent();
  addTeslaEyebrow(header, "NINEBOT // DRIVE STATUS");
  addSpacer(header);
  addTeslaStatus(header, vehicle);

  card.addSpacer(10);
  addDivider(card, 0.8);
  card.addSpacer(10);

  const content = card.addStack();
  content.layoutHorizontally();

  // 左侧：更大、更干净的车辆视觉区。
  const visual = content.addStack();
  visual.layoutVertically();
  visual.size = new Size(112, 0);
  const imageArea = visual.addStack();
  imageArea.centerAlignContent();
  imageArea.backgroundColor = Theme.cardSecondary;
  imageArea.cornerRadius = 12;
  imageArea.setPadding(7, 7, 7, 7);
  await addVehicleImage(imageArea, vehicle.imageURL, 82);
  visual.addSpacer(7);
  addText(visual, vehicle.name, { font: Font.semiboldSystemFont(13), minimumScaleFactor: 0.62 });
  addText(visual, vehicle.model || "ELECTRIC VEHICLE", {
    font: Font.mediumMonospacedSystemFont(9), color: Theme.tertiary, minimumScaleFactor: 0.6,
  });

  addSpacer(content, 15);
  const dashboard = content.addStack();
  dashboard.layoutVertically();
  const speedLabel = dashboard.addStack();
  speedLabel.centerAlignContent();
  addText(speedLabel, vehicle.speedIsHistorical ? "LAST TRIP SPEED" : "CURRENT SPEED", {
    font: Font.mediumMonospacedSystemFont(9), color: Theme.tertiary,
  });
  dashboard.addSpacer(1);
  const speedLine = dashboard.addStack();
  speedLine.bottomAlignContent();
  addText(speedLine, speedText(vehicle.speed), {
    font: Font.boldMonospacedSystemFont(31), color: Theme.primary, minimumScaleFactor: 0.6,
  });
  addSpacer(speedLine, 5);
  addText(speedLine, "km/h", { font: Font.mediumMonospacedSystemFont(10), color: Theme.secondary });
  dashboard.addSpacer(8);
  const detail = dashboard.addStack();
  addTeslaMetric(detail, "Battery", batteryText(vehicle.battery), "battery.100", { size: 15, iconColor: Theme.positive });
  addSpacer(detail, 12);
  addTeslaMetric(detail, "Range", rangeText(vehicle.range), "location.fill", { size: 13 });
  dashboard.addSpacer(8);
  const state = dashboard.addStack();
  addTeslaMetric(state, "Mode", vehicle.mode === "--" ? "—" : vehicle.mode.toUpperCase(), "figure.outdoor.cycle", { size: 13 });
  addSpacer(state, 12);
  addTeslaMetric(state, "Lock", vehicle.locked ? "LOCKED" : "OPEN", lockIcon(vehicle), {
    size: 11, color: vehicle.locked ? Theme.primary : Theme.warning,
  });

  card.addSpacer(8);
  addDivider(card, 0.8);
  card.addSpacer(6);
  const footer = card.addStack();
  footer.centerAlignContent();
  addText(footer, vehicle.charging ? "CHARGING" : "READY TO DRIVE", {
    font: Font.mediumMonospacedSystemFont(9),
    color: vehicle.charging ? Theme.positive : Theme.secondary,
  });
  addSpacer(footer);
  addFooterInline(footer, vehicle.updatedAt);
  return widget;
}

async function createLargeWidget(vehicle) {
  const widget = makeWidget();
  widget.setPadding(Layout.largeInset, Layout.largeInset, Layout.largeInset, Layout.largeInset);
  setWidgetURL(widget);

  // 顶部：像车辆中控屏一样的极简身份区。
  const header = makeCard(widget, 14);
  const headerTop = header.addStack();
  headerTop.centerAlignContent();
  addTeslaEyebrow(headerTop, "NINEBOT // VEHICLE CONSOLE");
  addSpacer(headerTop);
  addTeslaStatus(headerTop, vehicle);
  header.addSpacer(9);
  const identity = header.addStack();
  identity.layoutHorizontally();
  const imageArea = identity.addStack();
  imageArea.centerAlignContent();
  imageArea.backgroundColor = Theme.cardSecondary;
  imageArea.cornerRadius = 12;
  imageArea.setPadding(6, 9, 6, 9);
  await addVehicleImage(imageArea, vehicle.imageURL, 68);
  addSpacer(identity, 13);
  const identityText = identity.addStack();
  identityText.layoutVertically();
  addText(identityText, vehicle.name, { font: Font.boldSystemFont(19), minimumScaleFactor: 0.62 });
  identityText.addSpacer(3);
  addText(identityText, vehicle.model || "ELECTRIC VEHICLE", {
    font: Font.mediumMonospacedSystemFont(10), color: Theme.tertiary, minimumScaleFactor: 0.6,
  });
  identityText.addSpacer(8);
  addText(identityText, vehicle.charging ? "CHARGING" : (vehicle.locked ? "SECURED" : "READY"), {
    font: Font.mediumMonospacedSystemFont(10),
    color: vehicle.charging ? Theme.positive : (vehicle.locked ? Theme.secondary : Theme.warning),
  });

  widget.addSpacer(10);

  // 中部：最大化当前速度。
  const driving = makeCard(widget, 16);
  const titleRow = driving.addStack();
  addTeslaEyebrow(titleRow, vehicle.speedIsHistorical ? "LAST TRIP SPEED" : "CURRENT SPEED");
  driving.addSpacer(3);
  const speedLine = driving.addStack();
  speedLine.bottomAlignContent();
  addText(speedLine, speedText(vehicle.speed), {
    font: Font.boldMonospacedSystemFont(56), color: Theme.primary, minimumScaleFactor: 0.55,
  });
  addSpacer(speedLine, 7);
  addText(speedLine, "km/h", { font: Font.mediumMonospacedSystemFont(14), color: Theme.secondary });
  driving.addSpacer(9);
  addDivider(driving, 0.8);
  driving.addSpacer(10);
  const vehicleStats = driving.addStack();
  addTeslaMetric(vehicleStats, "Drive Mode", vehicle.mode === "--" ? "—" : vehicle.mode.toUpperCase(), "figure.outdoor.cycle", { size: 16 });
  addSpacer(vehicleStats);
  addTeslaMetric(vehicleStats, "Battery", batteryText(vehicle.battery), "battery.100", { size: 18, iconColor: Theme.positive });
  addSpacer(vehicleStats);
  addTeslaMetric(vehicleStats, "Range", rangeText(vehicle.range), "location.fill", { size: 15 });

  widget.addSpacer(10);

  // 底部：平整的行程与车辆状态栏。
  const summary = makeCard(widget, 14);
  const tripRow = summary.addStack();
  addTeslaMetric(tripRow, "Today", distanceText(vehicle.todayDistance), "figure.outdoor.cycle", { size: 14 });
  addSpacer(tripRow);
  addTeslaMetric(tripRow, "Odometer", distanceText(vehicle.totalDistance), "gauge.high", { size: 14 });
  addSpacer(tripRow);
  addTeslaMetric(tripRow, "Lock", vehicle.locked ? "LOCKED" : "OPEN", lockIcon(vehicle), {
    size: 11, color: vehicle.locked ? Theme.primary : Theme.warning,
  });
  addSpacer(tripRow);
  addTeslaMetric(tripRow, "Charge", vehicle.charging ? "ACTIVE" : "OFF", vehicle.charging ? "bolt.fill" : "battery.100", {
    size: 11, color: vehicle.charging ? Theme.positive : Theme.secondary,
    iconColor: vehicle.charging ? Theme.positive : Theme.tertiary,
  });
  summary.addSpacer(10);
  addDivider(summary, 0.8);
  summary.addSpacer(7);
  addFooter(summary, vehicle.updatedAt);
  return widget;
}

function addFooterInline(parent, date) {
  const item = parent.addStack();
  item.centerAlignContent();
  addSymbol(item, "clock", 10, Theme.tertiary);
  addSpacer(item, 3);
  addText(item, formatUpdateTime(date), { font: Font.regularSystemFont(10), color: Theme.secondary });
  item.url = scriptRunURL();
}

async function createErrorWidget(error) {
  const widget = makeWidget();
  setWidgetURL(widget);
  const card = makeCard(widget, 16);
  const top = card.addStack();
  top.centerAlignContent();
  addSymbol(top, "wifi.slash", 20, Theme.danger);
  addSpacer(top, 8);
  addText(top, "车辆离线", { font: Font.boldSystemFont(16) });
  card.addSpacer(12);
  addText(card, "网络错误", { font: Font.mediumSystemFont(13), color: Theme.danger });
  card.addSpacer(4);
  addText(card, error.message || "暂时无法读取车辆数据", { font: Font.regularSystemFont(11), color: Theme.secondary, lineLimit: 2, minimumScaleFactor: 0.65 });
  card.addSpacer();
  const footer = card.addStack();
  footer.centerAlignContent();
  addText(footer, "轻点刷新", { font: Font.regularSystemFont(11), color: Theme.secondary });
  addSpacer(footer);
  const refresh = addSymbol(footer, "arrow.clockwise.circle.fill", 18, Theme.accent);
  refresh.url = scriptRunURL();
  return widget;
}

async function createWidget() {
  try {
    const vehicle = await fetchDashboard();
    switch (config.widgetFamily) {
      case "small": return await createSmallWidget(vehicle);
      case "large": return await createLargeWidget(vehicle);
      case "medium":
      default: return await createMediumWidget(vehicle);
    }
  } catch (error) {
    // 在 Scriptable App 内手动运行时弹出真实错误，便于配置排查；
    // 主屏幕 Widget 仍保持简洁的离线错误卡片。
    if (!config.runsInWidget) await showConnectionError(error);
    return await createErrorWidget(error);
  }
}

async function showConnectionError(error) {
  const message = (error && error.message) ? error.message : "未知错误";
  const alert = new Alert();
  alert.title = "九号组件连接失败";
  alert.message = `${message}\n\n请检查：\n1. API_URL 与 LOGIN_URL 是否均为 https:// 地址；\n2. ADMIN_USERNAME / ADMIN_PASSWORD 是否已填写；\n3. 手机是否能访问你的后台。`;
  alert.addAction("知道了");
  await alert.presentAlert();
}

// ================================================================
// Scriptable 入口
// ================================================================
const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // 在 App 内运行时用于调试和预览。
  const family = Config.PREVIEW_FAMILY;
  if (family === "small") await widget.presentSmall();
  else if (family === "large") await widget.presentLarge();
  else await widget.presentMedium();
}
Script.complete();
