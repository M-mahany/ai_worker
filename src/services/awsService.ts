import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import { promisify } from "util";
import os from "os";
import { pipeline } from "stream";
import path from "path";
import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import {
  AutoScalingClient,
  CompleteLifecycleActionCommand,
  RecordLifecycleActionHeartbeatCommand,
} from "@aws-sdk/client-auto-scaling";

dotenv.config();
const ASG_NAME = "ai_worker_auto_scaling";
const ASG_HOOK_NAME = "pause_instance_termination";

const AWSConfig = {
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
};

const queueUrl = process.env.AWS_SQS_QUEUE_URL;

const SQS = new SQSClient(AWSConfig);

const S3 = new S3Client(AWSConfig);

export const autoScaling = new AutoScalingClient({
  ...AWSConfig,
  region: "us-east-1",
});

export class AWSService {
  // SQS
  static async pollQueue() {
    try {
      const command = new ReceiveMessageCommand({
        MaxNumberOfMessages: 2,
        MessageAttributeNames: ["All"],
        QueueUrl: queueUrl,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 300,
      });
      const { Messages } = await SQS.send(command);
      return Messages || [];
    } catch (error: any) {
      throw new Error(
        `Error polling messages from queue ${error?.messsage || error}`,
      );
    }
  }
  static async deleteMessageFromQueue(ReceiptHandle: string) {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: ReceiptHandle,
      });
      await SQS.send(command);
    } catch (error: any) {
      throw new Error(
        `Failed Deleteing Queue Message ${error?.message || error}`,
      );
    }
  }
  // S3 Bucket
  static async downloadS3File(key: string): Promise<string> {
    const streamPipeline = promisify(pipeline);

    const tempFilePath = path.join(os.tmpdir(), path.basename(key));
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    const { Body } = await S3.send(command);

    if (!Body || !(Body as any).pipe) {
      throw new Error("S3 response body is not a readable stream");
    }

    const fileStream = createWriteStream(tempFilePath);

    await streamPipeline(Body as NodeJS.ReadableStream, fileStream);

    return tempFilePath;
  }
  static async uploadJsonToS3(
    data: object,
    fileName: string,
    folderName: string,
  ): Promise<{ key: string }> {
    if (!process.env.AWS_BUCKET_NAME) {
      throw new Error("AWS_BUCKET_NAME is not set in environment variables.");
    }

    const jsonData = JSON.stringify(data, null, 2);

    // const key = `${folderName}/${Date.now()}_${fileName}.json`;

    const key = `${folderName}/${fileName}.json`;

    try {
      await S3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
          Body: Buffer.from(jsonData),
          ContentType: "application/json",
        }),
      );

      return { key };
    } catch (err: any) {
      console.log(`Failed to upload file to S3: ${err?.message || err}`);
      throw new Error(`Failed to upload file to S3: ${err?.message || err}`);
    }
  }

  static async fileExists(key: string) {
    try {
      await S3.send(
        new HeadObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
        }),
      );
      return true; // ✅ File exists
    } catch (error: any) {
      // if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      //   return false; // ❌ File does not exist
      // }
      // Any other unexpected error (e.g. permissions, invalid bucket)
      // console.error("Error checking file existence:", error);
      return false;
    }
  }

  static async downloadJsonFromS3(key: string): Promise<string> {
    try {
      if (!process.env.AWS_BUCKET_NAME) {
        throw new Error("AWS_BUCKET_NAME is not set in environment variables.");
      }

      const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      });

      const { Body } = await S3.send(command);

      if (!Body) {
        throw new Error("Empty response body from S3");
      }

      const jsonData = JSON.parse(await Body.transformToString());

      // Save to temp file
      const tempFilePath = path.join(os.tmpdir(), `doa_${path.basename(key)}`);
      await fs.writeFile(
        tempFilePath,
        JSON.stringify(jsonData, null, 2),
        "utf-8",
      );

      console.log(`✅ DOA JSON file downloaded from S3: ${key}`);

      return tempFilePath;
    } catch (error: any) {
      console.error(
        `❌ Failed to download DOA JSON file from S3: ${error.message}`,
      );
      throw error;
    }
  }

  // AutoScaling
  static async completeLifecycleAction(instanceId: string) {
    const params = {
      AutoScalingGroupName: ASG_NAME,
      LifecycleHookName: ASG_HOOK_NAME,
      InstanceId: instanceId,
      LifecycleActionResult: "CONTINUE",
    };

    try {
      const command = new CompleteLifecycleActionCommand(params);
      const result = await autoScaling.send(command);
      console.log("Lifecycle action completed:", result);
    } catch (error: any) {
      throw new Error(
        `Error completing lifecycle action Error: ${error?.message || error}`,
      );
    }
  }

  static async sendLifeCycleHeartBeat(InstanceId: string) {
    try {
      await autoScaling.send(
        new RecordLifecycleActionHeartbeatCommand({
          LifecycleHookName: ASG_HOOK_NAME,
          AutoScalingGroupName: ASG_NAME,
          InstanceId,
        }),
      );
    } catch (error: any) {
      throw new Error(
        `Error Sending Heart beat to Auto scaling group Error:${error?.message || error}`,
      );
    }
  }
}
