import { promises as fs } from "fs";
import { mainServerRequest } from "./utils/mainAPI";
import { AWSService } from "./services/awsService";
import { AiService } from "./services/aiService";
import { getFileTimestampFromFileKey } from "./utils/getTimestampFromFilekey";

interface BatchRecordingDTO {
  _id: string;
  fileKey: string;
  start: number; // Start time in seconds
  end: number; // End time in seconds
  fileURL: string;
  fileUrlExpiresAt: number;
  isTranscripted?: boolean;
  doaJsonFileKey?: string;
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

    let recordingTranscript: any = null;

    try {
      const { data: transcriptResponse } = await mainServerRequest.get(
        `/recording/${recordingId}/transcript`,
      );
      const { data: recordingTranscriptData } = transcriptResponse;

      recordingTranscript = recordingTranscriptData;
      console.log(`Recording ${recordingId} transcript fetched successfully`);
    } catch (error: any) {
      console.log(
        `Error fetching recording ${recordingId} transcript: ${error?.message || error}, continuing with empty transcript...`,
      );
    }

    // const expectedTranscriptFileKey = `tmp/${recordingId}_transcript.json`;

    // const hasTranscriptKey = await AWSService.fileExists(
    //   expectedTranscriptFileKey,
    // );

    // if (hasTranscriptKey) {
    //   await mainServerRequest.post(`/recording/${recordingId}/transcript`, {
    //     transcriptKey: expectedTranscriptFileKey,
    //   });
    //   return;
    // }

    const sortedBatches = batches.sort(
      (a, b) =>
        getFileTimestampFromFileKey(a.fileKey) -
        getFileTimestampFromFileKey(b.fileKey),
    );

    let language = "en";
    let segments: any[] = [];
    let previousEnd: number = 0;

    for (const [index, batch] of sortedBatches?.entries() || []) {
      let batchFilePath: string | undefined;
      let doaJsonFilePath: string | undefined;
      const hasDOAJson = batch?.doaJsonFileKey;

      try {
        console.log(
          `Started trancripting batch ${index + 1}/${batches?.length}`,
        );

        // if (batch?.isTranscripted) {
        //   console.log(`Skipping batch ${index + 1}, already transcripted...`);
        //   previousEnd += batch?.end;
        //   continue;
        // }

        if (batch?.isTranscripted && recordingTranscript) {
          const batchTranscript = recordingTranscript?.segments?.filter(
            (segment: any) =>
              segment?.batchId?.toString() === batch?._id?.toString(),
          );

          if (batchTranscript?.length > 0) {
            console.log(`Skipping batch ${index + 1}, already transcribed...`);

            const mappedWithIncrementedTimestamp = batchTranscript.map(
              (t: any) => ({
                ...t,
                start: t?.batchStart + previousEnd,
                end: t?.batchEnd + previousEnd,
                words: t?.words?.map((word: any) => ({
                  ...word,
                  start: word?.batchStart + previousEnd,
                  end: word?.batchEnd + previousEnd,
                })),
              }),
            );

            segments.push(...mappedWithIncrementedTimestamp);
            previousEnd += batch?.end;
            continue;
          }
        }

        console.log(`Downloading batch file from s3`);
        batchFilePath = await AWSService.downloadS3File(batch.fileKey);

        if (hasDOAJson) {
          console.log(`Downloading DOA JSON file from s3: ${hasDOAJson}`);
          try {
            doaJsonFilePath = await AWSService.downloadJsonFromS3(hasDOAJson);
          } catch (error: any) {
            console.log(
              `Error downloading DOA JSON file from s3: ${error?.message || error}`,
            );
          }
        }

        console.log(
          `Started processing Batch transcript ${index + 1} with whisper...`,
        );

        let whisperS2tTranscript = await AiService.transcribeAudio(
          batchFilePath,
          doaJsonFilePath,
        );

        if (whisperS2tTranscript?.length === 0) {
          whisperS2tTranscript = [
            {
              text: ".",
              start: batch?.start,
              end: batch?.end,
              words: [],
            },
          ];
        }

        // console.log("batch transcript", whisperS2tTranscript);
        const mappedWithIncrementedTimestamp = whisperS2tTranscript.map(
          (t) => ({
            ...t,
            batchId: batch?._id?.toString(),
            start: t.start + previousEnd,
            end: t.end + previousEnd,
            batchStart: t?.start,
            batchEnd: t?.end,
            words: t.words.map((word) => ({
              ...word,
              start: word.start + previousEnd,
              end: word.end + previousEnd,
              batchStart: word?.start,
              batchEnd: word?.end,
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
        if (doaJsonFilePath) {
          await fs.unlink(doaJsonFilePath).catch(() => {
            console.warn(
              `Failed to delete DOA JSON temp file: ${doaJsonFilePath}`,
            );
          });
        }
      }
    }

    console.log("segmentsCount:", segments?.length);

    if (segments?.length === 0) {
      console.log(
        `Recording ${recordingId} is silent. No transcript generated. sending null Key to main server...`,
      );
      mainServerRequest
        .post(`/recording/${recordingId}/transcript`, {
          transcriptKey: null,
          isSilent: true,
        })
        .catch((err) =>
          console.error(
            `Failed to notify main server (silent) for ${recordingId}:`,
            err?.message ?? err,
          ),
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

    // console.log("transcriptJson", transcript);

    const { key } = await AWSService.uploadJsonToS3(
      transcript,
      `${recordingId}_transcript`,
      "tmp",
    );
    console.log("transcriptKey", key);

    // console.log("AWS file key (2)", key);

    console.log("Sending update to the main server");
    mainServerRequest
      .post(`/recording/${recordingId}/transcript`, { transcriptKey: key })
      .catch((err) =>
        console.error(
          `Failed to notify main server of transcript for ${recordingId}:`,
          err?.message ?? err,
        ),
      );

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
