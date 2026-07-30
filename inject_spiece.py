import torch
from safetensors import safe_open
from safetensors.torch import save_file

def main():
    safetensor_path = "W:/ComfyUI_windows_portable_nvidia/ComfyUI_windows_portable/ComfyUI/models/clip/umt5_base_ace.safetensors"
    spiece_path = "L:/Content-Generator/spiece.model"
    output_path = safetensor_path

    print(f"Loading {safetensor_path}...")
    tensors = {}
    with safe_open(safetensor_path, framework="pt", device="cpu") as f:
        for k in f.keys():
            tensors[k] = f.get_tensor(k)
    
    print(f"Loading {spiece_path}...")
    with open(spiece_path, "rb") as f:
        spiece_bytes = f.read()
    
    # ComfyUI's serialize_model() uses torch.ByteTensor(list(bytes)) which is equivalent to torch.tensor(list(bytes), dtype=torch.uint8)
    spiece_tensor = torch.tensor(list(spiece_bytes), dtype=torch.uint8)
    
    tensors["spiece_model"] = spiece_tensor
    print(f"Added spiece_model tensor of shape {spiece_tensor.shape}")
    
    print(f"Saving updated model back to {output_path}...")
    save_file(tensors, output_path)
    print("Done!")

if __name__ == "__main__":
    main()
