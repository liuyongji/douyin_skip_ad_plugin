// 抖音优化插件 - 主要内容脚本（参考油猴插件 V6.3.2 优化版）
// 核心改进：收缩检测区域 + 排除侧边栏 + 精确关键词匹配

(function() {
  'use strict';

  // ==========================================
  //                全局配置参数
  // ==========================================
  const CONFIG = {
    // 检测频率（毫秒）
    checkInterval: 800,
    // 跳过后的冷却时间（毫秒）
    skipCooldown: 1500,
    // 需要跳过的内容类型
    skipTypes: {
      ad: true,           // 广告
      live: true,         // 直播
      shopping: true,     // 购物/带货
      promotion: true     // 推广
    },
    // 画质设置（保留功能）
    qualities: ["超清 4K", "超清 2K", "高清 1080P"],
    
    // 关键改进：可视检测区域限制
    viewportWidthRatio: 0.66,  // 只检测屏幕左侧 2/3 区域
    
    // 新增：右边栏检测区域（用于识别右侧有信息的视频）
    rightSidebarCheck: {
      enabled: true,        // 启用右侧检测
      widthRatio: 0.15,     // 右侧 15% 区域
      hasInteraction: true  // 检查是否有点赞/评论等交互元素
    },
    
    // 新增：检测左下角是否被主动隐藏（清屏模式特征 - 广告判定依据）
    bottomLeftHiddenCheck: {
      enabled: true,  // 启用检测
      selectors: [
        '[class*="user-info"]',
        '[class*="author-info"]',
        '[class*="nickname"]',
        '[class*="avatar"]'
      ]
    },
    
    // 精确的关键词匹配规则
    adKeywords: {
      exact: ['广告'],  // 精确匹配
      patterns: [
        /推广 | 赞助 | 立即 (了解 | 查看 | 领取 | 体验 | 下载 | 预约)|去看看|查看详情/,
        /限时 | 抢购 | 特价 | 优惠 | 折扣 | 券后价 | 到手价/,
        /[¥￥]\d+(\.\d+)?/  // 价格标识（如 ¥790）
      ]
    },
    liveKeywords: ['直播中', 'LIVE'],
    shoppingKeywords: ['购物', '购买', '商品', '购物车', '同款', '下单', '售价', '¥'],
    promotionKeywords: ['推广', '营销', '推荐'],
    
    // 精确的元素选择器（基于 data-e2e 和特定 class）
    skipSelectors: {
      ad: [
        '[data-e2e="ad"]',
        '[data-e2e="mix-ad"]'
      ],
      live: [
        '[data-e2e="live"]'
      ],
      shopping: [
        '[data-e2e="shopping"]',
        '[data-e2e="video-cart-entry"]'  // 购物车入口
      ]
    },
    
    // 视频容器选择器
    videoContainerSelector: '[data-e2e="feed-container"]',
    // 划走动作延迟（毫秒）
    swipeDelay: 600,
    // 连续检测次数阈值
    detectionThreshold: 1,  // 油猴插件使用单次检测，因为已经很精确了
    // 视频变化检测延迟（毫秒）
    videoChangeDelay: 2000,
    // 元素尺寸限制（防止误判）
    maxElementSize: {
      ad: { width: 90, height: 40 },      // 广告标签通常很小
      promotion: { width: 200, height: 60 },  // 推广文案限制
      shopping: { width: 350, height: 100 }   // 购物链接限制
    }
  };

  // ==========================================
  //                全局状态变量
  // ==========================================
  let state = {
    isEnabled: true,
    currentVideoIndex: 0,
    skippedCount: 0,
    lastCheckTime: 0,
    consecutiveDetections: 0,
    lastVideoId: null,
    isVideoChanging: false,
    currentContentType: null,
    isSkipping: false,          // 是否正在执行跳过动作
    skipCooldownEnd: 0,         // 冷却结束时间
    lastVideoSrc: '',           // 上一个视频源
    isQualityChecked: false,    // 画质是否已检查
    isDetectionPaused: false,   // 检测是否暂停（用户按了上键）
    detectionPauseEnd: 0        // 检测暂停结束时间
  };

  /**
   * 工具函数：模拟键盘方向键下按
   */
  function simulateKeyDown() {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
    console.log('[抖音优化] 执行跳过');
  }

  /**
   * 关键改进：元素是否在可视区域内（收缩至左侧 2/3）
   * 侧边栏通常在右侧，这样可以物理隔离侧边栏干扰
   */
  function isElementInViewport(el) {
    if (!el || !el.getBoundingClientRect) return false;
    
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    return (
      rect.top >= 0 && 
      rect.bottom <= windowHeight &&
      rect.left < windowWidth * CONFIG.viewportWidthRatio &&  // 只检测左侧 2/3
      rect.width > 10 && 
      rect.height > 10
    );
  }

  /**
   * 新增：检查元素是否在右侧边栏区域
   */
  function isElementInRightSidebar(el) {
    if (!el || !el.getBoundingClientRect) return false;
    
    const rect = el.getBoundingClientRect();
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    const rightBoundary = windowWidth * (1 - CONFIG.rightSidebarCheck.widthRatio);
    
    // 元素在右侧 15% 区域内
    return rect.left >= rightBoundary;
  }

  /**
   * 新增：检查右侧边栏是否有交互信息（点赞/评论/收藏等）
   */
  function hasRightSidebarInteraction() {
    if (!CONFIG.rightSidebarCheck.enabled) return false;
    
    // 查找右侧边栏的交互元素
    const interactionSelectors = [
      '[class*="like"]',      // 点赞
      '[class*="comment"]',   // 评论
      '[class*="collect"]',   // 收藏
      '[class*="share"]',     // 分享
      '.interaction-bar',     // 交互栏
      '[data-e2e*="bar"]'     // 各种 bar
    ];
    
    for (const selector of interactionSelectors) {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (isElementInRightSidebar(el)) {
          // 检查是否有数字（表示有互动量）
          const text = el.innerText || '';
          if (/\d/.test(text)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * 检测左下角信息是否被主动隐藏（清屏模式特征）
   * 注意：不是我们去隐藏，而是检测创作者是否隐藏了左下角信息
   */
  function isBottomLeftHidden() {
    if (!CONFIG.bottomLeftHiddenCheck.enabled) return false;
    
    let shouldHaveElements = 0;
    let hiddenCount = 0;
    
    for (const selector of CONFIG.bottomLeftHiddenCheck.selectors) {
      const elements = document.querySelectorAll(selector);
      shouldHaveElements += elements.length;
      
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        // 检查是否在左下角区域（底部 30%，左侧 30%）
        if (rect.bottom >= windowHeight * 0.7 && rect.left < windowWidth * 0.3) {
          // 检查是否被隐藏（透明度、display 等）
          const style = window.getComputedStyle(el);
          if (style.opacity === '0' || 
              style.display === 'none' || 
              style.visibility === 'hidden') {
            hiddenCount++;
          }
        }
      }
    }
    
    // 如果应该有元素但都被隐藏了，说明是清屏模式
    return shouldHaveElements > 0 && hiddenCount === shouldHaveElements;
  }

  /**
   * 检查元素是否属于侧边栏（二次保险）
   */
  function isElementInSidebar(el) {
    if (!el) return false;
    
    // 检查是否属于侧边栏容器
    const sidebarSelectors = [
      '[class*="drawer"]',
      '[class*="sideslip"]',
      '[class*="UserPanel"]',
      '[class*="side"]',
      '[class*="panel"]'
    ];
    
    for (const selector of sidebarSelectors) {
      if (el.closest(selector)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 获取当前视频的唯一标识
   */
  function getCurrentVideoId() {
    const videoElement = document.querySelector('video');
    const authorElement = document.querySelector('[data-e2e="userinfo"]');
    
    if (videoElement && authorElement) {
      return `${authorElement.innerText}_${videoElement.currentTime.toFixed(0)}`;
    }
    
    return window.location.href + '_' + Math.floor(Date.now() / 1000);
  }

  /**
   * 检查视频是否发生了变化
   */
  function hasVideoChanged() {
    const currentVideoId = getCurrentVideoId();
    if (currentVideoId !== state.lastVideoId) {
      state.lastVideoId = currentVideoId;
      state.consecutiveDetections = 0;
      state.currentContentType = null;
      state.isVideoChanging = true;
      
      setTimeout(() => {
        state.isVideoChanging = false;
      }, CONFIG.videoChangeDelay);
      
      console.log('[抖音优化] 检测到视频切换，等待', CONFIG.videoChangeDelay / 1000, '秒');
      return true;
    }
    return false;
  }

  /**
   * 显示 Toast 通知
   */
  function showToast(message) {
    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.className = 'douyin-optimizer-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      animation: fadeInOut 3s ease-in-out;
      pointer-events: none;
    `;
    toast.textContent = message;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        10% { opacity: 1; transform: translateX(-50%) translateY(0); }
        90% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  /**
   * 监听键盘上键，暂停检测让用户重新观看
   */
  function setupKeyUpListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
        // 用户按下上键，暂停检测 10 秒
        state.isDetectionPaused = true;
        state.detectionPauseEnd = Date.now() + 10000; // 10秒后恢复检测
        
        console.log('[抖音优化] 检测到上键，暂停检测 10 秒');
        showToast('已暂停检测，可以重新观看视频');
        
        // 10秒后自动恢复检测
        setTimeout(() => {
          state.isDetectionPaused = false;
          console.log('[抖音优化] 检测已恢复');
        }, 10000);
      }
    });
  }

  /**
   * 执行跳过操作（带冷却机制）
   */
  function executeSkip(contentType) {
    if (state.isSkipping || Date.now() < state.skipCooldownEnd) {
      return false;  // 正在跳过或冷却中
    }
    
    state.isSkipping = true;
    state.currentContentType = contentType;
    
    console.log(`[抖音优化] 发现${contentType}内容，执行跳过`);
    
    // 显示 Toast 通知
    const typeNames = {
      ad: '广告',
      live: '直播',
      shopping: '购物',
      promotion: '推广'
    };
    const typeName = typeNames[contentType] || '内容';
    showToast(`检测到${typeName}行为，执行跳过`);
    
    // 模拟键盘方向键下按
    simulateKeyDown();
    
    // 同时模拟滚轮滚动（辅助）
    const scrollStep = window.innerHeight * 0.9;
    window.scrollBy({
      top: scrollStep,
      left: 0,
      behavior: 'smooth'
    });

    // 更新状态
    state.skippedCount++;
    state.consecutiveDetections = 0;
    state.currentContentType = null;
    state.skipCooldownEnd = Date.now() + CONFIG.skipCooldown;  // 设置冷却时间
    
    setTimeout(() => {
      state.isSkipping = false;
    }, CONFIG.skipCooldown);
    
    return true;
  }

  /**
   * 核心检测函数：广告检测（参考油猴插件精确算法 + 增强版）
   */
  function detectAd() {
    if (!CONFIG.skipTypes.ad) return false;
    
    // 方法 1: 检查精确的元素选择器
    for (const selector of CONFIG.skipSelectors.ad) {
      const element = document.querySelector(selector);
      if (element && isElementInViewport(element) && !isElementInSidebar(element)) {
        console.log('[抖音优化] 找到广告元素:', selector);
        return executeSkip('ad');
      }
    }
    
    // 方法 2: 扫描页面上的按钮和文本标签
    const buttons = document.querySelectorAll('button, a, div, span');
    for (let i = 0; i < buttons.length; i++) {
      const el = buttons[i];
      
      // 不在可视区域或属于侧边栏，跳过
      if (!isElementInViewport(el) || isElementInSidebar(el)) {
        continue;
      }
      
      const text = (el.innerText || '').trim();
      const cleanText = text.replace(/\s+/g, '');
      
      // 精确匹配「广告」标签（严格尺寸限制）
      if (cleanText === '广告' && 
          el.offsetWidth < CONFIG.maxElementSize.ad.width && 
          el.offsetHeight < CONFIG.maxElementSize.ad.height) {
        console.log('[抖音优化] 发现广告标签');
        return executeSkip('ad');
      }
      
      // 正则匹配推广行为（严格尺寸和长度限制）
      if (text.length < 20 && 
          el.offsetWidth < CONFIG.maxElementSize.promotion.width && 
          el.offsetHeight < CONFIG.maxElementSize.promotion.height) {
        for (const pattern of CONFIG.adKeywords.patterns) {
          if (pattern.test(text)) {
            console.log('[抖音优化] 发现广告行为:', text);
            return executeSkip('ad');
          }
        }
      }
    }
    
    // 方法 3: 新增 - 检查右侧边栏是否有交互信息 + 左下角是否被隐藏（清屏模式）
    // 如果右侧有点赞/评论等，且左下角被主动隐藏（清屏模式），判定为广告
    if (hasRightSidebarInteraction() && isBottomLeftHidden()) {
      console.log('[抖音优化] 右侧有交互 + 左下角被隐藏（清屏模式）');
      return executeSkip('ad');
    }
    
    // 方法 4: 仅右侧有交互，但包含明显广告关键词
    if (hasRightSidebarInteraction()) {
      // 检查视频中是否有广告关键词
      const videoTitle = document.title || '';
      const pageText = document.body.innerText;
      
      for (const pattern of CONFIG.adKeywords.patterns) {
        if (pattern.test(videoTitle) || pattern.test(pageText)) {
          console.log('[抖音优化] 右侧有交互 + 广告特征');
          return executeSkip('ad');
        }
      }
    }
    
    return false;
  }

  /**
   * 核心检测函数：购物内容检测
   */
  function detectShopping() {
    if (!CONFIG.skipTypes.shopping) return false;
    
    // 方法 1: 检查购物车入口
    const cart = document.querySelector('[data-e2e="video-cart-entry"]');
    if (cart && isElementInViewport(cart) && !isElementInSidebar(cart)) {
      console.log('[抖音优化] 发现购物车入口');
      return executeSkip('shopping');
    }
    
    // 方法 2: XPath 查找购物相关文本
    const xpath = "//*[contains(text(), '购物')]";
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    
    for (let i = 0; i < result.snapshotLength; i++) {
      const el = result.snapshotItem(i);
      
      if (!isElementInViewport(el) || isElementInSidebar(el)) {
        continue;
      }
      
      const txt = el.innerText.trim();
      const pTxt = el.parentElement ? el.parentElement.innerText.trim() : "";
      
      // 排除「购物车」字样（避免误判）
      if (txt.includes("车") || pTxt.includes("车")) {
        continue;
      }
      
      const combinedText = txt + " " + pTxt;
      
      // 包含购物特征词
      if (combinedText.includes('|') || 
          combinedText.includes('销量') || 
          combinedText.includes('评价') || 
          combinedText.includes('同款') || 
          combinedText.includes('推荐') || 
          combinedText.includes('抢购')) {
        
        if (el.offsetWidth < CONFIG.maxElementSize.shopping.width && 
            el.offsetHeight < CONFIG.maxElementSize.shopping.height &&
            el.offsetParent !== null) {
          console.log('[抖音优化] 发现购物链接');
          return executeSkip('shopping');
        }
      }
    }
    
    return false;
  }

  /**
   * 核心检测函数：直播内容检测
   */
  function detectLive() {
    if (!CONFIG.skipTypes.live) return false;
    
    // XPath 查找「直播中」
    const xpath = "//*[text()='直播中']";
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    
    for (let i = 0; i < result.snapshotLength; i++) {
      const el = result.snapshotItem(i);
      
      if (isElementInViewport(el) && 
          !isElementInSidebar(el) && 
          el.offsetParent !== null) {
        console.log('[抖音优化] 发现直播中');
        return executeSkip('live');
      }
    }
    
    return false;
  }

  /**
   * 综合内容检测入口
   */
  function checkContent() {
    // 冷却中或跳过中，不检测
    if (state.isSkipping || Date.now() < state.skipCooldownEnd) {
      return true;
    }
    
    // 检测被暂停（用户按了上键），不检测
    if (state.isDetectionPaused || Date.now() < state.detectionPauseEnd) {
      return true;
    }
    
    // 视频切换中，不检测
    if (state.isVideoChanging) {
      return false;
    }
    
    // 按优先级检测：广告 > 购物 > 直播
    if (detectAd()) {
      return true;
    }
    
    if (detectShopping()) {
      return true;
    }
    
    if (detectLive()) {
      return true;
    }
    
    return false;
  }

  /**
   * 执行划走动作（优化版）
   */
  function swipeUp() {
    if (!state.currentContentType) {
      state.currentContentType = 'unknown';
    }
    
    console.log(`[抖音优化] 执行跳过操作（类型：${state.currentContentType}）`);
    
    // 方法 1: 模拟键盘方向键下按（最可靠）
    const arrowDownEvent = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(arrowDownEvent);
    
    // 方法 2: 同时模拟滚轮滚动（辅助）
    const scrollStep = window.innerHeight * 0.9;
    window.scrollBy({
      top: scrollStep,
      left: 0,
      behavior: 'smooth'
    });

    // 更新状态
    state.skippedCount++;
    state.consecutiveDetections = 0;
    state.currentContentType = null;
    state.retryCount = 0;
    
    console.log(`[抖音优化] 已跳过 ${state.skippedCount} 个${state.currentContentType || '内容'}`);
  }

  /**
   * 主检测循环
   */
  function startDetection() {
    console.log('[抖音优化] V6.3.2 参考版启动 - 跳过直播/广告/购物/推广');
    console.log('[抖音优化] 检测区域：屏幕左侧', Math.round(CONFIG.viewportWidthRatio * 100), '%');
    console.log('[抖音优化] 配置:', JSON.stringify(CONFIG.skipTypes, null, 2));
    
    // 初始延迟，等待页面完全加载
    setTimeout(() => {
      setInterval(() => {
        // 首先检查是否在正确的页面
        if (!window.location.href.includes('douyin.com')) {
          return;
        }
        
        // 执行内容检测
        checkContent();
        
        state.lastCheckTime = Date.now();
      }, CONFIG.checkInterval);
    }, 2000);
  }

  /**
   // 监听来自 popup 的消息
   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
       if (request.action === 'settingsUpdated') {
           console.log('[抖音优化] 设置已更新:', request.settings);
           
           // 更新全局配置
           CONFIG.enabled = request.settings.enabled;
           CONFIG.contentTypes.ad.enabled = request.settings.skipAd;
           CONFIG.contentTypes.live.enabled = request.settings.skipLive;
           CONFIG.contentTypes.shopping.enabled = request.settings.skipShopping;
           CONFIG.contentTypes.promotion.enabled = request.settings.skipPromotion;
           
           // 如果插件被禁用，清除所有标记
           if (!CONFIG.enabled) {
               clearInterval(detectionTimer);
               detectionTimer = null;
               console.log('[抖音优化] 插件已禁用，停止检测');
           } else if (!detectionTimer) {
               // 如果插件被启用，重新启动检测
               startDetection();
           }
           
           sendResponse({ success: true });
       }
       return true;
   });
   */
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleExtension') {
        state.isEnabled = request.enabled;
        console.log('[抖音广告跳过] 扩展已', state.isEnabled ? '启用' : '禁用');
        sendResponse({ success: true });
      } else if (request.action === 'getStatus') {
        sendResponse({
          enabled: state.isEnabled,
          skippedCount: state.skippedCount
        });
      }
      return true;
    });
  }

  /**
   * 初始化
   */
  function init() {
    console.log('[抖音广告跳过] 插件初始化');
    
    // 设置消息监听
    setupMessageListener();
    
    // 设置上键监听（暂停检测）
    setupKeyUpListener();
    
    // 等待页面加载完成后开始检测
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(startDetection, 2000);
      });
    } else {
      setTimeout(startDetection, 2000);
    }
  }

  // 启动插件
  init();
})();
