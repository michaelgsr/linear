import { Kind, ListTypeNode, NamedTypeNode, NameNode, NonNullTypeNode, VariableDefinitionNode } from "graphql";
import c from "./constants";
import { ApiDefinition } from "./types";

/**
 * Does the operation have optional variables
 */
export function hasOptionalVariable(o: ApiDefinition): boolean {
  return (
    !o.node.variableDefinitions ||
    o.node.variableDefinitions.length === 0 ||
    o.node.variableDefinitions.every(
      v => (o.path.length ? isIdVariable(v) : false) || !isRequiredVariable(v) || v.defaultValue
    )
  );
}

/**
 * Does the operation have a variable that matches the arg
 */
export function hasVariable(o: ApiDefinition, variableName: string): boolean {
  return Boolean(o.node.variableDefinitions?.some(v => v.variable.name.value === variableName));
}

/**
 * Does the operation have a variable other than the arg
 */
export function hasOtherVariable(o: ApiDefinition, variableName: string): boolean {
  return Boolean(o.node.variableDefinitions?.some(v => v.variable.name.value !== variableName));
}

/**
 * Is the variable named id and is it required
 */
export function isIdVariable(v: VariableDefinitionNode): boolean {
  return v.variable.name.value === c.ID_NAME && isRequiredVariable(v);
}

/**
 * Is this variable a non null type
 */
export function isRequiredVariable(v: VariableDefinitionNode): boolean {
  return v.type.kind === Kind.NON_NULL_TYPE;
}

/**
 * Get the string type name from any type node
 */
export function getTypeName(type: string | NameNode | NonNullTypeNode | NamedTypeNode | ListTypeNode): string {
  return typeof type === "string"
    ? type
    : type.kind === Kind.NON_NULL_TYPE
    ? getTypeName(type.type)
    : type.kind === Kind.NAMED_TYPE
    ? getTypeName(type.name)
    : type.kind === Kind.NAME
    ? getTypeName(type.value)
    : type.kind === Kind.LIST_TYPE
    ? getTypeName(type.type)
    : "UNKNOWN_OPERATION_TYPE";
}