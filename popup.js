// 插件设置管理
const SETTINGS_KEY = 'douyin_optimizer_settings';

// 默认设置
const defaultSettings = {
    enabled: true,          // 总开关
    skipLive: true,         // 跳过直播
    skipAd: true,           // 跳过广告
    skipShopping: true,     // 跳过购物
    skipPromotion: true     // 跳过推广
};

// 从 localStorage 加载设置
function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get([SETTINGS_KEY], (result) => {
            const settings = result[SETTINGS_KEY] || defaultSettings;
            resolve(settings);
        });
    });
}

// 保存设置到 localStorage
function saveSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
            // 通知 content script 设置已更新
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'settingsUpdated',
                        settings: settings
                    });
                }
                resolve();
            });
        });
    });
}

// 同步设置到所有抖音标签页
function syncSettingsToAllTabs(settings) {
    chrome.tabs.query({ url: '*://*.douyin.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'settingsUpdated',
                settings: settings
            }).catch(() => {
                // 忽略错误（可能页面还未加载）
            });
        });
    });
}

// 初始化界面
async function initUI() {
    const settings = await loadSettings();
    
    // 设置开关状态
    document.getElementById('masterSwitch').checked = settings.enabled;
    document.getElementById('liveSwitch').checked = settings.skipLive;
    document.getElementById('adSwitch').checked = settings.skipAd;
    document.getElementById('shoppingSwitch').checked = settings.skipShopping;
    document.getElementById('promotionSwitch').checked = settings.skipPromotion;
    
    // 更新状态指示器
    updateStatusIndicator(settings.enabled);
    
    // 绑定事件监听
    bindEvents();
}

// 更新状态指示器
function updateStatusIndicator(enabled) {
    const indicator = document.getElementById('statusIndicator');
    if (enabled) {
        indicator.className = 'status-indicator status-active';
        indicator.textContent = '✅ 插件正在运行中';
    } else {
        indicator.className = 'status-indicator status-inactive';
        indicator.textContent = '❌ 插件已禁用';
    }
}

// 绑定开关事件
function bindEvents() {
    // 总开关
    document.getElementById('masterSwitch').addEventListener('change', async (e) => {
        const settings = await loadSettings();
        settings.enabled = e.target.checked;
        await saveSettings(settings);
        syncSettingsToAllTabs(settings);
        updateStatusIndicator(settings.enabled);
        
        // 如果禁用总开关，同时禁用所有子开关
        if (!settings.enabled) {
            ['liveSwitch', 'adSwitch', 'shoppingSwitch', 'promotionSwitch'].forEach(id => {
                document.getElementById(id).disabled = true;
            });
        } else {
            ['liveSwitch', 'adSwitch', 'shoppingSwitch', 'promotionSwitch'].forEach(id => {
                document.getElementById(id).disabled = false;
            });
        }
    });
    
    // 子开关
    document.getElementById('liveSwitch').addEventListener('change', async (e) => {
        const settings = await loadSettings();
        settings.skipLive = e.target.checked;
        await saveSettings(settings);
        syncSettingsToAllTabs(settings);
    });
    
    document.getElementById('adSwitch').addEventListener('change', async (e) => {
        const settings = await loadSettings();
        settings.skipAd = e.target.checked;
        await saveSettings(settings);
        syncSettingsToAllTabs(settings);
    });
    
    document.getElementById('shoppingSwitch').addEventListener('change', async (e) => {
        const settings = await loadSettings();
        settings.skipShopping = e.target.checked;
        await saveSettings(settings);
        syncSettingsToAllTabs(settings);
    });
    
    document.getElementById('promotionSwitch').addEventListener('change', async (e) => {
        const settings = await loadSettings();
        settings.skipPromotion = e.target.checked;
        await saveSettings(settings);
        syncSettingsToAllTabs(settings);
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initUI);
