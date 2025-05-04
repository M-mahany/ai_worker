import { parentPort, workerData } from "node:worker_threads";
import { mainServerRequest } from "../utils/mainAPI";
import { AiService } from "../services/aiService";
import { transformInsightsBody } from "../helpers/transformInsightsBody";
import { retryOnceFn } from "../utils/retryOnce";

export interface segmentDTO {
  start: number;
  end: number;
  text: string;
  words: string[];
}

(async () => {
  let transcript = workerData?.transcript;
  const recordingId = workerData?.recordingId;

  console.log(
    `Started processing AI Analysis for recording ${recordingId} transcript...`,
  );

  try {
    if (!transcript) {
      console.log(
        `Transcript not passed, Fetching recording ${recordingId} transcript from main Server...`,
      );
      const { data: response } = await mainServerRequest.get(
        `/recording/${recordingId}/transcript`,
      );
      const { data: recordingTranscript } = response;
      transcript = recordingTranscript;
    }

    const segmentsTxts = transcript?.segments
      ?.map((seg: segmentDTO) => seg?.text)
      .join("\n");

    console.log(
      `Processing Recording ${recordingId} transcript with ollama...`,
    );
    const llmInsightsJson = await retryOnceFn(() =>
      AiService.analyzeTranscript(segmentsTxts),
    );

    console.log("Sending AI analysis to the main Server...");

    await mainServerRequest.post(`/recording/${recordingId}/insights`, {
      insights: transformInsightsBody(llmInsightsJson),
    });

    parentPort?.postMessage({ success: true, recordingId });
  } catch (error: any) {
    console.error(
      `InsightProcessor Worker failed for recording ${recordingId} Error:`,
      error,
    );

    parentPort?.postMessage({
      success: false,
      error: error.message || "Unknown error",
      recordingId,
    });
  }
})();
