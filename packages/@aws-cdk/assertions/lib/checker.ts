import * as path from 'path';
import { Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as fs from 'fs-extra';

export function load(filePath: string): void {
  const file = fs.readJSONSync(path.join(filePath, '.jsii'));
  // eslint-disable-next-line no-console
  console.log(file);
}

/**
 * An assertion about a property of the system.
 */
export interface IAssertion {

  /**
   * Run the assertion and throw in case of failure.
   * Use the functions available in the context to create constructs.
   *
   * @see Context
   */
  assert(context: Context): void;
}

/**
 * The execution context for an assertion, restricted to a single construct type.
 * Provides a number of functions to create different types of constructs.
 */
export class Context {
  constructor(private readonly types: any[], private readonly type: any) {
  }

  /**
   * Creates a construct with the usual three attributes: scope, id and props.
   */
  createConstruct(scope: Construct, id: string, props?: any): any {
    const { moduleName, className } = splitName(this.type.fqn);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require(moduleName);

    return new module[className](scope, id, props);
  }

  /**
   * Returns an object with all properties replaced with tokens.
   */
  tokenizedProps(): any {
    if (this.type.initializer?.parameters != null && this.type.initializer.parameters[2] != null) {
      const type = this.types[this.type.initializer.parameters[2].type.fqn];
      return this.tokenize(type);
    } else {
      return {};
    }
  }

  private tokenize(type: any): any {
    let result: { [key: string]: any } = {};
    for (const p of Object.values(type?.properties ?? {})) {
      const property = p as any;
      if (property.type.primitive === 'boolean') {
        result[property.name] = false;
      } else if (property.type.primitive === 'string') {
        result[property.name] = Token.asString({});
      } else if (property.type.primitive === 'number') {
        result[property.name] = Token.asNumber({});
      } else if (property.type.fqn != null) {
        result[property.name] = this.tokenize(this.types[property.type.fqn]);
        // result[property.name] = Token.asAny({});
      }
    }

    const superTypes = new Set<string>();
    const queue = [...type?.interfaces ?? []];
    while (queue.length > 0) {
      const iface = queue.pop();
      superTypes.add(iface);
      (this.types[iface]?.interfaces ?? []).forEach((i: string) => queue.push(i));
    }

    [...superTypes].forEach((t: any) => {
      if (this.types[t]) {
        result = { ...result, ...this.tokenize(this.types[t]) };
      }
    });

    return result;
  }
}

function splitName(name: string): { moduleName: string; className: string } {
  const sep = name.lastIndexOf('.');
  return {
    moduleName: name.substr(0, sep),
    className: name.substr(sep + 1),
  };
}

/**
 * The test runner. It selects the appropriate construct types to validate and runs the tests,
 * checking the assertions provided by the user.
 */
export class Checker {

  /**
   * Creates a checker from a directory where there is a .jsii file.
   */
  static fromDirectory(dirname: string): Checker {
    const metadata = fs.readJSONSync(path.join(dirname, '../.jsii'));
    return new Checker(metadata.types, metadata.types);
  }

  private readonly types: any;

  constructor(private readonly unfilteredTypes: any, types: any) {
    this.unfilteredTypes = types;
    const asArray = Object.entries(types);
    const filtered = asArray.filter(([_, value]) => this.subjectToValidation(value));
    this.types = Object.fromEntries(filtered);
  }

  private subjectToValidation(type: any): boolean {
    const { moduleName } = splitName(type.fqn);
    return type.kind === 'class' &&
      type.base === '@aws-cdk/core.Construct' || type.base === '@aws-cdk/core.Resource' &&
      !moduleName.startsWith('Cfn') &&
      !type.abstract;
  }

  /**
   * Runs the provided assertion against all applicable construct types.
   */
  assert(assertion: IAssertion): void {
    for (const type of Object.values(this.types)) {
      assertion.assert(new Context(this.unfilteredTypes, type));
    }
  }

  // TODO Think of a way to create more generic filters
  /**
   * A checker that only validates construct types that accept optional properties.
   */
  onlyOptionalProps(): Checker {
    const types: any[] = [];

    for (const t of Object.values(this.types)) {
      const type = t as any;
      if (type.kind === 'class' &&
        inheritsFromCore(type) &&
        type.initializer?.parameters &&
        type.initializer.parameters[2] != null &&
        type.initializer.parameters[2].optional &&
        allOptionalProps(this.types[type.initializer.parameters[2].type.fqn])) {
        types.push(type);
      }
    }

    return new Checker(this.unfilteredTypes, types);


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
}

