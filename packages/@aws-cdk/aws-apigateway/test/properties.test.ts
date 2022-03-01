import { Template } from '@aws-cdk/assertions';
import { App, Stack } from '@aws-cdk/core';
import * as fc from 'fast-check';
import { constructFactory, ConstructFactory, nullablePropsConstructFactory } from './arbitraries';

describe('Properties', () => {
  test('Empty props equal to no props', () => {
    fc.assert(fc.property(nullablePropsConstructFactory(), factory => {
      const stack1 = synth(factory);
      const stack2 = synth(factory, {});

      expect(stack1).toEqual(stack2);
    }));
  });

  test('Primitives can be replaced with tokens', () => {
    fc.assert(fc.property(constructFactory(), factory => {
      const app = new App();
      const stack = new Stack(app, 'stack');

      // TODO A factory doesn't make much sense here.
      //  Ideally, the props should be automatically generated
      factory(stack, '@aws-cdk/aws-apigateway.UsagePlan', 'test', {
        name: 'foo',
        quota: {
          limit: 111,
          offset: 333,
        },
        description: 'bar',
        throttle: {
          burstLimit: 100,
          rateLimit: 200,
        },
      });
    }));
  });
});

function synth(factory: ConstructFactory, props?: any): any {
  const app = new App();
  const stack = new Stack(app, 'stack');

  factory(stack, 'test', props);

  try {
    return Template.fromStack(stack).toJSON();
  } catch (_) {
    // TODO What should we do in case the stack cannot be syntheized (e.g., fails some post-construction validation)?
    //  Maybe return the error?
    return {};
  }
}
