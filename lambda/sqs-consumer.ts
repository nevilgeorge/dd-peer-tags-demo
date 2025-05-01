import { SQSEvent } from "aws-lambda";

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
  }
}; 