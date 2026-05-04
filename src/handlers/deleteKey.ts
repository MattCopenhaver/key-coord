import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { type APIGatewayProxyEventV2, type APIGatewayProxyResultV2 } from 'aws-lambda'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME
if (TABLE_NAME === undefined) throw new Error('TABLE_NAME env var is required')

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('deleteKey invoked', { path: event.rawPath })

  const { guildId, characterName } = event.pathParameters ?? {}

  if (guildId === undefined || characterName === undefined) {
    console.log('deleteKey 400: missing path params', { guildId, characterName })
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId or characterName' }) }
  }

  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { guildId: guildId.toLowerCase(), characterName },
    }))
  } catch (err) {
    console.error('deleteKey 500: DynamoDB delete failed', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to delete key' }) }
  }

  console.log('deleteKey 200: success', { guildId, characterName })
  return { statusCode: 200, body: JSON.stringify({ success: true }) }
}
