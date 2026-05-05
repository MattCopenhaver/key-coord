import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME
if (TABLE_NAME === undefined) throw new Error('TABLE_NAME env var is required')

export const handler = async (event: { region: string }): Promise<void> => {
  const { region } = event
  console.log('purgeKeys invoked', { region })

  let lastEvaluatedKey: Record<string, unknown> | undefined
  let totalDeleted = 0

  do {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(guildId, :prefix)',
      ExpressionAttributeValues: { ':prefix': `${region}-` },
      ProjectionExpression: 'guildId, characterName',
      ExclusiveStartKey: lastEvaluatedKey,
    }))

    const items = scanResult.Items ?? []
    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined

    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25)
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map(item => ({
            DeleteRequest: {
              Key: { guildId: item.guildId as string, characterName: item.characterName as string },
            },
          })),
        },
      }))
      totalDeleted += chunk.length
    }
  } while (lastEvaluatedKey !== undefined)

  console.log('purgeKeys complete', { region, totalDeleted })
}
