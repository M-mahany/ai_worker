import { processRecordingTranscript } from "./processors";
import { Worker } from "node:worker_threads";
import { getInstanceId } from "./helpers/getIntsanceId";
import path from "node:path";
import { AWSService } from "./services/awsService";
import { checkCudaReady } from "./helpers/checkCuda";

const MAX_ATTEMPTS = 100;
let EMPTY_ATTEMPTS = 0;

const MAX_WORKERS = 3;
let WORKER_RUNNING: number = 0;

let instanceId: string | null = null;
let hasActiveWorkerStarted = false;
let hookNotifiedStatus = 0;

const workerManager = async () => {
  EMPTY_ATTEMPTS = 0;
  try {
    while (true) {
      const Messages = await AWSService.pollQueue();

      if (!Messages?.length) {
        EMPTY_ATTEMPTS++;

        if (EMPTY_ATTEMPTS >= MAX_ATTEMPTS) {
          console.log("Too many empty attempts, terminating worker...");
          return;
        }

        console.log("Messages Queue is empty...");
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(EMPTY_ATTEMPTS * 2 * 1000, 150000)),
        );
        continue;
      }

      EMPTY_ATTEMPTS = 0;
      const message = Messages[0];

      if (!message?.Body) {
        console.log("Received an empty message body, deleting...");
        if (message.ReceiptHandle) {
          await AWSService.deleteMessageFromQueue(message.ReceiptHandle);
        }
        continue;
      }

      console.log(`Processing message: ${message.Body}`);
      try {
        const processingType =
          message?.MessageAttributes?.processingType?.StringValue;

        const isAnalyzeType = processingType === "analyze";

        let generatedTranscript;
        if (!isAnalyzeType) {
          generatedTranscript = await processRecordingTranscript(message.Body);
        }

        if (WORKER_RUNNING >= MAX_WORKERS) {
          console.log(
            "Maximum workers reached. Waiting for a worker to finish...",
          );
          await waitForWorkerToFinish();
        }

        const workerPath = path.resolve(
          __dirname,
          "./workers/insightProcessor.js",
        );

        const worker = new Worker(workerPath, {
          workerData: {
            transcript: generatedTranscript,
            recordingId: message?.Body,
          },
        });

        WORKER_RUNNING++;
        hasActiveWorkerStarted = true;
        // Handle worker exit event
        worker.on("exit", (code) => {
          WORKER_RUNNING--;
          console.log(
            `Worker finished with code ${code}. Active workers: ${WORKER_RUNNING}`,
          );
        });

        // Handle worker error event
        worker.on("error", (err) => {
          WORKER_RUNNING--;
          console.error("Worker encountered an error:", err);
        });
      } catch (error: any) {
        console.error(`Error processing message: ${error?.message || error}`);
      }
      if (message.ReceiptHandle) {
        console.log(`Message is being deleted...`);
        await AWSService.deleteMessageFromQueue(message.ReceiptHandle);
      } else {
        console.error("Message missing ReceiptHandle, skipping delete...");
      }
    }
  } catch (error) {
    console.error("Worker Manager Error:", error);
  }
};

const waitForWorkerToFinish = async () => {
  console.log("waiting for worker to finish reached maximum");
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (WORKER_RUNNING < MAX_WORKERS) {
        clearInterval(interval);
        resolve(null);
      }
    }, 1000);
  });
};

const handleAutoScalHook = async () => {
  try {
    if (!instanceId) {
      instanceId = await getInstanceId();
    }
    console.log("instance Id:", instanceId);
    if (WORKER_RUNNING === 0) {
      if (hookNotifiedStatus !== 1) {
        await AWSService.completeLifecycleAction(instanceId as string);
        console.log("Sending CompleteLifecycleAction");
        hookNotifiedStatus = 1;
      }
    } else {
      // if (hookNotifiedStatus !== 2) {
      await AWSService.sendLifeCycleHeartBeat(instanceId as string);
      console.log("Sent Heartbeat");
      hookNotifiedStatus = 2;
      // }
    }
  } catch (err: any) {
    console.log(`setInterval Error:${err?.message || err}`);
  }
};

setInterval(() => {
  if (hasActiveWorkerStarted) {
    handleAutoScalHook();
  }
}, 60000);

(async () => {
  const isReady = await checkCudaReady();

  if (!isReady) {
    console.error("Exiting due to unavailable CUDA/GPU.");
    process.exit(1);
  }

  workerManager();
})();
