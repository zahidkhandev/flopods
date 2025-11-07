export class V1YouTubeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

export class V1YouTubeInvalidURLError extends V1YouTubeError {
  constructor(url: string) {
    super(
      `Invalid YouTube URL: ${url}. Expected formats: youtube.com/watch?v=ID or youtu.be/ID`,
      'INVALID_URL',
      400,
    );
    this.name = 'YouTubeInvalidURLError';
  }
}

export class V1YouTubeVideoNotFoundError extends V1YouTubeError {
  constructor(videoId: string) {
    super(
      `YouTube video not found: ${videoId}. Video may be private, deleted, or removed.`,
      'VIDEO_NOT_FOUND',
      404,
    );
    this.name = 'YouTubeVideoNotFoundError';
  }
}

export class V1YouTubeAccessDeniedError extends V1YouTubeError {
  constructor(reason: string = 'Access denied') {
    super(
      `YouTube access denied: ${reason}. Check OAuth permissions or API quota.`,
      'ACCESS_DENIED',
      403,
    );
    this.name = 'YouTubeAccessDeniedError';
  }
}

export class V1YouTubeQuotaExceededError extends V1YouTubeError {
  constructor() {
    super('YouTube API quota exceeded. Please try again later.', 'QUOTA_EXCEEDED', 429);
    this.name = 'YouTubeQuotaExceededError';
  }
}

export class V1YouTubeAuthenticationError extends V1YouTubeError {
  constructor(message: string = 'Authentication failed') {
    super(
      `YouTube authentication error: ${message}. OAuth token may be invalid or expired.`,
      'AUTHENTICATION_FAILED',
      401,
    );
    this.name = 'YouTubeAuthenticationError';
  }
}

export class V1YouTubeTranscriptNotAvailableError extends V1YouTubeError {
  constructor(videoId: string) {
    super(`No captions or transcript available for video: ${videoId}`, 'NO_TRANSCRIPT', 400);
    this.name = 'YouTubeTranscriptNotAvailableError';
  }
}

export class V1YouTubeProcessingError extends V1YouTubeError {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(`YouTube processing error: ${message}`, 'PROCESSING_ERROR', 500);
    this.name = 'YouTubeProcessingError';
  }
}
