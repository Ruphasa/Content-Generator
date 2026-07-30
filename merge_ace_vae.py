import os
from safetensors import safe_open
from safetensors.torch import save_file

vae_path = "W:/ComfyUI_windows_portable_nvidia/ComfyUI_windows_portable/ComfyUI/models/vae/music_dcae_f8c8.safetensors"
vocoder_path = "W:/ComfyUI_windows_portable_nvidia/ComfyUI_windows_portable/ComfyUI/models/checkpoints/music_vocoder/diffusion_pytorch_model.safetensors"
output_path = "W:/ComfyUI_windows_portable_nvidia/ComfyUI_windows_portable/ComfyUI/models/vae/music_dcae_vocoder_combined.safetensors"

combined = {}

print("Loading VAE...")
with safe_open(vae_path, framework="pt", device="cpu") as f:
    for key in f.keys():
        # ACE-Step MusicDCAE has self.dcae and self.vocoder.
        # If the keys in music_dcae don't have 'dcae.', add it!
        new_key = key if key.startswith("dcae.") else f"dcae.{key}"
        combined[new_key] = f.get_tensor(key)

print("Loading Vocoder...")
with safe_open(vocoder_path, framework="pt", device="cpu") as f:
    for key in f.keys():
        new_key = key if key.startswith("vocoder.") else f"vocoder.{key}"
        combined[new_key] = f.get_tensor(key)

print("Saving combined...")
save_file(combined, output_path)
print("Done! Saved to:", output_path)
