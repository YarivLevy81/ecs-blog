import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class EcsBlogStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'Vpc', {maxAzs: 2});

        // Create a cluster
        const cluster = new ecs.Cluster(this, 'EcsCluster', {vpc});
        cluster.addCapacity('DefaultAutoScalingGroup', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO)
        });

        // Create Task Definition
        const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef');
        const container = taskDefinition.addContainer('web', {
            image: ecs.ContainerImage.fromRegistry("691490147357.dkr.ecr.us-east-1.amazonaws.com/ecs-blog:latest"),
            memoryLimitMiB: 512,
        });

        container.addPortMappings({
            containerPort: 80,
            hostPort: 8080,
            protocol: ecs.Protocol.TCP
        });

        // Create Service
        const service = new ecs.FargateService(this, "Service", {
            cluster,
            taskDefinition,
        });

        // Create ALB
        const lb = new elb.ApplicationLoadBalancer(this, 'LB', {
            vpc,
            internetFacing: true
        });
        const listener = lb.addListener('PublicListener', {port: 80, open: true});

        // Attach ALB to ECS Service
        listener.addTargets('ECS', {
            port: 8080,
            targets: [service.loadBalancerTarget({
                containerName: 'web',
                containerPort: 80
            })],
            // include health check (default is none)
            healthCheck: {
                interval: cdk.Duration.seconds(60),
                path: "/health",
                timeout: cdk.Duration.seconds(5),
            }
        });

        new cdk.CfnOutput(this, 'LoadBalancerDNS', {value: lb.loadBalancerDnsName,});

    }
}
