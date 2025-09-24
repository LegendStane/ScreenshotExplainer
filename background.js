// AI配置 - 动态配置管理
const DEFAULT_AI_CONFIG = {
  endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  apiKey: "",
  modelName: "qwen3-vl-plus"
};

// 当前使用的配置
let currentConfig = { ...DEFAULT_AI_CONFIG };

// 加载配置
async function loadConfig() {
  try {
    const stored = await chrome.storage.local.get(['ai_config']);
    if (stored.ai_config) {
      currentConfig = { ...DEFAULT_AI_CONFIG, ...stored.ai_config };
      console.log("配置已加载:", currentConfig);
    } else {
      console.log("使用默认配置:", currentConfig);
    }
  } catch (error) {
    console.error("加载配置失败:", error);
    currentConfig = { ...DEFAULT_AI_CONFIG };
  }
}

// 保存配置
async function saveConfig(newConfig) {
  try {
    await chrome.storage.local.set({ ai_config: newConfig });
    currentConfig = { ...DEFAULT_AI_CONFIG, ...newConfig };
    console.log("配置已保存:", currentConfig);
    return { success: true };
  } catch (error) {
    console.error("保存配置失败:", error);
    return { success: false, error: error.message };
  }
}

// 获取当前配置
function getCurrentConfig() {
  return { ...currentConfig };
}

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
  
  if (request.action === "analyze_image") {
    // 异步处理AI分析
    handleAIAnalysis(request.imageData, sender.tab.id);
    sendResponse({status: "ok", message: "AI分析已启动"});
  }
  
  if (request.action === "get_config") {
    // 返回当前配置
    sendResponse({status: "ok", config: getCurrentConfig()});
  }
  
  if (request.action === "save_config") {
    // 保存新配置
    saveConfig(request.config).then((result) => {
      sendResponse(result);
    }).catch((error) => {
      sendResponse({success: false, error: error.message});
    });
    return true; // 保持异步响应通道开放
  }
  
  return true; // 保持消息通道开放
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

// 处理AI分析请求
async function handleAIAnalysis(imageData, tabId) {
  try {
    console.log("开始处理AI分析请求...");
    
    // 调用AI API
    const result = await callAIAPI(imageData);
    
    // 将结果发送回content script
    chrome.tabs.sendMessage(tabId, {
      action: "ai_analysis_result",
      result: result
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("发送AI结果失败:", chrome.runtime.lastError.message);
      } else {
        console.log("AI结果已发送到content script");
      }
    });
    
  } catch (error) {
    console.error("AI分析处理失败:", error);
    
    // 发送错误结果
    chrome.tabs.sendMessage(tabId, {
      action: "ai_analysis_result",
      result: {
        success: false,
        error: "AI分析处理失败: " + error.message
      }
    });
  }
}

// AI API调用函数
async function callAIAPI(imageBase64) {
  try {
    console.log("开始调用AI API...");
    
    // 检查配置是否完整
    if (!currentConfig.endpoint || !currentConfig.apiKey || !currentConfig.modelName) {
      throw new Error("AI配置不完整，请在设置中配置endpoint、apiKey和modelName");
    }
    
    // 构建OpenAI兼容的请求
    const requestBody = {
      model: currentConfig.modelName,
      messages: [
        {
          role: "system",
          content: "你需要用简体中文帮助用户解释图片中的内容。由于可能没有后续对话，不要使用“可以再让我详细解释”等涉及用户后续交互的语句。回答用markdown格式给出，但不要使用行内公式和公式块。"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "这是需要解释的图片"
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    };
    
    console.log("发送AI请求...");
    
    const response = await fetch(currentConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentConfig.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("AI API响应:", data);
    
    // 提取AI回复内容
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      const aiResponse = data.choices[0].message.content;
      console.log("AI解释内容:", aiResponse);
      return {
        success: true,
        content: aiResponse,
        usage: data.usage || null
      };
    } else {
      throw new Error("API返回格式异常，找不到回复内容");
    }
    
  } catch (error) {
    console.error("AI API调用失败:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

console.log("Background.js is running.");

// 启动时加载配置
loadConfig();