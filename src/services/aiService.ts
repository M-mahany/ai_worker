import { spawn } from "child_process";
import { promises as fs } from "fs";
import ollama from "ollama";
import { join, dirname, basename } from "path";
import { llmPrompt } from "../helpers/generateAiPrompt";
import { InsightResponse } from "../helpers/transformInsightsBody";

export interface whisperS2T {
  text: string;
  avg_logprob: number;
  start_time: number;
  end_time: number;
}

export class AiService {
  static async transcribeAudio(
    audioFile: string,
  ): Promise<{ text: string; start: number; end: number; words: never[] }[]> {
    return new Promise((resolve, reject) => {
      const command = `/home/ubuntu/whisper-env/bin/python3 src/scripts/whisper.py ${audioFile}`;

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
      words: [],
    }));
  }

  static async analyzeTranscript(
    transcriptText: string,
  ): Promise<InsightResponse> {
    try {
      const llmResponse = await ollama.generate({
        model: "deepseek-r1:7b",
        prompt: llmPrompt(transcriptText),
        stream: false,
      });
      const { response } = llmResponse;

      console.log("raw llm response before cleaning", response);

      const jsonMatch = response.match(/```json([\s\S]*?)```/i);
      const cleanedResponse = jsonMatch ? jsonMatch[1].trim() : response;

      console.log("raw llm response", cleanedResponse);

      const jsonStart = cleanedResponse.indexOf("{");
      const jsonEnd = cleanedResponse.lastIndexOf("}") + 1;

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Could not locate JSON boundaries in response.");
      }

      const jsonString = cleanedResponse.substring(jsonStart, jsonEnd);

      const parsed = JSON.parse(jsonString);

      return parsed;
    } catch (error: any) {
      throw new Error(
        `LLM failed analyzing transcript Error:${error?.message || error}`,
      );
    }
  }
}
