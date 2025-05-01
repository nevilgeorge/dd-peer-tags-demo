import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sns = new SNSClient({ region: "us-east-1" });
const eventBridge = new EventBridgeClient({ region: "us-east-1" });
const kinesis = new KinesisClient({ region: "us-east-1" });
const sqs = new SQSClient({ region: "us-east-1" });

/**
 * AWS Lambda handler function
 * @param event - API Gateway event
 * @param context - Lambda execution context
 * @returns APIGatewayProxyResult
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log("Lambda function triggered with event:", event);
  console.log("Lambda function triggered with context:", context);

  if (!event.body) {
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Invalid JSON format",
            requestId: context.awsRequestId,
        }),
    }
  }

  const body = JSON.parse(event.body)
  
  if (!body['firstName'] || !body['lastName']) {
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Body requires firstName and lastName",
            requestId: context.awsRequestId,
        }),
    };
  }
  
  const topicArn = process.env.SNS_TOPIC_ARN;
  const eventBusName = process.env.EVENT_BUS_NAME;
  const streamName = process.env.KINESIS_STREAM_NAME;
  const queueUrl = process.env.SQS_QUEUE_URL;

  try {
    // Publish to SNS
    const snsResult = await sns.send(new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(body)
    }));

    // Send event to EventBridge
    const eventBridgeResult = await eventBridge.send(new PutEventsCommand({
        Entries: [{
            EventBusName: eventBusName,
            Source: 'peer-tags-demo',
            DetailType: 'UserCreated',
            Detail: JSON.stringify({
                firstName: body.firstName,
                lastName: body.lastName,
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId
            })
        }]
    }));

    // Write to Kinesis
    const kinesisResult = await kinesis.send(new PutRecordCommand({
        StreamName: streamName,
        PartitionKey: context.awsRequestId,
        Data: Buffer.from(JSON.stringify({
            firstName: body.firstName,
            lastName: body.lastName,
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId
        }))
    }));

    // Send message to SQS
    const sqsResult = await sqs.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
            firstName: body.firstName,
            lastName: body.lastName,
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId
        })
    }));

    console.log('EventBridge result:', eventBridgeResult);
    console.log('Kinesis result:', kinesisResult);
    console.log('SQS result:', sqsResult);
  } catch (error) {
    console.error("Failed to publish message:", error);
    return { statusCode: 500, body: "Failed to publish message" };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Successfully published to SNS, EventBridge, Kinesis, and SQS!",
      requestId: context.awsRequestId,
      receiveBody: JSON.parse(event.body),
    }),
  };
};
