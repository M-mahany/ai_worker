import { promises as fs } from "fs";
import { mainServerRequest } from "./utils/mainAPI";
import { AWSService } from "./services/awsService";
import { AiService } from "./services/aiService";
import { retryOnceFn } from "./utils/retryOnce";

interface BatchRecordingDTO {
  fileKey: string;
  start: number; // Start time in seconds
  end: number; // End time in seconds
  fileURL: string;
  fileUrlExpiresAt: number;
  isTranscripted?: boolean;
}

export interface TranscriptBySpeakerDTO {
  "Speaker 1": string;
  "Speaker 2": string;
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
          previousEnd += batch?.end;
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

    const transcriptBySpeaker = {
      "Speaker 1": segments
        .filter((seg) => seg.speaker === "Speaker 1")
        .map((seg) => seg.text)
        .join(" "),
      "Speaker 2": segments
        .filter((seg) => seg.speaker === "Speaker 2")
        .map((seg) => seg.text)
        .join(" "),
    };

    const mappedSpeaker: Record<string, string> | undefined = await retryOnceFn(
      () => AiService.getSpeakerTypeFromTranscript(transcriptBySpeaker),
    );

    const constructedSegments = segments.map((seg) => ({
      ...seg,
      speaker: mappedSpeaker?.[seg.speaker] ?? seg.speaker,
    }));

    const transcript = {
      language,
      segments: constructedSegments,
    };

    const { key } = await AWSService.uploadJsonToS3(
      transcript,
      `${recordingId}_transcript`,
      "tmp",
    );

    console.log("Sending update to the main server");
    await mainServerRequest.post(`/recording/${recordingId}/transcript`, {
      transcriptKey: key,
    });

    return transcript;
  } catch (error: any) {
    throw new Error(
      `Error Processing recording Transcript ${error?.message || error}`,
    );
  }
};
