# ComfyUI Visual Select v1.1.0
ComfyUI Visual Select is a front-end extension for ComfyUI designed to enhance the model selection experience. By overriding the native model dropdown menus, it provides an intuitive visual model browser with preview images and detailed information, helping users manage and select models more efficiently.

ComfyUI Visual Select 中文版：[README.md](https://github.com/VodooWaWa/Comfyui-Visual-Select/blob/main/README.md)

Cover images and metadata display require a cover image and an info metadata file with the same base name as the model file in the model folder. You can manually pick any cover image and rename it to match the model filename to make it show up. However, the info metadata file requires parsing JSON returned by the Civitai API.

**You can also pair this extension with my other repository tool to get a perfect display experience by generating covers and metadata while downloading and managing models.**
https://github.com/VodooWaWa/Civitai-Download-Tool
(Sorry, this tool is primarily designed for Chinese users and the Chinese network environment, so it does not support an English interface. If you really need English support, please submit an issue to let us know. 🙏)

Video tutorial (Bilibili): https://www.bilibili.com/video/BV1kfDTBXEad/

## 🎨 UI Preview
![image](/Example%20image/VisualSelect.png)

## ✨ Key Features
*   **🎨 Visual Model Browsing**: Replaces cumbersome text dropdowns with an intuitive card grid layout, supporting model cover image display.
*   **📂 Directory Tree Navigation**: Allows categorized browsing of models based on folder structure.
*   **🔍 Advanced Filtering & Search**:
    *   Text search by filename or model name.
    *   Filter by Base Model.
    *   Filter by FP Format (model precision).
    *   Filter by content safety level (SFW/NSFW).
*   **📄 HTML Detail Preview**: Renders HTML detail pages for matching model names directly in a popup, with full support for local image resource loading.
*   **📝 Notes**: Create multiple notes per model (title/content) with newline support, one-click copy, drag-and-drop reordering, and auto-save to a `*.notes.json` file alongside the model.
*   **🌐 Internationalization**: Built-in Chinese and English interface, switchable seamlessly in settings.
*   **⚙️ Highly Customizable (Persistent Configuration)**:
    *   Customizable trigger keywords.
    *   Customizable exclude keywords (defaults to excluding `model_type` used by the built-in standalone model browser).
    *   Settings auto-save and persist even in incognito mode.
*   **🧩 Standalone Model Browser Node**: Provides a dedicated `🎨 Visual Select Model Browser` node for browsing and selecting any type of model independently.

## 🆕 Updates

*   **Removed backdrop-filter**: Overlay blur is no longer used in the main dialog, details dialog, and notes dialog to reduce rendering overhead and improve responsiveness.
*   **Added Notes feature**: A new “Notes” entry is available in the model card actions, supporting add/delete/edit/copy/drag reorder with auto-save to `*.notes.json` next to the model.

## 📦 Installation
1. Navigate to your ComfyUI custom nodes directory (`ComfyUI/custom_nodes/`).
2. Clone or extract this project into the directory, ensuring the folder name is `Comfyui-Visual-Select`.
3. Restart ComfyUI; the extension will load automatically.

## 🛠️ Usage
### Floating Select Button
When the extension is enabled, click any supported model selection input (e.g., `ckpt_name` in `Load Checkpoint`). A faint green `🎨 Visual Select` floating button will appear on the left. Click it to open the visual panel.

*Note: The floating button will auto-hide after 5 seconds if not clicked, without interfering with normal workflow.*

### 🎨 Visual Select Model Browser Node
You can also add a dedicated browser node to the canvas:
1. Double-click the canvas or right-click, then find `🎨 Visual Select Model Browser` under the `🎨 Visual Select` category.
2. First select the model category to browse in `model_type` (e.g., checkpoints, loras).
3. Click `selected_model` to open the corresponding visual interface for selection.
4. Connect the output to any node that accepts a model path string.

### 📝 Notes
Click the “Notes” button on a model card to open the notes dialog. It supports multiple entries, title/content editing (with newlines), one-click copy, drag-and-drop sorting, and auto-save to a `*.notes.json` file next to the model.

![note](/Example%20image/note.png)

## ⚙️ Settings
Click the gear icon in the top-right corner of the ComfyUI interface to access **Settings**. The following options are available:
The following options are under the `🎨Visual Select` group:

*   **Enable Visual Selector**: Master toggle for the extension.
*   **Listening Keywords (comma-separated)**: The floating button only appears for node properties containing these keywords (e.g., ckpt, lora). Separate with commas.
*   **Exclude Keywords (comma-separated)**: Force native dropdowns for node properties containing these keywords. Defaults to `model_type`.
*   **Language**: Switch interface language (中文 / English).

> **Tip**: All settings are auto-saved in `config.json` in the extension directory and persist across sessions.

## 📁 Supported Cover & Detail Formats
The extension automatically scans files with the **same name** as the model for metadata:
*   **Cover Images**: Supports `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`. For a model named `model.safetensors`, `model.png` will be loaded automatically.
*   **Model Info**: Reads `.civitai.info` files (generated by Civitai helpers) to extract full name, Base Model, precision, and NSFW tags.
*   **HTML Details**: Supports `.html` files generated by companion Civitai download & management tools, rendered fully in a popup when viewing details.

## 🤝 Compatibility
*   Fully compatible with the classic LiteGraph rendering mode (V1 Canvas).
*   Compatible with ComfyUI's latest Vue component architecture (Node 2.0 Canvas).
