import { GatewayName } from '@openpayflow/common';
import { Gateway, GatewayConfig, GatewayFactory } from './interfaces/gateway';
import { StripeAdapter } from './adapters/stripe-adapter';
import { RazorpayAdapter } from './adapters/razorpay-adapter';
import { MockAdapter, MockGatewayConfig } from './adapters/mock-adapter';

export class DefaultGatewayFactory implements GatewayFactory {
  create(config: GatewayConfig): Gateway {
    if (!config.enabled) {
      throw new Error(`Gateway ${config.name} is not enabled`);
    }

    switch (config.name) {
      case 'stripe':
        return new StripeAdapter(
          config.credentials.secretKey,
          config.testMode
        );

      case 'razorpay':
        return new RazorpayAdapter(
          config.credentials.keyId,
          config.credentials.keySecret,
          config.testMode
        );

      case 'mock':
        return new MockAdapter(config.settings as MockGatewayConfig);

      default:
        throw new Error(`Unsupported gateway: ${config.name}`);
    }
  }

  getSupportedGateways(): GatewayName[] {
    return ['stripe', 'razorpay', 'mock'];
  }
}

// Singleton instance
export const gatewayFactory = new DefaultGatewayFactory();
