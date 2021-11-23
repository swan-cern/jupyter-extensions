/**
 * File took from https://github.com/jupyterlab/jupyterlab/blob/master/packages/services/src/kernelspec/validate.ts
 * for jupyterlab 3.0.x
 *
 * This allows to validate the kernels specs and to get the ISpecModel.
 * This is required to update the manager.services.kernelspecs.specs object
 * in the SwanFileBrowserModel.
 */
import { PartialJSONObject } from '@lumino/coreutils';

/**
 * Kernel Spec interface.
 *
 * #### Notes
 * See [Kernel specs](https://jupyter-client.readthedocs.io/en/latest/kernels.html#kernelspecs).
 */
export interface ISpecModel extends PartialJSONObject {
  /**
   * The name of the kernel spec.
   */
  readonly name: string;

  /**
   * The name of the language of the kernel.
   */
  readonly language: string;

  /**
   * A list of command line arguments used to start the kernel.
   */
  readonly argv: string[];

  /**
   * The kernel’s name as it should be displayed in the UI.
   */
  readonly display_name: string;

  /**
   * A dictionary of environment variables to set for the kernel.
   */
  readonly env?: PartialJSONObject;

  /**
   * A mapping of resource file name to download path.
   */
  readonly resources: { [key: string]: string };

  /**
   * A dictionary of additional attributes about this kernel; used by clients to aid in kernel selection.
   */
  readonly metadata?: PartialJSONObject;
}

/**
 * The available kernelSpec models.
 *
 * #### Notes
 * See the [Jupyter Notebook API](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/notebook/master/notebook/services/api/api.yaml#!/kernelspecs).
 */
export interface ISpecModels extends PartialJSONObject {
  /**
   * The name of the default kernel spec.
   */
  default: string;

  /**
   * A mapping of kernel spec name to spec.
   */
  readonly kernelspecs: { [key: string]: ISpecModel | undefined };
}

/**
 * Validate a property as being on an object, and optionally
 * of a given type and among a given set of values.
 */
export function validateProperty(
  object: any, // eslint-disable-line @typescript-eslint/explicit-module-boundary-types
  name: string,
  typeName?: string,
  values: any[] = []
): void {
  if (!object.hasOwnProperty(name)) { // eslint-disable-line 
    throw Error(`Missing property '${name}'`);
  }
  const value = object[name];

  if (typeName !== void 0) {
    let valid = true;
    switch (typeName) {
      case 'array':
        valid = Array.isArray(value);
        break;
      case 'object':
        valid = typeof value !== 'undefined';
        break;
      default:
        valid = typeof value === typeName;
    }
    if (!valid) {
      throw new Error(`Property '${name}' is not of type '${typeName}'`);
    }

    if (values.length > 0) {
      let valid = true;
      switch (typeName) {
        case 'string':
        case 'number':
        case 'boolean':
          valid = values.includes(value);
          break;
        default:
          valid = values.findIndex(v => v === value) >= 0;
          break;
      }
      if (!valid) {
        throw new Error(
          `Property '${name}' is not one of the valid values ${JSON.stringify(
            values
          )}`
        );
      }
    }
  }
}

/**
 * Validate a server kernelspec model to a client side model.
 */
export function validateSpecModel(data: any): ISpecModel {  // eslint-disable-line
  const spec = data.spec;
  if (!spec) {
    throw new Error('Invalid kernel spec');
  }
  validateProperty(data, 'name', 'string');
  validateProperty(data, 'resources', 'object');
  validateProperty(spec, 'language', 'string');
  validateProperty(spec, 'display_name', 'string');
  validateProperty(spec, 'argv', 'array');

  let metadata: any = null;
  if (spec.hasOwnProperty('metadata')) { // eslint-disable-line
    validateProperty(spec, 'metadata', 'object');
    metadata = spec.metadata;
  }

  let env: any = null;
  if (spec.hasOwnProperty('env')) { // eslint-disable-line
    validateProperty(spec, 'env', 'object');
    env = spec.env;
  }
  return {
    name: data.name,
    resources: data.resources,
    language: spec.language,
    display_name: spec.display_name,
    argv: spec.argv,
    metadata,
    env
  };
}

/**
 * Validate a `Kernel.ISpecModels` object.
 */
export function validateSpecModels(data: any): ISpecModels { // eslint-disable-line
  if (!data.hasOwnProperty('kernelspecs')) { // eslint-disable-line
    throw new Error('No kernelspecs found');
  }
  let keys = Object.keys(data.kernelspecs);
  const kernelspecs: { [key: string]: ISpecModel } = Object.create(null);
  let defaultSpec = data.default;

  for (let i = 0; i < keys.length; i++) {
    const ks = data.kernelspecs[keys[i]];
    try {
      kernelspecs[keys[i]] = validateSpecModel(ks);
    } catch (err) {
      // Remove the errant kernel spec.
      console.warn(`Removing errant kernel spec: ${keys[i]}`);
    }
  }
  keys = Object.keys(kernelspecs);
  if (!keys.length) {
    throw new Error('No valid kernelspecs found');
  }
  if (
    !defaultSpec ||
    typeof defaultSpec !== 'string' ||
    !(defaultSpec in kernelspecs)
  ) {
    defaultSpec = keys[0];
    console.warn(`Default kernel not found, using '${keys[0]}'`);
  }
  return {
    default: defaultSpec,
    kernelspecs
  };
}
