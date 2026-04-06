import server
import folder_paths
import os
import json
import urllib.parse
import re
import time
from aiohttp import web

# Define the web directory for frontend files
WEB_DIRECTORY = "./web"

# Create a fully functional node that acts as a Model Browser
class VisualSelectModelBrowser:
    @classmethod
    def INPUT_TYPES(s):
        types = list(folder_paths.folder_names_and_paths.keys())
        default_type = "checkpoints" if "checkpoints" in types else types[0]
        try:
            models = folder_paths.get_filename_list(default_type)
        except:
            models = []
        if not models:
            models = [""]
            
        return {
            "required": {
                "model_type": (types, {"default": default_type}),
                "selected_model": (models, ),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("model_name",)
    FUNCTION = "get_model"
    CATEGORY = "🎨 Visual Select"

    def get_model(self, model_type, selected_model):
        return (selected_model,)

NODE_CLASS_MAPPINGS = {
    "VisualSelectModelBrowser": VisualSelectModelBrowser
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "VisualSelectModelBrowser": "🎨 Visual Select Model Browser"
}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']

print("✨ [Visual Select] Model Preview Extension is loading...")

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
DEFAULT_CONFIG = {
    "enabled": True,
    "intercept_types": "ckpt,model,lora,vae,unet,controlnet,checkpoint",
    "intercept_excludes": "model_type",
    "language": "zh-CN",
    "nsfw_blur": True,
    "replace_zoom_preview": False
}

try:
    from comfy.model_downloader import get_full_path_or_raise as _comfy_get_full_path_or_raise
    from comfy.model_downloader import get_filename_list as _comfy_get_filename_list
except Exception:
    _comfy_get_full_path_or_raise = None
    _comfy_get_filename_list = None

_MODEL_TYPE_ALIASES = {
    "checkpoint": "checkpoints",
    "ckpt": "checkpoints",
    "lora": "loras",
    "control": "controlnet",
}

_BASENAME_INDEX_CACHE = {}
_BASENAME_INDEX_CACHE_TS = {}
_BASENAME_INDEX_CACHE_TTL_SEC = 30

def _normalize_model_type(model_type: str) -> str:
    if not model_type:
        return ""
    mt = str(model_type).strip()
    if mt in folder_paths.folder_names_and_paths:
        return mt
    mt_lower = mt.lower()
    if mt_lower in _MODEL_TYPE_ALIASES:
        mapped = _MODEL_TYPE_ALIASES[mt_lower]
        if mapped in folder_paths.folder_names_and_paths:
            return mapped
    for k, v in _MODEL_TYPE_ALIASES.items():
        if k in mt_lower and v in folder_paths.folder_names_and_paths:
            return v
    return mt

def _get_filename_list(folder_type: str):
    try:
        return folder_paths.get_filename_list(folder_type)
    except Exception:
        if _comfy_get_filename_list:
            return _comfy_get_filename_list(folder_type)
    return []

def _get_basename_index(folder_type: str):
    now = time.time()
    ts = _BASENAME_INDEX_CACHE_TS.get(folder_type, 0)
    if folder_type in _BASENAME_INDEX_CACHE and (now - ts) < _BASENAME_INDEX_CACHE_TTL_SEC:
        return _BASENAME_INDEX_CACHE[folder_type]

    index = {}
    names = _get_filename_list(folder_type) or []
    for n in names:
        if not isinstance(n, str) or not n:
            continue
        base = os.path.basename(n).lower()
        if base not in index:
            index[base] = n

    _BASENAME_INDEX_CACHE[folder_type] = index
    _BASENAME_INDEX_CACHE_TS[folder_type] = now
    return index

def _resolve_model_full_path(model_type: str, model_name: str):
    if not model_name or not isinstance(model_name, str):
        return None
    if os.path.isabs(model_name):
        return None

    mt = _normalize_model_type(model_type)
    candidate_types = []
    if mt and mt in folder_paths.folder_names_and_paths:
        candidate_types.append(mt)

    for folder_name in folder_paths.folder_names_and_paths:
        if folder_name not in candidate_types:
            candidate_types.append(folder_name)

    for folder_name in candidate_types:
        try:
            path = folder_paths.get_full_path(folder_name, model_name)
            if path and os.path.exists(path):
                return path
        except Exception:
            pass
        if _comfy_get_full_path_or_raise:
            try:
                path = _comfy_get_full_path_or_raise(folder_name, model_name)
                if path and os.path.exists(path):
                    return path
            except Exception:
                pass

    if ("/" not in model_name) and ("\\" not in model_name):
        model_name_lower = model_name.lower()
        for folder_name in candidate_types:
            idx = _get_basename_index(folder_name)
            rel = idx.get(model_name_lower)
            if not rel:
                continue
            try:
                path = folder_paths.get_full_path(folder_name, rel)
                if path and os.path.exists(path):
                    return path
            except Exception:
                pass
            if _comfy_get_full_path_or_raise:
                try:
                    path = _comfy_get_full_path_or_raise(folder_name, rel)
                    if path and os.path.exists(path):
                        return path
                except Exception:
                    pass

    return None

def _notes_file_path(model_full_path: str) -> str:
    base_path = os.path.splitext(model_full_path)[0]
    return base_path + ".notes.json"

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if isinstance(cfg, dict):
                    for k, v in DEFAULT_CONFIG.items():
                        if k not in cfg:
                            cfg[k] = v
                    return cfg
                return DEFAULT_CONFIG
        except Exception as e:
            print(f"[Visual_Select] Error loading config: {e}")
    return DEFAULT_CONFIG

def save_config(config):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=4)
    except Exception as e:
        print(f"[Visual_Select] Error saving config: {e}")

# Ensure __init__.py works correctly for frontend injection
if hasattr(server.PromptServer, "instance"):
    @server.PromptServer.instance.routes.get("/visual_select/config")
    async def get_config_route(request):
        return web.json_response(load_config())

    @server.PromptServer.instance.routes.post("/visual_select/config")
    async def post_config_route(request):
        try:
            data = await request.json()
            config = load_config()
            if "enabled" in data:
                config["enabled"] = data["enabled"]
            if "intercept_types" in data:
                config["intercept_types"] = data["intercept_types"]
            if "intercept_excludes" in data:
                config["intercept_excludes"] = data["intercept_excludes"]
            if "language" in data:
                config["language"] = data["language"]
            if "nsfw_blur" in data:
                config["nsfw_blur"] = bool(data["nsfw_blur"])
            if "replace_zoom_preview" in data:
                config["replace_zoom_preview"] = bool(data["replace_zoom_preview"])
            save_config(config)
            return web.json_response({"status": "success"})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    # Setup API routes for fetching preview images and html details
    @server.PromptServer.instance.routes.get("/visual_select/preview")
    async def get_model_preview(request):
        model_name = request.query.get("name", "")
        preview_type = request.query.get("format", "image") # 'image' or 'html'
        model_type = request.query.get("type", "")
        
        if not model_name:
            return web.Response(status=400, text="Model name required")
            
        full_path = _resolve_model_full_path(model_type, model_name)
                    
        if not full_path:
            return web.Response(status=404, text="Model not found")
            
        base_path = os.path.splitext(full_path)[0]
        
        if preview_type == "image":
            extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"]
            for ext in extensions:
                img_path = base_path + ext
                if os.path.exists(img_path):
                    return web.FileResponse(img_path)
            return web.Response(status=404, text="Preview image not found")
            
        elif preview_type == "html":
            html_path = base_path + ".html"
            if os.path.exists(html_path):
                try:
                    with open(html_path, "r", encoding="utf-8") as f:
                        html_content = f.read()
                        
                    def replace_asset_path(match):
                        attr = match.group(1)
                        file_path = match.group(2)
                        new_url = f"/visual_select/model_asset?type={urllib.parse.quote(model_type)}&model={urllib.parse.quote(model_name)}&file={urllib.parse.quote(file_path)}"
                        return f'{attr}="{new_url}"'

                    # Replace relative src and href attributes with our asset endpoint
                    html_content = re.sub(
                        r'(src|href)=["\'](?!http|data:|blob:|/|#)([^"\']+)["\']',
                        replace_asset_path,
                        html_content
                    )
                    return web.Response(text=html_content, content_type="text/html")
                except Exception as e:
                    print(f"[Visual_Select] Error processing HTML {html_path}: {e}")
                    # Fallback to serving the raw file if parsing fails
                    return web.FileResponse(html_path)
            return web.Response(status=404, text="Preview HTML not found")
            
        return web.Response(status=400, text="Invalid format")

    @server.PromptServer.instance.routes.get("/visual_select/model_asset")
    async def get_model_asset(request):
        model_type = request.query.get("type", "")
        model_name = request.query.get("model", "")
        file_name = request.query.get("file", "")
        
        if not model_name or not file_name:
            return web.Response(status=400, text="Missing parameters")
            
        full_path = _resolve_model_full_path(model_type, model_name)
                    
        if not full_path:
            return web.Response(status=404, text="Model not found")
            
        base_dir = os.path.dirname(full_path)
        
        # Decode file_name if it was URL encoded in the HTML (e.g. spaces as %20)
        file_name = urllib.parse.unquote(file_name)
        
        # Resolve absolute path for the requested asset
        asset_path = os.path.abspath(os.path.join(base_dir, file_name))
        
        # Security check: ensure the requested file is actually within the model's directory
        # to prevent directory traversal attacks like file=../../../etc/passwd
        if not asset_path.startswith(os.path.abspath(base_dir)):
            return web.Response(status=403, text="Forbidden: Invalid file path")
            
        if os.path.exists(asset_path):
            return web.FileResponse(asset_path)
            
        return web.Response(status=404, text="Asset not found")

    @server.PromptServer.instance.routes.post("/visual_select/preview_info")
    async def get_model_preview_info(request):
        data = await request.json()
        model_names = data.get("names", [])
        model_type = data.get("type", "")
        result = {}
        
        extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"]
        
        for model_name in model_names:
            full_path = _resolve_model_full_path(model_type, model_name)
                    
            if full_path:
                base_path = os.path.splitext(full_path)[0]
                has_image = False
                has_html = False
                civitai_name = None
                base_model = None
                fp_format = None
                is_nsfw = False
                
                for ext in extensions:
                    if os.path.exists(base_path + ext):
                        has_image = True
                        break
                        
                if os.path.exists(base_path + ".html"):
                    has_html = True
                    
                info_path = base_path + ".civitai.info"
                if os.path.exists(info_path):
                    try:
                        with open(info_path, "r", encoding="utf-8") as f:
                            info_data = json.load(f)
                            if "name" in info_data:
                                civitai_name = info_data["name"]
                            if "baseModel" in info_data:
                                base_model = info_data["baseModel"]
                            if "nsfw" in info_data:
                                is_nsfw = info_data["nsfw"]
                            if "metadata" in info_data and isinstance(info_data["metadata"], dict) and "fp" in info_data["metadata"]:
                                fp_format = info_data["metadata"]["fp"]
                    except Exception as e:
                        print(f"[Visual_Select] Error reading {info_path}: {e}")
                    
                result[model_name] = {
                    "has_image": has_image, 
                    "has_html": has_html,
                    "civitai_name": civitai_name,
                    "base_model": base_model,
                    "fp_format": fp_format,
                    "is_nsfw": is_nsfw
                }
                
        return web.json_response(result)

    @server.PromptServer.instance.routes.get("/visual_select/notes")
    async def get_model_notes(request):
        model_name = request.query.get("name", "")
        model_type = request.query.get("type", "")
        if not model_name:
            return web.json_response({"items": []})

        full_path = _resolve_model_full_path(model_type, model_name)
        if not full_path:
            return web.Response(status=404, text="Model not found")

        notes_path = _notes_file_path(full_path)
        if not os.path.exists(notes_path):
            return web.json_response({"items": []})

        try:
            with open(notes_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("items"), list):
                return web.json_response({"items": data.get("items", [])})
        except Exception:
            pass

        return web.json_response({"items": []})

    @server.PromptServer.instance.routes.post("/visual_select/notes")
    async def save_model_notes(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"status": "error", "message": "Invalid JSON"}, status=400)

        model_name = data.get("name", "")
        model_type = data.get("type", "")
        items = data.get("items", [])

        if not model_name:
            return web.json_response({"status": "error", "message": "Model name required"}, status=400)

        full_path = _resolve_model_full_path(model_type, model_name)
        if not full_path:
            return web.json_response({"status": "error", "message": "Model not found"}, status=404)

        if not isinstance(items, list):
            return web.json_response({"status": "error", "message": "Items must be a list"}, status=400)

        normalized_items = []
        for it in items:
            if not isinstance(it, dict):
                continue
            item_id = str(it.get("id", "")).strip()
            if not item_id:
                item_id = str(int(time.time() * 1000))
            title = it.get("title", "")
            content = it.get("content", "")
            if not isinstance(title, str):
                title = str(title)
            if not isinstance(content, str):
                content = str(content)
            normalized_items.append({"id": item_id, "title": title, "content": content})

        notes_path = _notes_file_path(full_path)
        try:
            with open(notes_path, "w", encoding="utf-8") as f:
                json.dump({"version": 1, "items": normalized_items}, f, ensure_ascii=False, indent=2)
            return web.json_response({"status": "success"})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)
                
    @server.PromptServer.instance.routes.get("/visual_select/get_models")
    async def get_models_by_type(request):
        model_type = request.query.get("type", "checkpoints")
        
        # Robust model_type mapping
        if model_type not in folder_paths.folder_names_and_paths:
            # Try some common aliases
            aliases = {
                "checkpoint": "checkpoints",
                "ckpt": "checkpoints",
                "lora": "loras",
                "control": "controlnet",
            }
            for k, v in aliases.items():
                if k in model_type.lower() and v in folder_paths.folder_names_and_paths:
                    model_type = v
                    break
        
        try:
            # We want just the relative path string like "folder/model.safetensors"
            models = folder_paths.get_filename_list(model_type)
        except:
            models = []
        
        result = []
        if not models:
            return web.json_response(result)
            
        for model_name in models:
            # We only need the name, frontend will fetch the rest via /visual_select/preview_info
            # Ensure model_name is a string (sometimes folder_paths returns weird objects)
            if isinstance(model_name, str):
                result.append({
                    "name": model_name
                })
            
        return web.json_response(result)

print("Loaded ComfyUI-Visual-Select plugin.")
