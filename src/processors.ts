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

interface TransformedWhisperS2T {
  text: string;
  start: number;
  end: number;
  words: {
    word: string;
    start: number;
    end: number;
    speaker: string;
  }[];
}

interface GroupedSegmentsBySpeakerDTO {
  text: string;
  start: number;
  end: number;
  speaker: string;
}

function groupSegmentsBySpeaker(
  parsedJson: TransformedWhisperS2T[],
): GroupedSegmentsBySpeakerDTO[] {
  const result: GroupedSegmentsBySpeakerDTO[] = [];

  parsedJson.forEach((segment) => {
    let currentSpeaker: any = null;
    let buffer: string[] = [];
    let start_time: number = 0;
    let end_time: number = 0;

    segment.words.forEach((word, idx) => {
      const { speaker, word: text, start, end } = word;

      if (currentSpeaker === null || speaker !== currentSpeaker) {
        // Push last group
        if (buffer.length > 0) {
          result.push({
            text: buffer.join(" "),
            start: start_time,
            end: end_time,
            speaker: currentSpeaker,
          });
          buffer = [];
        }

        // Start new speaker group
        currentSpeaker = speaker;
        start_time = start;
      }

      buffer.push(text);
      end_time = end;

      // Final word
      if (idx === segment.words.length - 1) {
        result.push({
          text: buffer.join(" "),
          start: start_time,
          end: end_time,
          speaker: currentSpeaker,
        });
      }
    });
  });
  console.log(result);
  return result;
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
            words: t.words.map((word) => ({
              ...word,
              start: word.start + previousEnd,
              end: word.end + previousEnd,
            })),
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

    const groupedSpeakerSegments = groupSegmentsBySpeaker(segments);

    const transcript = {
      language,
      segments: groupedSpeakerSegments,
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
