import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { type APIGatewayProxyEventV2, type APIGatewayProxyResultV2 } from 'aws-lambda'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME
if (TABLE_NAME === undefined) throw new Error('TABLE_NAME env var is required')

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('getGuildKeys invoked', { path: event.rawPath })

  const { guildId } = event.pathParameters ?? {}

  if (guildId === undefined) {
    console.log('getGuildKeys 400: missing guildId')
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId' }) }
  }

  const normalizedGuildId = guildId.toLowerCase()

  const params = event.queryStringParameters ?? {}
  const minLevel = params.minLevel !== undefined ? Number(params.minLevel) : undefined
  const maxLevel = params.maxLevel !== undefined ? Number(params.maxLevel) : undefined
  const dungeonId = params.dungeonId !== undefined ? Number(params.dungeonId) : undefined

  if ((minLevel !== undefined && isNaN(minLevel)) ||
      (maxLevel !== undefined && isNaN(maxLevel)) ||
      (dungeonId !== undefined && isNaN(dungeonId))) {
    console.log('getGuildKeys 400: invalid filter params', { minLevel, maxLevel, dungeonId })
    return { statusCode: 400, body: JSON.stringify({ error: 'minLevel, maxLevel, and dungeonId must be numbers' }) }
  }

  const filterParts: string[] = []
  const expressionValues: Record<string, number> = {}

  if (minLevel !== undefined) {
    filterParts.push('keyLevel >= :minLevel')
    expressionValues[':minLevel'] = minLevel
  }
  if (maxLevel !== undefined) {
    filterParts.push('keyLevel <= :maxLevel')
    expressionValues[':maxLevel'] = maxLevel
  }
  if (dungeonId !== undefined) {
    filterParts.push('dungeonId = :dungeonId')
    expressionValues[':dungeonId'] = dungeonId
  }

  let result
  try {
    result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'guildId = :guildId',
      FilterExpression: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
      ExpressionAttributeValues: {
        ':guildId': normalizedGuildId,
        ...expressionValues,
      },
    }))
  } catch (err) {
    console.error('getGuildKeys 500: DynamoDB query failed', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch keys' }) }
  }

  const keys = (result.Items ?? []).map((item) => ({
    guildId: item.guildId,
    characterName: item.characterName,
    dungeonId: item.dungeonId,
    keyLevel: item.keyLevel,
    updatedAt: item.updatedAt,
  }))

  console.log('getGuildKeys 200', { normalizedGuildId, count: keys.length })
  return {
    statusCode: 200,
    body: JSON.stringify({ keys }),
  }
}
