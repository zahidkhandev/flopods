export class V1YouTubeInvalidURLError extends Error {
  constructor(url: string) {
    super(`Invalid YouTube URL: ${url}. Expected formats: youtube.com/watch?v=ID or youtu.be/ID`);
    this.name = 'YouTubeInvalidURLError';
  }
}

export class V1YouTubeURLParser {
  static extractVideoId(url: string): string {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
      throw new V1YouTubeInvalidURLError('Empty URL');
    }

    const videoIdPattern = '[a-zA-Z0-9_-]{11}';

    const patterns = [
      new RegExp(`youtube\\.com/watch\\?.*v=(${videoIdPattern})`),
      new RegExp(`youtu\\.be/(${videoIdPattern})`),
      new RegExp(`youtube\\.com/embed/(${videoIdPattern})`),
      new RegExp(`youtube\\.com/v/(${videoIdPattern})`),
      new RegExp(`youtube\\.com/watch\\?[^&]*v=(${videoIdPattern})`),
    ];

    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new V1YouTubeInvalidURLError(normalizedUrl);
  }

  static isValidVideoId(videoId: string): boolean {
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  }

  static getVideoInfoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  static getThumbnailUrl(
    videoId: string,
    quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'high',
  ): string {
    const qualityMap = {
      default: 'default',
      medium: 'mqdefault',
      high: 'hqdefault',
      standard: 'sddefault',
      maxres: 'maxresdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
  }
}
