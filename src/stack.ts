import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export class TailscaleExitNodeStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'tailscale-vpc', {
            maxAzs: 3,
            natGateways: 0,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'tailscale-subnet',
                    subnetType: ec2.SubnetType.PUBLIC
                }
            ],
            vpcName: 'tailscale-vpc'
        });

        new ecs.Cluster(this, 'tailscale-cluster', {
            vpc: vpc
        });
    }
}
