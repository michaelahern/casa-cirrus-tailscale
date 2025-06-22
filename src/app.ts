import * as cdk from 'aws-cdk-lib';
import { TailscaleAuthKeyStack } from './auth-key-stack.js';
import { TailscaleExitNodeStack } from './exit-node-stack.js';
import { TailscaleRouterNodeStack } from './router-node-stack.js';

const app = new cdk.App();

new TailscaleAuthKeyStack(app, 'TailscaleAuthKey', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

new TailscaleExitNodeStack(app, 'TailscaleExitNode', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});

new TailscaleRouterNodeStack(app, 'TailscaleRouterNode', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
