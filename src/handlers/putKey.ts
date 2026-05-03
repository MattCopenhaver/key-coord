import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { type APIGatewayProxyEventV2, type APIGatewayProxyResultV2 } from 'aws-lambda'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60

const TABLE_NAME = process.env.TABLE_NAME
if (TABLE_NAME === undefined) throw new Error('TABLE_NAME env var is required')

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const { guildId, characterName } = event.pathParameters ?? {}

  if (guildId === undefined || characterName === undefined) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId or characterName' }) }
  }

  const body = JSON.parse(event.body ?? '{}')
  const { dungeonId, keyLevel } = body

  if (dungeonId === undefined || keyLevel === undefined) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing dungeonId or keyLevel' }) }
  }

  if (typeof keyLevel !== 'number' || typeof dungeonId !== 'number') {
    return { statusCode: 400, body: JSON.stringify({ error: 'dungeonId and keyLevel must be numbers' }) }
  }

  const now = Math.floor(Date.now() / 1000)

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      guildId,
      characterName,
      dungeonId,
      keyLevel,
      updatedAt: new Date(now * 1000).toISOString(),
      ttl: now + ONE_WEEK_SECONDS
    }
  }))

  return { statusCode: 200, body: JSON.stringify({ success: true }) }
}
