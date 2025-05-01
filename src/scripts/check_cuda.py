import torch
import time

retries = 10
for i in range(retries):
    if torch.cuda.is_available():
        print("READY")
        exit(0)
    print("Waiting for CUDA to be ready...")
    time.sleep(10)

print("NOT_READY")
exit(1)
