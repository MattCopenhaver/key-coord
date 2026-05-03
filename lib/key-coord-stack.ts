import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
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
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    const commonEnv = { TABLE_NAME: table.tableName }
    const handlerDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: commonEnv,
      bundling: { externalModules: ['@aws-sdk/*'] }
    }

    const putKeyFn = new lambdaNodejs.NodejsFunction(this, `key-coord-put-key${suffix}`, {
      ...handlerDefaults,
      functionName: `key-coord-put-key${suffix}`,
      entry: 'src/handlers/putKey.ts'
    })

    const getGuildKeysFn = new lambdaNodejs.NodejsFunction(this, `key-coord-get-guild-keys${suffix}`, {
      ...handlerDefaults,
      functionName: `key-coord-get-guild-keys${suffix}`,
      entry: 'src/handlers/getGuildKeys.ts'
    })

    const deleteKeyFn = new lambdaNodejs.NodejsFunction(this, `key-coord-delete-key${suffix}`, {
      ...handlerDefaults,
      functionName: `key-coord-delete-key${suffix}`,
      entry: 'src/handlers/deleteKey.ts'
    })

    table.grantReadWriteData(putKeyFn)
    table.grantReadData(getGuildKeysFn)
    table.grantReadWriteData(deleteKeyFn)

    const httpApi = new apigateway.HttpApi(this, `key-coord-api${suffix}`, {
      apiName: `key-coord-api${suffix}`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowHeaders: ['*']
      }
    })

    httpApi.addRoutes({
      path: '/keys/{guildId}/{characterName}',
      methods: [apigateway.HttpMethod.PUT],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(`key-coord-put-key-integration${suffix}`, putKeyFn)
    })

    httpApi.addRoutes({
      path: '/keys/{guildId}',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(`key-coord-get-guild-keys-integration${suffix}`, getGuildKeysFn)
    })

    httpApi.addRoutes({
      path: '/keys/{guildId}/{characterName}',
      methods: [apigateway.HttpMethod.DELETE],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(`key-coord-delete-key-integration${suffix}`, deleteKeyFn)
    })

    // eslint-disable-next-line no-new
    new cdk.CfnOutput(this, `key-coord-api-url${suffix}`, { value: httpApi.url ?? '' })
  }
}
