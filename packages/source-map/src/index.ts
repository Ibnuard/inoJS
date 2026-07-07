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
}
