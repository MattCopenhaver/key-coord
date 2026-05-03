import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import { type Construct } from 'constructs'

export class CiStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const ciUser = new iam.User(this, 'key-coord-ci-iam-user-iam-user', {
      userName: 'key-coord-ci-iam-user'
    })

    ciUser.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: ['arn:aws:iam::*:role/cdk-*']
    }))

    ciUser.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudformation:DescribeStacks'],
      resources: ['*']
    }))
  }
}
