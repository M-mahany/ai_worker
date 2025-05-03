#!/bin/bash
set -e

cd /home/ubuntu/ai_worker

echo "🔄 Resetting repo..." | tee -a /var/log/ai_worker.log
git reset --hard HEAD
git clean -fd
git pull

echo "🕒 Waiting for full GPU + cuDNN initialization..." | tee -a /var/log/ai_worker.log

RETRIES=120
SLEEP_SECONDS=5

for ((i=1;i<=RETRIES;i++)); do
  if /home/ubuntu/whisper-env/bin/python3 -c "import torch; assert torch.cuda.is_available(); torch.randn(1).cuda(); torch.backends.cudnn.is_acceptable(torch.empty(1, device='cuda'))" &>/dev/null; then
    echo "✅ GPU + cuDNN fully initialized." | tee -a /var/log/ai_worker.log
    break
  else
    echo "⏳ Attempt $i/$RETRIES: Waiting for GPU/cuDNN..." | tee -a /var/log/ai_worker.log
    sleep $SLEEP_SECONDS
  fi
done

echo "📦 Installing dependencies..." | tee -a /var/log/ai_worker.log
ollama pull mistral
npm install
npx rimraf ./build
npm run build

echo "🚀 Starting PM2 app..." | tee -a /var/log/ai_worker.log
pm2 start npm --name "ai_worker" -- start
