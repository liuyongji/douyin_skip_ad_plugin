# 项目结构概览

```
youhouplugin/
│
├── 📄 manifest.json          # Chrome 插件配置文件（必需）
├── 📜 content.js             # 主要内容脚本 - 广告检测与跳过逻辑
├── 🔧 background.js          # 后台服务脚本 - 扩展状态管理
│
├── 📖 README.md              # 项目说明文档
├── 📖 INSTALL.md             # 安装指南
├── 📖 PROJECT_STRUCTURE.md   # 本文件 - 项目结构说明
│
├── 📦 package.json           # Node.js 包配置（可选，用于图标生成）
├── 🔨 generate-icons.js      # 图标生成脚本（可选）
│
└── 📁 icons/                 # 图标资源目录（可选）
    ├── icon16.svg           # 16x16 SVG 图标
    ├── icon48.svg           # 48x48 SVG 图标
    ├── icon128.svg          # 128x128 SVG 图标
    └── README.md            # 图标生成说明
```

## 核心文件说明

### 1. manifest.json (必需)
**作用**: Chrome 插件的配置文件，定义插件的基本信息、权限和脚本

**关键配置**:
- `manifest_version`: 使用 Manifest V3（最新标准）
- `permissions`: 请求的浏览器权限
- `host_permissions`: 允许访问的网站域名
- `content_scripts`: 注入到网页的脚本
- `background`: 后台服务脚本

### 2. content.js (必需)
**作用**: 主要功能实现脚本，在抖音页面中运行

**核心功能**:
- ✅ 定时检测页面内容
- ✅ 识别广告关键词和元素
- ✅ 执行划走动作（模拟键盘和滚动）
- ✅ 统计跳过的广告数量
- ✅ 响应后台消息（启用/禁用）

**主要函数**:
```javascript
isAdvertisement()     // 检测是否为广告
swipeUp()            // 执行划走动作
startDetection()     // 启动检测循环
setupMessageListener() // 设置消息监听
init()               // 初始化
```

### 3. background.js (必需)
**作用**: 后台服务脚本，处理扩展生命周期和全局状态

**核心功能**:
- ✅ 扩展安装/更新时的初始化
- ✅ 存储扩展状态（启用/禁用、计数等）
- ✅ 监听扩展图标点击事件
- ✅ 转发控制消息到 content script
- ✅ 定时任务管理

**主要事件**:
```javascript
onInstalled          // 安装/更新事件
onMessage           // 消息接收事件
onClicked           // 图标点击事件
onAlarm             // 定时闹钟事件
```

## 工作原理

### 数据流
```
用户访问抖音网站
    ↓
content.js 加载并初始化
    ↓
启动定时检测循环 (每 1000ms)
    ↓
检测到广告？
    ├─ 是 → 延迟 500ms → 执行划走动作
    └─ 否 → 继续检测
    ↓
记录日志到控制台
```

### 消息传递
```
background.js          content.js
     │                      │
     │←-- toggleExtension ---│  (切换启用状态)
     │                      │
     │--- getStatus ------→│  (获取当前状态)
     │                      │
     │←------ response -----│  (返回状态信息)
     │                      │
```

## 广告检测机制

### 三层检测策略

#### 第一层：关键词检测
扫描整个页面的文本内容，查找广告相关词汇：
- '广告', 'AD', 'Ad'
- '广告合作', '商业推广', '赞助'
- 'branding', 'promotion'

#### 第二层：DOM 元素检测
查找带有广告标识的 DOM 元素：
- `[data-e2e="ad"]` - 抖音的广告数据标签
- `.ad-mark` - 广告标记类名
- `.video-ad` - 视频广告类名
- `[class*="ad"]` - 包含 ad 的类名

#### 第三层：视频标签检测
检查视频容器内的文本标签：
- 定位到视频容器 `[data-e2e="feed-container"]`
- 扫描其中的所有文本标签
- 验证是否包含广告关键词

### 划走动作实现

```javascript
// 1. 模拟键盘方向键下按
const arrowDownEvent = new KeyboardEvent('keydown', {
  key: 'ArrowDown',
  code: 'ArrowDown',
  keyCode: 40,
  bubbles: true,
  cancelable: true
});
document.dispatchEvent(arrowDownEvent);

// 2. 同时执行页面滚动
window.scrollBy({
  top: window.innerHeight * 0.8,
  behavior: 'smooth'
});
```

## 配置参数说明

在 `content.js` 中的 `CONFIG` 对象可以调整：

```javascript
const CONFIG = {
  // 检测间隔：多久检查一次页面（毫秒）
  checkInterval: 1000,
  
  // 划走延迟：检测到广告后多久执行动作（毫秒）
  swipeDelay: 500,
  
  // 广告关键词列表（可自定义添加）
  adKeywords: ['广告', 'AD', ...],
  
  // 广告元素选择器（根据实际页面结构调整）
  adSelectors: ['[data-e2e="ad"]', ...]
};
```

## 调试方法

### 查看 Content Script 日志
```
1. 打开抖音网站
2. F12 → Console
3. 筛选 "[抖音广告跳过]"
```

### 查看 Background Script 日志
```
1. chrome://extensions/
2. 找到扩展 → "检查视图 - Service Worker"
3. 查看控制台输出
```

### 测试广告检测
```javascript
// 在控制台手动测试检测函数
// （需要先安装插件）
console.log(isAdvertisement());
```

## 性能优化建议

1. **检测间隔调整**
   - 默认 1000ms 已足够
   - 如需更快响应，可降至 500ms
   - 如需节省性能，可升至 2000ms

2. **选择器优化**
   - 根据实际抖音页面结构精确定位
   - 避免使用过于宽泛的选择器
   - 定期更新以适应网站变化

3. **内存管理**
   - setInterval 会持续运行
   - 离开页面时自动清理
   - 可通过禁用扩展停止

## 扩展功能建议

### 已实现
✅ 自动广告检测
✅ 自动划走动作
✅ 启用/禁用切换
✅ 跳过计数统计
✅ 详细日志输出

### 可扩展
⬜ 弹窗界面显示统计
⬜ 白名单功能（允许特定广告）
⬜ 快捷键控制
⬜ 自定义检测规则
⬜ 云端同步配置
⬜ 广告类型分类

## 常见问题排查

### 问题 1: 插件不工作
**检查清单**:
- [ ] manifest.json 格式正确
- [ ] content.js 无语法错误
- [ ] 权限配置完整
- [ ] 域名匹配正确

### 问题 2: 检测不到广告
**可能原因**:
- 抖音更新了页面结构
- 广告标识方式改变
- 关键词不匹配

**解决方法**:
- 查看页面 HTML 结构
- 更新 adSelectors
- 添加新的关键词

### 问题 3: 误判正常视频
**优化方案**:
- 增加检测条件
- 添加多重验证
- 延长检测延迟

## 技术栈

- **Manifest V3**: 最新的 Chrome 扩展标准
- **Vanilla JavaScript**: 原生 JavaScript，无依赖
- **Chrome APIs**: 
  - `chrome.runtime` - 运行时 API
  - `chrome.storage` - 存储 API
  - `chrome.action` - 扩展图标 API
  - `chrome.alarms` - 定时任务 API

## 兼容性

- ✅ Chrome 88+ (支持 Manifest V3)
- ✅ Edge 88+ (基于 Chromium)
- ✅ 其他 Chromium 内核浏览器
- ❌ Firefox (需要适配)
- ❌ Safari (需要适配)

---

**开发时间**: 2026-04-01
**版本**: v1.0.0
**许可**: MIT License
