// 全局变量
let isSelectingArea = false;
let selectionOverlay = null;
let selectionBox = null;
let startX = 0;
let startY = 0;
let currentScreenshot = null;

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
      
      // 显示成功提示
      showNotification("截图已保存！正在复制到剪贴板...", "success");
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
    showNotification("截图已复制到剪贴板！可以粘贴使用", "success");
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

console.log("Content.js is running.");