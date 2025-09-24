## 基于通义千问的截图解析浏览器扩展

---

### 功能

在配置通义千问API的前提下，可以使用快捷键在网页中截图，并在弹窗中自动解析。

### 使用方法

1. ```bash
   git clone https://github.com/LegendStane/ScreenshotExplainer
   ```

   将目录放在合适的位置，因为可能需要长期存放。

2. 设置icon(可选)

   ```bash
   pip install Pillow
   python toicon.py
   ```

   然后选择一张图片，自动制作为icon。

3. 安装扩展(要求浏览器为Chromium内核)

   1. 进入浏览器扩展管理界面，如 chrome://extensions 或 edge://extensions
   2. 开启开发者模式
   3. 点击"加载已解压的扩展程序"，选择项目目录
   4. 然后在扩展程序列表里就能看到图标了

4. 设置API

   1. 点击图标，输入API Endpoint(使用OpenAI兼容/HTTP方式调用，默认为阿里云百炼平台)和模型名称(默认为qwen3-vl-plus)
   2. 输入API Key；如果在阿里云百炼平台申请API，只修改这一条、不修改其他两个参数就能直接使用，申请地址：[链接](https://bailian.console.aliyun.com/)，在[设置]中选择API-Key
   3. 点击保存

5. 截图并解析

   按快捷键截图，Windows下为Ctrl+Shift+E，MacOS下为Command+Shift+E。截图后会跳出弹窗，等待解析完成即可。拖动弹窗右下角三角区域可改变其大小和形状。

