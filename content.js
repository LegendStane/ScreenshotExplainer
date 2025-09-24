// 全局变量
let isSelectingArea = false;
let selectionOverlay = null;
let selectionBox = null;
let startX = 0;
let startY = 0;
let currentScreenshot = null;
let aiResultWindow = null;

// 默认窗口尺寸
const DEFAULT_WINDOW_SIZE = {
  width: 400,
  height: 500
};

// 保存窗口尺寸
async function saveWindowSize() {
  if (!aiResultWindow) return;
  
  try {
    const windowSize = {
      width: aiResultWindow.offsetWidth,
      height: aiResultWindow.offsetHeight
    };
    
    await chrome.storage.local.set({ 'ai_window_size': windowSize });
    console.log('AI窗口尺寸已保存:', windowSize);
  } catch (error) {
    console.error('保存窗口尺寸失败:', error);
  }
}

// 加载窗口尺寸
async function loadWindowSize() {
  try {
    const result = await chrome.storage.local.get(['ai_window_size']);
    if (result.ai_window_size) {
      console.log('AI窗口尺寸已加载:', result.ai_window_size);
      return result.ai_window_size;
    }
  } catch (error) {
    console.error('加载窗口尺寸失败:', error);
  }
  
  // 返回默认尺寸
  console.log('使用默认窗口尺寸:', DEFAULT_WINDOW_SIZE);
  return DEFAULT_WINDOW_SIZE;
}

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script 收到消息:", request);
  
  if (request.action === "start_area_selection") {
    try {
      currentScreenshot = request.screenshot;
      startAreaSelection();
      sendResponse({status: "ok", message: "区域选择已启动"});
    } catch (error) {
      console.error("启动区域选择时出错:", error);
      sendResponse({status: "error", message: "启动区域选择失败: " + error.message});
    }
  }
  
  if (request.action === "copy_to_clipboard") {
    try {
      copyToClipboard(request.imageData).then((result) => {
        sendResponse({status: "ok", message: result});
      }).catch((error) => {
        sendResponse({status: "error", message: "复制失败: " + error.message});
      });
    } catch (error) {
      sendResponse({status: "error", message: "复制失败: " + error.message});
    }
  }
  
  if (request.action === "ai_analysis_result") {
    try {
      // 显示AI分析结果
      showAIResult(request.result);
      sendResponse({status: "ok", message: "AI结果已显示"});
    } catch (error) {
      console.error("显示AI结果失败:", error);
      sendResponse({status: "error", message: "显示失败: " + error.message});
    }
  }
  
  return true; // 保持消息通道开放以支持异步响应
});

// 启动区域选择模式
function startAreaSelection() {
  if (isSelectingArea) {
    return; // 已经在选择模式中
  }
  
  isSelectingArea = true;
  createSelectionOverlay();
  document.body.style.cursor = 'crosshair';
}

// 创建选择覆盖层
function createSelectionOverlay() {
  // 创建全屏覆盖层
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'screenshot-selection-overlay';
  selectionOverlay.style.position = 'fixed';
  selectionOverlay.style.top = '0';
  selectionOverlay.style.left = '0';
  selectionOverlay.style.width = '100vw';
  selectionOverlay.style.height = '100vh';
  selectionOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  selectionOverlay.style.zIndex = '999999';
  selectionOverlay.style.cursor = 'crosshair';
  
  // 创建选择框
  selectionBox = document.createElement('div');
  selectionBox.style.position = 'absolute';
  selectionBox.style.border = '2px solid #ff0000';
  selectionBox.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  selectionBox.style.display = 'none';
  selectionBox.style.pointerEvents = 'none';
  
  selectionOverlay.appendChild(selectionBox);
  document.body.appendChild(selectionOverlay);
  
  // 添加事件监听器
  selectionOverlay.addEventListener('mousedown', onMouseDown);
  selectionOverlay.addEventListener('mousemove', onMouseMove);
  selectionOverlay.addEventListener('mouseup', onMouseUp);
  
  // 添加ESC键退出
  document.addEventListener('keydown', onKeyDown);
  
  // 添加提示信息
  showSelectionTip();
}

// 显示选择提示
function showSelectionTip() {
  const tip = document.createElement('div');
  tip.id = 'selection-tip';
  tip.style.position = 'fixed';
  tip.style.top = '20px';
  tip.style.left = '50%';
  tip.style.transform = 'translateX(-50%)';
  tip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  tip.style.color = 'white';
  tip.style.padding = '10px 20px';
  tip.style.borderRadius = '5px';
  tip.style.fontSize = '14px';
  tip.style.zIndex = '1000000';
  tip.innerText = '拖动鼠标选择截图区域，按ESC取消';
  
  document.body.appendChild(tip);
  
  // 3秒后自动消失
  setTimeout(() => {
    if (document.getElementById('selection-tip')) {
      tip.remove();
    }
  }, 3000);
}

// 鼠标按下事件
function onMouseDown(e) {
  e.preventDefault();
  startX = e.clientX;
  startY = e.clientY;
  
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  selectionBox.style.display = 'block';
}

// 鼠标移动事件
function onMouseMove(e) {
  if (selectionBox.style.display === 'block') {
    e.preventDefault();
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }
}

// 鼠标抬起事件
function onMouseUp(e) {
  e.preventDefault();
  
  if (selectionBox.style.display === 'block') {
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    // 检查选择区域是否足够大
    if (width > 10 && height > 10) {
      cropAndSaveScreenshot(left, top, width, height);
    } else {
      console.log("选择区域太小，取消截图");
    }
  }
  
  exitSelectionMode();
}

// 键盘事件（ESC退出）
function onKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    exitSelectionMode();
  }
}

// 退出选择模式
function exitSelectionMode() {
  isSelectingArea = false;
  document.body.style.cursor = '';
  
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
  
  if (selectionBox) {
    selectionBox = null;
  }
  
  const tip = document.getElementById('selection-tip');
  if (tip) {
    tip.remove();
  }
  
  document.removeEventListener('keydown', onKeyDown);
}

// 裁剪并保存截图
function cropAndSaveScreenshot(x, y, width, height) {
  if (!currentScreenshot) {
    console.error("没有可用的截图数据");
    return;
  }
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = function() {
    // 计算设备像素比
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // 调整坐标和尺寸以匹配实际截图
    const actualX = x * devicePixelRatio;
    const actualY = y * devicePixelRatio;
    const actualWidth = width * devicePixelRatio;
    const actualHeight = height * devicePixelRatio;
    
    // 设置canvas尺寸
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    // 裁剪图片
    ctx.drawImage(
      img,
      actualX, actualY, actualWidth, actualHeight,  // 源区域
      0, 0, actualWidth, actualHeight                // 目标区域
    );
    
    // 转换为base64
    const croppedImageData = canvas.toDataURL('image/png');
    
    console.log("截图已裁剪，大小:", width, 'x', height);
    
    // 发送到background script进行保存
    chrome.runtime.sendMessage({
      action: "area_selected",
      imageData: croppedImageData
    }, (response) => {
      console.log("截图处理响应:", response);
    });
    
    // 立即显示AI分析窗口（等待状态）
    showAIWaiting().then(() => {
      console.log("AI等待窗口已显示");
    });
    
    // 发送AI分析请求
    chrome.runtime.sendMessage({
      action: "analyze_image",
      imageData: croppedImageData
    }, (response) => {
      console.log("AI分析请求响应:", response);
    });
  };
  
  img.onerror = function() {
    console.error("加载截图失败");
  };
  
  img.src = currentScreenshot;
}

// 复制图片到剪贴板的函数
async function copyToClipboard(imageData) {
  try {
    console.log("开始复制到剪贴板...");
    
    // 检查剪贴板API是否可用
    if (!navigator.clipboard) {
      throw new Error("navigator.clipboard 不可用");
    }
    
    if (!navigator.clipboard.write) {
      throw new Error("navigator.clipboard.write 不可用");
    }
    
    console.log("剪贴板API可用，开始转换图片数据...");
    
    // 将base64转换为blob
    const response = await fetch(imageData);
    const blob = await response.blob();
    
    console.log("图片数据转换完成，blob大小:", blob.size, "类型:", blob.type);
    
    // 创建ClipboardItem
    const clipboardItem = new ClipboardItem({ 
      'image/png': blob 
    });
    
    console.log("ClipboardItem创建完成，开始写入剪贴板...");
    
    // 写入剪贴板
    await navigator.clipboard.write([clipboardItem]);
    
    console.log("截图已成功复制到剪贴板");
    return "截图已复制到剪贴板";
    
  } catch (error) {
    console.error("复制到剪贴板失败:", error);
    console.error("错误详情:", error.name, error.message);
    
    // 尝试替代方案：复制base64文本
    try {
      console.log("尝试复制base64文本作为替代方案...");
      await navigator.clipboard.writeText(imageData);
      console.log("截图base64数据已复制到剪贴板");
      showNotification("截图数据已复制（base64格式）", "warning");
      return "截图数据已复制到剪贴板（base64格式）";
    } catch (textError) {
      console.error("复制文本到剪贴板也失败:", textError);
      showNotification("复制到剪贴板失败: " + error.message, "error");
      throw new Error("剪贴板操作完全失败: " + error.message);
    }
  }
}

// 显示通知的函数
function showNotification(message, type = "info") {
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.padding = '12px 24px';
  notification.style.borderRadius = '6px';
  notification.style.fontSize = '14px';
  notification.style.fontWeight = 'bold';
  notification.style.zIndex = '1000001';
  notification.style.minWidth = '200px';
  notification.style.textAlign = 'center';
  
  // 根据类型设置颜色
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
      break;
    case 'error':
      notification.style.backgroundColor = '#f44336';
      notification.style.color = 'white';
      break;
    case 'warning':
      notification.style.backgroundColor = '#ff9800';
      notification.style.color = 'white';
      break;
    default:
      notification.style.backgroundColor = '#2196F3';
      notification.style.color = 'white';
  }
  
  notification.innerText = message;
  document.body.appendChild(notification);
  
  // 3秒后自动消失
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// 创建AI结果显示窗口
async function createAIResultWindow() {
  // 如果已存在窗口，先关闭并保存尺寸
  if (aiResultWindow) {
    await saveWindowSize();
    aiResultWindow.remove();
  }
  
  // 加载保存的窗口尺寸
  const savedSize = await loadWindowSize();
  
  // 创建主窗口容器
  aiResultWindow = document.createElement('div');
  aiResultWindow.id = 'ai-result-window';
  aiResultWindow.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    width: ${savedSize.width}px;
    height: ${savedSize.height}px;
    min-width: 300px;
    min-height: 200px;
    max-height: 600px;
    background: #1a1a1a;
    border: 2px solid #666;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    z-index: 1000002;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
  `;
  
  // 创建标题栏
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    background: #2a2a2a;
    color: #e0e0e0;
    padding: 10px 12px;
    font-weight: 500;
    font-size: 13px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
    border-bottom: 1px solid #444;
  `;
  titleBar.innerHTML = `
    <span>解析</span>
    <span id="close-ai-window" style="cursor: pointer; font-size: 16px; color: #ccc; hover: #fff;">&times;</span>
  `;
  
  // 创建内容区域
  const contentArea = document.createElement('div');
  contentArea.id = 'ai-content-area';
  contentArea.style.cssText = `
    padding: 15px;
    flex: 1;
    overflow-y: auto;
    line-height: 1.5;
    font-size: 13px;
    background: #1a1a1a;
    color: #e0e0e0;
  `;
  
  // 添加到窗口
  aiResultWindow.appendChild(titleBar);
  aiResultWindow.appendChild(contentArea);
  
  // 创建调整大小的拖拽句柄
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    cursor: se-resize;
    background: linear-gradient(-45deg, transparent 40%, #888 40%, #888 60%, transparent 60%);
    z-index: 10;
  `;
  aiResultWindow.appendChild(resizeHandle);
  
  document.body.appendChild(aiResultWindow);
  
  // 添加关闭事件
  titleBar.querySelector('#close-ai-window').onclick = async () => {
    await saveWindowSize(); // 关闭前保存窗口尺寸
    aiResultWindow.remove();
    aiResultWindow = null;
  };
  
  // 添加拖拽功能
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  titleBar.onmousedown = (e) => {
    // 只在点击标题栏文字区域时才启用拖拽，避免干扰关闭按钮
    if (e.target.id === 'close-ai-window') return;
    
    isDragging = true;
    dragOffset.x = e.clientX - aiResultWindow.offsetLeft;
    dragOffset.y = e.clientY - aiResultWindow.offsetTop;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
  };
  
  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    aiResultWindow.style.left = (e.clientX - dragOffset.x) + 'px';
    aiResultWindow.style.top = (e.clientY - dragOffset.y) + 'px';
    aiResultWindow.style.right = 'auto'; // 取消right定位
  }
  
  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  }
  
  // 添加调整大小功能
  let isResizing = false;
  let resizeStartPos = { x: 0, y: 0 };
  let resizeStartSize = { width: 0, height: 0 };
  
  resizeHandle.onmousedown = (e) => {
    e.preventDefault();
    e.stopPropagation(); // 防止触发拖拽
    isResizing = true;
    resizeStartPos.x = e.clientX;
    resizeStartPos.y = e.clientY;
    resizeStartSize.width = aiResultWindow.offsetWidth;
    resizeStartSize.height = aiResultWindow.offsetHeight;
    
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
  };
  
  function onResize(e) {
    if (!isResizing) return;
    e.preventDefault();
    
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    
    const newWidth = Math.max(300, resizeStartSize.width + deltaX);
    const newHeight = Math.max(200, resizeStartSize.height + deltaY);
    
    aiResultWindow.style.width = newWidth + 'px';
    aiResultWindow.style.height = newHeight + 'px';
  }
  
  function stopResize() {
    if (isResizing) {
      // 调整大小完成后保存尺寸
      saveWindowSize();
    }
    isResizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
  }
  
  return contentArea;
}

// 显示等待状态
async function showAIWaiting() {
  const contentArea = await createAIResultWindow();
  contentArea.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <p style="margin-top: 15px; color: #666;">正在分析图片，请稍候...</p>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
}

// 显示AI结果
// 简单但功能完整的 Markdown 解析器
function renderMarkdownToHTML(text) {
  if (!text) return '';
  
  console.log('使用简单 Markdown 解析器渲染:', text.substring(0, 100) + '...');
  
  let html = text
    // 处理代码块 (``` 包围的多行代码)
    .replace(/```([\s\S]*?)```/g, function(match, code) {
      return '<pre style="background: #1a1a1a; color: #f8f8f2; padding: 12px; margin: 8px 0; border-radius: 6px; overflow-x: auto; font-family: Consolas, Monaco, monospace; border: 1px solid #333;"><code>' + 
        code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
        '</code></pre>';
    })
    
    // 处理标题 (必须在行首)
    .replace(/^#### (.*$)/gim, '<h4 style="color: #4CAF50; margin: 10px 0 6px 0; font-size: 15px; font-weight: bold;">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 style="color: #4CAF50; margin: 12px 0 8px 0; font-size: 17px; font-weight: bold;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="color: #4CAF50; margin: 14px 0 10px 0; font-size: 19px; font-weight: bold;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="color: #4CAF50; margin: 16px 0 12px 0; font-size: 21px; font-weight: bold;">$1</h1>')
    
    // 处理引用 (> 开头的行)
    .replace(/^> (.*$)/gim, '<blockquote style="border-left: 4px solid #4CAF50; padding: 8px 12px; margin: 8px 0; background: #2a2a2a; color: #ccc; font-style: italic; border-radius: 4px;">$1</blockquote>')
    
    // 处理无序列表 (- 或 * 开头)
    .replace(/^[\s]*[-\*]\s+(.*)$/gim, '<li style="margin: 3px 0; color: #e0e0e0; list-style-type: disc;">$1</li>')
    
    // 处理有序列表 (数字. 开头)
    .replace(/^[\s]*\d+\.\s+(.*)$/gim, '<li style="margin: 3px 0; color: #e0e0e0;">$1</li>')
    
    // 处理粗体 **文本**
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fff; font-weight: bold;">$1</strong>')
    
    // 处理斜体 *文本*
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em style="color: #ccc; font-style: italic;">$1</em>')
    
    // 处理删除线 ~~文本~~
    .replace(/~~(.*?)~~/g, '<del style="color: #888; text-decoration: line-through;">$1</del>')
    
    // 处理行内代码 `代码`
    .replace(/`([^`\n]+?)`/g, '<code style="background: #1a1a1a; color: #f8f8f2; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, monospace; font-size: 0.9em;">$1</code>')
    
    // 处理链接 [文本](URL)
    .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a style="color: #4CAF50; text-decoration: underline; cursor: pointer;" target="_blank" href="$2">$1</a>')
    
    // 处理图片 ![alt](src)
    .replace(/!\[([^\]]*?)\]\(([^)]+?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; border-radius: 4px; margin: 4px 0;" />')
    
    // 处理水平分割线 --- 或 ***
    .replace(/^[-*]{3,}$/gim, '<hr style="border: none; border-top: 2px solid #4CAF50; margin: 16px 0; opacity: 0.6;" />')
    
    // 处理换行
    .replace(/\n/g, '<br>');
  
  // 将连续的 <li> 包装在 <ul> 或 <ol> 中
  html = html.replace(/(<li[^>]*>.*?<\/li>(?:\s*<br>\s*<li[^>]*>.*?<\/li>)*)/g, function(match) {
    const items = match.replace(/<br>/g, '');
    // 检查是否是有序列表（通过查看原始文本是否包含数字）
    const isOrdered = /^\d+\./.test(text);
    const listTag = isOrdered ? 'ol' : 'ul';
    return `<${listTag} style="margin: 8px 0; padding-left: 20px; color: #e0e0e0;">${items}</${listTag}>`;
  });
  
  // 将连续的 <blockquote> 合并
  html = html.replace(/(<blockquote[^>]*>.*?<\/blockquote>)(\s*<br>\s*<blockquote[^>]*>.*?<\/blockquote>)*/g, function(match) {
    const quotes = match.replace(/<br>/g, '').replace(/<\/blockquote><blockquote[^>]*>/g, '<br>');
    return quotes;
  });
  
  // 清理多余的 <br>
  html = html
    .replace(/(<\/ul>)<br>/g, '$1')
    .replace(/(<\/ol>)<br>/g, '$1')
    .replace(/(<\/blockquote>)<br>/g, '$1')
    .replace(/(<\/h[1-6]>)<br>/g, '$1')
    .replace(/(<\/pre>)<br>/g, '$1')
    .replace(/<br>(<ul)/g, '$1')
    .replace(/<br>(<ol)/g, '$1')
    .replace(/<br>(<blockquote)/g, '$1')
    .replace(/<br>(<h[1-6])/g, '$1')
    .replace(/<br>(<pre)/g, '$1');
  
  console.log('Markdown 解析完成，HTML长度:', html.length);
  return html;
}

// 使用简单 Markdown 渲染器
async function renderMarkdownWithEasyMarkdown(text) {
  if (!text) return '';
  
  try {
    // 直接使用我们的简单 Markdown 解析器
    return renderMarkdownToHTML(text);
  } catch (error) {
    console.error('Markdown 渲染失败，使用纯文本:', error);
    // 如果连简单解析器都失败了，就使用最基本的处理
    return text.replace(/\n/g, '<br>');
  }
}

async function showAIResult(result) {
  const contentArea = document.getElementById('ai-content-area');
  if (!contentArea) return;
  
  if (result.success) {
    console.log('Displaying AI result with easy-markdown rendering...');
    
    // 使用 easy-markdown 渲染 Markdown 内容
    const renderedContent = await renderMarkdownWithEasyMarkdown(result.content);
    
    contentArea.innerHTML = `
      <div>
        <h4 style="margin: 0 0 10px 0; color: #4CAF50; font-size: 14px;">🤖 AI分析结果</h4>
        <div id="ai-result-content" style="background: #2a2a2a; padding: 12px; border-radius: 6px; border-left: 3px solid #4CAF50; color: #e0e0e0; line-height: 1.6; overflow-wrap: break-word; word-wrap: break-word;">
          ${renderedContent}
        </div>
        ${result.usage ? `
          <div style="margin-top: 12px; padding: 8px; background: #1f2a1f; border-radius: 4px; font-size: 11px; color: #90ee90;">
            <strong>📊 使用统计：</strong> 
            输入Token: ${result.usage.prompt_tokens || 'N/A'} | 
            输出Token: ${result.usage.completion_tokens || 'N/A'} | 
            总计: ${result.usage.total_tokens || 'N/A'}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    contentArea.innerHTML = `
      <div style="text-align: center;">
        <h4 style="margin: 0 0 10px 0; color: #ff6b6b; font-size: 14px;">❌ 分析失败</h4>
        <div style="background: #2a1a1a; padding: 12px; border-radius: 6px; border-left: 3px solid #ff6b6b; color: #ffcccb;">
          ${result.error}
        </div>
        <p style="margin-top: 12px; font-size: 11px; color: #999;">
          请检查网络连接和API配置
        </p>
      </div>
    `;
  }
}

console.log("Content.js is running.");