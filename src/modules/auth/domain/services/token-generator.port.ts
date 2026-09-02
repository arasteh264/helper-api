export interface TokenPayload {
  userId: string;
  role: string;
}

export interface TokenGenerator {
  generate(payload: TokenPayload): string;
}