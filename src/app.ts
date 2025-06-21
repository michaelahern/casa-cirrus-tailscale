#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TailscaleExitNode } from './stack.js';

const app = new cdk.App();
new TailscaleExitNode(app, 'TailscaleExitNode', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
