import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { type APIGatewayProxyEventV2, type APIGatewayProxyResultV2 } from 'aws-lambda'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME
if (TABLE_NAME === undefined) throw new Error('TABLE_NAME env var is required')

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const { guildId, characterName } = event.pathParameters ?? {}

  if (guildId === undefined || characterName === undefined) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId or characterName' }) }
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { guildId, characterName },
  }))

  return { statusCode: 200, body: JSON.stringify({ success: true }) }
}
