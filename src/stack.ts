import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class TailscaleExitNodeStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const authKeySecret = new secretsmanager.Secret(this, 'AuthKey', {
            secretName: 'tailscale/casa-cloud-exit-node/auth-key'
        });

        const vpc = new ec2.Vpc(this, 'VPC', {
            maxAzs: 3,
            natGateways: 0,
            subnetConfiguration: [{
                cidrMask: 24,
                name: 'Public',
                subnetType: ec2.SubnetType.PUBLIC
            }]
        });

        new ecs.Cluster(this, 'Cluster', {
            vpc: vpc
        });

        new ecs.FargateTaskDefinition(this, 'Tailscale', {
            // executionRole
            cpu: 2048,
            memoryLimitMiB: 4096,
            runtimePlatform: {
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
            }
        }).addContainer('tailscale', {
            image: ecs.ContainerImage.fromRegistry('ghcr.io/tailscale/tailscale:latest'),
            environment: {
                TS_ENABLE_HEALTH_CHECK: 'true',
                TS_EXTRA_ARGS: '--advertise-exit-node',
                TS_HOSTNAME: 'casa-cloud-exit-node'
            },
            secrets: {
                TS_AUTH_KEY: ecs.Secret.fromSecretsManager(authKeySecret)
            },
            essential: true,
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logRetention: cdk.aws_logs.RetentionDays.ONE_MONTH,
                mode: ecs.AwsLogDriverMode.NON_BLOCKING
            }),
            portMappings: [{
                containerPort: 9002,
                hostPort: 9002,
                protocol: ecs.Protocol.TCP
            }]
        });
    }
}
