// ============================================================================
// Generic type utilities
// ============================================================================

/**
 * Remove first parameter from a single function signature
 */
type OmitFirstParam<F> = F extends (first: any, ...rest: infer R) => infer T
  ? (...args: R) => T
  : never

/**
 * Extract overloads as union (supports up to 20 overloads)
 * TypeScript doesn't provide a way to iterate overloads, so we enumerate them
 */
type OverloadsToUnion<T> =
  T extends {
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
    (...args: infer A3): infer R3
    (...args: infer A4): infer R4
    (...args: infer A5): infer R5
    (...args: infer A6): infer R6
    (...args: infer A7): infer R7
    (...args: infer A8): infer R8
    (...args: infer A9): infer R9
    (...args: infer A10): infer R10
    (...args: infer A11): infer R11
    (...args: infer A12): infer R12
    (...args: infer A13): infer R13
    (...args: infer A14): infer R14
    (...args: infer A15): infer R15
    (...args: infer A16): infer R16
    (...args: infer A17): infer R17
    (...args: infer A18): infer R18
    (...args: infer A19): infer R19
    (...args: infer A20): infer R20
  }
    ? ((...args: A1) => R1) | ((...args: A2) => R2) | ((...args: A3) => R3) | ((...args: A4) => R4) |
      ((...args: A5) => R5) | ((...args: A6) => R6) | ((...args: A7) => R7) | ((...args: A8) => R8) |
      ((...args: A9) => R9) | ((...args: A10) => R10) | ((...args: A11) => R11) | ((...args: A12) => R12) |
      ((...args: A13) => R13) | ((...args: A14) => R14) | ((...args: A15) => R15) | ((...args: A16) => R16) |
      ((...args: A17) => R17) | ((...args: A18) => R18) | ((...args: A19) => R19) | ((...args: A20) => R20)
    : T extends {
        (...args: infer A1): infer R1
        (...args: infer A2): infer R2
        (...args: infer A3): infer R3
        (...args: infer A4): infer R4
        (...args: infer A5): infer R5
        (...args: infer A6): infer R6
        (...args: infer A7): infer R7
        (...args: infer A8): infer R8
        (...args: infer A9): infer R9
        (...args: infer A10): infer R10
      }
      ? ((...args: A1) => R1) | ((...args: A2) => R2) | ((...args: A3) => R3) | ((...args: A4) => R4) |
        ((...args: A5) => R5) | ((...args: A6) => R6) | ((...args: A7) => R7) | ((...args: A8) => R8) |
        ((...args: A9) => R9) | ((...args: A10) => R10)
      : T extends {
          (...args: infer A1): infer R1
          (...args: infer A2): infer R2
          (...args: infer A3): infer R3
          (...args: infer A4): infer R4
          (...args: infer A5): infer R5
        }
        ? ((...args: A1) => R1) | ((...args: A2) => R2) | ((...args: A3) => R3) | ((...args: A4) => R4) |
          ((...args: A5) => R5)
        : T extends (...args: infer A) => infer R
          ? (...args: A) => R
          : never

/**
 * Convert union back to intersection (for overloaded function type)
 */
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

/**
 * Transform all overloads of a function to remove the first parameter
 */
export type OmitFirstFromOverloads<T> = UnionToIntersection<
  OmitFirstParam<OverloadsToUnion<T>>
>
