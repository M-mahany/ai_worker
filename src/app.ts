import { processRecordingTranscript } from "./processors";
// import { Worker } from "node:worker_threads";
import { getInstanceId } from "./helpers/getIntsanceId";
// import path from "node:path";
import { AWSService } from "./services/awsService";

const MAX_ATTEMPTS = 100;
let EMPTY_ATTEMPTS = 0;

const MAX_CONCURRENCY = 2;
let WORKER_RUNNING: number = 0;

let instanceId: string | null = null;
let hasActiveWorkerStarted = false;
let hookNotifiedStatus = 0;

const workerManager = async () => {
  EMPTY_ATTEMPTS = 0;
  const inFlight = new Set<Promise<void>>();
  const pendingMessages: any[] = [];

  const startProcessing = (message: any) => {
    const p = (async () => {
      if (!message?.Body) {
        console.log("Received an empty message body, deleting...");
        if (message.ReceiptHandle) {
          await AWSService.deleteMessageFromQueue(message.ReceiptHandle);
        }
        return;
      }

      console.log(`Processing message: ${message.Body}`);
      try {
        const processingType =
          message?.MessageAttributes?.processingType?.StringValue;

        const isAnalyzeType = processingType === "analyze";

        if (!isAnalyzeType) {
          await processRecordingTranscript(message.Body);
        }
      } catch (error: any) {
        console.error(
          `Error processing message: ${error?.message || error}`,
          error,
        );
      }

      try {
        if (message?.ReceiptHandle) {
          console.log(`Message is being deleted...`);
          await AWSService.deleteMessageFromQueue(message?.ReceiptHandle);
        } else {
          console.error("Message missing ReceiptHandle, skipping delete...");
        }
      } catch (error: any) {
        console.error(
          `Error deleting message: ${error?.message || error}`,
          error,
        );
      }
    })()
      .catch((err) => {
        console.error("Unhandled error in message handler:", err);
      })
      .finally(() => {
        inFlight.delete(p);
        WORKER_RUNNING = inFlight.size;
      });

    inFlight.add(p);
    hasActiveWorkerStarted = true;
    WORKER_RUNNING = inFlight.size;
  };

  try {
    while (true) {
      // First, drain any internally queued messages up to concurrency limit
      while (inFlight.size < MAX_CONCURRENCY && pendingMessages.length > 0) {
        const nextMessage = pendingMessages.shift();
        if (nextMessage) {
          startProcessing(nextMessage);
        }
      }

      if (inFlight.size >= MAX_CONCURRENCY) {
        await Promise.race(inFlight);
        continue;
      }

      const Messages = await AWSService.pollQueue();

      if (!Messages?.length) {
        if (inFlight.size === 0 && pendingMessages.length === 0) {
          EMPTY_ATTEMPTS++;

          if (EMPTY_ATTEMPTS >= MAX_ATTEMPTS) {
            console.log("Too many empty attempts, terminating worker...");
            return;
          }

          console.log("Messages Queue is empty...");
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(EMPTY_ATTEMPTS * 2 * 1000, 150000)),
          );
        } else {
          await Promise.race(inFlight);
        }
        continue;
      }

      EMPTY_ATTEMPTS = 0;

      // Queue all received messages internally so none are "thrown away"
      pendingMessages.push(...Messages);
    }
  } catch (error) {
    console.error("Worker Manager Error:", error);
  }
};

// const waitForWorkerToFinish = async () => {
//   console.log("waiting for worker to finish reached maximum");
//   await new Promise((resolve) => {
//     const interval = setInterval(() => {
//       if (WORKER_RUNNING < MAX_WORKERS) {
//         clearInterval(interval);
//         resolve(null);
//       }
//     }, 1000);
//   });
// };

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
  if (hasActiveWorkerStarted && WORKER_RUNNING > 0) {
    handleAutoScalHook();
  }
}, 60000);

workerManager();
