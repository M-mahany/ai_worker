import { promises as fs } from "fs";
import { mainServerRequest } from "./utils/mainAPI";
import { AWSService } from "./services/awsService";
import { AiService } from "./services/aiService";

interface BatchRecordingDTO {
  fileKey: string;
  start: number; // Start time in seconds
  end: number; // End time in seconds
  fileURL: string;
  fileUrlExpiresAt: number;
  isTranscripted?: boolean;
}

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
      // should update recording status before breaking the function --TODO--
      return;
    }

    let language = "en";
    let segments: any[] = [];
    let previousEnd: number = 0;

    for (const [index, batch] of batches.entries()) {
      let batchFilePath: string | undefined;
      try {
        console.log(
          `Started trancripting batch ${index + 1}/${batches?.length}`,
        );

        // if (batch?.isTranscripted) {
        //   console.log(`Skipping batch ${index + 1}, already transcripted...`);
        //   previousEnd += batch?.end;
        //   continue;
        // }

        console.log(`Downloading batch file from s3`);
        batchFilePath = await AWSService.downloadS3File(batch.fileKey);

        console.log(
          `Started processing Batch transcript ${index + 1} with whisper...`,
        );

        const whisperS2tTranscript =
          await AiService.transcribeAudio(batchFilePath);

        // console.log("batch transcript", whisperS2tTranscript);
        const mappedWithIncrementedTimestamp = whisperS2tTranscript.map(
          (t) => ({
            ...t,
            start: t.start + previousEnd,
            end: t.end + previousEnd,
            words: t.words.map((word) => ({
              ...word,
              start: word.start + previousEnd,
              end: word.end + previousEnd,
            })),
          }),
        );

        segments.push(...mappedWithIncrementedTimestamp);
        previousEnd += batch?.end;

        console.log(`Finished transcribing batch ${index + 1}`);
      } catch (error: any) {
        console.log(
          `Error processing recording batch ${index + 1}: ${error?.message || error}`,
        );
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

    console.log("segmentsCount:", segments?.length);

    if (segments.length === 0) {
      // console.log("segements:", segments);
      console.log(
        `Recording ${recordingId} is silent. No transcript generated. sending null Key to main server...`,
      );
      await mainServerRequest.post(`/recording/${recordingId}/transcript`, {
        transcriptKey: null,
      });
      return;
    }

    console.log(
      "Finished Recording transcript, uploading tmp json to s3 bucket",
    );

    const transcript = {
      language,
      segments,
    };

    console.log("transcriptJson", transcript);

    const { key } = await AWSService.uploadJsonToS3(
      transcript,
      `${recordingId}_transcript`,
      "tmp",
    );
    console.log("transcriptKey", key);

    // console.log("AWS file key (2)", key);

    console.log("Sending update to the main server");
    await mainServerRequest.post(`/recording/${recordingId}/transcript`, {
      transcriptKey: key,
    });

    return transcript;
  } catch (error: any) {
    console.log(
      `Error Processing recording Transcript ${error?.message || error}`,
    );
    throw new Error(
      `Error Processing recording Transcript ${error?.message || error}`,
    );
  }
};
