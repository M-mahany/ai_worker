import { exec } from "child_process";

export const checkCudaReady = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    exec("python3 check_cuda.py", (error, stdout, stderr) => {
      if (error) {
        console.error("❌ CUDA check failed:", stderr);
        resolve(false);
        return;
      }
      if (stdout.trim() === "READY") {
        console.log("✅ CUDA is ready!");
        resolve(true);
      } else {
        console.log("❌ CUDA not ready.");
        resolve(false);
      }
    });
  });
};
