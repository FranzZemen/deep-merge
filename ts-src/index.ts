import {isMap, isSet} from 'util/types';

export abstract class Matcher {
  constructor(public name: string = Matcher.name) {
  }

  abstract matches(target: Object, source: Object): boolean;
}

export class GenericMatcher extends Matcher {

  constructor() {
    super(GenericMatcher.name);
  }

  matches(target: Object, source: Object): boolean {
    return target === source;
  }
}


/**
 * Defines an interface to allow to merge custom objects (Objects where simply merging properties is not the desired outcome
 */
export abstract class MergeAble {
  // Provide a name for the factory
  constructor(public name: string = MergeAble.name) {
  }

  // A matching function
  abstract match(sourceProperty: Object): boolean;

  /**
   * Merge a property T from a property object with a property name into the same location in the target object.
   * @param target The target object, for which target[propertyName] may or may not exist. Target is guaranteed to exist
   * @param propertyName Identifies the property name to merge into target.  If property name is undefined, property is the top level property object.
   * @param property The property to merge (property). Property is guaranteed to exist.
   * @param parentObjects The parent objects to the property
   * @param _
   */
  abstract merge(target: Object, property: Object, propertyName: string | number, parentObjects: Object[], _: Merger);
}

/**
 * The default Mergeable for any object
 */
export class GenericObjectMergeAble extends MergeAble {
  constructor() {
    super(GenericObjectMergeAble.name);
  }

  match(sourceValue: Object): boolean {
    return typeof sourceValue === 'object';
  }


  merge(target: Object, property: Object, propertyName: string | number, parentObjects: Object[], _: Merger) {
    // Merge property as a generic object
    if (typeof property === 'function' || typeof property === 'symbol') {
      return target; // Not merging functions
    }
    if (parentObjects.some(parent => parent === property)) {
      return;
    }
    // If propertyName exists we're processing a nested object
    if (propertyName && ((typeof propertyName === 'string' && propertyName.trim().length > 0) || typeof propertyName === 'number')) {
      const nextParentObjects = [].concat(parentObjects);
      nextParentObjects.push(property);
      // Off chance that target is cyclic with property parents or property
      if (nextParentObjects.find(parent => parent === target)) {
        // We return the target and change nothing
      } else if (nextParentObjects.find(parent => parent === target[propertyName])) {
        // Also off chance that target is cyclic with property parents or property
        // We assign the property indiscriminately to the target
        target[propertyName] = property;
      } else {
        this.mergeSourceProperties(target[propertyName], property, nextParentObjects, _);
      }
    } else {
      // We're processing a top level object.  There are no parents.
      // There's a chance target is property, or target[propertyName] is property
      if (target === property) {
        return target;
      }
      // Rename property for sensical logic
      const source = property;
      parentObjects.push(source);
      // Now we iterate on source and merge each property to target's properties of the same name, letting the _
      // do this
      this.mergeSourceProperties(target, source, parentObjects, _);
    }
  }

  /**
   * Here target and source are at the same hierarchical level, unlike merge, where target is one level higher
   * @param target
   * @param source
   * @param parentObjects
   * @param _
   */
  mergeSourceProperties(target: Object, source: Object, parentObjects: Object[], _: Merger) {
    for (const sourcePropertyName in source) {
      const sourceProperty = source[sourcePropertyName];
      if (sourceProperty) {
        if (typeof sourceProperty === 'object') {
          if (parentObjects.find(parent => parent === sourceProperty)) {
            // Cyclic.  Simple assignment
            target[sourcePropertyName] = sourceProperty;
          } else {
            if (target[sourcePropertyName] === undefined) {
              if (Array.isArray(sourceProperty)) {
                target[sourcePropertyName] = [];
              } else if (isSet(sourceProperty)) {
                target[sourcePropertyName] = new Set();
              } else if (isMap(sourceProperty)) {
                target[sourcePropertyName] = new Map();
              } else {
                target[sourcePropertyName] = {};
              }
            }
            const mergeable = _.getMergeable(sourceProperty);
            const sourcePropertyParents = [].concat(parentObjects);
            mergeable.merge(target, sourceProperty, sourcePropertyName, sourcePropertyParents, _);
          }
        } else if (typeof sourceProperty === 'bigint') {
          target[sourcePropertyName] = BigInt(sourceProperty);
        } else {
          // Primitive
          target[sourcePropertyName] = sourceProperty;
        }
      } else {
        // Do nothing, target[sourcePropertyName] remains intact
      }
    }
  }
}

export class ArrayMergeAble extends MergeAble {
  constructor() {
    super(ArrayMergeAble.name);
  }

  match(sourceProperty: Object): boolean {
    return Array.isArray(sourceProperty);
  }

  merge(target: Object, property: Array<any>, propertyName: string | number, parentObjects: Object[], _: Merger) {
    if (parentObjects.some(parent => parent === property)) {
      return;
    }
    const nextParentObjects = [].concat(parentObjects);
    if (parentObjects.some(parent => parent === target)) {
      // We don't want to alter 'self'
      return;
    }
    let targetArray: Object[];
    if (!propertyName) {
      // Top level Arrays
      if (!Array.isArray(target)) {
        throw new Error('Can not merge top level arrays if target is not an array');
      } else {
        targetArray = target;
      }
    } else {
      if (target[propertyName]) {
        if (Array.isArray(target[propertyName])) {
          targetArray = target[propertyName];
          if (nextParentObjects.some(parent => parent === target[propertyName])) {
            // Don't want to overwrite an array in the source
            return;
          }
        } else {
          // Not an array, overwrite it with an empty one
          target[propertyName] = [];
          targetArray = target[propertyName];
        }
      } else {
        target[propertyName] = [];
        targetArray = target[propertyName];
      }
    }
    // Iterate over the source array and merge
    // If all primitives, copy Array over
    if (property.every(element =>
      typeof element === 'string' ||
      typeof element === 'number' ||
      typeof element === 'boolean' ||
      typeof element === 'bigint' ||
      typeof element === 'undefined')) {
      targetArray.splice(0, targetArray.length, ...property);
      return;
    }
    property.forEach(sourceElement => {
      if (sourceElement === undefined || sourceElement === null) {
        return;
      }
      if (nextParentObjects.some(parent => parent === sourceElement)) {
        return;
      }
      if (typeof sourceElement === 'function' && typeof sourceElement === 'symbol') {
        return;
      } else if (typeof sourceElement === 'object') {
        const targetElementNdx = targetArray.findIndex(targetElement => _.matches(targetElement, sourceElement));

        if (targetElementNdx < 0) {
          // If it doesn't match add it
          targetArray.push(sourceElement);
        } else {
          // Merge it
          _.getMergeable(sourceElement).merge(targetArray, sourceElement, targetElementNdx, nextParentObjects, _);
        }
      } else {
        if (!targetArray.some(element => element === sourceElement)) {
          targetArray.push(sourceElement);
        }
      }
    });
  }
}


export class Merger {
  constructor(protected mergeables: MergeAble[] = [], protected matchers: Matcher[] = []) {
    // Determine if the target
    this.addMergeable(new GenericObjectMergeAble());
    this.addMergeable(new ArrayMergeAble());

    this.addMatcher(new GenericMatcher());
  }

  /**
   * Adds at the beginning, so most specific should be added last
   * @param mergeable
   */
  addMergeable(mergeable: MergeAble) {
    this.mergeables.splice(0, 0, mergeable);
  }

  getMergeable(source: Object): MergeAble {
    let result = this.mergeables.find(mergeable => mergeable.match(source));
    return result ? result : new GenericObjectMergeAble();
  }

  addMatcher(matcher: Matcher) {
    this.matchers.splice(0, 0, matcher);
  }

  /**
   * Top level merge
   * @param target
   * @param source
   */
  merge(target: Object, source: Object): Object {
    if (target === source) {
      return target;
    }
    if (!source || typeof source !== 'object') {
      throw new Error('Source undefined or not an object');
    }
    if (!target || typeof target !== 'object') {
      throw new Error('Target undefined or not an object');
    }
    const parentObjects = [source];
    const mergeable = this.getMergeable(source);
    mergeable.merge(target, source, undefined, [], this);
    return target;
  }

  matches(target: Object, source: Object): boolean {
    return this.matchers.some(matcher => matcher.matches(target, source));
  }
}



