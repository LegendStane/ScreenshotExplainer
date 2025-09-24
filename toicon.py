#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
from pathlib import Path
from PIL import Image, ImageDraw
import tkinter as tk
from tkinter import filedialog, messagebox


def select_image_file():
  root = tk.Tk()
  root.withdraw()
  
  filetypes = [
    ('图片文件', '*.png *.jpg *.jpeg'),
    ('PNG文件', '*.png'),
    ('JPEG文件', '*.jpg *.jpeg'),
    ('所有文件', '*.*')
  ]
  
  file_path = filedialog.askopenfilename(
    title="选择图片文件",
    filetypes=filetypes
  )
  
  root.destroy()
  return file_path


def validate_image_size(image_path):
  try:
    with Image.open(image_path) as img:
      width, height = img.size
      min_dimension = min(width, height)
      
      if min_dimension < 128:
        raise ValueError(f"图片尺寸不符合要求！最小边为{min_dimension}像素，需要至少128像素。")
      
      print(f"图片尺寸验证通过：{width}x{height}像素")
      return True
      
  except Exception as e:
    raise ValueError(f"无法读取图片文件：{e}")


def clear_icons_folder():
  icons_dir = Path("icons")
  
  if icons_dir.exists():
    shutil.rmtree(icons_dir)
    print("已清空icons")
  
  icons_dir.mkdir(exist_ok=True)
  print("已创建icons")


def create_circular_icon(image, target_size):
  """创建圆形图标，圆形直径等于图标边长，周围透明"""
  # 创建一个透明背景的图像
  icon = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
  
  # 将原图缩放到目标尺寸（圆形将铺满整个图标区域）
  resized_image = image.resize((target_size, target_size), Image.Resampling.LANCZOS)
  
  # 创建圆形遮罩，直径等于target_size
  mask = Image.new('L', (target_size, target_size), 0)
  draw = ImageDraw.Draw(mask)
  draw.ellipse((0, 0, target_size, target_size), fill=255)
  
  # 创建圆形图像
  circular_image = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
  circular_image.paste(resized_image, (0, 0))
  circular_image.putalpha(mask)
  
  return circular_image


def resize_to_square(image, target_size):
  """已弃用：使用create_circular_icon代替"""
  return create_circular_icon(image, target_size)


def generate_icons(image_path):
  sizes = [16, 24, 32, 48, 128]
  
  try:
    with Image.open(image_path) as original_image:
      if original_image.mode != 'RGBA':
        original_image = original_image.convert('RGBA')
      
      print(f"正在处理图片：{Path(image_path).name}")
      print(f"原始尺寸：{original_image.size}")
      
      for size in sizes:
        icon = resize_to_square(original_image, size)
        
        output_path = Path("icons") / f"icon{size}.png"
        icon.save(output_path, "PNG")
        
        print(f"已生成：{output_path} ({size}x{size})")
        
  except Exception as e:
    raise RuntimeError(f"生成图标时出错：{e}")


def main():
  """主函数"""
  print("=== Chrome扩展图标生成器 ===")
  print("请选择一张图片文件（PNG/JPEG/JPG格式）")
  print("要求：图片的最小边至少为128像素")
  
  try:
    # 1. 选择图片文件
    image_path = select_image_file()
    
    if not image_path:
      print("未选择文件，程序退出。")
      return
    
    print(f"已选择文件：{image_path}")
    
    # 2. 验证图片尺寸
    validate_image_size(image_path)
    
    # 3. 清空icons
    clear_icons_folder()
    
    # 4. 生成图标
    generate_icons(image_path)
    
    print("\n=== Chrome扩展图标生成完成！ ===")
    print("生成的圆形图标文件：")
    for size in [16, 24, 32, 48, 128]:
      print(f"  - icons/icon{size}.png (透明背景圆形)")
    
    # 显示成功消息框
    root = tk.Tk()
    root.withdraw()
    messagebox.showinfo("完成", "完成，请查看icons文件夹！")
    root.destroy()
    
  except ValueError as e:
    print(f"输入错误：{e}")
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("输入错误", str(e))
    root.destroy()
    
  except Exception as e:
    print(f"程序出错：{e}")
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("程序错误", f"程序执行时出错：{e}")
    root.destroy()


if __name__ == "__main__":
  main()
