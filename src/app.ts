import { processRecordingTranscript } from "./processors";
// import { Worker } from "node:worker_threads";
import { getInstanceId } from "./helpers/getIntsanceId";
// import path from "node:path";
import { AWSService } from "./services/awsService";

const MAX_ATTEMPTS = 100;
let EMPTY_ATTEMPTS = 0;

const MAX_CONCURRENCY = 1;
let WORKER_RUNNING: number = 0;

function recordingIdFromBody(message: any): string | null {
  const b = message?.Body;
  return typeof b === "string" && b.trim() ? b.trim() : null;
}

function queueKeyForMessage(message: any): string {
  return recordingIdFromBody(message) ?? (message.MessageId as string);
}

async function deleteQueueMessage(
  message: any,
  errorContext: string,
): Promise<void> {
  try {
    if (message.ReceiptHandle) {
      await AWSService.deleteMessageFromQueue(message.ReceiptHandle);
    }
  } catch (error: any) {
    console.error(`${errorContext}:`, error?.message || error);
  }
}

/** One message per recording id per poll; delete extra SQS receipts. */
async function dedupeMessagesWithinPoll(
  messages: readonly any[],
): Promise<any[]> {
  const uniqueByKey = new Map<string, any>();

  for (const message of messages) {
    const recordingId = recordingIdFromBody(message);
    const key = queueKeyForMessage(message);

    if (recordingId && uniqueByKey.has(recordingId)) {
      await deleteQueueMessage(
        message,
        `Error deleting duplicate poll message for ${recordingId}`,
      );
      continue;
    }
    if (!recordingId && uniqueByKey.has(key)) {
      continue;
    }
    uniqueByKey.set(recordingId ?? key, message);
  }

  return Array.from(uniqueByKey.values());
}

function isRecordingAlreadyQueued(
  recordingId: string,
  pendingMessages: readonly any[],
): boolean {
  return pendingMessages.some((m) => recordingIdFromBody(m) === recordingId);
}

/** Push to pending or delete SQS message if already pending / in flight. */
async function enqueueUniquePollMessages(
  uniqueMessages: readonly any[],
  pendingMessages: any[],
  inFlightRecordingIds: ReadonlySet<string>,
): Promise<void> {
  for (const message of uniqueMessages) {
    const recordingId = recordingIdFromBody(message);
    const alreadyPending =
      recordingId && isRecordingAlreadyQueued(recordingId, pendingMessages);
    const alreadyProcessing =
      !!recordingId && inFlightRecordingIds.has(recordingId);

    if (alreadyPending || alreadyProcessing) {
      await deleteQueueMessage(
        message,
        `Error deleting duplicate message for ${recordingId}`,
      );
      if (recordingId) {
        console.log(
          `Duplicate queue message for recording ${recordingId}, removed from queue`,
        );
      }
      continue;
    }
    pendingMessages.push(message);
  }
}

async function runMessageProcessing(message: any): Promise<void> {
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
    console.error(`Error deleting message: ${error?.message || error}`, error);
  }
}

// let instanceId: string | null = null;
let hasActiveWorkerStarted = false;
// let hookNotifiedStatus = 0;

const workerManager = async () => {
  EMPTY_ATTEMPTS = 0;
  const inFlight = new Set<Promise<void>>();
  const pendingMessages: any[] = [];
  const inFlightRecordingIds = new Set<string>();

  const startProcessing = (message: any) => {
    const p = runMessageProcessing(message)
      .catch((err) => {
        console.error("Unhandled error in message handler:", err);
      })
      .finally(() => {
        inFlight.delete(p);
        WORKER_RUNNING = inFlight.size;
        const rid = recordingIdFromBody(message);
        if (rid) {
          inFlightRecordingIds.delete(rid);
        }
      });

    inFlight.add(p);
    hasActiveWorkerStarted = true;
    WORKER_RUNNING = inFlight.size;
  };

  const drainPendingWhileUnderConcurrency = () => {
    while (inFlight.size < MAX_CONCURRENCY && pendingMessages.length > 0) {
      const nextMessage = pendingMessages.shift();
      if (nextMessage) {
        const rid = recordingIdFromBody(nextMessage);
        if (rid) {
          inFlightRecordingIds.add(rid);
        }
        startProcessing(nextMessage);
      }
    }
  };

  try {
    while (true) {
      drainPendingWhileUnderConcurrency();

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

      const uniqueQueueMessages = await dedupeMessagesWithinPoll(Messages);
      await enqueueUniquePollMessages(
        uniqueQueueMessages,
        pendingMessages,
        inFlightRecordingIds,
      );
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

// const handleAutoScalHook = async () => {
//   try {
//     if (!instanceId) {
//       instanceId = await getInstanceId();
//     }
//     console.log("instance Id:", instanceId);
//     if (WORKER_RUNNING === 0) {
//       if (hookNotifiedStatus !== 1) {
//         await AWSService.completeLifecycleAction(instanceId as string);
//         console.log("Sending CompleteLifecycleAction");
//         hookNotifiedStatus = 1;
//       }
//     } else {
//       // if (hookNotifiedStatus !== 2) {
//       await AWSService.sendLifeCycleHeartBeat(instanceId as string);
//       console.log("Sent Heartbeat");
//       hookNotifiedStatus = 2;
//       // }
//     }
//   } catch (err: any) {
//     console.log(`setInterval Error:${err?.message || err}`);
//   }
// };

// setInterval(() => {
//   if (hasActiveWorkerStarted && WORKER_RUNNING > 0) {
//     handleAutoScalHook();
//   }
// }, 60000);

workerManager();
