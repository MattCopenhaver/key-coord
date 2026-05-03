import * as cdk from 'aws-cdk-lib'
import { CiStack } from '../lib/ci-stack'
import { KeyCoordStack } from '../lib/key-coord-stack'

const app = new cdk.App()

// eslint-disable-next-line no-new
new CiStack(app, 'key-coord-ci-iam-user')

const envSuffix = app.node.tryGetContext('envSuffix') as string | undefined
if (envSuffix !== undefined) {
  // eslint-disable-next-line no-new
  new KeyCoordStack(app, `key-coord-${envSuffix}`, { envSuffix })
}
