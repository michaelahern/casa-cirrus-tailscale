import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class TailscaleAuthKeyStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        new secretsmanager.Secret(this, 'AuthKeySecret', {
            secretName: 'tailscale/casa-cirrus',
            replicaRegions: [
                { region: 'us-east-1' },
                { region: 'us-west-2' }
            ]
        });
    }
}
