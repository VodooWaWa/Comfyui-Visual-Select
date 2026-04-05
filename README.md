# ComfyUI Visual Select (视图选择器) v1.1.0

ComfyUI Visual Select 是一款旨在提升模型选择体验的 ComfyUI 前端扩展插件。它通过拦截原生的模型下拉列表，提供了一个直观、支持预览图和详细信息的模型可视化浏览器，帮助用户更高效地管理和选择模型。

Comfyui-Visual-Select EN：[Comfyui-Visual-Select README (EN)](https://github.com/VodooWaWa/Comfyui-Visual-Select/blob/main/README_EN.md)

封面图和元数据信息显示需要模型文件夹存在模型名同名的jpeg图片作为封面和info元数据信息文件，你可以手动选择一张封面图改名模型文件名同名即可显示。但是info元数据信息文件需要用civitai api做返回值JSON解析。

**搭配我的另一个仓库[Civitai-Download_Tool](https://github.com/VodooWaWa/Civitai-Download-Tool)里的工具，用于批量下载模型和自动生成封面与元数据信息（免费使用）可实现完美显示效果。</br>**
**【详情】按钮必须搭配该工具（需要捐赠版）的管理模型生成html才能实现，默认无html文件情况下隐藏该按钮，完全不影响插件使用。**

插件使用视频教程B站链接：https://www.bilibili.com/video/BV1kfDTBXEad/

## 🎨UI界面预览

![image](Example%20image/VisualSelect.png)
## ✨ 主要特性

*   **🎨 可视化模型浏览**：用直观的卡片网格代替了繁琐的文字下拉菜单，支持显示模型封面图。
*   **📂 目录树导航**：支持按照文件夹结构对模型进行分类浏览。
*   **🔍 高级筛选与搜索**：
    *   支持按文件名或模型名称进行文本搜索。
    *   支持按基础模型 (Base Model) 过滤。
    *   支持按模型精度 (FP Format) 过滤。
    *   支持按内容安全级别 (SFW/NSFW) 过滤。
*   **📄 HTML 详情预览**：支持直接在弹窗中渲染模型同名配套的 HTML 详细信息页面，并完美修复了本地图片资源的加载问题。
*   **📝 备注功能**：支持为每个模型创建多条备注（标题/内容），支持回车换行、一键复制、拖拽排序，编辑后自动保存，并以 JSON 持久化到模型同目录。
*   **🌐 国际化支持**：内置中英双语界面，可在设置中无缝切换。
*   **⚙️ 高度可定制 (持久化配置)**：
    *   支持自定义拦截关键字。
    *   支持自定义排除关键字（默认放过内置独立模型浏览器的`model_type`）。
    *   配置修改后自动保存，即使在无痕模式下也不会丢失设置。
*   **🧩 独立模型浏览器节点**：提供了一个专门的 `🎨 Visual Select Model Browser` 节点，用于独立浏览和选择任何类型的模型。

## 🆕 v1.1.0 更新说明

*   **移除 backdrop-filter**：主弹窗/详情弹窗/备注弹窗遮罩层不再启用背景毛玻璃效果，以降低渲染压力、提升流畅度。
*   **新增备注功能**：在模型卡片操作区新增“备注”入口，支持新增/删除/编辑/复制/拖拽排序，并自动保存到模型同目录的 `*.notes.json`。

## 📦 安装说明

1. 进入你的 ComfyUI 插件目录 (`ComfyUI/custom_nodes/`)。
2. 将此项目克隆或解压至该目录下，确保文件夹名称为 `Comfyui-Visual-Select`。
3. 重启 ComfyUI 即可自动加载。

## 🛠️ 使用方法

### 悬浮选择按钮
当插件启用时，点击任意一个支持的**模型选择输入框**（例如 `Load Checkpoint` 里的 `ckpt_name`），鼠标左侧会弹出一个淡绿色的 `🎨 视图选择 (Visual Select)` 悬浮按钮。点击该按钮即可打开可视化面板。

*注：如果不点击它，该悬浮按钮会在 5 秒后自动消失，不会干扰你的正常操作。*

### 🎨 Visual Select Model Browser 节点
你也可以在画布中添加专用的浏览器节点：
1. 双击画布或右键，在 `🎨 Visual Select` 分类下找到 `🎨 模型浏览器 (Visual Select Model Browser)` 节点。
2. 首先在 `model_type` 中选择你想浏览的模型大类（如 checkpoints, loras 等）。
3. 然后点击 `selected_model`，即可弹出对应的可视化界面进行挑选。
4. 将该节点的输出连接到任何接受模型路径字符串的节点即可使用。

### 📝 备注功能
在模型卡片上点击“备注”按钮即可打开备注弹窗。支持多条条目、标题与内容编辑（支持回车换行）、一键复制内容、拖拽排序，并在编辑框失焦后自动保存到模型同目录的 `*.notes.json` 文件中。

![note](Example%20image/note.png)

## ⚙️ 设置选项

点击 ComfyUI 界面右上角的齿轮图标进入**设置 (Settings)**，在列表中可以找到以下配置项：

以下选项位于设置分组 `🎨Visual Select` 下：

*   **开启视图选择器**: 插件总开关，开启后生效。
*   **监听关键字（逗号分隔）**: 只有当节点的属性名包含这些关键字时（如 ckpt, lora 等），才会弹出悬浮按钮。使用英文逗号分隔。
*   **排除关键字（逗号分隔）**: 当节点属性名包含这些关键字时，强制**不拦截**（直接显示原生下拉框）。默认包含 `model_type`。
*   **语言 (Language)**: 切换可视化界面的语言（中文 / English）。

> **提示**：所有的设置都会自动保存在插件目录下的 `config.json` 文件中，支持持久化。

## 📁 支持的模型封面和详情格式

插件会自动扫描与模型文件**同名**的特定后缀文件来显示信息：

*   **封面图**：支持 `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`。例如模型为 `model.safetensors`，则会自动读取 `model.png`。
*   **模型信息**：支持读取 Civitai 助手生成的 `.civitai.info` 文件，用于提取模型全名、Base Model、精度和 NSFW 标签。
*   **HTML 详情**：支持配合另一个仓库的Civitai下载助手的模型管理功能生成的 `.html` 文件，能在点击“详情”按钮时以弹窗形式完整渲染，方便浏览模型详情。

## 🤝 兼容性

*   完全兼容传统的 LiteGraph 渲染模式 (V1 Canvas)。
*   兼容 ComfyUI 最新的 Vue 组件架构 (Node 2.0 Canvas)。
