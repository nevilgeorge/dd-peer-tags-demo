import { APIGatewayProxyResult, SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * AWS Lambda handler function
 * @param event - SNS event
 * @returns APIGatewayProxyResult
 */
export const handler = async (
  event: SNSEvent,
): Promise<APIGatewayProxyResult> => {
  console.log("Received SNS message:", JSON.stringify(event));

  for (const record of event.Records) {
    const messageBody = JSON.parse(record.Sns.Message);
    console.log(`Hello ${messageBody.firstName} ${messageBody.lastName}, welcome to Lambda + SNS traces with Datadog!`);
    
    // Write to DynamoDB
    const params = {
      TableName: process.env.TABLE_NAME!,
      Item: {
        uuid: uuidv4(),
        firstName: messageBody.firstName,
        lastName: messageBody.lastName,
        createdAt: new Date().toISOString()
      }
    };

    try {
      await docClient.send(new PutCommand(params));
      console.log('Successfully wrote to DynamoDB:', params.Item);
    } catch (error) {
      console.error('Error writing to DynamoDB:', error);
      throw error;
    }
  }

  return {statusCode: 200, body: 'Messages processed!'};
};
