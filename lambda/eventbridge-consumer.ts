import { APIGatewayProxyResult, EventBridgeEvent } from "aws-lambda";

type UserCreatedEvent = {
  firstName: string;
  lastName: string;
  timestamp?: string;
  requestId?: string;
};

/**
 * AWS Lambda handler function
 * @param event - EventBridge event
 * @returns APIGatewayProxyResult
 */
export const handler = async (
  event: EventBridgeEvent<'UserCreated', UserCreatedEvent>,
): Promise<APIGatewayProxyResult> => {
  console.log("Received EventBridge event:", JSON.stringify(event));

  const messageBody = event.detail;
  console.log(`Hello ${messageBody.firstName} ${messageBody.lastName}, welcome to Lambda + EventBridge traces with Datadog!`);
  
  return {statusCode: 200, body: 'Event processed!'};
}; 