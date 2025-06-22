import * as cdk from 'aws-cdk-lib';
import { TailscaleExitNodeStack } from './stack.js';

const app = new cdk.App();
new TailscaleExitNodeStack(app, 'TailscaleExitNode', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
