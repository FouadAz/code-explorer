import { SymbolEntry } from '../types';
import { SymbolTable } from './importResolver';

/**
 * Symbol table implementation.
 * (Re-exported from importResolver for consistency)
 */
export { SymbolTable } from './importResolver';

/**
 * Type resolver for cross-file type references.
 * This is a simplified implementation that could be enhanced
 * with TypeScript compiler API integration for deeper type analysis.
 */
export class TypeResolver {
  constructor(private symbolTable: SymbolTable) {}

  /**
   * Resolve a type reference to its definition.
   */
  resolveType(typeName: string): SymbolEntry[] {
    return this.symbolTable.resolveReference(typeName);
  }

  /**
   * Check if a type name refers to a built-in/primitive type.
   */
  isBuiltInType(typeName: string): boolean {
    const builtIns = [
      'string', 'number', 'boolean', 'void', 'any', 'unknown', 'never',
      'object', 'Object', 'Array', 'Promise', 'Map', 'Set', 'Date',
      'RegExp', 'Error', 'Function', 'Symbol', 'BigInt',
      // Java primitives
      'int', 'long', 'double', 'float', 'char', 'byte', 'short', 'boolean',
      'Integer', 'Long', 'Double', 'Float', 'Character', 'Byte', 'Short', 'Boolean',
      'String', 'List', 'ArrayList', 'HashMap', 'HashSet',
      // Python built-ins
      'str', 'int', 'float', 'bool', 'list', 'dict', 'tuple', 'set',
      'None', 'Any', 'Optional', 'Union', 'List', 'Dict', 'Tuple', 'Set',
    ];

    return builtIns.includes(typeName);
  }

  /**
   * Extract type name from a complex type expression.
   * E.g., "Array<User>" -> "User", "Promise<Response>" -> "Response"
   */
  extractTypeNames(typeExpr: string): string[] {
    const types: string[] = [];

    // Remove generics brackets and extract inner types
    const genericMatch = typeExpr.match(/<([^>]+)>/);
    if (genericMatch) {
      types.push(...this.extractTypeNames(genericMatch[1]));
    }

    // Extract base type
    const baseType = typeExpr.replace(/<[^>]+>/g, '').trim();
    if (baseType && !this.isBuiltInType(baseType)) {
      types.push(baseType);
    }

    return types;
  }
}
