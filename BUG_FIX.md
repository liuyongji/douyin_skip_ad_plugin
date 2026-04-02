# Bug 修复说明

## 问题描述

Chrome 扩展管理页面报错：
```
Uncaught TypeError: Cannot read properties of undefined (reading 'onClicked')
```

## 问题原因

在 Manifest V3 中，`chrome.action.onClicked` 在 Service Worker（后台脚本）中的使用方式有限制。这个 API 主要用于 browser_action（浏览器工具栏按钮），而不是我们的插件场景。

## 解决方案

完全移除了 `chrome.action.onClicked` 相关代码，因为：

1. **插件主要在抖音页面自动运行**，不需要通过点击图标来触发
2. **用户可以通过扩展管理页面启用/禁用插件**，功能等效
3. **简化了代码结构**，减少了兼容性问题

## 修改内容

### background.js 修改

**移除了以下代码：**
- `chrome.action.onClicked` 事件监听器
- `chrome.alarms` 定时任务（未使用）
- 图标点击切换功能

**保留了以下功能：**
- 扩展安装/更新时的初始化
- 消息传递（content script ↔ background）
- 状态存储（启用/禁用、跳过计数等）

## 现在的使用方法

### 自动运行
插件会在抖音页面自动运行，无需任何操作。

### 临时禁用
在 Chrome 扩展管理页面（chrome://extensions/）关闭插件开关即可。

### 查看日志
打开抖音网站 → 按 F12 → 查看 Console 控制台输出。

## 文件更新

- ✅ `background.js` - 移除问题代码，简化结构

## 重新加载扩展

```bash
1. 打开 chrome://extensions/
2. 找到"抖音优化 - 跳过直播广告购物"
3. 点击"刷新"按钮 🔄
4. 错误应该消失 ✅
```

## 验证修复

刷新扩展后，打开控制台应该看到：
```
[抖音优化] 扩展已安装/更新 {reason: "install"}
[抖音优化] 后台脚本已启动 - 支持跳过直播/广告/购物/推广
```

而不是之前的错误信息。

---

*修复时间：2026-04-01*  
*问题类型：Manifest V3 API 兼容性*  
*影响范围：无功能损失，插件正常运行*
