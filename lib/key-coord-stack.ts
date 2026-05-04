import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'
import { type Construct } from 'constructs'

interface KeyCoordStackProps extends cdk.StackProps {
  envSuffix: string
}

export class KeyCoordStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props: KeyCoordStackProps) {
    super(scope, id, props)

    const suffix = `-${props.envSuffix}`

    const table = new dynamodb.Table(this, `key-coord-keys-table${suffix}`, {
      tableName: `key-coord-keys-table${suffix}`,
      partitionKey: { name: 'guildId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'characterName', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const blizzardClientId = process.env.BLIZZARD_CLIENT_ID ?? ''
    const blizzardClientSecret = process.env.BLIZZARD_CLIENT_SECRET ?? ''

    const commonEnv = { TABLE_NAME: table.tableName }
    const handlerDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(15),
      environment: commonEnv,
      bundling: { externalModules: ['@aws-sdk/*'] },
    }

    const putKeyFn = new lambdaNodejs.NodejsFunction(this, `key-coord-put-key${suffix}`, {
      ...handlerDefaults,
      functionName: `key-coord-put-key${suffix}`,
      entry: 'src/handlers/putKey.ts',
    })

    const getGuildKeysFn = new lambdaNodejs.NodejsFunction(this, `key-coord-get-guild-keys${suffix}`, {
      ...handlerDefaults,
      functionName: `key-coord-get-guild-keys${suffix}`,
      entry: 'src/handlers/getGuildKeys.ts',
    })

    const deleteKeyFn = new lambdaNodejs.NodejsFunction(this, `key-coord-delete-key${suffix}`, {
      ...handlerDefaults,
      functionName: `key-coord-delete-key${suffix}`,
      entry: 'src/handlers/deleteKey.ts',
    })

    const authCallbackFn = new lambdaNodejs.NodejsFunction(this, `key-coord-auth-callback${suffix}`, {
      ...handlerDefaults,
      functionName: `key-coord-auth-callback${suffix}`,
      entry: 'src/handlers/authCallback.ts',
      environment: {
        ...commonEnv,
        BLIZZARD_CLIENT_ID: blizzardClientId,
        BLIZZARD_CLIENT_SECRET: blizzardClientSecret,
      },
    })

    table.grantReadWriteData(putKeyFn)
    table.grantReadData(getGuildKeysFn)
    table.grantReadWriteData(deleteKeyFn)

    const httpApi = new apigateway.HttpApi(this, `key-coord-api${suffix}`, {
      apiName: `key-coord-api${suffix}`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowHeaders: ['*'],
      },
    })

    httpApi.addRoutes({
      path: '/keys/{guildId}/{characterName}',
      methods: [apigateway.HttpMethod.PUT],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(`key-coord-put-key-integration${suffix}`, putKeyFn),
    })

    httpApi.addRoutes({
      path: '/keys/{guildId}',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(`key-coord-get-guild-keys-integration${suffix}`, getGuildKeysFn),
    })

    httpApi.addRoutes({
      path: '/keys/{guildId}/{characterName}',
      methods: [apigateway.HttpMethod.DELETE],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(`key-coord-delete-key-integration${suffix}`, deleteKeyFn),
    })

    httpApi.addRoutes({
      path: '/auth/callback',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(`key-coord-auth-callback-integration${suffix}`, authCallbackFn),
    })

    const websiteBucket = new s3.Bucket(this, `key-coord-website${suffix}`, {
      bucketName: `key-coord-website${suffix}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const stripApiPrefixFn = new cloudfront.Function(this, `key-coord-strip-api-prefix${suffix}`, {
      functionName: `key-coord-strip-api-prefix${suffix}`,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/api/, '');
  if (request.uri === '') request.uri = '/';
  return request;
}
      `),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    })

    const apiDomain = `${httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`

    const distribution = new cloudfront.Distribution(this, `key-coord-distribution${suffix}`, {
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new cloudfrontOrigins.HttpOrigin(apiDomain),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          functionAssociations: [{
            function: stripApiPrefixFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    })

    // eslint-disable-next-line no-new
    new s3deploy.BucketDeployment(this, `key-coord-website-deployment${suffix}`, {
      sources: [s3deploy.Source.asset('website/dist')],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // eslint-disable-next-line no-new
    new cdk.CfnOutput(this, `key-coord-api-url${suffix}`, { value: httpApi.url ?? '' })
    // eslint-disable-next-line no-new
    new cdk.CfnOutput(this, 'WebsiteUrl', { value: `https://${distribution.distributionDomainName}` })
  }
}
