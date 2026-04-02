// 抖音优化插件 - 后台脚本（参考油猴插件）

// 扩展安装或更新时触发
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[抖音优化] 扩展已安装/更新', details);
  
  // 初始化存储
  chrome.storage.local.set({
    enabled: true,
    skippedCount: 0,
    installTime: Date.now(),
    skipConfig: {
      ad: true,           // 跳过广告
      live: true,         // 跳过直播
      shopping: true,     // 跳过购物
      promotion: true     // 跳过推广
    }
  });
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSkippedCount') {
    // 更新跳过计数
    chrome.storage.local.get(['skippedCount'], (result) => {
      const newCount = (result.skippedCount || 0) + 1;
      chrome.storage.local.set({ skippedCount: newCount });
      console.log('[抖音优化] 跳过计数:', newCount);
    });
  } else if (request.action === 'getSkipConfig') {
    // 获取跳过配置
    chrome.storage.local.get(['skipConfig'], (result) => {
      sendResponse(result.skipConfig);
    });
    return true;
  } else if (request.action === 'updateSkipConfig') {
    // 更新跳过配置
    chrome.storage.local.set({ skipConfig: request.config });
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'toggleExtension') {
    // 切换启用/禁用状态
    chrome.storage.local.get(['enabled'], (result) => {
      const newState = !(result.enabled || true);
      chrome.storage.local.set({ enabled: newState });
      sendResponse({ enabled: newState });
      console.log('[抖音优化] 扩展已', newState ? '启用' : '禁用');
    });
    return true;
  } else if (request.action === 'getStatus') {
    // 获取当前状态
    chrome.storage.local.get(['enabled', 'skippedCount'], (result) => {
      sendResponse({
        enabled: result.enabled,
        skippedCount: result.skippedCount || 0
      });
    });
    return true;
  }
  return true;
});

console.log('[抖音优化] 后台脚本已启动 - 支持跳过直播/广告/购物/推广');
