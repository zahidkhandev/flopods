/**
 * Token estimation utilities
 * Rule of thumb: 1 token ≈ 0.75 words ≈ 4 characters
 */

export class TokenEstimator {
  private static readonly CHARS_PER_TOKEN = 4;
  private static readonly WORDS_PER_TOKEN = 0.75;

  /**
   * Estimate tokens from text (fast approximation)
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;

    // Use character-based estimation (more accurate for mixed content)
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Estimate tokens from word count
   */
  static estimateTokensFromWords(wordCount: number): number {
    return Math.ceil(wordCount / this.WORDS_PER_TOKEN);
  }

  /**
   * Check if adding new text would exceed limit
   */
  static wouldExceedLimit(currentText: string, newText: string, maxTokens: number): boolean {
    const currentTokens = this.estimateTokens(currentText);
    const newTokens = this.estimateTokens(newText);
    return currentTokens + newTokens > maxTokens;
  }

  /**
   * Get safe context window size (leave 20% for response)
   */
  static getSafeContextLimit(modelMaxTokens: number): number {
    return Math.floor(modelMaxTokens * 0.8);
  }
}
