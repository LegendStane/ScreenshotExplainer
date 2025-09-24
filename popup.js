// DOM元素
const configForm = document.getElementById('configForm');
const endpointInput = document.getElementById('endpoint');
const apiKeyInput = document.getElementById('apiKey');
const modelNameInput = document.getElementById('modelName');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const loadingDiv = document.getElementById('loading');
const statusDiv = document.getElementById('status');

// 默认配置
const DEFAULT_CONFIG = {
  endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  apiKey: "",
  modelName: "qwen3-vl-plus"
};

// 页面加载时获取当前配置
document.addEventListener('DOMContentLoaded', async () => {
  console.log("设置面板已加载");
  await loadCurrentConfig();
});

// 加载当前配置
async function loadCurrentConfig() {
  try {
    showLoading(true);
    
    const response = await chrome.runtime.sendMessage({
      action: "get_config"
    });
    
    if (response && response.status === "ok") {
      const config = response.config;
      
      // 填充表单
      endpointInput.value = config.endpoint || DEFAULT_CONFIG.endpoint;
      apiKeyInput.value = config.apiKey || "";
      modelNameInput.value = config.modelName || DEFAULT_CONFIG.modelName;
      
      console.log("配置已加载到表单");
    } else {
      throw new Error("获取配置失败");
    }
  } catch (error) {
    console.error("加载配置失败:", error);
    showStatus("加载配置失败: " + error.message, "error");
    
    // 使用默认配置
    endpointInput.value = DEFAULT_CONFIG.endpoint;
    apiKeyInput.value = DEFAULT_CONFIG.apiKey;
    modelNameInput.value = DEFAULT_CONFIG.modelName;
  } finally {
    showLoading(false);
  }
}

// 保存配置函数
async function saveCurrentConfig() {
  try {
    showLoading(true);
    hideStatus();
    
    // 获取表单数据
    const newConfig = {
      endpoint: endpointInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      modelName: modelNameInput.value.trim()
    };
    
    // 验证配置
    if (!validateConfig(newConfig)) {
      return false;
    }
    
    console.log("保存配置:", { ...newConfig, apiKey: "***" });
    
    // 发送保存请求
    const response = await chrome.runtime.sendMessage({
      action: "save_config",
      config: newConfig
    });
    
    if (response && response.success) {
      showStatus("配置保存成功！", "success");
      console.log("配置保存成功");
      return true;
    } else {
      throw new Error(response.error || "保存失败");
    }
    
  } catch (error) {
    console.error("保存配置失败:", error);
    showStatus("❌ 保存失败: " + error.message, "error");
    return false;
  } finally {
    showLoading(false);
  }
}

// 强制保存配置（跳过验证，用于保存默认配置）
async function forceLoadCurrentConfig() {
  try {
    showLoading(true);
    hideStatus();
    
    // 获取表单数据，不进行验证
    const newConfig = {
      endpoint: endpointInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      modelName: modelNameInput.value.trim()
    };
    
    console.log("强制保存配置:", { ...newConfig, apiKey: newConfig.apiKey ? "***" : "(空)" });
    
    // 发送保存请求
    const response = await chrome.runtime.sendMessage({
      action: "save_config",
      config: newConfig
    });
    
    if (response && response.success) {
      console.log("默认配置保存成功");
      return true;
    } else {
      throw new Error(response.error || "保存失败");
    }
    
  } catch (error) {
    console.error("强制保存配置失败:", error);
    return false;
  } finally {
    showLoading(false);
  }
}

// 保存配置表单事件
configForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveCurrentConfig();
});

// 恢复默认配置
resetBtn.addEventListener('click', async () => {
  // 恢复默认值
  endpointInput.value = DEFAULT_CONFIG.endpoint;
  apiKeyInput.value = DEFAULT_CONFIG.apiKey;
  modelNameInput.value = DEFAULT_CONFIG.modelName;
  
  // 强制保存默认配置（跳过验证）
  const saveResult = await forceLoadCurrentConfig();
  
  if (saveResult) {
    showStatus("📋 已恢复默认设置并保存", "success");
  } else {
    showStatus("📋 已恢复默认配置，但保存失败", "error");
  }
});

// 验证配置
function validateConfig(config) {
  // 验证 endpoint URL
  try {
    const url = new URL(config.endpoint);
    if (!url.protocol.startsWith('http')) {
      showStatus("❌ API Endpoint必须是有效的HTTP/HTTPS地址", "error");
      return false;
    }
  } catch (error) {
    showStatus("❌ API Endpoint格式不正确", "error");
    return false;
  }
  
  // 验证 API Key
  if (!config.apiKey || config.apiKey.length < 10) {
    showStatus("❌ API Key不能为空且长度至少10位", "error");
    return false;
  }
  
  // 验证模型名称
  if (!config.modelName || config.modelName.length < 2) {
    showStatus("❌ 模型名称不能为空", "error");
    return false;
  }
  
  return true;
}

// 显示/隐藏加载状态
function showLoading(show) {
  if (show) {
    loadingDiv.style.display = 'block';
    saveBtn.disabled = true;
    resetBtn.disabled = true;
  } else {
    loadingDiv.style.display = 'none';
    saveBtn.disabled = false;
    resetBtn.disabled = false;
  }
}

// 显示状态信息
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  // 成功信息3秒后自动消失
  if (type === 'success') {
    setTimeout(() => {
      hideStatus();
    }, 3000);
  }
}

// 隐藏状态信息
function hideStatus() {
  statusDiv.style.display = 'none';
}

// 输入框实时验证
endpointInput.addEventListener('input', () => {
  if (endpointInput.value) {
    try {
      new URL(endpointInput.value);
      endpointInput.style.borderColor = '#4CAF50';
    } catch (error) {
      endpointInput.style.borderColor = '#f44336';
    }
  } else {
    endpointInput.style.borderColor = '#e1e5e9';
  }
});

apiKeyInput.addEventListener('input', () => {
  if (apiKeyInput.value.length >= 10) {
    apiKeyInput.style.borderColor = '#4CAF50';
  } else if (apiKeyInput.value.length > 0) {
    apiKeyInput.style.borderColor = '#ff9800';
  } else {
    apiKeyInput.style.borderColor = '#e1e5e9';
  }
});

modelNameInput.addEventListener('input', () => {
  if (modelNameInput.value.length >= 2) {
    modelNameInput.style.borderColor = '#4CAF50';
  } else {
    modelNameInput.style.borderColor = '#e1e5e9';
  }
});

console.log("Popup.js is running.");