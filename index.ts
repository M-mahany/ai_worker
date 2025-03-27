import axios from "axios";
import dotenv from "dotenv";
import { AWSService } from "./awsService";
import { AiService } from "./aiService";
import { promises as fs } from "fs";

dotenv.config();

interface BatchRecordingDTO {
  fileKey: string;
  start: number; // Start time in seconds
  end: number; // End time in seconds
  fileURL: string;
  fileUrlExpiresAt: number;
  isTranscripted?: boolean;
}

export const mainServerRequest = axios.create({
  baseURL: `${process.env.MAIN_SERVER_ENDPOINT}/worker`,
  headers: { "x-api-key": process.env.API_KEY },
});

export const processRecordingTranscript = async (recordingId: string) => {
  try {
    const { data: response } = await mainServerRequest.get(
      `/recording/${recordingId}`,
    );
    const { data: recording } = response;

    console.log(`Started Processing recording ${recordingId}`);

    const batches = recording?.batches as BatchRecordingDTO[];

    const unprocessedBatches = batches.filter((batch) => !batch.isTranscripted);
    if (unprocessedBatches.length === 0) {
      console.log(
        `All batches for recording ${recordingId} are already transcribed. skipping recording ${recordingId}...`,
      );
      return;
    }

    let language = "en";
    let segments = [];
    let previousEnd: number = 0;

    for (const [index, batch] of batches.entries()) {
      let batchFilePath: string | undefined;
      try {
        console.log(
          `Started trancripting batch ${index + 1}/${batches?.length}`,
        );

        if (batch?.isTranscripted) {
          console.log(`Skipping batch ${index + 1}, already transcripted...`);
          continue;
        }

        console.log(`Downloading batch file from s3`);
        batchFilePath = await AWSService.downloadS3File(batch.fileKey);

        console.log(
          `Started processing Batch transcript ${index + 1} with whisper...`,
        );

        const whisperS2tTranscript =
          await AiService.transcribeAudio(batchFilePath);

        const mappedWithIncrementedTimestamp = whisperS2tTranscript.map(
          (t) => ({
            ...t,
            start: t.start + previousEnd,
            end: t.end + previousEnd,
          }),
        );

        segments.push(...mappedWithIncrementedTimestamp);
        previousEnd += batch?.end;
      } catch (error: any) {
        throw new Error(
          `Error processing recording batch ${index + 1}: ${error?.message || error}`,
        );
      } finally {
        if (batchFilePath) {
          await fs.unlink(batchFilePath).catch(() => {
            console.warn(`Failed to delete temp file: ${batchFilePath}`);
          });
        }
      }
    }

    if (segments.length === 0) {
      console.warn(
        `No valid segments found for recording ${recordingId}. Skipping update.`,
      );
      return;
    }

    console.log(
      "Finished Recording transcript, uploading tmp json to s3 bucket",
    );

    const transcript = {
      language,
      segments,
    };

    const { key } = await AWSService.uploadJsonToS3(
      transcript,
      `${recordingId}_transcript`,
      "tmp",
    );
    console.log("Sending update to the main server");
    await mainServerRequest.post(`/recording/transcript/${recordingId}`, {
      transcriptKey: key,
    });
  } catch (error) {
    throw new Error(`Error Processing recording Transcript ${error}`);
  }
};
