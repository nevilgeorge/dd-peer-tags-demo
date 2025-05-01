import { SQSEvent } from "aws-lambda";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: "us-east-1" });

type UserCreatedEvent = {
  firstName: string;
  lastName: string;
  timestamp: string;
  requestId: string;
};

/**
 * AWS Lambda handler function
 * @param event - SQS event
 */
export const handler = async (
  event: SQSEvent
): Promise<void> => {
  console.log("Received SQS event:", JSON.stringify(event));

  for (const record of event.Records) {
    const messageBody: UserCreatedEvent = JSON.parse(record.body);
    
    console.log(`Processing SQS message with ID: ${record.messageId}`);
    console.log(`Hello ${messageBody.firstName} ${messageBody.lastName}, welcome to Lambda + SQS traces with Datadog!`);
    console.log('Message details:', {
      timestamp: messageBody.timestamp,
      requestId: messageBody.requestId,
      messageId: record.messageId,
      sentTimestamp: record.attributes.SentTimestamp
    });

    try {
      // Write message to S3
      const s3Result = await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `sqs-messages/${record.messageId}.json`,
        Body: JSON.stringify({
          messageId: record.messageId,
          sentTimestamp: record.attributes.SentTimestamp,
          ...messageBody
        }, null, 2),
        ContentType: 'application/json'
      }));
      console.log('Successfully wrote message to S3:', s3Result);
    } catch (error) {
      console.error('Failed to write message to S3:', error);
      throw error; // Re-throw to trigger SQS retry
    }
  }
}; 