import { type APIGatewayProxyHandlerV2 } from 'aws-lambda'

const CLIENT_ID = process.env.BLIZZARD_CLIENT_ID
if (CLIENT_ID === undefined) throw new Error('BLIZZARD_CLIENT_ID not set')

const CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET
if (CLIENT_SECRET === undefined) throw new Error('BLIZZARD_CLIENT_SECRET not set')

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log('authCallback invoked')

  const code = event.queryStringParameters?.code
  const redirectUri = event.queryStringParameters?.redirect_uri

  if (code === undefined || redirectUri === undefined) {
    console.log('authCallback 400: missing code or redirect_uri')
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or redirect_uri' }) }
  }

  const tokenRes = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenRes.ok) {
    console.error('authCallback 401: token exchange failed', tokenRes.status, await tokenRes.text())
    return { statusCode: 401, body: JSON.stringify({ error: 'Token exchange failed' }) }
  }

  const token = await tokenRes.json() as { access_token: string, expires_in: number }

  const userRes = await fetch('https://oauth.battle.net/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })

  if (!userRes.ok) {
    console.error('authCallback 401: userinfo fetch failed', userRes.status)
    return { statusCode: 401, body: JSON.stringify({ error: 'Failed to fetch user info' }) }
  }

  const user = await userRes.json() as { battletag: string }

  console.log('authCallback 200: success', { battletag: user.battletag })
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      battletag: user.battletag,
      accessToken: token.access_token,
      expiresIn: token.expires_in,
    }),
  }
}
