import { spawn } from "child_process";
import { promises as fs } from "fs";
import ollama from "ollama";
import { join, dirname, basename } from "path";
import { llmPrompt, speakerTypePrompt } from "../helpers/generateAiPrompt";
import { InsightResponse } from "../helpers/transformInsightsBody";
import { retryOnceFn } from "../utils/retryOnce";
import dotenv from "dotenv";

dotenv.config();

export interface whisperS2T {
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
  start_time: number;
  end_time: number;
  speaker: string;
}

export interface TranscriptBySpeakerDTO {
  "Speaker 1": string;
  "Speaker 2": string;
}

let pullingPromise: Promise<void> | null = null;

export class AiService {
  static async transcribeAudio(
    audioFile: string,
  ): Promise<{ text: string; start: number; end: number; words: never[] }[]> {
    return new Promise((resolve, reject) => {
      const command = `/home/ubuntu/whisper-env/bin/python3 src/scripts/whisper.py ${audioFile} ${process.env.HUGGINGFACE_TOKEN}`;

      const pythonProcess = spawn(command, { shell: true });

      let fullData = "";
      let errorOutput = "";

      pythonProcess.stdout.on("data", (data) => {
        fullData += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on("close", async (code) => {
        if (code !== 0) {
          return reject(
            new Error(`Whisper failed with code ${code}: ${errorOutput}`),
          );
        }

        // Generate expected JSON filename
        const jsonFilePath = join(
          dirname(audioFile),
          `0_${basename(audioFile).split(".")[0]}.json`,
        );

        try {
          const readJson = await fs.readFile(jsonFilePath, "utf-8");
          const parsedJson = JSON.parse(readJson);

          // Delete JSON file after reading
          await fs.unlink(jsonFilePath);
          const formatedJson = this.transformJson(parsedJson);

          const transcriptBySpeaker = {
            "Speaker 1": formatedJson
              .filter((seg) => seg.speaker === "Speaker 1")
              .map((seg) => seg.text)
              .join(" "),
            "Speaker 2": formatedJson
              .filter((seg) => seg.speaker === "Speaker 2")
              .map((seg) => seg.text)
              .join(" "),
          };

          const mappedSpeaker: Record<string, string> | undefined =
            await retryOnceFn(() =>
              this.getSpeakerTypeFromTranscript(transcriptBySpeaker),
            );

          const constructedSegments = formatedJson.map((seg) => ({
            ...seg,
            speaker: mappedSpeaker?.[seg.speaker] ?? seg.speaker,
          }));

          resolve(constructedSegments);
        } catch (error: any) {
          reject(
            new Error("Failed transcribing audio: " + error?.message || error),
          );
        }
      });
    });
  }

  static transformJson(whisperS2tTranscript: whisperS2T[]) {
    return whisperS2tTranscript.map((segment) => ({
      text: segment.text,
      start: segment.start_time,
      end: segment.end_time,
      speaker: segment.speaker,
      words: [],
    }));
  }

  static async analyzeTranscript(
    transcriptText: string,
  ): Promise<InsightResponse> {
    try {
      const modelName = "phi4";

      const { models } = await ollama.list();
      const modelExists = models.some((m) => m.name.includes(modelName));
      if (!modelExists) {
        if (pullingPromise) {
          await pullingPromise;
        } else {
          pullingPromise = (async () => {
            const pullStream = await ollama.pull({
              model: modelName,
              stream: true,
            });
            for await (const status of pullStream) {
              if (status.status)
                console.log(`[Pulling ${modelName}] ${status.status}`);
            }
            console.log(`Model "${modelName}" pulled successfully.`);
          })();
          await pullingPromise;
          pullingPromise = null;
        }
      }

      const llmResponse = await ollama.generate({
        model: modelName,
        options: {
          temperature: 0.3,
        },
        prompt: llmPrompt(transcriptText),
        stream: false,
      });
      const { response } = llmResponse;

      console.log("raw llm response before cleaning", response);

      const matches = [...response.matchAll(/```json([\s\S]*?)```/gi)];
      const jsonMatch =
        matches.length > 0 ? matches[matches.length - 1][1].trim() : null;

      if (!jsonMatch) {
        throw new Error(`Ai Response is not a valid json`);
      }

      console.log("raw llm response", jsonMatch);

      const jsonStart = jsonMatch.indexOf("{");
      const jsonEnd = jsonMatch.lastIndexOf("}") + 1;

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Could not locate JSON boundaries in response.");
      }

      const jsonString = jsonMatch.substring(jsonStart, jsonEnd);

      const parsed = JSON.parse(jsonString);

      return parsed;
    } catch (error: any) {
      console.log(`LLM failed analyzing transcript Error`, error);
      throw new Error(
        `LLM failed analyzing transcript Error:${error?.message || error}`,
      );
    }
  }

  static async getSpeakerTypeFromTranscript(
    transcriptBySpeaker: TranscriptBySpeakerDTO,
  ): Promise<{
    "Speaker 1": string;
    "Speaker 2": string;
  }> {
    try {
      const modelName = "phi4";

      const { models } = await ollama.list();
      const modelExists = models.some((m) => m.name.includes(modelName));
      if (!modelExists) {
        if (pullingPromise) {
          await pullingPromise;
        } else {
          pullingPromise = (async () => {
            const pullStream = await ollama.pull({
              model: modelName,
              stream: true,
            });
            for await (const status of pullStream) {
              if (status.status)
                console.log(`[Pulling ${modelName}] ${status.status}`);
            }
            console.log(`Model "${modelName}" pulled successfully.`);
          })();
          await pullingPromise;
          pullingPromise = null;
        }
      }

      const llmResponse = await ollama.generate({
        model: modelName,
        options: {
          temperature: 0.3,
        },
        prompt: speakerTypePrompt(transcriptBySpeaker),
        stream: false,
      });
      const { response } = llmResponse;

      console.log("raw llm response before cleaning", response);

      const matches = [...response.matchAll(/```json([\s\S]*?)```/gi)];
      const jsonMatch =
        matches.length > 0 ? matches[matches.length - 1][1].trim() : null;

      if (!jsonMatch) {
        throw new Error(`Ai Response is not a valid json`);
      }

      console.log("raw llm response", jsonMatch);

      const jsonStart = jsonMatch.indexOf("{");
      const jsonEnd = jsonMatch.lastIndexOf("}") + 1;

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Could not locate JSON boundaries in response.");
      }

      const jsonString = jsonMatch.substring(jsonStart, jsonEnd);

      const parsed = JSON.parse(jsonString);

      return parsed;
    } catch (error: any) {
      console.log(`LLM failed analyzing transcript Error`, error);
      throw new Error(
        `LLM failed analyzing transcript Error:${error?.message || error}`,
      );
    }
  }
}
