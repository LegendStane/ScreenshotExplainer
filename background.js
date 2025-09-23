// 监听来自 manifest.json 的快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === "start_screenshot") {
    // 1. 查询当前活跃的标签页
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        
        // 检查是否是特殊页面（chrome://, file://, etc.）
        if (activeTab.url.startsWith('chrome://') || 
            activeTab.url.startsWith('chrome-extension://') ||
            activeTab.url.startsWith('edge://') ||
            activeTab.url.startsWith('about:') ||
            activeTab.url.startsWith('moz-extension://') ||
            activeTab.url.startsWith('file://')) {
          console.log("无法在特殊页面上运行扩展");
          return;
        }
        
        // 2. 先截取整个标签页
        chrome.tabs.captureVisibleTab(null, {format: 'png'}, (screenshotDataUrl) => {
          if (chrome.runtime.lastError) {
            console.error("截图失败:", chrome.runtime.lastError.message);
            return;
          }
          
          console.log("截图成功，开始选择区域");
          
          // 3. 向该标签页的内容脚本发送消息，启动区域选择
          chrome.tabs.sendMessage(activeTab.id, {
            action: "start_area_selection", 
            screenshot: screenshotDataUrl
          }, (response) => {
            // 检查是否有错误
            if (chrome.runtime.lastError) {
              console.error("发送消息时出错:", chrome.runtime.lastError.message);
              // 尝试重新注入内容脚本
              chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content.js']
              }, () => {
                if (chrome.runtime.lastError) {
                  console.error("注入内容脚本失败:", chrome.runtime.lastError.message);
                } else {
                  console.log("内容脚本已重新注入，重新发送消息");
                  // 重新发送消息
                  chrome.tabs.sendMessage(activeTab.id, {
                    action: "start_area_selection", 
                    screenshot: screenshotDataUrl
                  }, (response) => {
                    if (chrome.runtime.lastError) {
                      console.error("重新发送消息失败:", chrome.runtime.lastError.message);
                    } else {
                      console.log("区域选择已启动:", response);
                    }
                  });
                }
              });
            } else {
              console.log("区域选择已启动:", response);
            }
          });
        });
      }
    });
  }
});

// 监听来自content script的消息（处理截图区域选择结果）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "area_selected") {
    // 处理选定的区域截图
    handleAreaScreenshot(request.imageData, sender.tab.id);
    sendResponse({status: "ok", message: "区域截图已处理"});
  }
});

// 处理区域截图的函数
function handleAreaScreenshot(imageData, tabId) {
  // 保存到 chrome.storage.session
  chrome.storage.session.set({
    screenshot: imageData,
    timestamp: Date.now()
  }, () => {
    console.log("截图已保存到 session storage");
    
    // 通知 content script 复制到剪贴板
    chrome.tabs.sendMessage(tabId, {
      action: "copy_to_clipboard",
      imageData: imageData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("发送剪贴板消息失败:", chrome.runtime.lastError.message);
      } else {
        console.log("剪贴板复制结果:", response);
        if (response && response.status === "ok") {
          console.log("✅ 截图已成功保存并复制到剪贴板");
        } else {
          console.error("❌ 剪贴板复制失败:", response);
        }
      }
    });
  });
}

console.log("Background.js is running.");