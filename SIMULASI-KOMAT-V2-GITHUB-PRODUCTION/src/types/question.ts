export type OptionId = 'A' | 'B' | 'C' | 'D';
export interface Question {
  readonly id: string;
  readonly originalNumber: number;
  readonly topic: string;
  readonly originalTopic: string;
  readonly statement: string;
  readonly options: readonly [Option, Option, Option, Option];
  readonly mathExpressions: readonly string[];
  readonly cryptarithm: { readonly addends: readonly string[]; readonly sum: string } | null;
  readonly diagram: {
    readonly src: string; readonly caption: string; readonly alt: string;
    readonly sourcePhysicalPage: number;
    readonly cropPixels: readonly [number,number,number,number];
    readonly renderSize: readonly [number,number]; readonly provenance: string;
  } | null;
  readonly source: { readonly physicalPage: number; readonly printedPage: number; readonly originalText: string };
  readonly auditFlags: readonly string[];
}
export interface Option { readonly id: OptionId; readonly text: string }
