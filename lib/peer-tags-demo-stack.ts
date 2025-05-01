import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { DatadogLambda } from "datadog-cdk-constructs-v2";

export class PeerTagsDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table
    const userTable = new dynamodb.Table(this, 'peer-tags-user-table', {
      tableName: 'peer-tags-user-table',
      partitionKey: { name: 'uuid', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
    });

    // Create S3 bucket
    const bucket = new s3.Bucket(this, 'peer-tags-bucket', {
      bucketName: 'peer-tags-bucket',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
      autoDeleteObjects: true, // For development - change for production
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90), // Objects expire after 90 days
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30), // Minimum 30 days for STANDARD_IA
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(60), // Minimum 90 days for Glacier
            },
          ],
        },
      ],
    });

    // Create Kinesis stream
    const stream = new kinesis.Stream(this, 'peer-tags-stream', {
      streamName: 'peer-tags-stream',
      shardCount: 1, // For development - adjust for production
      retentionPeriod: cdk.Duration.hours(24), // For development - adjust for production
    });

    // Create EventBridge bus
    const eventBus = new events.EventBus(this, 'peer-tags-event-bus', {
      eventBusName: 'peer-tags-event-bus'
    });

    // SNS topic
    const topic = new sns.Topic(this, 'peer-tags-topic', {
      topicName: 'peer-tags-topic',
    });

    // Lambda function for publisher.
    const publisherLambda = new lambda.Function(this, 'peer-tags-publisher', {
      functionName: 'peer-tags-publisher',
      runtime: lambda.Runtime.NODEJS_20_X,  // Specify runtime
      handler: 'publisher.handler',            // Specify the handler function
      code: lambda.Code.fromAsset('lambda'), // Path to Lambda code
      memorySize: 128,                      // Memory allocation
      timeout: cdk.Duration.seconds(5),     // Timeout in seconds
      environment: {
        DD_COLD_START_TRACING: 'false',
        SNS_TOPIC_ARN: topic.topicArn,
        EVENT_BUS_NAME: eventBus.eventBusName,
        KINESIS_STREAM_NAME: stream.streamName,
        S3_BUCKET_NAME: bucket.bucketName,
      }
    });
    
    // Lambda function for SNS consumer.
    const snsConsumerLambda = new lambda.Function(this, 'peer-tags-sns-consumer', {
      functionName: 'peer-tags-sns-consumer',
      runtime: lambda.Runtime.NODEJS_20_X,  // Specify runtime
      handler: 'sns-consumer.handler',            // Specify the handler function
      code: lambda.Code.fromAsset('lambda'), // Path to Lambda code
      memorySize: 128,                      // Memory allocation
      timeout: cdk.Duration.seconds(5),     // Timeout in seconds
      environment: {
        DD_COLD_START_TRACING: 'false',
        TABLE_NAME: userTable.tableName, // DynamoDB table name to write to.
      }
    });

    // Lambda function for EventBridge consumer.
    const eventBridgeConsumerLambda = new lambda.Function(this, 'peer-tags-eventbridge-consumer', {
      functionName: 'peer-tags-eventbridge-consumer',
      runtime: lambda.Runtime.NODEJS_20_X,  // Specify runtime
      handler: 'eventbridge-consumer.handler',  // Specify the handler function
      code: lambda.Code.fromAsset('lambda'), // Path to Lambda code
      memorySize: 128,                      // Memory allocation
      timeout: cdk.Duration.seconds(5),     // Timeout in seconds
      environment: {
        DD_COLD_START_TRACING: 'false',
      }
    });

    // Lambda function for Kinesis consumer.
    const kinesisConsumerLambda = new lambda.Function(this, 'peer-tags-kinesis-consumer', {
      functionName: 'peer-tags-kinesis-consumer',
      runtime: lambda.Runtime.NODEJS_20_X,  // Specify runtime
      handler: 'kinesis-consumer.handler',  // Specify the handler function
      code: lambda.Code.fromAsset('lambda'), // Path to Lambda code
      memorySize: 128,                      // Memory allocation
      timeout: cdk.Duration.seconds(5),     // Timeout in seconds
      environment: {
        DD_COLD_START_TRACING: 'false',
      }
    });

    // Create SQS queue
    const queue = new sqs.Queue(this, 'peer-tags-queue', {
      queueName: 'peer-tags-queue',
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(4),
    });

    // Lambda function for SQS consumer
    const sqsConsumerLambda = new lambda.Function(this, 'peer-tags-sqs-consumer', {
      functionName: 'peer-tags-sqs-consumer',
      runtime: lambda.Runtime.NODEJS_20_X,  // Specify runtime
      handler: 'sqs-consumer.handler',  // Specify the handler function
      code: lambda.Code.fromAsset('lambda'), // Path to Lambda code
      memorySize: 128,                      // Memory allocation
      timeout: cdk.Duration.seconds(5),     // Timeout in seconds
      environment: {
        DD_COLD_START_TRACING: 'false',
        S3_BUCKET_NAME: bucket.bucketName,
      }
    });

    // Grant necessary permissions.
    topic.grantPublish(publisherLambda);
    userTable.grantWriteData(snsConsumerLambda);
    eventBus.grantPutEventsTo(publisherLambda);
    stream.grantWrite(publisherLambda);
    stream.grantRead(kinesisConsumerLambda);
    queue.grantSendMessages(publisherLambda);
    queue.grantConsumeMessages(sqsConsumerLambda);
    bucket.grantWrite(sqsConsumerLambda);

    // Subscribe the SNS consumer Lambda to the SNS topic
    topic.addSubscription(new snsSubs.LambdaSubscription(snsConsumerLambda));

    // Create EventBridge rule to capture user creation events
    const userCreatedRule = new events.Rule(this, 'user-created-rule', {
      eventBus: eventBus,
      eventPattern: {
        source: ['peer-tags-demo'],
        detailType: ['UserCreated'],
      },
      ruleName: 'user-created-rule',
    });

    // Add the EventBridge consumer Lambda as a target for the rule
    userCreatedRule.addTarget(new targets.LambdaFunction(eventBridgeConsumerLambda));

    // Add Kinesis event source mapping
    kinesisConsumerLambda.addEventSource(new lambdaEventSources.KinesisEventSource(stream, {
      batchSize: 10, // Process 10 records at a time
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // Add SQS event source mapping
    sqsConsumerLambda.addEventSource(new lambdaEventSources.SqsEventSource(queue, {
      batchSize: 10,
    }));

    // Update publisher Lambda environment variables
    publisherLambda.addEnvironment('SQS_QUEUE_URL', queue.queueUrl);

    // Integrate Datadog monitoring
    const datadogLambdas = new DatadogLambda(this, 'DatadogIntegration', {
      nodeLayerVersion: 124, // Use latest version
      extensionLayerVersion: 77, // Use latest version
      addLayers: true,
      enableDatadogTracing: true,
      enableDatadogLogs: true,
      site: 'datadoghq.com', // Adjust for EU if needed
      apiKey: process.env.DD_API_KEY,
      service: 'peer-tags-demo',
      env: 'production',
    });

    datadogLambdas.addLambdaFunctions([publisherLambda, snsConsumerLambda, eventBridgeConsumerLambda, kinesisConsumerLambda, sqsConsumerLambda]);

    // Create API Gateway and integrate with Lambda
    const apigw = new apigateway.LambdaRestApi(this, 'peer-tags-apigw', {
      handler: publisherLambda,
      proxy: true, // Forward all requests to Lambda
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true, // Enable X-Ray tracing for API Gateway
      }
    });

    // Output the SNS topic ARN
    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: topic.topicArn,
    });
    
    // Output the DynamoDB table name
    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: userTable.tableName,
    });

    // Output the EventBus name
    new cdk.CfnOutput(this, 'EventBusName', {
      value: eventBus.eventBusName,
    });

    // Output the Kinesis stream name
    new cdk.CfnOutput(this, 'KinesisStreamName', {
      value: stream.streamName,
    });

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: apigw.url
    });

    // Output publisher function ARN
    new cdk.CfnOutput(this, 'publisherLambdaFunctionArn', {
        value: publisherLambda.functionArn,
    });

    // Output SNS consumer function ARN
    new cdk.CfnOutput(this, 'snsConsumerLambdaFunctionArn', {
        value: snsConsumerLambda.functionArn,
    });

    // Output EventBridge consumer function ARN
    new cdk.CfnOutput(this, 'eventBridgeConsumerLambdaFunctionArn', {
        value: eventBridgeConsumerLambda.functionArn,
    });

    // Output Kinesis consumer function ARN
    new cdk.CfnOutput(this, 'kinesisConsumerLambdaFunctionArn', {
        value: kinesisConsumerLambda.functionArn,
    });

    // Output SQS queue URL
    new cdk.CfnOutput(this, 'SQSQueueUrl', {
      value: queue.queueUrl,
    });

    // Output SQS consumer function ARN
    new cdk.CfnOutput(this, 'sqsConsumerLambdaFunctionArn', {
      value: sqsConsumerLambda.functionArn,
    });

    // Output S3 bucket name
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: bucket.bucketName,
    });
  }
} 