# AWS Services Documentation - Casa Cirrus Tailscale

This document provides a comprehensive overview of all AWS services used in the Casa Cirrus Tailscale project, including detailed narratives about each service and how they are utilized in this infrastructure.

## Table of Contents

1. [AWS CloudFormation](#aws-cloudformation)
2. [Amazon EC2 (VPC)](#amazon-ec2-vpc)
3. [Amazon ECS with AWS Fargate](#amazon-ecs-with-aws-fargate)
4. [AWS Secrets Manager](#aws-secrets-manager)
5. [Amazon CloudWatch Logs](#amazon-cloudwatch-logs)
6. [AWS IAM (Identity and Access Management)](#aws-iam-identity-and-access-management)
7. [AWS KMS (Key Management Service)](#aws-kms-key-management-service)
8. [Amazon S3](#amazon-s3)
9. [AWS Lambda](#aws-lambda)
10. [AWS EventBridge](#aws-eventbridge)
11. [Elastic Load Balancing v2](#elastic-load-balancing-v2)

---

## AWS CloudFormation

### Service Overview

AWS CloudFormation is Amazon's native Infrastructure as Code (IaC) service that allows you to model, provision, and manage AWS resources by treating infrastructure as code. Instead of manually clicking through the AWS Console to create servers, databases, and networking components, you write a declarative template file (in JSON or YAML format), and CloudFormation builds the entire environment for you automatically. This service provides deep integration with AWS services and typically supports new AWS features first, making it the go-to choice for AWS-native infrastructure automation.

CloudFormation templates describe all the AWS resources you want to deploy, and the service handles the provisioning and configuration in the correct order, managing dependencies automatically. The service also provides powerful features like stack sets for multi-account and multi-region deployments, drift detection to identify configuration changes, and change sets to preview modifications before applying them to running infrastructure.

### Usage in This Project

In the Casa Cirrus Tailscale project, AWS CloudFormation is used implicitly through the AWS Cloud Development Kit (CDK). The CDK provides a higher-level programming interface (using TypeScript in this case) that synthesizes down to CloudFormation templates. This approach combines the benefits of CloudFormation's robust deployment engine with the expressiveness and reusability of a modern programming language.

**Key Implementation Details:**
- **Location**: `cdk.json` - CDK configuration that controls CloudFormation behavior
- **Deployment**: The `.github/workflows/deploy.yml` and `.github/workflows/diff.yml` workflows use CDK to synthesize and deploy CloudFormation stacks
- **Multi-Region Deployment**: CloudFormation stacks are deployed across three AWS regions:
  - `us-east-2`: Primary region for auth key and router node
  - `us-east-1`: Secondary region for exit node
  - `us-west-2`: Tertiary region for exit node

The CDK app defines three distinct stacks that CloudFormation manages:
1. Authentication Key Stack - Manages Tailscale authentication secrets
2. Router Node Stack - Deploys the Tailscale router infrastructure
3. Exit Node Stacks - Deploys Tailscale exit nodes in multiple regions

### Recent Developments (2025)

- **AI-Powered Assistance**: AWS introduced the Infrastructure-as-Code (IaC) MCP Server, bridging AI assistants with CloudFormation development workflows
- **IDE Experience**: New CloudFormation IDE Experience provides end-to-end development within IDEs with CloudFormation-first tooling

---

## Amazon EC2 (VPC)

### Service Overview

Amazon Elastic Compute Cloud (EC2) provides the compute layer of AWS infrastructure, offering resizable virtual servers (instances) that run applications in the cloud. Amazon Virtual Private Cloud (VPC) is the networking foundation that defines the private network environment in which these instances operate. A VPC is a logically isolated section of the AWS cloud where you can launch AWS resources in a virtual network that you define, giving you complete control over your virtual networking environment.

With VPC, you control every aspect of your network configuration, including IP address ranges (CIDR blocks), subnet creation, route table configuration, network gateway setup, and security settings through security groups and network ACLs. Each VPC spans all Availability Zones (AZs) in a region, providing high availability and fault tolerance. You can create both public subnets (with internet access via Internet Gateways) and private subnets (isolated from direct internet access), enabling sophisticated network architectures.

VPC networking operates at Layer 3/4 of the OSI model, though newer services like VPC Lattice extend capabilities to Layer 7 with application-level routing and service mesh features. Production environments should always use custom VPCs rather than the default VPC, as custom VPCs provide fine-grained control over network isolation, security boundaries, and compliance requirements.

### Usage in This Project

The Casa Cirrus Tailscale project uses VPC networking extensively to create isolated, secure network environments for running Tailscale nodes. Each deployment stack creates its own VPC infrastructure with carefully configured networking components.

**Router Node Stack** (`src/router-node-stack.ts`):
- **VPC Configuration**: Creates a dedicated VPC with CIDR block `10.100.0.0/16`
- **Subnet Strategy**: Public subnets only (private subnets disabled with `natGateways: 0`)
- **Internet Connectivity**: Internet Gateway for public internet access
- **VPN Gateway**: Includes VPN Gateway for site-to-site VPN connectivity
- **Security Groups**: Custom security group rules for container traffic
- **High Availability**: VPC spans multiple Availability Zones

**Exit Node Stack** (`src/exit-node-stack.ts`):
- **VPC Configuration**: Creates a dedicated VPC with CIDR block `10.101.0.0/16`
- **Subnet Strategy**: Public subnets only (no NAT Gateways)
- **Simpler Design**: No VPN Gateway (unlike router node)
- **Security Groups**: Container-specific security rules
- **Multi-Region**: Deployed in both `us-east-1` and `us-west-2`

**Network Design Rationale:**
The use of public subnets with no NAT Gateways reflects the nature of Tailscale nodes, which need direct internet connectivity to establish peer-to-peer connections and serve as network routing points. This design minimizes costs (no NAT Gateway charges) while providing the necessary connectivity for Tailscale's mesh networking protocol.

### Best Practices Implemented

- **Custom VPCs**: Uses custom VPCs instead of default VPC for production deployments
- **CIDR Isolation**: Different CIDR blocks for each deployment prevent IP conflicts
- **Multi-AZ**: Spans availability zones for high availability
- **Security Groups**: Fine-grained network access control at the instance level

---

## Amazon ECS with AWS Fargate

### Service Overview

Amazon Elastic Container Service (ECS) is AWS's fully managed container orchestration platform that enables teams to build, manage, and run containerized workloads without the complexity of managing underlying infrastructure. ECS handles the scheduling, placement, scaling, and health monitoring of containers across a cluster of compute resources. It integrates deeply with the AWS ecosystem, providing seamless connections to services like CloudWatch for monitoring, IAM for security, and load balancers for traffic distribution.

AWS Fargate is the serverless compute engine for containers that works with both ECS and Amazon EKS (Kubernetes). Fargate eliminates the need to provision, configure, and manage EC2 instances for your container workloads. Instead, you define your application's resource requirements (CPU and memory), and Fargate handles all the underlying infrastructure management, including server provisioning, scaling, patching, and security updates. Each Fargate task runs in its own isolated compute environment with dedicated kernel, memory, and network interfaces, providing strong security boundaries between workloads.

With Fargate, you pay only for the vCPU and memory resources your containerized applications actually consume, billed by the second. This serverless model allows you to focus entirely on designing and building applications rather than managing servers.

### Usage in This Project

The Casa Cirrus Tailscale project leverages ECS with Fargate to run Tailscale router and exit nodes as containerized services. This approach provides a fully managed, scalable, and cost-effective way to deploy Tailscale infrastructure without managing any servers.

**ECS Cluster Configuration** (Both router and exit node stacks):
- **Container Insights**: Enabled with ENHANCED monitoring for deep observability
- **Cluster Management**: Fully managed by AWS, no EC2 instances to maintain
- **Multi-Region Deployment**: Separate clusters in each region for fault isolation

**Fargate Task Definitions**:
- **CPU Architecture**: ARM64 (Graviton processors for cost efficiency)
- **Resource Allocation**:
  - CPU: 512 units (0.5 vCPU)
  - Memory: 1024 MB (1 GB)
- **Container Image**: `tailscale/tailscale:latest` from Docker Hub
- **Network Mode**: AWS VPC mode for direct VPC integration
- **Compatibility**: FARGATE platform version for serverless execution

**Container Configuration**:

*Router Node* (`src/router-node-stack.ts:46-62`):
```typescript
{
  image: ecs.ContainerImage.fromRegistry("tailscale/tailscale:latest"),
  environment: {
    TS_ROUTES: "10.100.0.0/16",
    TS_STATE_DIR: "/var/lib/tailscale",
    TS_ACCEPT_DNS: "false",
    TS_SOCKET: "/var/run/tailscale/tailscaled.sock"
  },
  secrets: {
    TS_AUTHKEY: ecs.Secret.fromSecretsManager(authKeySecret)
  },
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: "ecs",
    logRetention: logs.RetentionDays.ONE_MONTH,
    mode: ecs.AwsLogDriverMode.NON_BLOCKING
  }),
  healthCheck: {
    command: ["CMD-SHELL", "tailscale", "status"],
    interval: cdk.Duration.seconds(30),
    timeout: cdk.Duration.seconds(5),
    retries: 3
  }
}
```

*Exit Node* (`src/exit-node-stack.ts:43-59`):
```typescript
{
  image: ecs.ContainerImage.fromRegistry("tailscale/tailscale:latest"),
  environment: {
    TS_STATE_DIR: "/var/lib/tailscale",
    TS_ACCEPT_DNS: "false",
    TS_SOCKET: "/var/run/tailscale/tailscaled.sock"
  },
  secrets: {
    TS_AUTHKEY: ecs.Secret.fromSecretsManager(authKeySecret)
  },
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: "ecs",
    logRetention: logs.RetentionDays.ONE_MONTH,
    mode: ecs.AwsLogDriverMode.NON_BLOCKING
  }),
  healthCheck: {
    command: ["CMD-SHELL", "tailscale", "status"],
    interval: cdk.Duration.seconds(30)
  }
}
```

**ECS Fargate Service Configuration**:
- **Desired Count**: 1 task per service (single instance deployment)
- **Health Checks**: Built-in health monitoring via `tailscale status` command
- **Auto-Restart**: Automatic container restart on failures
- **Service Discovery**: Integrated with VPC networking for consistent connectivity
- **Secrets Integration**: Secure injection of Tailscale auth keys from Secrets Manager

**Operational Benefits**:
1. **Zero Server Management**: No EC2 instances to patch, scale, or secure
2. **Cost Optimization**: ARM64 architecture reduces compute costs
3. **High Availability**: Automatic task recovery and health monitoring
4. **Security**: Isolated compute environments per task
5. **Observability**: Enhanced Container Insights for deep metrics and logging

### Recent ECS/Fargate Developments (2025)

- **ECS Express Mode** (November 2025): New capability for launching highly available containerized applications with a single command, automating infrastructure setup
- **ECS Managed Instances** (September 2025): Fully managed EC2-based container compute with automatic provisioning, scaling, and patching
- **Custom Container Stop Signals** (December 2025): Support for custom OCI stop signals on Fargate for graceful container shutdowns
- **CloudWatch Logs Live Tail Integration** (2025): Native real-time log streaming within the ECS console

---

## AWS Secrets Manager

### Service Overview

AWS Secrets Manager is a fully managed service designed to help you protect access to your applications, services, and IT resources without the upfront investment and ongoing maintenance costs of operating your own infrastructure. The service enables you to manage, retrieve, and rotate database credentials, application credentials, OAuth tokens, API keys, and other secrets throughout their entire lifecycle, eliminating the security risk of hard-coded credentials in application source code or configuration files.

Secrets Manager provides five critical security capabilities: **encryption at rest** (using AWS KMS), **encryption in transit** (including Post-Quantum TLS support by default), **comprehensive auditing** (via CloudTrail integration), **fine-grained access control** (through IAM policies), and **automated credential rotation** (as frequently as every four hours). The service integrates seamlessly with AWS databases like RDS, DocumentDB, and Redshift to enable zero-downtime credential rotation without application changes.

Every secret stored in Secrets Manager is encrypted using a KMS key you own and control—this encryption cannot be disabled, ensuring secrets are always protected at rest. For most use cases, AWS recommends using the `aws/secretsmanager` AWS-managed key, which incurs no additional cost. Secrets Manager also supports cross-region replication, allowing you to maintain disaster recovery capabilities and support multi-region applications.

### Usage in This Project

The Casa Cirrus Tailscale project uses AWS Secrets Manager to securely store and distribute Tailscale authentication keys across all deployed nodes. This approach ensures that sensitive authentication credentials are never hard-coded in infrastructure code or exposed in environment variables, following AWS security best practices.

**Auth Key Stack** (`src/auth-key-stack.ts`):
```typescript
const authKeySecret = new secretsmanager.Secret(this, "TailscaleAuthKey", {
  secretName: "tailscale/casa-cirrus-auth-key",
  description: "Tailscale authentication key for Casa Cirrus deployment",
  replicaRegions: [
    { region: "us-east-1" },
    { region: "us-west-2" }
  ]
});
```

**Key Implementation Details**:
- **Secret Name**: `tailscale/casa-cirrus-auth-key` - Centralized authentication credential
- **Primary Region**: `us-east-2` (where the secret is originally created)
- **Replica Regions**:
  - `us-east-1` - For exit node access
  - `us-west-2` - For exit node access
- **Cross-Region Replication**: Automatic synchronization ensures all regions have access to the same secret value

**Secret Consumption in ECS Tasks**:

The secret is securely injected into ECS Fargate containers as the `TS_AUTHKEY` environment variable, but it's never exposed in logs or task definitions:

*Router Node* (`src/router-node-stack.ts:46`):
```typescript
secrets: {
  TS_AUTHKEY: ecs.Secret.fromSecretsManager(authKeySecret)
}
```

*Exit Nodes* (`src/exit-node-stack.ts:43`):
```typescript
secrets: {
  TS_AUTHKEY: ecs.Secret.fromSecretsManager(authKeySecret)
}
```

**Security Architecture**:
1. **Secret Storage**: Tailscale auth key stored encrypted in Secrets Manager
2. **IAM Permissions**: ECS task execution role granted read-only access to the secret
3. **Secret Injection**: At container startup, ECS retrieves the secret and injects it as an environment variable
4. **No Exposure**: Secret value never appears in CloudFormation templates, CDK code, or CloudWatch Logs
5. **Automatic Rotation**: While not currently configured, Secrets Manager supports automatic rotation for enhanced security

**Deployment Workflow** (`.github/workflows/deploy.yml:27`):
The GitHub Actions deployment workflow uses Secrets Manager to store the Tailscale auth key:
```yaml
- name: Store Tailscale Auth Key
  run: |
    aws secretsmanager put-secret-value \
      --secret-id tailscale/casa-cirrus-auth-key \
      --secret-string ${{ secrets.TAILSCALE_AUTH_KEY }}
```

**Benefits of This Approach**:
- **Centralized Management**: Single source of truth for authentication credentials
- **Multi-Region Support**: Replicated secrets enable consistent access across regions
- **Zero Hard-Coding**: No credentials in source code or configuration files
- **Audit Trail**: All secret access logged via CloudTrail for compliance
- **Encryption**: Automatic encryption at rest and in transit
- **Easy Rotation**: Can rotate auth keys without redeploying infrastructure

### Best Practices Implemented

✓ Using Secrets Manager for sensitive credentials instead of environment variables
✓ Cross-region replication for multi-region deployments
✓ IAM-based access control for least-privilege access
✓ Descriptive secret names following namespace convention (`tailscale/...`)
✓ Integration with ECS for secure secret injection at runtime

### Recent Secrets Manager Developments (2025)

- **Managed External Secrets**: New secret type for third-party applications like Salesforce with automated rotation
- **Post-Quantum TLS**: Default support for quantum-resistant encryption in transit
- **Enhanced Caching**: AWS Secrets Manager Agent for standardized secret consumption across Lambda, ECS, EKS, and EC2

---

## Amazon CloudWatch Logs

### Service Overview

Amazon CloudWatch Logs is a highly scalable, fully managed log aggregation and monitoring service that enables you to centralize logs from all your systems, applications, and AWS services into a single location. The service collects and stores logs in near real-time, making them immediately available for search, analysis, alerting, and long-term retention. CloudWatch Logs eliminates the need to manage separate log collection infrastructure and provides powerful tools to derive insights from your log data.

The service offers several key capabilities: **CloudWatch Logs Insights** for interactive log querying using a purpose-built query language, **Live Tail** for real-time log streaming, **natural language queries** that automatically transform questions into precise queries, and **two log classes** (Standard and Infrequent Access) for cost optimization based on access patterns. CloudWatch Logs integrates seamlessly with other AWS services, automatically collecting logs from Lambda functions, ECS containers, API Gateway, and more.

CloudWatch Logs connects metrics, logs, and traces to help you quickly understand relationships between different telemetry signals, spot performance bottlenecks, and uncover hidden dependencies—all without jumping between tools. Logs can be retained from 1 day to 10 years, or indefinitely, depending on your compliance and operational requirements.

### Usage in This Project

The Casa Cirrus Tailscale project uses CloudWatch Logs to capture, store, and monitor all output from the Tailscale containers running on ECS Fargate. This provides complete visibility into container operations, authentication events, network routing activities, and any errors or warnings.

**Router Node Logging Configuration** (`src/router-node-stack.ts:58-62`):
```typescript
logging: ecs.LogDrivers.awsLogs({
  streamPrefix: "ecs",
  logRetention: logs.RetentionDays.ONE_MONTH,
  mode: ecs.AwsLogDriverMode.NON_BLOCKING
})
```

**Exit Node Logging Configuration** (`src/exit-node-stack.ts:55-59`):
```typescript
logging: ecs.LogDrivers.awsLogs({
  streamPrefix: "ecs",
  logRetention: logs.RetentionDays.ONE_MONTH,
  mode: ecs.AwsLogDriverMode.NON_BLOCKING
})
```

**Log Configuration Details**:
- **Log Driver**: `awslogs` - Native CloudWatch Logs integration for ECS
- **Stream Prefix**: `ecs` - Organizes log streams by service
- **Retention Period**: `ONE_MONTH` (30 days) - Balances operational visibility with cost
- **Logging Mode**: `NON_BLOCKING` - Prevents container slowdowns if CloudWatch Logs is temporarily unavailable

**Log Organization Structure**:
```
/aws/ecs/<cluster-name>
  └── ecs/<task-definition-family>/<task-id>
      └── <container-name>
```

**What Gets Logged**:
The Tailscale containers write various operational logs to CloudWatch:
- **Startup Events**: Container initialization, Tailscale daemon startup
- **Authentication**: Tailscale network authentication using the auth key
- **Network Events**: Route advertisements, peer connections, DERP relay usage
- **Health Checks**: Results of periodic `tailscale status` health check commands
- **Errors and Warnings**: Connection failures, authentication issues, routing problems
- **State Changes**: Tailscale daemon state transitions

**Operational Use Cases**:
1. **Troubleshooting**: Investigate container failures or network connectivity issues
2. **Audit Trail**: Track when nodes joined/left the Tailscale network
3. **Performance Monitoring**: Analyze connection patterns and routing behavior
4. **Security Monitoring**: Detect unauthorized access attempts or unusual patterns
5. **Compliance**: Maintain logs for security and operational compliance requirements

**Accessing Logs**:
- **AWS Console**: Navigate to CloudWatch → Log groups → `/aws/ecs/<cluster-name>`
- **CloudWatch Logs Insights**: Query logs using structured query language
- **Live Tail** (2025): Real-time log streaming directly in the ECS console
- **AWS CLI**: `aws logs tail /aws/ecs/<cluster-name> --follow`

**Cost Optimization**:
- **One-Month Retention**: Automatically deletes logs older than 30 days to control storage costs
- **Non-Blocking Mode**: Prevents log buffer buildup that could increase costs
- **Stream Prefix Organization**: Enables targeted log queries to minimize data scanned

### Recent CloudWatch Logs Developments (2025)

- **ECS Console Integration**: Native CloudWatch Logs Live Tail directly within the ECS console for real-time monitoring
- **Natural Language Queries**: AI-powered query generation from plain English questions
- **Enhanced Analytics**: Deeper integration with metrics and traces for comprehensive observability

---

## AWS IAM (Identity and Access Management)

### Service Overview

AWS Identity and Access Management (IAM) is the foundational security service that controls who can access your AWS resources (authentication) and what they can do with those resources (authorization). IAM enables you to create and manage AWS users, groups, roles, and their corresponding permissions with fine-grained precision. The service operates on the principle of least privilege, allowing you to grant only the minimum permissions required to perform specific tasks.

IAM supports multiple identity types: **IAM users** for long-term credentials (though deprecated for modern use cases), **IAM roles** for temporary credentials and cross-service access, **federated identities** for external identity providers, and **service-linked roles** for AWS services to act on your behalf. IAM policies define permissions using JSON documents that specify which actions are allowed or denied on which resources under what conditions.

Modern IAM best practices in 2025 emphasize the use of temporary credentials over long-term access keys. IAM users with static access keys are now considered insecure and not scalable. Instead, organizations should use **AWS Identity Center** for human users, **Security Token Service (STS)** for programmatic access and automation, and **OpenID Connect (OIDC)** for CI/CD pipelines, implementing a zero-trust access model.

### Usage in This Project

The Casa Cirrus Tailscale project implements modern IAM best practices by using OIDC federation for GitHub Actions authentication and IAM roles for ECS task execution, avoiding long-term credentials entirely.

**GitHub Actions OIDC Authentication** (`.github/workflows/deploy.yml:20-24`):
```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v5
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN_US_EAST_2 }}
    aws-region: us-east-2
```

This configuration uses OpenID Connect to establish a trust relationship between GitHub and AWS, allowing GitHub Actions workflows to assume an IAM role without storing long-term AWS access keys as secrets. The workflow assumes different roles for each region:
- `AWS_ROLE_ARN_US_EAST_2` - Role for us-east-2 deployments
- `AWS_ROLE_ARN_US_EAST_1` - Role for us-east-1 deployments
- `AWS_ROLE_ARN_US_WEST_2` - Role for us-west-2 deployments

**IAM Role Capabilities for GitHub Actions**:
The assumed roles have permissions to:
- Deploy CloudFormation stacks via CDK
- Create and manage ECS clusters, task definitions, and services
- Create and manage VPC networking components
- Read secrets from Secrets Manager
- Create and write to CloudWatch Logs groups
- Manage IAM roles for ECS tasks (via CDK)

**ECS Task Execution Role**:
ECS Fargate tasks automatically use an IAM execution role (created by CDK) that grants permissions to:
- Pull container images from Docker Hub
- Retrieve secrets from AWS Secrets Manager
- Write logs to CloudWatch Logs

**ECS Task Role**:
The Tailscale containers run with a task role that could be configured for additional AWS API access, though the current implementation doesn't require AWS SDK calls from within containers.

**IAM Best Practices Implemented**:
✓ **OIDC Federation**: No long-term credentials stored in GitHub Secrets
✓ **Temporary Credentials**: All access uses short-lived STS tokens
✓ **Role Assumption**: Separate roles per region following least-privilege
✓ **Service Roles**: Dedicated execution roles for ECS tasks
✓ **No IAM Users**: Entire infrastructure avoids static access keys
✓ **Infrastructure as Code**: IAM policies managed through CDK for auditability

**Security Benefits**:
1. **Credential Rotation**: Automatic through STS temporary credentials (expire hourly)
2. **No Secret Sprawl**: No AWS access keys to manage or rotate
3. **Audit Trail**: CloudTrail logs all IAM role assumptions and API calls
4. **Least Privilege**: Each role has only the permissions needed for its specific function
5. **Compliance**: Meets modern security standards and compliance frameworks

### CDK Context IAM Configuration

The `cdk.json` file includes several feature flags that affect how CDK generates IAM policies:
- Modern IAM policy generation with reduced cross-account scope
- Explicit policy creation for certain resource types
- Integration with other services like Lambda and S3

### Recent IAM Developments (2025)

- **IAM Policy Autopilot** (November 2025): Open-source MCP server that helps AI coding assistants generate IAM policies from code, supporting Python, TypeScript, and Go
- **Modern Access Patterns**: Industry shift away from IAM users toward Identity Center, STS, and OIDC
- **AWS re:Inforce 2025**: Conference tracks focused on identity-first security and zero-trust architectures
- **Security Concerns**: Ongoing campaigns targeting compromised IAM credentials highlight the importance of temporary credentials and automated rotation

---

## AWS KMS (Key Management Service)

### Service Overview

AWS Key Management Service (KMS) is a fully managed encryption key management service that enables you to create, control, and rotate the cryptographic keys used to encrypt your data across AWS services and within your applications. KMS provides a highly available, durable key storage system backed by FIPS 140-2 validated hardware security modules (HSMs). The service integrates seamlessly with most AWS services, making it easy to encrypt data at rest and in transit without managing complex key infrastructure.

KMS uses **customer master keys (CMKs)**, now called **KMS keys**, which are the primary resources in KMS. You can use KMS keys to encrypt data directly (for data up to 4 KB) or to generate, encrypt, and decrypt data encryption keys (DEKs) that encrypt larger datasets. KMS supports two types of keys: **AWS-managed keys** (created and managed automatically by AWS services, free to use) and **customer-managed keys** (created and controlled by you, providing more granular control and incurring charges).

All KMS keys are protected by hardware security modules and never leave AWS KMS unencrypted. The service provides comprehensive audit logging through CloudTrail, recording every use of your keys for compliance and security analysis. KMS also supports automatic key rotation, cross-region replication for disaster recovery, and custom key stores backed by AWS CloudHSM for regulatory requirements.

### Usage in This Project

While KMS is not explicitly configured in the application code, it plays a critical role behind the scenes in the Casa Cirrus Tailscale infrastructure, particularly for encrypting secrets in AWS Secrets Manager and potentially for encrypting CloudWatch Logs.

**Implicit KMS Usage**:

1. **Secrets Manager Encryption**:
   - When the Tailscale auth key is stored in Secrets Manager (`src/auth-key-stack.ts`), it is automatically encrypted at rest using a KMS key
   - By default, Secrets Manager uses the AWS-managed key `aws/secretsmanager` for encryption
   - The secret replicas in `us-east-1` and `us-west-2` are also encrypted with KMS keys in those respective regions
   - This encryption cannot be disabled—all secrets in Secrets Manager are always encrypted

2. **CloudWatch Logs Encryption**:
   - CloudWatch Logs can optionally be encrypted using KMS
   - While not explicitly configured in this project, the CDK context flags in `cdk.json` suggest KMS awareness
   - Organizations with strict compliance requirements often enable log encryption using customer-managed KMS keys

**KMS Configuration via CDK Context** (`cdk.json:33-35`):
```json
"@aws-cdk/aws-kms:aliasNameRef": true,
"@aws-cdk/aws-kms:applyImportedAliasPermissionsToPrincipal": true,
"@aws-cdk/aws-kms:reduceCrossAccountRegionPolicyScope": true
```

These feature flags control how CDK generates KMS-related resources:
- `aliasNameRef`: Uses KMS key alias names in references
- `applyImportedAliasPermissionsToPrincipal`: Properly applies permissions when importing key aliases
- `reduceCrossAccountRegionPolicyScope`: Optimizes cross-region KMS key policies

**Security Architecture**:
```
Tailscale Auth Key (plaintext)
    ↓
Secrets Manager (encrypted at rest with KMS)
    ↓
Cross-Region Replication (encrypted in transit, re-encrypted with regional KMS keys)
    ↓
ECS Task Retrieval (decrypted by KMS, injected into container)
```

**Key Security Benefits**:
- **Encryption at Rest**: All secrets encrypted using FIPS 140-2 validated HSMs
- **Key Isolation**: Separate KMS keys per region for fault isolation
- **Access Control**: IAM policies control who can decrypt secrets
- **Audit Trail**: CloudTrail logs all KMS decrypt operations
- **Compliance**: Meets encryption requirements for various compliance frameworks

**Cost Considerations**:
- **AWS-Managed Keys**: Free to use (no KMS charges for `aws/secretsmanager`)
- **API Calls**: Small charges for each encrypt/decrypt operation
- **Cross-Region Replication**: Additional KMS operations for secret replication

### Best Practices Implemented

✓ Using AWS-managed keys for cost-effective encryption
✓ Implicit encryption for all sensitive data (secrets)
✓ IAM-based access control for decryption operations
✓ Cross-region key availability for multi-region deployments

### When to Use Customer-Managed Keys

While this project uses AWS-managed keys, you might consider customer-managed KMS keys for:
- **Regulatory Compliance**: Requirements for customer-controlled key lifecycle
- **Key Rotation Control**: Custom rotation schedules beyond AWS defaults
- **Cross-Account Access**: Sharing encrypted data across AWS accounts
- **Fine-Grained Auditing**: Detailed CloudTrail logging of specific key usage
- **Key Deletion Control**: Ability to schedule key deletion (7-30 day waiting period)

---

## Amazon S3

### Service Overview

Amazon Simple Storage Service (S3) is AWS's industry-leading object storage service, offering unlimited scalability, industry-leading durability (99.999999999% - 11 nines), and multiple storage tiers to optimize costs based on access patterns. S3 stores data as objects within buckets, providing a simple key-value interface for storing and retrieving any amount of data from anywhere on the web. The service is used for a vast range of use cases including data lakes, website hosting, backup and recovery, disaster recovery, archiving, application data storage, and content distribution.

S3 provides multiple storage classes tailored to different access patterns and cost requirements: **S3 Standard** for frequently accessed data, **S3 Intelligent-Tiering** for automatic cost optimization, **S3 Standard-IA** and **S3 One Zone-IA** for infrequent access, **S3 Glacier** tiers for long-term archiving, and **S3 Outposts** for on-premises storage. The service includes comprehensive security features like encryption at rest (with SSE-S3, SSE-KMS, or SSE-C), encryption in transit, access control via IAM and bucket policies, versioning for data protection, and Object Lock for compliance retention.

S3 integrates deeply with virtually every AWS service—Lambda functions can trigger on S3 events, CloudFront can cache S3 content globally, Athena can query S3 data directly, and services like ECS and CloudFormation use S3 for artifacts and templates.

### Usage in This Project

While S3 is not explicitly created or managed in the application code, it plays several important implicit roles in the Casa Cirrus Tailscale infrastructure, primarily through AWS CDK and CloudFormation operations.

**Implicit S3 Usage**:

1. **CDK Asset Storage**:
   - When you run `cdk deploy`, CDK automatically creates an S3 bucket in your account (typically named `cdk-<qualifier>-assets-<account>-<region>`)
   - This bucket stores CloudFormation templates synthesized from your CDK code
   - Large CloudFormation templates (over 51,200 bytes) must be uploaded to S3 before CloudFormation can process them
   - CDK asset bucket is created once per environment (account + region combination)

2. **CloudFormation Template Storage**:
   - CloudFormation retrieves stack templates from the CDK asset bucket during deployments
   - Templates are versioned in S3, allowing rollbacks to previous infrastructure versions
   - Multi-region deployments create separate asset buckets in each region

3. **Docker Image Layers** (Alternative to ECR):
   - While this project pulls images from Docker Hub, organizations often mirror container images to S3 for cost optimization
   - S3 can serve as a backing store for container image layers in private registries

**S3 Configuration via CDK Context** (`cdk.json:40-44`):
```json
"@aws-cdk/aws-s3:createDefaultLoggingPolicy": true,
"@aws-cdk/aws-s3:publicAccessBlockedByDefault": true,
"@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy": true,
"@aws-cdk/aws-s3:setUniqueReplicationRoleName": true
```

These feature flags configure S3 security and operational behaviors:
- **createDefaultLoggingPolicy**: Automatically creates policies for S3 server access logging
- **publicAccessBlockedByDefault**: Blocks public access to all new S3 buckets (critical security control)
- **serverAccessLogsUseBucketPolicy**: Uses bucket policies instead of ACLs for access logging
- **setUniqueReplicationRoleName**: Ensures unique IAM role names for cross-region replication

**Security Best Practices Enforced**:
✓ **Public Access Blocking**: All CDK-created S3 buckets block public access by default
✓ **Bucket Policies**: Modern policy-based access control instead of legacy ACLs
✓ **Server-Side Encryption**: CDK asset buckets are encrypted at rest
✓ **Versioning**: Template versioning enables infrastructure rollbacks
✓ **Lifecycle Policies**: CDK may configure automatic cleanup of old assets

**CDK Asset Bucket Structure**:
```
s3://cdk-<qualifier>-assets-<account>-<region>/
  ├── <stack-name>.template.json
  ├── <stack-name>.template.yaml
  └── assets/
      ├── <hash1>.json
      └── <hash2>.json
```

**Operational Impact**:
- **Deployment Speed**: Local S3 bucket in each region ensures fast template retrieval
- **Reliability**: S3's 99.99% availability SLA ensures CloudFormation can always access templates
- **Audit Trail**: S3 server access logs provide detailed records of template access
- **Cost**: Minimal cost for storing CloudFormation templates (typically a few KB each)

### When S3 Might Be Explicitly Used

Future enhancements to this project might explicitly use S3 for:
- **Tailscale State Backup**: Storing Tailscale node state for disaster recovery
- **Configuration Storage**: Centralized configuration files for Tailscale nodes
- **Log Archival**: Long-term storage of CloudWatch Logs via S3 export
- **Container Image Cache**: Mirroring Tailscale images for faster deployment
- **Infrastructure Artifacts**: Storing custom scripts or configuration files

---

## AWS Lambda

### Service Overview

AWS Lambda is AWS's serverless compute service that lets you run code without provisioning or managing servers. Lambda automatically scales your applications by running code in response to triggers such as HTTP requests (via API Gateway), changes to data (via S3, DynamoDB, Kinesis), scheduled events (via EventBridge), or messages (via SQS, SNS). You simply upload your code, and Lambda handles all the operational aspects including server capacity provisioning, auto-scaling, security patching, monitoring, and logging.

Lambda supports multiple programming languages including Python, Node.js, Java, Go, Ruby, .NET, and custom runtimes. You pay only for the compute time you consume—billed in milliseconds based on the number of requests and the duration your code executes. Lambda functions can run for up to 15 minutes per invocation, with configurable memory from 128 MB to 10,240 MB (CPU allocation scales proportionally with memory).

The service integrates deeply with the AWS ecosystem, providing event sources from over 200 AWS services and supporting extensions for observability, security, and governance tools. Lambda functions run in isolated execution environments with dedicated resources, providing strong security boundaries between invocations.

### Usage in This Project

Lambda is not directly deployed or explicitly used in the Casa Cirrus Tailscale application code. However, Lambda configuration flags appear in the CDK context, suggesting that the CDK framework includes Lambda-related constructs or that the project structure supports future Lambda integration.

**Lambda Configuration via CDK Context** (`cdk.json:36-39`):
```json
"@aws-cdk/aws-lambda:recognizeLayerVersion": true,
"@aws-cdk/aws-lambda:useCdkManagedLogGroup": true,
"@aws-cdk/aws-lambda-nodejs:sdkV3ExcludeSmithyPackages": true,
"@aws-cdk/aws-lambda-nodejs:useLatestRuntimeVersion": true
```

These feature flags control Lambda-related CDK behavior:
- **recognizeLayerVersion**: Properly handles Lambda layer version references
- **useCdkManagedLogGroup**: CDK creates and manages CloudWatch Logs groups for Lambda functions
- **sdkV3ExcludeSmithyPackages**: Optimizes Node.js Lambda bundles by excluding Smithy packages from AWS SDK v3 (reduces package size)
- **useLatestRuntimeVersion**: Automatically uses the latest runtime version for Lambda functions

**Why These Flags Are Present**:
Even though this project doesn't currently deploy Lambda functions, the CDK framework includes these flags to ensure compatibility and optimal defaults if Lambda functions are added in the future. CDK apps often include comprehensive feature flags to handle various AWS service integrations.

### Potential Future Lambda Use Cases

While not currently implemented, Lambda could enhance this infrastructure for:

1. **Tailscale Health Monitoring**:
   - Scheduled Lambda function to check Tailscale node health via API
   - Send alerts to SNS/Slack if nodes go offline
   - Automatically restart ECS tasks if health checks fail

2. **Dynamic Route Management**:
   - Lambda function triggered by AWS Config or EventBridge
   - Automatically update Tailscale route advertisements based on VPC changes
   - Sync route tables between AWS and Tailscale

3. **Cost Optimization**:
   - Scheduled Lambda to analyze ECS Fargate usage patterns
   - Automatically adjust task counts based on network traffic
   - Generate cost reports and send to S3/SNS

4. **Secret Rotation**:
   - Custom Lambda rotation function for Tailscale auth keys
   - Automatically generate new keys, update Secrets Manager
   - Trigger ECS task restarts to use new credentials

5. **Custom CloudFormation Resources**:
   - Lambda-backed custom resources for Tailscale API integration
   - Automate Tailscale network configuration via Infrastructure as Code
   - Manage ACL rules, DNS settings, and node approvals

6. **Log Processing**:
   - Lambda function triggered by CloudWatch Logs subscriptions
   - Parse Tailscale logs for security events or routing anomalies
   - Forward structured events to security monitoring tools

### Recent Lambda Developments (2025)

- **IAM Policy Autopilot Integration**: Lambda functions can now benefit from AI-generated IAM policies via the new MCP server
- **Enhanced Observability**: Deeper integration with CloudWatch for metrics, logs, and traces
- **Improved Cold Start Performance**: Continued runtime optimizations reduce cold start latency
- **Advanced Scaling**: More sophisticated scaling algorithms for high-concurrency workloads

---

## AWS EventBridge

### Service Overview

AWS EventBridge (formerly Amazon CloudWatch Events) is a serverless event bus service that makes it easy to connect applications using events. EventBridge enables event-driven architectures where components of your application communicate asynchronously by producing and consuming events. An event is a signal that a system's state has changed—such as a new file uploaded to S3, a change in DynamoDB, a scheduled time, or a custom event from your application.

EventBridge provides several key capabilities: **event buses** for routing events, **rules** for filtering and routing events to targets, **schemas** for discovering and understanding event structure, **archive and replay** for debugging and recovery, and **API destinations** for sending events to external SaaS applications. The service integrates with over 200 AWS services as event sources and supports custom applications as both event producers and consumers.

EventBridge is fundamentally different from traditional message queues—it operates on a publish-subscribe pattern with powerful event filtering, schema discovery, and multi-target fanout. Events are matched against rules containing event patterns, and matching events are routed to one or more targets such as Lambda functions, Step Functions state machines, SNS topics, SQS queues, Kinesis streams, or API destinations.

### Usage in This Project

EventBridge is not directly deployed or explicitly used in the Casa Cirrus Tailscale application code. However, EventBridge configuration flags appear in the CDK context, indicating that CDK includes EventBridge-related constructs or that the infrastructure supports future event-driven integrations.

**EventBridge Configuration via CDK Context** (`cdk.json:28-29`):
```json
"@aws-cdk/aws-events:eventsTargetQueueSameAccount": true,
"@aws-cdk/aws-events:requireEventBusPolicySid": true
```

These feature flags control EventBridge-related CDK behavior:
- **eventsTargetQueueSameAccount**: Ensures EventBridge rules can target SQS queues in the same account without complex cross-account permissions
- **requireEventBusPolicySid**: Requires statement IDs (SIDs) in event bus policies for better auditability and policy management

**Why These Flags Are Present**:
CDK includes comprehensive feature flags for all major AWS services to ensure optimal defaults and prevent breaking changes when new CDK versions are released. Even if not currently using EventBridge, these flags ensure that if EventBridge resources are added later, they'll follow AWS best practices.

### Potential Future EventBridge Use Cases

While not currently implemented, EventBridge could enhance this infrastructure through event-driven automation:

1. **Infrastructure Event Automation**:
   - Trigger on ECS task state changes (task started, stopped, failed)
   - Automatically invoke Lambda for incident response or remediation
   - Send notifications to SNS/Slack when Tailscale nodes change state

2. **Scheduled Operations**:
   - Replace CloudWatch Events with EventBridge Scheduler for cron-like tasks
   - Schedule health checks, cost reports, or configuration audits
   - Coordinate multi-region operations at specific times

3. **Cross-Service Integration**:
   - React to Secrets Manager rotation events
   - Trigger ECS task updates when new Tailscale container images are available (via ECR events)
   - Coordinate VPC network changes with Tailscale route updates

4. **Security and Compliance**:
   - Monitor IAM role assumption events for unauthorized access
   - Alert on unexpected security group changes
   - Archive all infrastructure events for compliance auditing

5. **Multi-Account Architecture**:
   - Use EventBridge cross-account event delivery for centralized monitoring
   - Aggregate events from multiple AWS accounts into a central security account
   - Coordinate deployments across development, staging, and production

6. **Custom Application Events**:
   - Tailscale nodes could publish custom events about network topology
   - Trigger automation when specific routes become available
   - Build event-driven workflows for network provisioning

### EventBridge vs. CloudWatch Events

EventBridge is the evolution of CloudWatch Events with additional capabilities:
- **Schema Registry**: Discover and understand event structure automatically
- **Archive and Replay**: Store events and replay them for debugging
- **API Destinations**: Send events to external SaaS applications via HTTP
- **Multi-Account Buses**: Aggregate events across AWS accounts
- **Expanded Integrations**: Over 200 AWS and SaaS event sources

Modern AWS architectures should use EventBridge instead of the legacy CloudWatch Events service.

---

## Elastic Load Balancing v2

### Service Overview

Elastic Load Balancing (ELB) automatically distributes incoming application traffic across multiple targets, such as EC2 instances, containers (ECS tasks), IP addresses, Lambda functions, and virtual appliances. Load balancing increases the availability and fault tolerance of your applications by detecting unhealthy targets and routing traffic only to healthy targets. ELB operates at multiple layers of the OSI model, providing different balancing strategies for different use cases.

AWS offers three types of load balancers, all part of the ELBv2 service family:

1. **Application Load Balancer (ALB)**: Operates at Layer 7 (HTTP/HTTPS), provides advanced request routing based on content, supports WebSockets and HTTP/2, and includes built-in authentication, SSL/TLS termination, and AWS WAF integration.

2. **Network Load Balancer (NLB)**: Operates at Layer 4 (TCP/UDP/TLS), handles millions of requests per second with ultra-low latency, preserves source IP addresses, and provides static IP addresses for whitelisting.

3. **Gateway Load Balancer (GLB)**: Operates at Layer 3 (network layer), used for deploying, scaling, and managing third-party virtual appliances like firewalls and intrusion detection systems.

Load balancers perform health checks on targets, automatically removing unhealthy targets from rotation until they recover. They provide SSL/TLS termination to offload encryption from application servers, support multiple AZs for high availability, and integrate with Auto Scaling, CloudWatch, and WAF for comprehensive application delivery.

### Usage in This Project

Elastic Load Balancing is not directly deployed or explicitly used in the Casa Cirrus Tailscale application code. The Tailscale nodes run as standalone ECS Fargate tasks that don't receive external HTTP/HTTPS traffic requiring load balancing. However, ELBv2 configuration flags appear in the CDK context.

**ELBv2 Configuration via CDK Context** (`cdk.json:26-27`):
```json
"@aws-cdk/aws-elasticloadbalancingV2:albDualstackWithoutPublicIpv4SecurityGroupRulesDefault": true,
"@aws-cdk/aws-elasticloadbalancingv2:networkLoadBalancerWithSecurityGroupByDefault": true
```

These feature flags control ELBv2-related CDK behavior:
- **albDualstackWithoutPublicIpv4SecurityGroupRulesDefault**: Configures Application Load Balancers to support both IPv4 and IPv6 (dual-stack) without requiring explicit IPv4 security group rules in certain scenarios
- **networkLoadBalancerWithSecurityGroupByDefault**: Ensures Network Load Balancers are created with security groups by default (a newer NLB feature for enhanced security)

**Why These Flags Are Present**:
Like other AWS service feature flags, these ensure that if load balancers are added to the infrastructure later, they'll follow modern AWS best practices for security and networking. CDK includes flags for all major services to prevent breaking changes across versions.

**Current Architecture Without Load Balancers**:
The Tailscale infrastructure operates differently from typical web applications:
- **Mesh Networking**: Tailscale uses peer-to-peer connections rather than centralized ingress
- **No HTTP Endpoints**: Tailscale nodes don't serve HTTP traffic requiring load balancing
- **Outbound Connectivity**: Nodes primarily initiate connections to the Tailscale coordination server and peers
- **Single Task Deployment**: Each ECS service runs a single task (no horizontal scaling requiring load balancing)

### Potential Future Load Balancer Use Cases

While not currently needed, load balancers could be added for:

1. **Tailscale Management API**:
   - Deploy a custom web interface for Tailscale node management
   - Use ALB for HTTPS termination and request routing
   - Implement authentication via ALB's built-in OIDC support

2. **High-Availability Exit Nodes**:
   - Scale exit nodes horizontally across multiple ECS tasks
   - Use NLB to distribute VPN traffic across multiple exit node instances
   - Achieve higher throughput and fault tolerance

3. **Metrics and Monitoring Dashboard**:
   - Deploy a web-based dashboard showing Tailscale network status
   - ALB routes traffic to dashboard containers running on ECS
   - Integrate with AWS WAF for DDoS protection

4. **Multi-Protocol Gateway**:
   - Combine Tailscale with other VPN protocols (WireGuard, OpenVPN)
   - Use NLB with TCP/UDP listeners for different protocol types
   - Provide protocol-specific health checks

5. **Hybrid Cloud Integration**:
   - Deploy third-party network virtual appliances (firewalls, SD-WAN)
   - Use Gateway Load Balancer for transparent traffic inspection
   - Integrate Tailscale with enterprise security tools

### Recent ELBv2 Developments

- **Security Group Support for NLB**: Network Load Balancers now support security groups (previously only ALB/GLB had this feature)
- **Dual-Stack Improvements**: Enhanced IPv4/IPv6 dual-stack support with simplified configuration
- **Enhanced Observability**: Better CloudWatch metrics and integration with X-Ray for tracing
- **Cost Optimization**: New pricing models for low-traffic applications

---

## Summary: AWS Services Usage Matrix

| Service | Direct Usage | Implicit Usage | Configuration Present | Future Potential |
|---------|--------------|----------------|----------------------|------------------|
| **CloudFormation** | ✓ (via CDK) | ✓ | ✓ | ✓ |
| **EC2 (VPC)** | ✓ | - | ✓ | ✓ |
| **ECS + Fargate** | ✓ | - | ✓ | ✓ |
| **Secrets Manager** | ✓ | - | ✓ | ✓ |
| **CloudWatch Logs** | ✓ | - | ✓ | ✓ |
| **IAM** | ✓ | ✓ | ✓ | ✓ |
| **KMS** | - | ✓ | ✓ | ✓ |
| **S3** | - | ✓ (CDK assets) | ✓ | ✓ |
| **Lambda** | - | - | ✓ | ✓ |
| **EventBridge** | - | - | ✓ | ✓ |
| **ELBv2** | - | - | ✓ | ✓ |

## Regional Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AWS Multi-Region Architecture                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  │   us-east-2      │  │   us-east-1      │  │   us-west-2      │
│  │   (Primary)      │  │   (Secondary)    │  │   (Tertiary)     │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│  │                  │  │                  │  │                  │
│  │ • Auth Key       │  │ • Exit Node      │  │ • Exit Node      │
│  │   (Primary)      │  │ • Secret Replica │  │ • Secret Replica │
│  │ • Router Node    │  │ • VPC            │  │ • VPC            │
│  │ • VPC + VPN GW   │  │   10.101.0.0/16  │  │   10.101.0.0/16  │
│  │   10.100.0.0/16  │  │ • ECS Cluster    │  │ • ECS Cluster    │
│  │ • ECS Cluster    │  │ • CloudWatch     │  │ • CloudWatch     │
│  │ • CloudWatch     │  │                  │  │                  │
│  │                  │  │                  │  │                  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Cross-Region Services (Replicated)                │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ • Secrets Manager (auth key replicated to all regions)     │ │
│  │ • KMS (regional keys for encryption)                       │ │
│  │ • S3 (CDK assets per region)                               │ │
│  │ • IAM (global roles, regional trust policies)              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Optimization Considerations

This project has been designed with cost optimization in mind:

1. **ARM64 Fargate**: Using ARM-based Graviton processors reduces compute costs by ~20% vs x86
2. **Right-Sized Resources**: 0.5 vCPU / 1 GB memory is appropriate for Tailscale's resource requirements
3. **No NAT Gateways**: Public subnets eliminate ~$30+/month NAT Gateway charges per region
4. **AWS-Managed KMS Keys**: Free encryption for Secrets Manager
5. **One-Month Log Retention**: Balances operational visibility with storage costs
6. **Single Task Deployment**: Runs only what's necessary, no over-provisioning
7. **CDK Infrastructure**: Enables easy cost analysis and optimization over time

## Security Posture Summary

The infrastructure implements AWS security best practices:

✓ **Encryption at Rest**: All secrets encrypted with KMS
✓ **Encryption in Transit**: TLS for all AWS API calls, post-quantum TLS for Secrets Manager
✓ **No Long-Term Credentials**: OIDC for CI/CD, temporary STS tokens only
✓ **Least Privilege IAM**: Role-based access with minimal required permissions
✓ **Network Isolation**: Custom VPCs with dedicated CIDR blocks
✓ **Security Groups**: Fine-grained network access control
✓ **Audit Logging**: CloudTrail (implicit) and CloudWatch Logs for all operations
✓ **Secret Management**: Centralized secret storage with cross-region replication
✓ **No Public Access**: S3 buckets block public access by default
✓ **Infrastructure as Code**: All resources defined in version-controlled CDK code

---

## References and Sources

### AWS CloudFormation
- [AWS CloudFormation Official Page](https://aws.amazon.com/cloudformation/)
- [AWS CloudFormation: Automating Infrastructure as Code](https://aws.plainenglish.io/aws-cloudformation-automating-infrastructure-as-code-57f55bd2b1c6)
- [Introducing the AWS Infrastructure as Code MCP Server](https://aws.amazon.com/blogs/devops/introducing-the-aws-infrastructure-as-code-mcp-server-ai-powered-cdk-and-cloudformation-assistance/)

### Amazon EC2 (VPC)
- [AWS VPC Guide 2025: From Basic Networking to VPC Lattice](https://cloudurable.com/blog/aws-vpc-2025/)
- [How to Set Up Amazon EC2 with VPC the Right Way: A 2025 AWS Guide](https://www.sedai.io/blog/ec2-vpc-integration-aws)
- [What is Amazon VPC? - Official AWS Documentation](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)

### Amazon ECS with AWS Fargate
- [Amazon ECS at AWS re:Invent 2025](https://aws.amazon.com/blogs/containers/amazon-ecs-at-aws-reinvent-2025/)
- [Build production-ready applications using Amazon ECS Express Mode](https://aws.amazon.com/blogs/aws/build-production-ready-applications-without-infrastructure-complexity-using-amazon-ecs-express-mode/)
- [Announcing Amazon ECS Managed Instances](https://aws.amazon.com/blogs/aws/announcing-amazon-ecs-managed-instances-for-containerized-applications/)
- [AWS Fargate Official Page](https://aws.amazon.com/fargate/)

### AWS Secrets Manager
- [AWS Secrets Manager Official Page](https://aws.amazon.com/secrets-manager/)
- [AWS Secrets Manager: A Quick Guide to Safe Credential Storage](https://sedai.io/blog/manage-secrets-aws-secrets-manager)
- [What is AWS Secrets Manager? - Official Documentation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [AWS Secrets Manager launches Managed External Secrets](https://aws.amazon.com/blogs/security/aws-secrets-manager-launches-managed-external-secrets-for-third-party-credentials/)

### Amazon CloudWatch Logs
- [Amazon CloudWatch Official Page](https://aws.amazon.com/cloudwatch/)
- [What is Amazon CloudWatch Logs? - Official Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html)
- [Amazon CloudWatch Features](https://aws.amazon.com/cloudwatch/features/)

### AWS IAM
- [Building identity-first security at AWS re:Inforce 2025](https://aws.amazon.com/blogs/security/building-identity-first-security-a-guide-to-the-identity-and-access-management-track-at-aws-reinforce-2025/)
- [AWS announces IAM Policy Autopilot](https://aws.amazon.com/about-aws/whats-new/2025/11/iam-policy-autopilot-generate-iam-policies-code/)
- [IAM Policy Autopilot: An open-source tool](https://aws.amazon.com/blogs/security/iam-policy-autopilot-an-open-source-tool-that-brings-iam-policy-expertise-to-builders-and-ai-coding-assistants/)
- [AWS Identity and Access Management Official Page](https://aws.amazon.com/iam/)

---

*This documentation was generated on 2025-12-29 for the Casa Cirrus Tailscale project.*
