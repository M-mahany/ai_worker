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
    let language = "en";
    let segments = [];

    for (const [index, batch] of batches.entries()) {
      let batchFilePath;
      try {
        console.log(
          `Started trancripting batch ${index + 1}/${batches?.length}`,
        );

        if (batch?.isTranscripted) continue;

        console.log(`Downloading batch file from s3`);

        batchFilePath = await AWSService.downloadS3File(batch.fileKey);

        console.log(
          `Started processing Batch transcript ${index + 1} with whisper...`,
        );

        const whisperS2tTranscript =
          await AiService.transcribeAudio(batchFilePath);

        segments.push(...whisperS2tTranscript);
      } catch (error) {
        throw new Error(`Error Processing recording batch ${index} ${error}`);
      }
      await fs.unlink(batchFilePath);
    }

    console.log(`Finished Recording transcript, sending update to the server`);

    await mainServerRequest.post(`/recording/transcript/${recordingId}`, {
      transcript: {
        language,
        segments,
      },
    });
  } catch (error) {
    throw new Error(`Error Processing recording Transcript ${error}`);
  }
};
