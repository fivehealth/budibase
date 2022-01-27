import { store } from "./index"
import { Helpers } from "@budibase/bbui"

/**
 * Recursively searches for a specific component ID
 */
export const findComponent = (rootComponent, id) => {
  return searchComponentTree(rootComponent, comp => comp._id === id)
}

/**
 * Recursively searches for a specific component type
 */
export const findComponentType = (rootComponent, type) => {
  return searchComponentTree(rootComponent, comp => comp._component === type)
}

/**
 * Recursively searches for the parent component of a specific component ID
 */
export const findComponentParent = (rootComponent, id, parentComponent) => {
  if (!rootComponent || !id) {
    return null
  }
  if (rootComponent._id === id) {
    return parentComponent
  }
  if (!rootComponent._children) {
    return null
  }
  for (const child of rootComponent._children) {
    const childResult = findComponentParent(child, id, rootComponent)
    if (childResult) {
      return childResult
    }
  }
  return null
}

/**
 * Recursively searches for a specific component ID and records the component
 * path to this component
 */
export const findComponentPath = (rootComponent, id, path = []) => {
  if (!rootComponent || !id) {
    return []
  }
  if (rootComponent._id === id) {
    return [...path, rootComponent]
  }
  if (!rootComponent._children) {
    return []
  }
  for (const child of rootComponent._children) {
    const newPath = [...path, rootComponent]
    const childResult = findComponentPath(child, id, newPath)
    if (childResult?.length) {
      return childResult
    }
  }
  return []
}

/**
 * Recurses through the component tree and finds all components which match
 * a certain selector
 */
export const findAllMatchingComponents = (rootComponent, selector) => {
  if (!rootComponent || !selector) {
    return []
  }
  let components = []
  if (rootComponent._children) {
    rootComponent._children.forEach(child => {
      components = [
        ...components,
        ...findAllMatchingComponents(child, selector),
      ]
    })
  }
  if (selector(rootComponent)) {
    components.push(rootComponent)
  }
  return components.reverse()
}

/**
 * Finds the closes parent component which matches certain criteria
 */
export const findClosestMatchingComponent = (
  rootComponent,
  componentId,
  selector
) => {
  if (!selector) {
    return null
  }
  const componentPath = findComponentPath(rootComponent, componentId).reverse()
  for (let component of componentPath) {
    if (selector(component)) {
      return component
    }
  }
  return null
}

/**
 * Recurses through a component tree evaluating a matching function against
 * components until a match is found
 */
const searchComponentTree = (rootComponent, matchComponent) => {
  if (!rootComponent || !matchComponent) {
    return null
  }
  if (matchComponent(rootComponent)) {
    return rootComponent
  }
  if (!rootComponent._children) {
    return null
  }
  for (const child of rootComponent._children) {
    const childResult = searchComponentTree(child, matchComponent)
    if (childResult) {
      return childResult
    }
  }
  return null
}

/**
 * Searches a component's definition for a setting matching a certain predicate.
 * These settings are cached because they cannot change at run time.
 */
let componentSettingCache = {}
export const getComponentSettings = componentType => {
  if (!componentType) {
    return []
  }

  // Ensure whole component name is used
  if (!componentType.startsWith("@budibase")) {
    componentType = `@budibase/standard-components/${componentType}`
  }

  // Check if we have cached this type already
  if (componentSettingCache[componentType]) {
    return componentSettingCache[componentType]
  }

  // Otherwise get the settings and cache them
  const def = store.actions.components.getDefinition(componentType)
  let settings = []
  if (def) {
    settings = def.settings?.filter(setting => !setting.section) ?? []
    def.settings
      ?.filter(setting => setting.section)
      .forEach(section => {
        settings = settings.concat(section.settings || [])
      })
  }
  componentSettingCache[componentType] = settings

  return settings
}

/**
 * Randomizes all ID's of a component tree.
 * @param component the root component of the tree to randomize
 */
export const randomizeIds = component => {
  if (!component) {
    return
  }
  component._id = Helpers.uuid()
  component._children?.forEach(randomizeIds)
}
