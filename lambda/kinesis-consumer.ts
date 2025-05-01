import { KinesisStreamEvent } from "aws-lambda";

type UserCreatedEvent = {
  firstName: string;
  lastName: string;
  timestamp: string;
  requestId: string;
};

/**
 * AWS Lambda handler function
 * @param event - Kinesis stream event
 */
export const handler = async (
  event: KinesisStreamEvent
): Promise<void> => {
  console.log("Received Kinesis event:", JSON.stringify(event));

  for (const record of event.Records) {
    const payload = Buffer.from(record.kinesis.data, 'base64').toString();
    const messageBody: UserCreatedEvent = JSON.parse(payload);
    
    console.log(`Processing Kinesis record from shard ${record.kinesis.partitionKey}`);
    console.log(`Hello ${messageBody.firstName} ${messageBody.lastName}, welcome to Lambda + Kinesis traces with Datadog!`);
    console.log('Record details:', {
      timestamp: messageBody.timestamp,
      requestId: messageBody.requestId,
      sequenceNumber: record.kinesis.sequenceNumber,
      approximateArrivalTimestamp: record.kinesis.approximateArrivalTimestamp
    });
  }
}; 