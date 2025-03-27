import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

dotenv.config();

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

export class AWSService {
  static async pollQueue() {
    try {
      const command = new ReceiveMessageCommand({
        MaxNumberOfMessages: 1,
        MessageAttributeNames: ["All"],
        QueueUrl: queueUrl,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 900,
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
}
