export interface SourcePosition {
  filename?: string;
  line: number;
  column: number;
}

export interface LineMapping {
  generatedLine: number;
  source: SourcePosition;
}

export class InoSourceMap {
  private readonly mappings = new Map<number, SourcePosition>();

  add(generatedLine: number, source: SourcePosition): void {
    this.mappings.set(generatedLine, source);
  }

  get(generatedLine: number): SourcePosition | undefined {
    return this.mappings.get(generatedLine);
  }

  toJSON(): LineMapping[] {
    return [...this.mappings].map(([generatedLine, source]) => ({ generatedLine, source }));
  }

  static fromJSON(mappings: LineMapping[]): InoSourceMap {
    const sourceMap = new InoSourceMap();
    for (const mapping of mappings) sourceMap.add(mapping.generatedLine, mapping.source);
    return sourceMap;
  }
}

export interface RemappedDiagnostic {
  generatedLine: number;
  source?: SourcePosition;
}

export function remapGeneratedLine(mappings: LineMapping[], generatedLine: number): RemappedDiagnostic {
  return {
    generatedLine,
    source: InoSourceMap.fromJSON(mappings).get(generatedLine)
  };
}
