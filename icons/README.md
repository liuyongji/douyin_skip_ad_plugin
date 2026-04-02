# 图标生成说明

由于需要依赖 canvas 库，建议使用以下方法之一生成 PNG 图标：

## 方法 1: 使用在线工具

1. 访问 https://cloudconvert.com/svg-to-png
2. 上传 `icons/icon16.svg`, `icons/icon48.svg`, `icons/icon128.svg`
3. 转换为 PNG 格式并保存到 icons 目录

## 方法 2: 使用 Node.js (需要安装 canvas)

```bash
npm install canvas
npm run generate-icons
```

## 方法 3: 使用简易图标（推荐）

如果只需要测试，可以暂时使用任何 16x16、48x48、128x128 的 PNG 图片，重命名为：
- `icon16.png`
- `icon48.png`
- `icon128.png`

或者修改 `manifest.json`，移除 icons 相关配置，这样插件也能正常运行（只是没有自定义图标）。

## 临时方案

在 manifest.json 中临时移除图标配置即可直接使用插件：

```json
{
  // ... 其他配置
  // 注释或删除 icons 和 action.default_icon 部分
}
```
