import { processRecordingTranscript } from ".";
import { AWSService } from "./awsService";

const MAX_ATTEMPTS = 8;
let EMPTY_ATTEMPTS = 0;

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
        await processRecordingTranscript(message.Body);
        // then will take the transcript and pass it to isnights AI processing worker use node worker thread --TODO--
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

workerManager();
