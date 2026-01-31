import { spawn } from "child_process";
import { promises as fs } from "fs";
import ollama from "ollama";
import { join, dirname, basename } from "path";
import { llmPrompt } from "../helpers/generateAiPrompt";
import { InsightResponse } from "../helpers/transformInsightsBody";
import dotenv from "dotenv";

dotenv.config();

export interface WhisperS2TWords {
  word: string;
  start_time: number;
  end_time: number;
  speaker: string;
}

export interface whisperS2T {
  text: string;
  start_time: number;
  end_time: number;
  words: WhisperS2TWords[];
}

let pullingPromise: Promise<void> | null = null;

export class AiService {
  static async transcribeAudio(audioFile: string): Promise<
    {
      text: string;
      start: number;
      end: number;
      words: {
        word: string;
        start: number;
        end: number;
        speaker: string;
      }[];
    }[]
  > {
    return new Promise((resolve, reject) => {
      const command = `/home/ubuntu/whisper-env/bin/python3 src/scripts/whisper.py ${audioFile} ${process.env.HUGGINGFACE_TOKEN}`;

      const env = {
        ...process.env,
        LD_LIBRARY_PATH: "/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu",
      };

      const pythonProcess = spawn(command, { shell: true, env });

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
          `${basename(audioFile).split(".")[0]}_faster_whisper.json`,
        );

        try {
          const readJson = await fs.readFile(jsonFilePath, "utf-8");
          const parsedJson = JSON.parse(readJson);

          // Delete JSON file after reading
          await fs.unlink(jsonFilePath);
          const formatedJson = this.transformJson(parsedJson);

          resolve(formatedJson);
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
      words: segment.words.map((wrd) => ({
        word: wrd.word,
        start: wrd.start_time,
        end: wrd.end_time,
        speaker: wrd.speaker,
      })),
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

  //
}
