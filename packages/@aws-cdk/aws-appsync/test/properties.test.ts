import * as path from 'path';
import { IAssertion, Checker, Context, Template } from '@aws-cdk/assertions';
import { App, Stack } from '@aws-cdk/core';

describe('New API', () => {
  test('Empty props equal to no props', () => {
    Checker.fromDirectory(path.join(__dirname))
      .onlyOptionalProps()
      .assert(new class implements IAssertion {
        assert(ctx: Context) {
          const stack1 = synthesize(ctx);
          const stack2 = synthesize(ctx, {});

          expect(stack1).toEqual(stack2);
        }
      });
  });

  test('Tokens can be used instead of literal values', () => {
    Checker.fromDirectory(path.join(__dirname))
      .assert(new class implements IAssertion {
        assert(ctx: Context) {
          const app = new App();
          const stack = new Stack(app, 'stack');
          let tokenizedProps = ctx.tokenizedProps();
          ctx.createConstruct(stack, 'test', tokenizedProps);
        }
      });
  });


  function synthesize(ctx: Context, props?: any): any {
    const app = new App();
    const stack = new Stack(app, 'stack');

    ctx.createConstruct(stack, 'test', props);

    try {
      return Template.fromStack(stack).toJSON();
    } catch (_) {
      // TODO What should we do in case the stack cannot be syntheized (e.g., fails some post-construction validation)?
      //  Maybe return the error?
      return {};
    }
  }
});