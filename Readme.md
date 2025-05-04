## Startup.sh

should be located in /home/ubuntu

```
#!/bin/bash
set -e

cd /home/ubuntu/ai_worker

ollama rm mistral


echo "🔄 Resetting repo..."
git reset --hard HEAD
git clean -fd
git pull

echo "🕒 Waiting for full GPU + cuDNN initialization..."

RETRIES=120
SLEEP_SECONDS=5

for ((i=1;i<=RETRIES;i++)); do
  if /home/ubuntu/whisper-env/bin/python3 -c "import torch; assert torch.cuda.is_available(); torch.randn(1).cuda(); torch.backends.cudnn.is_acceptable(torch.empty(1, device='cuda'))"; then
    echo "✅ GPU + cuDNN fully initialized."
    break
  else
    echo "⏳ Attempt $i/$RETRIES: Waiting for GPU/cuDNN..."
    sleep $SLEEP_SECONDS
  fi
done

echo "📦 Installing dependencies..."
ollama pull mistral
npm install
npx rimraf ./build
npm run build

echo "🚀 Starting PM2 app..."
pm2 delete ai_worker 2>/dev/null || true  # <-- Add this line
pm2 start npm --name "ai_worker" -- start
pm2 save

source whisper-env/bin/activate
```

then run this script

```
sudo chmod +x /home/ubuntu/startup.sh
```

``

## /etc/systemd/system/ai_worker.service

in that path add this

```
[Unit]
Description=AI Worker Boot Auto Start
After=network-online.target
Wants=network-online.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/home/ubuntu/startup.sh
Type=oneshot  # Allow PM2 to daemonize
StandardOutput=append:/var/log/ai_worker_output.log
StandardError=append:/var/log/ai_worker_error.log

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable ai_worker.service
```

### check logs

```
 cat /var/log/ai_worker_output.log
```
