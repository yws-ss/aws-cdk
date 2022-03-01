import * as path from 'path';
import { Stack, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Arbitrary, Random, Shrinkable, Stream } from 'fast-check';
import * as fs from 'fs-extra';

export type ConstructFactory = (scope: Stack, id: string, props?: any) => Construct;

export type NamedConstructFactory = (scope: Stack, fqn: string, id: string, props?: any) => Construct;

export class ConstructFactoryArbitrary extends Arbitrary<NamedConstructFactory> {
  private readonly fqns: string[] = [];
  constructor() {
    super();

    const metadata = fs.readJSONSync(path.join(__dirname, '../.jsii'));

    const types = metadata.types;
    for (const [fqn, t] of Object.entries(types)) {
      const type = t as any;

      if (type.kind === 'class' && inheritsFromCore(type)) {
        this.fqns.push(fqn);
      }
    }

    // TODO Remove duplication
    function inheritsFromCore(type: any): boolean {
      // TODO This is incomplete and hacky. Look up constructs in other assemblies
      if (type.base == null) {
        return false;
      } else if (type.base === '@aws-cdk/core.Construct' || type.base === '@aws-cdk/core.Resource') {
        return true;
      } else {
        const superType = types[type.base];
        return superType ? inheritsFromCore(superType) : false;
      }
    }
  }

  generate(_mrng: Random): Shrinkable<NamedConstructFactory> {
    const factory = (scope: Stack, fqn: string, id: string, props?: any) => {
      const { moduleName, className } = splitName(fqn);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require(moduleName);

      const instance = new module[className](scope, id, props);

      let suffix = 1;
      for (const tokenizedProps of tokenize(props)) {
        new module[className](scope, id + (suffix++), tokenizedProps);
      }

      return instance;
    };

    return new Shrinkable<NamedConstructFactory>(factory, () => Stream.nil());
  }
}

export class NullablePropsConstructFactoryArbitrary extends Arbitrary<ConstructFactory> {
  private readonly fqns: string[] = [];

  constructor() {
    super();

    const metadata = fs.readJSONSync(path.join(__dirname, '../.jsii'));

    const types = metadata.types;
    for (const [fqn, t] of Object.entries(types)) {
      const type = t as any;

      if (type.kind === 'class' &&
        inheritsFromCore(type) &&
        type.initializer.parameters[2] != null &&
        type.initializer.parameters[2].optional &&
        allOptionalProps(types[type.initializer.parameters[2].type.fqn])) {
        this.fqns.push(fqn);
      }
    }

    function inheritsFromCore(type: any): boolean {
      // TODO This is incomplete and hacky. Look up constructs in other assemblies
      if (type.base == null) {
        return false;
      } else if (type.base === '@aws-cdk/core.Construct' || type.base === '@aws-cdk/core.Resource') {
        return true;
      } else {
        const superType = types[type.base];
        return superType ? inheritsFromCore(superType) : false;
      }
    }

    function allOptionalProps(type: any): boolean {
      // TODO The type being null means that we haven't found it in the 'types' map
      //  But this is probably because it's in another assembly. Leaving it like this for now
      if (type == null) { return false; }

      for (const ifaceFqn of type.interfaces ?? []) {
        if (!allOptionalProps(types[ifaceFqn])) {
          return false;
        }
      }
      return (type.properties ?? []).every((p: any) => p.optional);
    }
  }

  generate(mrng: Random): Shrinkable<ConstructFactory> {
    const fqn = this.fqns[mrng.nextInt(0, this.fqns.length - 1)];

    const factory = (scope: Stack, id: string, props?: any) => {
      const { moduleName, className } = splitName(fqn);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require(moduleName);

      return new module[className](scope, id, props);
    };

    // TODO Figure out what this shrinking business is
    return new Shrinkable<ConstructFactory>(factory, () => Stream.nil());
  }
}

function splitName(name: string) {
  const sep = name.lastIndexOf('.');
  return {
    moduleName: name.substr(0, sep),
    className: name.substr(sep + 1),
  };
}

export function nullablePropsConstructFactory(): Arbitrary<ConstructFactory> {
  return new NullablePropsConstructFactoryArbitrary();
}

export function constructFactory(): Arbitrary<NamedConstructFactory> {
  return new ConstructFactoryArbitrary();
}

export function tokenize(props: any): any[] {
  const result: any[] = [];

  // TODO Tokenize the subprops recursively
  for (const [name, value] of Object.entries(props)) {
    const clone = { ...props };
    if (typeof value === 'string') {
      clone[name] = Token.asString({});
      result.push(clone);
    } else if (typeof value === 'number') {
      clone[name] = Token.asNumber({});
      result.push(clone);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      tokenize(value)
        .map(tp => ({ ...props, [name]: tp }))
        .forEach(p => result.push(p));
    }
  }

  return result;
}